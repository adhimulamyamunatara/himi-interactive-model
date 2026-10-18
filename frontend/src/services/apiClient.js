import axios from 'axios';

/** Single source of truth for the FastAPI base URL. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

export default apiClient;

/** True when a request was aborted on purpose (AbortController). */
export function isRequestCancelled(error) {
  return axios.isCancel(error);
}

/**
 * Turn any request failure into a short message that is safe to show to students.
 * Server details (stack traces, status text) are never exposed.
 *
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response) {
    const detail = error.response.data?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (error.response.status === 422) {
      return 'Some options were not accepted. Please check them and try again.';
    }

    return fallback;
  }

  if (error?.code === 'ECONNABORTED') {
    return 'The request took too long. Please try again.';
  }

  if (error?.request) {
    return 'Could not reach the HIMI server. Check that the backend is running and try again.';
  }

  return fallback;
}
