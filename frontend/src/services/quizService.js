import { buildQuizRequest, parseQuizResponse } from '../utils/quiz';
import apiClient from './apiClient';

// Quiz generation can take a while with larger models (the backend allows up to 90s per attempt).
const QUIZ_REQUEST_TIMEOUT_MS = 200_000;

/**
 * Ask the FastAPI backend (which calls Gemini) to generate a quiz.
 *
 * @param {import('../utils/quiz').QuizConfig} config
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{subject: string, topic: string | null, difficulty: string, questions: import('../utils/quiz').QuizQuestion[]}>}
 * @throws Axios errors for network/HTTP failures and `InvalidQuizResponseError` for malformed payloads.
 */
export async function generateQuiz(config, { signal } = {}) {
  const { data } = await apiClient.post('/api/quiz/generate', buildQuizRequest(config), {
    signal,
    timeout: QUIZ_REQUEST_TIMEOUT_MS
  });

  return parseQuizResponse(data);
}
