import { getLearningProfileStore } from '../utils/learningProfileStore';
import apiClient from './apiClient';

/**
 * Send a chat request to the FastAPI backend.
 *
 * @param {{message: string, subject: string, userName: string}} payload
 * @param {{signal?: AbortSignal}} [config] Optional AbortSignal, used to drop a request whose conversation was deleted.
 * @returns {Promise<{response: string, timestamp: string, status: string}>}
 */
export async function sendChatMessage(payload, { signal } = {}) {
  // Adds the student's learning profile only when personalisation is on and a profile has been saved.
  const request = getLearningProfileStore().personalize(payload, 'learningProfile');
  const { data } = await apiClient.post('/api/chat', request, { signal });
  return data;
}
