/**
 * The notes screen as a small state machine:
 *
 *   idle -> extracting -> extracted -> summarizing -> done
 *                 \             \____________/  \
 *                  `-> error (extract)            `-> error (summarize)
 *
 * Every async step carries a request id (handed out by the caller). A response is applied only when its id is still the current one, so a
 * late answer for a cancelled, replaced or abandoned request can never change what the student sees.
 */

export const initialNotesState = {
  phase: 'idle',
  requestId: 0,
  file: null, // {name, size} (the PDF itself is never kept in state)
  extraction: null, // {text, pageCount, wordCount, characterCount, truncated}
  result: null, // {title, notes}
  error: null // {stage: 'extract' | 'summarize', message}
};

const isCurrent = (state, requestId) => requestId === state.requestId;

export function notesReducer(state, action) {
  switch (action.type) {
    case 'extractStarted':
      return {
        ...initialNotesState,
        phase: 'extracting',
        requestId: action.requestId,
        file: { name: action.file.name, size: action.file.size }
      };

    case 'extractSucceeded':
      if (!isCurrent(state, action.requestId) || state.phase !== 'extracting') {
        return state;
      }
      return { ...state, phase: 'extracted', extraction: action.extraction, error: null };

    case 'extractFailed':
      if (!isCurrent(state, action.requestId) || state.phase !== 'extracting') {
        return state;
      }
      return { ...state, phase: 'error', error: { stage: 'extract', message: action.message } };

    case 'summarizeStarted':
      if (!state.extraction || !['extracted', 'error'].includes(state.phase) || (state.phase === 'error' && state.error?.stage !== 'summarize')) {
        return state;
      }
      return { ...state, phase: 'summarizing', requestId: action.requestId, result: null, error: null };

    case 'summarizeSucceeded':
      if (!isCurrent(state, action.requestId) || state.phase !== 'summarizing') {
        return state;
      }
      return { ...state, phase: 'done', result: action.result, error: null };

    case 'summarizeFailed':
      if (!isCurrent(state, action.requestId) || state.phase !== 'summarizing') {
        return state;
      }
      return { ...state, phase: 'error', error: { stage: 'summarize', message: action.message } };

    case 'cancel':
      // Stop waiting. Whatever is in flight is now stale (the id changes).
      if (state.phase === 'extracting') {
        return { ...initialNotesState, requestId: action.requestId };
      }
      if (state.phase === 'summarizing') {
        return { ...state, phase: 'extracted', requestId: action.requestId };
      }
      return state;

    case 'reset':
      return { ...initialNotesState, requestId: action.requestId };

    default:
      return state;
  }
}
