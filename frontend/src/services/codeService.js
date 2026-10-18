import { getLearningProfileStore } from '../utils/learningProfileStore';
import { InvalidCodeResponseError, parseCodeResponse } from '../utils/codeAssist';
import apiClient, { getApiErrorMessage } from './apiClient';

const CODE_REQUEST_TIMEOUT_MS = 130_000;

/**
 * Ask the Coding Assistant to analyse code. The code is sent only when the student presses Analyse and is never
 * stored by HIMI. The response is validated before it is returned.
 */
export async function assistCode(request, { signal } = {}) {
  const personalised = getLearningProfileStore().personalize(request, 'learningProfile');
  const { data } = await apiClient.post('/api/code/assist', personalised, { signal, timeout: CODE_REQUEST_TIMEOUT_MS });

  return parseCodeResponse(data);
}

export function describeCodeError(error) {
  if (error instanceof InvalidCodeResponseError) {
    return { kind: 'invalid', message: null };
  }

  return { kind: error?.response ? 'server' : 'network', message: getApiErrorMessage(error, 'The code assistant could not answer. Please try again.') };
}
