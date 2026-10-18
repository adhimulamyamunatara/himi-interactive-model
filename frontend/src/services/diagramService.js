import { getLearningProfileStore } from '../utils/learningProfileStore';
import { InvalidDiagramError, parseDiagramResponse } from '../utils/diagram';
import apiClient, { getApiErrorMessage } from './apiClient';

const DIAGRAM_REQUEST_TIMEOUT_MS = 130_000;

/** Generate a validated node/edge diagram. The response is checked again here before anything is drawn. */
export async function generateDiagram(request, { signal } = {}) {
  const personalised = getLearningProfileStore().personalize(request, 'learningProfile');
  const { data } = await apiClient.post('/api/diagrams/generate', personalised, { signal, timeout: DIAGRAM_REQUEST_TIMEOUT_MS });

  return parseDiagramResponse(data);
}

export function describeDiagramError(error) {
  if (error instanceof InvalidDiagramError) {
    return { kind: 'invalid', message: null };
  }

  return { kind: error?.response ? 'server' : 'network', message: getApiErrorMessage(error, 'The diagram could not be drawn. Please try again.') };
}
