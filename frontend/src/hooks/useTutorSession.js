import { useEffect, useState, useSyncExternalStore } from 'react';
import { askTutor, describeTutorError } from '../services/tutorService';
import { createTutorSession } from '../utils/tutorSession';

/** One Mentor conversation. Created per mount, cancelled and discarded on unmount. */
export function useTutorSession() {
  // The initializer runs once per mounted component, so each page visit gets its own controller.
  const [session] = useState(() => createTutorSession({ ask: askTutor, describeError: describeTutorError }));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => () => session.dispose(), [session]);

  return { ...snapshot, send: session.send, cancel: session.cancel, reset: session.reset };
}
