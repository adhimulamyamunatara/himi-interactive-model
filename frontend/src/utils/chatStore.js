import { createMessage } from './messageModel.js';
import {
  appendMessage,
  canCreateConversation,
  clearConversationMessages,
  createConversationWithMessage,
  createId,
  createInitialState,
  deleteConversation,
  findConversation,
  getActiveConversation,
  getSelectedSubject,
  removeMessage,
  renameConversation,
  selectConversation,
  setSubject,
  startDraft
} from './chatConversations.js';
import { clearChatStorage, loadChatState, saveChatState } from './chatStorage.js';

export const CHAT_ERROR_MESSAGE = "I couldn't process that request. Please try again.";

/**
 * Framework-free chat controller.
 *
 * It owns the conversation state, persistence and every in-flight AI request, so the tricky rules can be
 * tested without React:
 *
 *  - State lives in a ref-like variable and is updated synchronously, so handlers never read a stale closure.
 *  - Each request is bound to the id of the conversation that started it. Replies are appended *by id*:
 *    if that conversation was deleted meanwhile the append is a no-op, so nothing is resurrected or leaked
 *    into the conversation that happens to be open.
 *  - Requests are tracked per conversation, so one slow reply never blocks switching or other conversations,
 *    but the same conversation can never have two requests at once.
 *  - Deleting or clearing a conversation aborts its request; an aborted request is silent (no error bubble).
 *
 * Notifications go through `setNotifier` (the React layer turns them into toasts):
 *   { type: 'reply-failed', conversationId, title, active }
 *   { type: 'limit-reached' }
 *   { type: 'storage-failed' }   (at most once)
 *
 * @param {object} options
 * @param {(payload: {message: string, subject: string, userName: string}, config: {signal: AbortSignal}) => Promise<any>} options.sendChat
 * @param {Storage | null} [options.storage]
 * @param {() => string} [options.now] ISO timestamp factory (injectable for tests).
 */
export function createChatStore({ sendChat, storage, now = () => new Date().toISOString() }) {
  const resolvedStorage = storage === undefined ? (typeof window === 'undefined' ? null : window.localStorage) : storage;
  const loaded = loadChatState(resolvedStorage, now());

  let state = loaded.state;
  let migratedFromLegacy = loaded.migratedFromLegacy;
  let loadIssue = loaded.issue;
  let userName = 'Student';
  let notifier = () => {};
  let storageFailureReported = false;

  const controllers = new Map(); // conversationId -> AbortController of its in-flight request
  const listeners = new Set();
  let snapshot = buildSnapshot();

  function buildSnapshot() {
    return { state, pendingIds: [...controllers.keys()], loadIssue };
  }

  function emit() {
    snapshot = buildSnapshot();
    listeners.forEach((listener) => listener());
  }

  function persist() {
    const ok = saveChatState(state, resolvedStorage, { migratedFromLegacy });

    if (!ok && !storageFailureReported && resolvedStorage) {
      storageFailureReported = true;
      notifier({ type: 'storage-failed' });
    }
  }

  /** Apply a pure state transition, persist and notify, but only when something actually changed. */
  function commit(transition) {
    const next = transition(state);

    if (next === state) {
      return false;
    }

    state = next;
    persist();
    emit();
    return true;
  }

  function abortRequest(conversationId) {
    const controller = controllers.get(conversationId);

    if (controller) {
      controller.abort();
      controllers.delete(conversationId);
    }
  }

  async function requestReply(conversationId, content, subject) {
    const controller = new AbortController();
    controllers.set(conversationId, controller);
    emit();

    const finish = () => {
      // Only release the slot if it still belongs to *this* request (a delete may have replaced it).
      if (controllers.get(conversationId) === controller) {
        controllers.delete(conversationId);
        emit();
      }
    };

    try {
      const data = await sendChat({ message: content, subject, userName }, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      if (data?.status !== 'success' || !data.response) {
        throw new Error('The AI service did not return a successful response.');
      }

      const reply = createMessage({ role: 'assistant', content: data.response, subject });
      commit((current) => appendMessage(current, conversationId, reply, now()));
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      const failure = createMessage({ role: 'assistant', content: CHAT_ERROR_MESSAGE, subject, error: true });
      const appended = commit((current) => appendMessage(current, conversationId, failure, now()));
      const conversation = findConversation(state, conversationId);

      if (appended && conversation) {
        notifier({
          type: 'reply-failed',
          conversationId,
          title: conversation.title,
          active: state.activeConversationId === conversationId
        });
      }
    } finally {
      finish();
    }
  }

  return {
    // ---- subscription (useSyncExternalStore) -----------------------------------------------
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,

    setNotifier(next) {
      notifier = next ?? (() => {});
    },
    setUserName(name) {
      userName = name || 'Student';
    },
    dismissLoadIssue() {
      if (loadIssue) {
        loadIssue = null;
        emit();
      }
    },

    isPending: (conversationId) => controllers.has(conversationId),

    // ---- conversation management -----------------------------------------------------------
    /** Start a blank chat. The conversation is only created once the first message is sent. */
    startNewConversation(subject) {
      commit((current) => startDraft(current, subject));
    },
    selectConversation(id) {
      commit((current) => selectConversation(current, id));
    },
    renameConversation(id, title) {
      return commit((current) => renameConversation(current, id, title));
    },
    deleteConversation(id) {
      abortRequest(id);
      const changed = commit((current) => deleteConversation(current, id));
      emit(); // the pending set may have changed even when nothing else did
      return changed;
    },
    /** Remove the messages of one conversation; its record and title stay. */
    clearConversation(id) {
      abortRequest(id);
      const changed = commit((current) => clearConversationMessages(current, id));
      emit();
      return changed;
    },
    /** Remove every conversation and every stored chat key (sign out). */
    clearAll() {
      [...controllers.keys()].forEach(abortRequest);
      state = createInitialState();
      migratedFromLegacy = false;
      loadIssue = null;
      clearChatStorage(resolvedStorage);
      emit();
    },
    setSubject(subject) {
      commit((current) => setSubject(current, subject));
    },

    // ---- messaging ------------------------------------------------------------------------
    /**
     * Send a message in the open conversation (creating it on the first message).
     * @returns {Promise<boolean>} false when nothing was sent.
     */
    async sendMessage(content) {
      const trimmed = typeof content === 'string' ? content.trim() : '';

      if (!trimmed) {
        return false;
      }

      const active = getActiveConversation(state);

      if (active && controllers.has(active.id)) {
        return false;
      }

      if (!active && !canCreateConversation(state)) {
        notifier({ type: 'limit-reached' });
        return false;
      }

      const subject = getSelectedSubject(state);
      const message = createMessage({ role: 'user', content: trimmed, subject });
      const conversationId = active?.id ?? createId();

      if (active) {
        commit((current) => appendMessage(current, conversationId, message, now()));
      } else {
        commit((current) => createConversationWithMessage(current, { id: conversationId, subject, message, now: now() }));
      }

      await requestReply(conversationId, trimmed, subject);
      return true;
    },

    /** Re-send the question that preceded a failed assistant message of the given conversation. */
    async retryMessage(conversationId, errorMessageId) {
      const conversation = findConversation(state, conversationId);

      if (!conversation || controllers.has(conversationId)) {
        return false;
      }

      const errorIndex = conversation.messages.findIndex((message) => message.id === errorMessageId);

      if (errorIndex < 0) {
        return false;
      }

      const question = conversation.messages
        .slice(0, errorIndex)
        .reverse()
        .find((message) => message.role === 'user');

      if (!question) {
        return false;
      }

      commit((current) => removeMessage(current, conversationId, errorMessageId));
      await requestReply(conversationId, question.content, question.subject);
      return true;
    }
  };
}
