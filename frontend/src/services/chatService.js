import axios from 'axios';

const chatApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Send a chat request to the FastAPI backend.
 *
 * @param {{message: string, subject: string, userName: string}} payload
 * @returns {Promise<{response: string, timestamp: string, status: string}>}
 */
export async function sendChatMessage(payload) {
  const { data } = await chatApi.post('/api/chat', payload);
  return data;
}

export default chatApi;