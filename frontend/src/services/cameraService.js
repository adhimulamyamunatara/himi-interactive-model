import { getLearningProfileStore } from '../utils/learningProfileStore';
import { InvalidCameraResponseError, parseCameraResponse } from '../utils/camera';
import apiClient, { getApiErrorMessage } from './apiClient';

const CAMERA_REQUEST_TIMEOUT_MS = 130_000;

/**
 * Send ONE photo to be explained. Called only when the student presses the Explain button. The server passes the
 * photo to the model for this request and keeps nothing. The response is validated before it is returned.
 */
export async function analyzePhoto(request, { signal } = {}) {
  const personalised = getLearningProfileStore().personalize(request, 'learningProfile');
  const { data } = await apiClient.post('/api/camera/analyze', personalised, { signal, timeout: CAMERA_REQUEST_TIMEOUT_MS });

  return parseCameraResponse(data);
}

export function describeCameraError(error) {
  if (error instanceof InvalidCameraResponseError) {
    return { kind: 'invalid', message: null };
  }

  return { kind: error?.response ? 'server' : 'network', message: getApiErrorMessage(error, 'The photo could not be analysed. Please try again.') };
}
