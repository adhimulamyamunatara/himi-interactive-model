import { useCallback, useSyncExternalStore } from 'react';
import { voiceAvailability } from '../utils/voice';

/**
 * Whether the browser has a speech voice installed for `lang` ("te-IN"): 'available', 'missing' or 'unknown'
 * (voices are listed lazily, so nothing is claimed until the browser reports them).
 */
export function useVoiceAvailability(lang) {
  const subscribe = useCallback((onChange) => {
    const synth = globalThis.speechSynthesis;

    synth?.addEventListener?.('voiceschanged', onChange);
    return () => synth?.removeEventListener?.('voiceschanged', onChange);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return voiceAvailability(globalThis.speechSynthesis?.getVoices?.(), lang);
    } catch {
      return 'unknown';
    }
  }, [lang]);

  return useSyncExternalStore(subscribe, getSnapshot, () => 'unknown');
}
