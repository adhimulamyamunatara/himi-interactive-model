import apiClient from './apiClient';

/**
 * Send a chat request to the FastAPI backend.
 *
 * @param {{message: string, subject: string, userName: string}} payload
 * @returns {Promise<{response: string, timestamp: string, status: string}>}
 */
export async function sendChatMessage(payload) {
  const { data } = await apiClient.post('/api/chat', payload);
  return data;
}
