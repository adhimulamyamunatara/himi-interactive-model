import { parseExtractResponse, parseSummaryResponse } from '../utils/notes';
import { getLearningProfileStore } from '../utils/learningProfileStore';
import apiClient from './apiClient';

const EXTRACT_TIMEOUT_MS = 60_000;
const SUMMARIZE_TIMEOUT_MS = 200_000;

/**
 * Upload a PDF so the server can read its text. The file is sent as the raw request body and is NOT sent to the AI:
 * the server processes it in memory and discards it when the response is returned.
 *
 * @param {File} file
 * @param {{signal?: AbortSignal}} [options]
 */
export async function extractPdfText(file, { signal } = {}) {
  const { data } = await apiClient.post('/api/notes/extract', file, {
    headers: { 'Content-Type': 'application/pdf' },
    signal,
    timeout: EXTRACT_TIMEOUT_MS
  });

  return parseExtractResponse(data);
}

/**
 * Ask the AI to summarise text. Only called after the student presses "Summarize".
 *
 * @param {{text: string, title?: string | null}} input
 * @param {{signal?: AbortSignal}} [options]
 */
export async function summarizeNotes({ text, title }, { signal } = {}) {
  const request = getLearningProfileStore().personalize(
    { text, ...(title ? { title } : {}) },
    'learning_profile'
  );
  const { data } = await apiClient.post('/api/notes/summarize', request, { signal, timeout: SUMMARIZE_TIMEOUT_MS });

  return parseSummaryResponse(data);
}
