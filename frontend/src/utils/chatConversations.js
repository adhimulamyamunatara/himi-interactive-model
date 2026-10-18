import { DEFAULT_SUBJECT, SUBJECTS } from './subjects.js';

/**
 * Pure, immutable operations on the chat state. Nothing here touches React, storage or the network,
 * so every rule (ownership, ordering, titles) can be unit tested.
 *
 * State shape:
 *   {
 *     conversations: Conversation[],      // always sorted by `updatedAt`, most recent first
 *     activeConversationId: string | null, // null = a blank "new chat" draft (nothing is stored until the first message)
 *     draftSubject: string                 // subject used by the draft
 *   }
 *
 * Conversation:
 *   { id, title, titleSource: 'auto' | 'manual', subject, createdAt, updatedAt, messages: ChatMessage[] }
 *
 * Every operation returns the *same* state object when it changes nothing, so callers can cheaply detect no-ops.
 */

export const MAX_TITLE_LENGTH = 60;
export const MAX_MANUAL_TITLE_LENGTH = 80;
export const MAX_CONVERSATIONS = 50;
export const DEFAULT_TITLE = 'New chat';

const EMPTY_MESSAGES = Object.freeze([]);

export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createInitialState(subject = DEFAULT_SUBJECT) {
  return {
    conversations: [],
    activeConversationId: null,
    draftSubject: SUBJECTS.includes(subject) ? subject : DEFAULT_SUBJECT
  };
}

// ---------------------------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Collapse whitespace/control characters into single spaces. */
function tidy(text) {
  return String(text ?? '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, limit) {
  if (text.length <= limit) {
    return text;
  }

  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  // Prefer a word boundary, unless that would throw away most of the title.
  const clean = lastSpace >= limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${clean.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

// Conversational openers that add nothing to a title ("Explain DBMS normalization" -> "DBMS normalization").
const LEADING_FILLER = [
  /^(?:hi|hello|hey)[\s,!.]+(?=\S)/i,
  /^(?:please|kindly)\s+/i,
  /^(?:can|could|would|will)\s+you\s+(?:please\s+)?/i,
  /^i\s+(?:want|need)\s+(?:you\s+)?to\s+/i,
  /^i\s+(?:want|need)\s+(?:to\s+)?(?:know|understand|learn)(?:\s+about)?\s+/i,
  /^help\s+me\s+(?:to\s+)?(?:understand|learn)\s+/i,
  /^(?:explain|describe|define|summari[sz]e|teach\s+me|tell\s+me\s+about|what\s+do\s+you\s+mean\s+by|what\s+is|what\s+are|what's|whats)\s+/i
];
const LEADING_ARTICLE = /^(?:the|an|a)\s+/i;

/**
 * Deterministic, local conversation title from the first user message.
 *
 * @param {string} content First user message.
 * @param {string} [subject] Fallback when the message gives nothing usable.
 * @returns {string} A non-empty, single-line title of at most MAX_TITLE_LENGTH characters.
 */
export function generateTitle(content, subject) {
  const fallback = subject ? `${subject} chat` : DEFAULT_TITLE;
  // Code blocks make terrible titles; drop them before looking at the text.
  const original = tidy(
    String(content ?? '')
      .replace(/```[\s\S]*?(?:```|$)/g, ' ')
      .replace(/`+|\*\*/g, '')
      .replace(/^[\s#>*~-]+/, '')
  );

  if (!original) {
    return fallback;
  }

  let title = original;
  let stripped = true;

  // Peel openers repeatedly ("Hi, can you explain ...").
  while (stripped) {
    stripped = false;

    for (const pattern of LEADING_FILLER) {
      const next = title.replace(pattern, '');

      if (next !== title && next.length > 0) {
        title = next;
        stripped = true;
      }
    }
  }

  title = title.replace(LEADING_ARTICLE, '').replace(/[\s?!.,:;]+$/, '').trim();

  // If stripping left almost nothing, the original wording is a better title.
  if (title.length < 3) {
    title = original.replace(/[\s?!.,:;]+$/, '').trim();
  }

  if (!title) {
    return fallback;
  }

  title = title.charAt(0).toUpperCase() + title.slice(1);
  return truncate(title, MAX_TITLE_LENGTH);
}

/**
 * Clean a user-entered title. Returns '' when nothing usable remains.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeTitle(raw) {
  if (typeof raw !== 'string') {
    return '';
  }

  return tidy(raw).slice(0, MAX_MANUAL_TITLE_LENGTH).trim();
}

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

export function findConversation(state, id) {
  return state.conversations.find((conversation) => conversation.id === id) ?? null;
}

export function getActiveConversation(state) {
  return state.activeConversationId ? findConversation(state, state.activeConversationId) : null;
}

export function getSelectedSubject(state) {
  return getActiveConversation(state)?.subject ?? state.draftSubject;
}

export function getActiveMessages(state) {
  return getActiveConversation(state)?.messages ?? EMPTY_MESSAGES;
}

/** Every message across all conversations, oldest first (used for dashboard statistics). */
export function getAllMessages(state) {
  return state.conversations
    .flatMap((conversation) => conversation.messages)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/** Conversations that actually contain messages, most recently active first. */
export function getRecentConversations(state, limit = 5) {
  return state.conversations.filter((conversation) => conversation.messages.length > 0).slice(0, limit);
}

export function canCreateConversation(state) {
  return state.conversations.length < MAX_CONVERSATIONS;
}

// ---------------------------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------------------------

function replaceConversation(state, id, update) {
  let changed = false;
  const conversations = state.conversations.map((conversation) => {
    if (conversation.id !== id) {
      return conversation;
    }

    const next = update(conversation);
    changed = next !== conversation;
    return next;
  });

  return changed ? { ...state, conversations } : state;
}

/** Move a conversation to the front (most recent). Stable for the others. */
function bringToFront(state, id) {
  const index = state.conversations.findIndex((conversation) => conversation.id === id);

  if (index <= 0) {
    return state;
  }

  const conversations = [...state.conversations];
  const [moved] = conversations.splice(index, 1);
  return { ...state, conversations: [moved, ...conversations] };
}

/** Sort by last activity, most recent first, keeping the existing order for ties. */
export function sortConversations(conversations) {
  return conversations
    .map((conversation, index) => ({ conversation, index }))
    .sort((a, b) => {
      const diff = new Date(b.conversation.updatedAt) - new Date(a.conversation.updatedAt);
      return Number.isNaN(diff) || diff === 0 ? a.index - b.index : diff;
    })
    .map(({ conversation }) => conversation);
}

/**
 * Leave the current conversation and show a blank draft. Nothing is stored until a message is sent,
 * so repeated "New chat" clicks can never pile up empty conversations.
 */
export function startDraft(state, subject) {
  const draftSubject = SUBJECTS.includes(subject) ? subject : getSelectedSubject(state);

  if (state.activeConversationId === null && state.draftSubject === draftSubject) {
    return state;
  }

  return { ...state, activeConversationId: null, draftSubject };
}

export function selectConversation(state, id) {
  if (state.activeConversationId === id || !findConversation(state, id)) {
    return state;
  }

  return { ...state, activeConversationId: id };
}

/** Change the subject of the open conversation, or of the draft when none is open. */
export function setSubject(state, subject) {
  if (!SUBJECTS.includes(subject)) {
    return state;
  }

  const active = getActiveConversation(state);

  if (!active) {
    return state.draftSubject === subject ? state : { ...state, draftSubject: subject };
  }

  return replaceConversation(state, active.id, (conversation) =>
    conversation.subject === subject ? conversation : { ...conversation, subject }
  );
}

/**
 * Create a conversation holding its first message and open it.
 *
 * @param {object} state
 * @param {{id: string, subject: string, message: object, now: string}} params
 */
export function createConversationWithMessage(state, { id, subject, message, now }) {
  if (findConversation(state, id)) {
    return state;
  }

  const conversation = {
    id,
    title: message.role === 'user' ? generateTitle(message.content, subject) : DEFAULT_TITLE,
    titleSource: 'auto',
    subject,
    createdAt: now,
    updatedAt: now,
    messages: [message]
  };

  return { ...state, conversations: [conversation, ...state.conversations], activeConversationId: id };
}

/**
 * Append a message to a *specific* conversation.
 *
 * If that conversation no longer exists (for example it was deleted while a reply was on its way) the
 * state is returned unchanged, so a late response can never resurrect or leak into another conversation.
 */
export function appendMessage(state, conversationId, message, now) {
  const next = replaceConversation(state, conversationId, (conversation) => {
    // The first user message names the conversation, unless the student already renamed it.
    const isFirstUserMessage =
      message.role === 'user' && conversation.titleSource === 'auto' && conversation.messages.length === 0;

    return {
      ...conversation,
      title: isFirstUserMessage ? generateTitle(message.content, conversation.subject) : conversation.title,
      updatedAt: now,
      messages: [...conversation.messages, message]
    };
  });

  return next === state ? state : bringToFront(next, conversationId);
}

export function updateMessage(state, conversationId, messageId, updates) {
  return replaceConversation(state, conversationId, (conversation) => {
    if (!conversation.messages.some((message) => message.id === messageId)) {
      return conversation;
    }

    return {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? { ...message, ...updates, id: message.id } : message
      )
    };
  });
}

export function removeMessage(state, conversationId, messageId) {
  return replaceConversation(state, conversationId, (conversation) => {
    if (!conversation.messages.some((message) => message.id === messageId)) {
      return conversation;
    }

    return { ...conversation, messages: conversation.messages.filter((message) => message.id !== messageId) };
  });
}

/** Rename keeps the activity order unchanged and pins the title (it is never auto-generated again). */
export function renameConversation(state, id, rawTitle) {
  const title = sanitizeTitle(rawTitle);

  if (!title) {
    return state;
  }

  return replaceConversation(state, id, (conversation) =>
    conversation.title === title && conversation.titleSource === 'manual'
      ? conversation
      : { ...conversation, title, titleSource: 'manual' }
  );
}

/** Delete one conversation. If it was open, fall back to a blank draft (never to another chat's messages). */
export function deleteConversation(state, id) {
  const target = findConversation(state, id);

  if (!target) {
    return state;
  }

  return {
    conversations: state.conversations.filter((conversation) => conversation.id !== id),
    activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    draftSubject: state.activeConversationId === id ? target.subject : state.draftSubject
  };
}

/** Remove the messages of one conversation. The record and its title stay. */
export function clearConversationMessages(state, id) {
  return replaceConversation(state, id, (conversation) =>
    conversation.messages.length === 0 ? conversation : { ...conversation, messages: [] }
  );
}
