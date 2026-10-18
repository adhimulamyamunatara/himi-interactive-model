import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRequestSession } from '../utils/requestSession';

/**
 * One cancellable request per mounted page. Pass module-level (stable) `ask` and `describeError` functions.
 * The controller is created once per mount and aborted when the page unmounts.
 */
export function useRequestSession(ask, describeError) {
  const [session] = useState(() => createRequestSession({ ask, describeError }));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => () => session.dispose(), [session]);

  return { ...snapshot, send: session.send, cancel: session.cancel, reset: session.reset };
}
