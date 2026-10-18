/**
 * Controller for one Mentor conversation: at most one request in flight, every request is cancellable, and a
 * response that arrives after `reset()`, a newer request or unmount is ignored, so it can never appear in the
 * wrong place. Framework-free so the ownership rules can be unit tested.
 */
import { MAX_HISTORY_TURNS } from './tutor.js';

export const INITIAL_SNAPSHOT = Object.freeze({ status: 'idle', result: null, error: null, history: [], lastRequest: null });

const isAbort = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError';

export function createTutorSession({ ask, describeError = (error) => ({ kind: 'server', message: error?.message ?? 'Request failed.' }) }) {
  const listeners = new Set();
  let snapshot = { ...INITIAL_SNAPSHOT };
  let currentId = 0;
  let controller = null;

  const publish = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const cancelInFlight = () => {
    currentId += 1;
    controller?.abort();
    controller = null;
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Start a request. Ignored while another one is running (a double click must not send two).
     * @param {(history: Array<{role: string, content: string}>) => object} buildRequest called with the conversation so far
     * @returns {Promise<{started: boolean, reason?: string}>}
     */
    async send(buildRequest, userMessage) {
      if (snapshot.status === 'loading') {
        return { started: false, reason: 'busy' };
      }

      const id = ++currentId;
      const own = new AbortController();
      controller = own;
      const request = buildRequest(snapshot.history);
      publish({ status: 'loading', error: null, result: null, lastRequest: { message: userMessage } });

      try {
        const result = await ask(request, { signal: own.signal });

        if (id !== currentId) {
          return { started: true, reason: 'stale' };
        }

        // Only a real answer becomes conversation context; a handoff or a clarification is not an answer.
        const history =
          result.outcome === 'answer'
            ? [...snapshot.history, { role: 'user', content: userMessage }, { role: 'assistant', content: result.answer }].slice(-MAX_HISTORY_TURNS)
            : snapshot.history;
        publish({ status: 'success', result, history });
        return { started: true };
      } catch (error) {
        if (id !== currentId || isAbort(error)) {
          return { started: true, reason: 'stale' };
        }

        publish({ status: 'error', error: describeError(error) });
        return { started: true, reason: 'error' };
      } finally {
        if (id === currentId) {
          controller = null;
        }
      }
    },

    /** Stop the running request (the answer, if it still arrives, is discarded). */
    cancel() {
      if (snapshot.status !== 'loading') {
        return;
      }

      cancelInFlight();
      publish({ status: 'idle' });
    },

    /** Start over: forget the answer and the conversation context. */
    reset() {
      cancelInFlight();
      publish({ ...INITIAL_SNAPSHOT });
    },

    /**
     * Called when the page unmounts: stop any running request so its answer is discarded. Deliberately
     * reversible, because React StrictMode runs this cleanup and then mounts the same instance again.
     */
    dispose() {
      cancelInFlight();

      if (snapshot.status === 'loading') {
        publish({ status: 'idle' });
      }
    }
  };
}
