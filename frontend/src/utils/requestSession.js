/**
 * Single-flight, cancellable request controller shared by the Code Assistant and the Diagram tool.
 *
 * At most one request runs at a time (a second `send` while loading is ignored), every request can be cancelled, and a
 * response that arrives after `cancel`, `reset` or unmount is discarded so it can never appear in the wrong place.
 * Framework-free so these rules can be unit tested.
 */

export const INITIAL_REQUEST_SNAPSHOT = Object.freeze({ status: 'idle', result: null, error: null });

const isAbort = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError';

export function createRequestSession({ ask, describeError = (error) => ({ kind: 'server', message: error?.message ?? 'Request failed.' }) }) {
  const listeners = new Set();
  let snapshot = { ...INITIAL_REQUEST_SNAPSHOT };
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

    /** @returns {Promise<{started: boolean, reason?: 'busy' | 'stale' | 'error'}>} */
    async send(request) {
      if (snapshot.status === 'loading') {
        return { started: false, reason: 'busy' };
      }

      const id = ++currentId;
      const own = new AbortController();
      controller = own;
      publish({ status: 'loading', error: null, result: null });

      try {
        const result = await ask(request, { signal: own.signal });

        if (id !== currentId) {
          return { started: true, reason: 'stale' };
        }

        publish({ status: 'success', result });
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

    cancel() {
      if (snapshot.status === 'loading') {
        cancelInFlight();
        publish({ status: 'idle' });
      }
    },

    reset() {
      cancelInFlight();
      publish({ ...INITIAL_REQUEST_SNAPSHOT });
    },

    /** Unmount: abort any running request. Reversible, because React StrictMode remounts the same instance. */
    dispose() {
      cancelInFlight();

      if (snapshot.status === 'loading') {
        publish({ status: 'idle' });
      }
    }
  };
}
