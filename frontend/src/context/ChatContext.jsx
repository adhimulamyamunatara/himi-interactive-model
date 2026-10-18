import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { sendChatMessage } from '../services/chatService';
import {
  MAX_CONVERSATIONS,
  getActiveConversation,
  getActiveMessages,
  getAllMessages,
  getSelectedSubject
} from '../utils/chatConversations';
import { CHAT_ERROR_MESSAGE, createChatStore } from '../utils/chatStore';
import { useToast } from './ToastContext';
import { useUser } from './UserContext';

export { CHAT_ERROR_MESSAGE };

const ChatContext = createContext(null);

/**
 * React binding for the chat store (`utils/chatStore.js`), which holds all conversation logic.
 *
 * Conversations are saved in this browser only (localStorage); nothing is synced to a server or other devices.
 *
 * Backwards compatible fields: `messages` (the open conversation's messages), `selectedSubject`,
 * `setSelectedSubject`, `sendMessage`, `retryMessage`, `loading`. `clearConversation` was replaced by the
 * explicit `clearActiveConversation` and `clearAllConversations` (used when signing out).
 */
export function ChatProvider({ children }) {
  const { user } = useUser();
  const toast = useToast();
  const [store] = useState(() => createChatStore({ sendChat: sendChatMessage }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { state, pendingIds, loadIssue } = snapshot;
  const userName = user?.name ?? 'Student';

  useEffect(() => {
    store.setUserName(userName);
  }, [store, userName]);

  useEffect(() => {
    store.setNotifier((notice) => {
      if (notice.type === 'reply-failed') {
        toast.error(
          'Message failed',
          notice.active
            ? 'HIMI could not get a reply right now. You can retry the message.'
            : `HIMI could not reply in "${notice.title}". Open it to retry the message.`
        );
      } else if (notice.type === 'limit-reached') {
        toast.error('Too many chats', `You can keep up to ${MAX_CONVERSATIONS} chats. Delete one to start another.`);
      } else if (notice.type === 'storage-failed') {
        toast.error('Chats not saved', 'Your browser would not store chat history, so it may be lost on refresh.');
      }
    });

    return () => store.setNotifier(null);
  }, [store, toast]);

  const activeConversation = getActiveConversation(state);
  const activeConversationId = activeConversation?.id ?? null;
  const messages = getActiveMessages(state);
  const selectedSubject = getSelectedSubject(state);
  const loading = activeConversationId !== null && pendingIds.includes(activeConversationId);
  const allMessages = useMemo(() => getAllMessages(state), [state]);

  const retryMessage = useCallback(
    (errorMessageId) => {
      const { activeConversationId: openId } = store.getSnapshot().state;
      return openId ? store.retryMessage(openId, errorMessageId) : Promise.resolve(false);
    },
    [store]
  );

  const clearActiveConversation = useCallback(() => {
    const { activeConversationId: openId } = store.getSnapshot().state;
    return openId ? store.clearConversation(openId) : false;
  }, [store]);

  const value = useMemo(
    () => ({
      conversations: state.conversations,
      activeConversationId,
      activeConversation,
      pendingConversationIds: pendingIds,
      messages,
      allMessages,
      selectedSubject,
      loading,
      loadIssue,
      maxConversations: MAX_CONVERSATIONS,
      sendMessage: store.sendMessage,
      retryMessage,
      setSelectedSubject: store.setSubject,
      /** Start a blank chat; the conversation is created when its first message is sent. */
      createConversation: store.startNewConversation,
      selectConversation: store.selectConversation,
      renameConversation: store.renameConversation,
      deleteConversation: store.deleteConversation,
      clearActiveConversation,
      clearAllConversations: store.clearAll,
      dismissLoadIssue: store.dismissLoadIssue
    }),
    [
      activeConversation,
      activeConversationId,
      allMessages,
      clearActiveConversation,
      loadIssue,
      loading,
      messages,
      pendingIds,
      retryMessage,
      selectedSubject,
      state.conversations,
      store
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }

  return context;
}
