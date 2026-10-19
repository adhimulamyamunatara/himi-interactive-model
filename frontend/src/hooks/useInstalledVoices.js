import { useEffect, useState } from 'react';

const read = () => {
  try {
    return Array.from(globalThis.speechSynthesis?.getVoices?.() ?? []);
  } catch {
    return [];
  }
};

/** The speech voices this browser has installed. Browsers list them lazily, so the list updates when they load. */
export function useInstalledVoices() {
  const [voices, setVoices] = useState(read);

  useEffect(() => {
    const synth = globalThis.speechSynthesis;
    const refresh = () => setVoices(read());

    synth?.addEventListener?.('voiceschanged', refresh);
    // Some browsers fill the list without telling anyone.
    const timer = setTimeout(refresh, 600);

    return () => {
      synth?.removeEventListener?.('voiceschanged', refresh);
      clearTimeout(timer);
    };
  }, []);

  return voices;
}
