import apiClient from './apiClient';

/**
 * Send a chat request to the FastAPI backend.
 *
 * @param {{message: string, subject: string, userName: string}} payload
 * @param {{signal?: AbortSignal}} [config] Optional AbortSignal, used to drop a request whose conversation was deleted.
 * @returns {Promise<{response: string, timestamp: string, status: string}>}
 */
export async function sendChatMessage(payload, { signal } = {}) {
  const { data } = await apiClient.post('/api/chat', payload, { signal });
  return data;
}
