import { InvalidCampusResponseError, parseCampusResponse } from '../utils/campus';
import { InvalidSummaryError, parseSummaryResponse } from '../utils/classroom';
import apiClient, { getApiErrorMessage } from './apiClient';

const REQUEST_TIMEOUT_MS = 130_000;

/** Ask a college question. Only the selected passages of the student's own documents are sent. */
export async function askCampus(request, { signal } = {}) {
  const { data } = await apiClient.post('/api/campus/ask', request, { signal, timeout: REQUEST_TIMEOUT_MS });
  return parseCampusResponse(data, request.sources);
}

export function describeCampusError(error) {
  if (error instanceof InvalidCampusResponseError) {
    return { kind: 'invalid', message: null };
  }

  return { kind: error?.response ? 'server' : 'network', message: getApiErrorMessage(error, 'The campus assistant could not answer. Please try again.') };
}

/** Summarise a local classroom session. */
export async function summariseClassroom(request, { signal } = {}) {
  const { data } = await apiClient.post('/api/classroom/summary', request, { signal, timeout: REQUEST_TIMEOUT_MS });
  return parseSummaryResponse(data);
}

export function describeSummaryError(error) {
  if (error instanceof InvalidSummaryError) {
    return { kind: 'invalid', message: null };
  }

  return { kind: error?.response ? 'server' : 'network', message: getApiErrorMessage(error, 'The summary could not be made. Please try again.') };
}
