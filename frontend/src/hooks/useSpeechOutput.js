import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getSpeechOutput } from '../utils/speechOutput';

/** Playback state of the one shared reader plus `speak` / `stop`. Replies only play when `speak` is called. */
export function useSpeechOutput() {
  const output = getSpeechOutput();
  const snapshot = useSyncExternalStore(output.subscribe, output.getSnapshot, output.getSnapshot);
  const speak = useCallback((id, text) => output.speak(id, text), [output]);
  const stop = useCallback(() => output.stop(), [output]);

  return { supported: output.isSupported(), ...snapshot, speak, stop };
}

/**
 * Stops any reading when `ownerKey` changes (another chat opened or deleted), when the page unmounts
 * (navigating away, logout) and when the page is hidden or closed.
 */
export function useStopSpeechOnLeave(ownerKey) {
  useEffect(() => {
    const output = getSpeechOutput();
    const stop = () => output.stop();

    window.addEventListener('pagehide', stop);

    return () => {
      window.removeEventListener('pagehide', stop);
      output.stop();
    };
  }, [ownerKey]);
}
