import { getLearningProfileStore } from '../utils/learningProfileStore';
import { InvalidTutorResponseError, parseTutorResponse } from '../utils/tutor';
import apiClient, { getApiErrorMessage } from './apiClient';

// The backend allows up to ~100s for one tutoring request (two model calls at most in the normal case).
const TUTOR_REQUEST_TIMEOUT_MS = 130_000;

/**
 * Ask the multi-agent tutor. The response is validated before it is returned.
 *
 * @param {object} request A request built by `buildTutorRequest`.
 * @param {{signal?: AbortSignal}} [options]
 * @throws Axios errors for network/HTTP failures and `InvalidTutorResponseError` for a malformed payload.
 */
export async function askTutor(request, { signal } = {}) {
  const personalised = getLearningProfileStore().personalize(request, 'learningProfile');
  const { data } = await apiClient.post('/api/tutor/respond', personalised, { signal, timeout: TUTOR_REQUEST_TIMEOUT_MS });

  return parseTutorResponse(data);
}

/** Classify a failure for the UI. Server details are never exposed beyond the backend's own safe message. */
export function describeTutorError(error) {
  if (error instanceof InvalidTutorResponseError) {
    return { kind: 'invalid', message: null };
  }

  return { kind: error?.response ? 'server' : 'network', message: getApiErrorMessage(error, 'The mentor could not answer. Please try again.') };
}
