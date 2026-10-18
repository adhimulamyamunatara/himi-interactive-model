import {
  DEFAULT_TITLE,
  MAX_CONVERSATIONS,
  createId,
  createInitialState,
  generateTitle,
  sanitizeTitle,
  sortConversations
} from './chatConversations.js';
import { DEFAULT_SUBJECT, SUBJECTS } from './subjects.js';

/**
 * Persistence for chat conversations (browser localStorage only; nothing is synced anywhere).
 *
 * Keys
 *   himi.chat.conversations.v1                    current format (this file owns it)
 *   himi.chat.state                               LEGACY single-conversation format: { selectedSubject, messages }
 *   himi.chat.conversations.v1.unreadable_backup  raw copy of a current-format value we could not read
 *
 * Migration (legacy -> v1), run on load, only when the v1 key is absent:
 *   1. Parse the legacy value and keep every well-formed message (timestamps kept when valid).
 *   2. Write the v1 value, flagged `migratedFromLegacy`.
 *   3. Read it back and compare conversation/message counts.
 *   4. Only then remove the legacy key.
 * Because step 1 is skipped whenever the v1 key exists, repeating the migration can never duplicate
 * conversations. If step 4 was interrupted, the flag lets the next load finish removing the legacy key.
 * An unreadable legacy value is left untouched (never deleted) and reported as an issue.
 *
 * This module never reads or writes the user, quiz or study-planner keys.
 */

export const CHAT_STORAGE_KEY = 'himi.chat.conversations.v1';
export const LEGACY_CHAT_STORAGE_KEY = 'himi.chat.state';
export const CHAT_BACKUP_KEY = 'himi.chat.conversations.v1.unreadable_backup';
export const CHAT_STORAGE_VERSION = 1;

const MAX_STORED_MESSAGES_PER_CONVERSATION = 2000;

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidIso(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

/** Return `id` when it is a usable, unseen string id; otherwise a fresh one. */
function uniqueId(id, seen) {
  const candidate = typeof id === 'string' && id.trim() ? id : createId();
  let next = candidate;

  while (seen.has(next)) {
    next = createId();
  }

  seen.add(next);
  return next;
}

/**
 * Keep only well-formed messages, preserving the message contract
 * (id, role, content, timestamp, subject, error). Duplicate ids get fresh ids so React keys stay unique.
 *
 * @returns {{messages: object[], dropped: number}}
 */
export function parseMessages(value, fallbackTimestamp, fallbackSubject) {
  if (!Array.isArray(value)) {
    return { messages: [], dropped: 0 };
  }

  const seen = new Set();
  const messages = [];
  let dropped = 0;

  for (const raw of value.slice(0, MAX_STORED_MESSAGES_PER_CONVERSATION)) {
    const valid =
      isRecord(raw) &&
      (raw.role === 'user' || raw.role === 'assistant') &&
      typeof raw.content === 'string';

    if (!valid) {
      dropped += 1;
      continue;
    }

    messages.push({
      id: uniqueId(raw.id, seen),
      role: raw.role,
      content: raw.content,
      timestamp: isValidIso(raw.timestamp) ? raw.timestamp : fallbackTimestamp,
      subject: SUBJECTS.includes(raw.subject) ? raw.subject : fallbackSubject,
      ...(raw.error === true ? { error: true } : {})
    });
  }

  dropped += Math.max(0, value.length - MAX_STORED_MESSAGES_PER_CONVERSATION);
  return { messages, dropped };
}

/** @returns {{conversation: object | null, dropped: number}} */
function parseConversation(raw, seenIds, now) {
  if (!isRecord(raw)) {
    return { conversation: null, dropped: 1 };
  }

  const subject = SUBJECTS.includes(raw.subject) ? raw.subject : DEFAULT_SUBJECT;
  const createdAt = isValidIso(raw.createdAt) ? raw.createdAt : now;
  const { messages, dropped } = parseMessages(raw.messages, createdAt, subject);
  const lastTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : createdAt;
  const manualTitle = raw.titleSource === 'manual' ? sanitizeTitle(raw.title) : '';
  const firstQuestion = messages.find((message) => message.role === 'user');
  const storedTitle = sanitizeTitle(raw.title);

  return {
    dropped,
    conversation: {
      id: uniqueId(raw.id, seenIds),
      title: manualTitle || storedTitle || (firstQuestion ? generateTitle(firstQuestion.content, subject) : DEFAULT_TITLE),
      titleSource: manualTitle ? 'manual' : 'auto',
      subject,
      createdAt,
      updatedAt: isValidIso(raw.updatedAt) ? raw.updatedAt : lastTimestamp,
      messages
    }
  };
}

/**
 * Validate a decoded v1 value.
 *
 * @returns {{state: object, dropped: number, migratedFromLegacy: boolean} | null} null when unusable.
 */
export function parseStoredState(value, now = new Date().toISOString()) {
  if (!isRecord(value) || !Array.isArray(value.conversations)) {
    return null;
  }

  const seenIds = new Set();
  let dropped = 0;
  const conversations = [];

  for (const raw of value.conversations.slice(0, MAX_CONVERSATIONS)) {
    const result = parseConversation(raw, seenIds, now);
    dropped += result.dropped;

    if (result.conversation) {
      conversations.push(result.conversation);
    }
  }

  dropped += Math.max(0, value.conversations.length - MAX_CONVERSATIONS);
  const sorted = sortConversations(conversations);
  const activeConversationId = sorted.some((conversation) => conversation.id === value.activeConversationId)
    ? value.activeConversationId
    : null;

  return {
    dropped,
    migratedFromLegacy: value.migratedFromLegacy === true,
    state: {
      conversations: sorted,
      activeConversationId,
      draftSubject: SUBJECTS.includes(value.draftSubject) ? value.draftSubject : DEFAULT_SUBJECT
    }
  };
}

/**
 * Turn the legacy `{ selectedSubject, messages }` value into a state with (at most) one conversation.
 *
 * @returns {{state: object, dropped: number} | null} null when the value is not a usable legacy object.
 */
export function migrateLegacyValue(value, now = new Date().toISOString()) {
  if (!isRecord(value)) {
    return null;
  }

  const subject = SUBJECTS.includes(value.selectedSubject) ? value.selectedSubject : DEFAULT_SUBJECT;
  const { messages, dropped } = parseMessages(value.messages, now, subject);

  if (messages.length === 0) {
    return { state: createInitialState(subject), dropped };
  }

  const firstQuestion = messages.find((message) => message.role === 'user');
  const createdAt = messages[0].timestamp;
  const conversation = {
    id: createId(),
    title: firstQuestion ? generateTitle(firstQuestion.content, subject) : DEFAULT_TITLE,
    titleSource: 'auto',
    subject,
    createdAt,
    updatedAt: messages[messages.length - 1].timestamp,
    messages
  };

  return { state: { conversations: [conversation], activeConversationId: conversation.id, draftSubject: subject }, dropped };
}

/** Serialisable form of the state. */
export function serializeState(state, { migratedFromLegacy = false } = {}) {
  return JSON.stringify({
    version: CHAT_STORAGE_VERSION,
    activeConversationId: state.activeConversationId,
    draftSubject: state.draftSubject,
    ...(migratedFromLegacy ? { migratedFromLegacy: true } : {}),
    conversations: state.conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      titleSource: conversation.titleSource,
      subject: conversation.subject,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages
    }))
  });
}

function countMessages(state) {
  return state.conversations.reduce((total, conversation) => total + conversation.messages.length, 0);
}

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return undefined; // storage itself is unavailable
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function tryParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * Load the chat state, migrating legacy history when needed. Never throws.
 *
 * `issue` is null or one of:
 *   { type: 'unavailable' }                    storage cannot be used; chats live in memory only
 *   { type: 'unreadable' }                     the saved chats could not be read (a raw copy is kept in a backup key)
 *   { type: 'unsupported' }                    the saved chats were written by a newer version of HIMI
 *   { type: 'partial', dropped }               some damaged messages/conversations were skipped
 *   { type: 'legacy-unreadable' }              the old history could not be recovered (it was left untouched)
 *   { type: 'legacy-partial', dropped }        the old history was migrated, minus damaged messages
 *
 * @returns {{state: object, issue: object | null, migrated: boolean, migratedFromLegacy: boolean}}
 */
export function loadChatState(storage = getDefaultStorage(), now = new Date().toISOString()) {
  const fresh = (issue = null, extra = {}) => ({
    state: createInitialState(),
    issue,
    migrated: false,
    migratedFromLegacy: false,
    ...extra
  });

  if (!storage) {
    return fresh({ type: 'unavailable' });
  }

  const current = safeGet(storage, CHAT_STORAGE_KEY);

  if (current === undefined) {
    return fresh({ type: 'unavailable' });
  }

  // ---- Current format --------------------------------------------------------------------
  if (current !== null) {
    const decoded = tryParse(current);

    if (!decoded.ok || !isRecord(decoded.value) || !Array.isArray(decoded.value.conversations)) {
      safeSet(storage, CHAT_BACKUP_KEY, current);
      return fresh({ type: 'unreadable' });
    }

    if (decoded.value.version !== CHAT_STORAGE_VERSION) {
      safeSet(storage, CHAT_BACKUP_KEY, current);
      return fresh({ type: 'unsupported' });
    }

    const parsed = parseStoredState(decoded.value, now);

    // Finish a migration whose last step (removing the legacy key) was interrupted.
    if (parsed.migratedFromLegacy && safeGet(storage, LEGACY_CHAT_STORAGE_KEY) !== null) {
      safeRemove(storage, LEGACY_CHAT_STORAGE_KEY);
    }

    return {
      state: parsed.state,
      issue: parsed.dropped > 0 ? { type: 'partial', dropped: parsed.dropped } : null,
      migrated: false,
      migratedFromLegacy: parsed.migratedFromLegacy
    };
  }

  // ---- Legacy format ----------------------------------------------------------------------
  const legacyRaw = safeGet(storage, LEGACY_CHAT_STORAGE_KEY);

  if (legacyRaw === null || legacyRaw === undefined) {
    return fresh();
  }

  const decoded = tryParse(legacyRaw);
  const migration = decoded.ok ? migrateLegacyValue(decoded.value, now) : null;

  if (!migration) {
    // Leave the old value exactly as it is: it is the only copy.
    return fresh({ type: 'legacy-unreadable' });
  }

  const issue = migration.dropped > 0 ? { type: 'legacy-partial', dropped: migration.dropped } : null;

  if (migration.state.conversations.length === 0) {
    // Nothing to carry over (an empty or message-less legacy value): keep only the subject choice,
    // and drop the legacy key once that has been stored.
    if (saveChatState(migration.state, storage, { migratedFromLegacy: true })) {
      safeRemove(storage, LEGACY_CHAT_STORAGE_KEY);
    }

    return { state: migration.state, issue, migrated: true, migratedFromLegacy: true };
  }

  const serialized = serializeState(migration.state, { migratedFromLegacy: true });
  const written = safeSet(storage, CHAT_STORAGE_KEY, serialized);
  const readBack = written ? parseStoredState(tryParse(safeGet(storage, CHAT_STORAGE_KEY)).value, now) : null;
  const verified =
    readBack !== null &&
    readBack.state.conversations.length === migration.state.conversations.length &&
    countMessages(readBack.state) === countMessages(migration.state);

  if (verified) {
    safeRemove(storage, LEGACY_CHAT_STORAGE_KEY);
  }

  // Even if it could not be verified the history is shown from memory, and the legacy key is kept.
  return { state: migration.state, issue, migrated: true, migratedFromLegacy: true };
}

/**
 * Save the state. An empty default state removes the key instead of storing a blank record.
 *
 * @returns {boolean} true when the write (or removal) succeeded.
 */
export function saveChatState(state, storage = getDefaultStorage(), { migratedFromLegacy = false } = {}) {
  if (!storage) {
    return false;
  }

  if (state.conversations.length === 0 && state.draftSubject === DEFAULT_SUBJECT) {
    return safeRemove(storage, CHAT_STORAGE_KEY);
  }

  return safeSet(storage, CHAT_STORAGE_KEY, serializeState(state, { migratedFromLegacy }));
}

/** Remove every chat key (used when the student signs out). Other keys are never touched. */
export function clearChatStorage(storage = getDefaultStorage()) {
  if (!storage) {
    return false;
  }

  return [CHAT_STORAGE_KEY, LEGACY_CHAT_STORAGE_KEY, CHAT_BACKUP_KEY].map((key) => safeRemove(storage, key)).every(Boolean);
}
