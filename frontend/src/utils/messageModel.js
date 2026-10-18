/**
 * Create a normalized chat message model.
 *
 * @param {object} params - Message details.
 * @param {'user' | 'assistant'} params.role - Sender role.
 * @param {string} params.content - Message text.
 * @param {string} params.subject - Selected subject.
 * @returns {{id: string, role: 'user' | 'assistant', content: string, timestamp: string, subject: string}}
 */
export function createMessage({ role, content, subject }) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    subject
  };
}

/**
 * Group messages into recent conversation summaries.
 *
 * @param {Array<{id: string, role: string, content: string, timestamp: string, subject: string}>} messages
 * @returns {Array<{id: string, subject: string, preview: string, timestamp: string}>}
 */
export function buildConversationSummaries(messages) {
  const userMessages = messages.filter((message) => message.role === 'user');

  return userMessages.slice(-3).reverse().map((message) => ({
    id: message.id,
    subject: message.subject,
    preview: message.content,
    timestamp: message.timestamp
  }));
}