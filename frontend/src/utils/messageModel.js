/**
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {'user' | 'assistant'} role
 * @property {string} content
 * @property {string} timestamp ISO-8601 string.
 * @property {string} subject
 * @property {boolean} [error] True when the assistant could not produce a reply.
 */

/**
 * Create a normalized chat message.
 *
 * @param {object} params
 * @param {'user' | 'assistant'} params.role
 * @param {string} params.content
 * @param {string} params.subject
 * @param {boolean} [params.error]
 * @returns {ChatMessage}
 */
export function createMessage({ role, content, subject, error = false }) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    subject,
    ...(error ? { error: true } : {})
  };
}

/**
 * Keep only well-formed messages (protects against corrupted local storage).
 *
 * @param {unknown} value
 * @returns {ChatMessage[]}
 */
export function sanitizeMessages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (message) =>
      message &&
      typeof message.id === 'string' &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string'
  );
}

/**
 * Most recent questions the student asked, newest first.
 *
 * @param {ChatMessage[]} messages
 * @param {number} [limit]
 * @returns {ChatMessage[]}
 */
export function getRecentQuestions(messages, limit = 10) {
  return messages
    .filter((message) => message.role === 'user')
    .slice(-limit)
    .reverse();
}

/**
 * Per-subject activity derived from the student's questions, most recently used first.
 *
 * @param {ChatMessage[]} messages
 * @returns {Array<{subject: string, count: number, lastActive: string}>}
 */
export function getSubjectActivity(messages) {
  const activity = new Map();

  messages
    .filter((message) => message.role === 'user')
    .forEach((message) => {
      const current = activity.get(message.subject);
      activity.set(message.subject, {
        subject: message.subject,
        count: (current?.count ?? 0) + 1,
        lastActive: message.timestamp
      });
    });

  return [...activity.values()].sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
}

function toDayKey(date) {
  return date.toLocaleDateString('en-CA');
}

/**
 * Consecutive days (ending today or yesterday) on which the student asked a question.
 *
 * @param {ChatMessage[]} messages
 * @returns {number}
 */
export function calculateStreak(messages) {
  const activeDays = new Set(
    messages
      .filter((message) => message.role === 'user')
      .map((message) => new Date(message.timestamp))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map(toDayKey)
  );

  const cursor = new Date();

  if (!activeDays.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;

  while (activeDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
