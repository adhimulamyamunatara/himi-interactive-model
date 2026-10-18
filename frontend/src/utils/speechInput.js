/**
 * Speech-to-text controller built on the browser's SpeechRecognition API (no library, no server of ours).
 *
 * Safety rules enforced here:
 * - The microphone is only requested inside `start()`, which the UI calls from an explicit user action.
 * - Every `start()` creates a numbered session. `abort()` (and a newer `start()`) invalidates it, so a late
 *   result or error from an old session can never reach the screen, the draft or another conversation.
 * - Only one session can be active; a second `start()` while listening is refused (no duplicates).
 */

export const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'te-IN', label: 'Telugu' }
];
export const DEFAULT_VOICE_LANGUAGE = 'en-IN';

export const isVoiceLanguage = (code) => VOICE_LANGUAGES.some((language) => language.code === code);

/**
 * @returns {{ supported: boolean, Recognition: Function | null, reason: null | 'unsupported' | 'insecure' }}
 */
export function getSpeechInputSupport(scope = globalThis) {
  const Recognition = scope?.SpeechRecognition ?? scope?.webkitSpeechRecognition ?? null;

  if (!Recognition) {
    return { supported: false, Recognition: null, reason: 'unsupported' };
  }

  if (scope.isSecureContext === false) {
    return { supported: false, Recognition: null, reason: 'insecure' };
  }

  return { supported: true, Recognition, reason: null };
}

export const SUPPORT_MESSAGES = {
  unsupported: 'Voice input is not available in this browser. You can still type your question.',
  insecure: 'Voice input only works on a secure (HTTPS) page. You can still type your question.'
};

/** Student-facing text for a SpeechRecognition error code. Returns null for errors that should stay silent. */
export function describeSpeechError(code) {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        message: 'Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again. You can also type instead.',
        retryable: false
      };
    case 'audio-capture':
      return { message: 'No microphone was found. Connect one and try again, or type your question.', retryable: true };
    case 'no-speech':
      return { message: 'I did not hear anything. Check your microphone and try again.', retryable: true };
    case 'network':
      return { message: 'Speech recognition could not reach its online service. Check your connection and try again, or type instead.', retryable: true };
    case 'language-not-supported':
      return { message: 'This browser cannot recognise that language. Pick another voice language or type instead.', retryable: false };
    default:
      return { message: 'Voice input stopped unexpectedly. Try again, or type your question.', retryable: true };
  }
}

/**
 * Read a SpeechRecognition result event.
 *
 * @returns {{ finals: { index: number, text: string }[], interim: string }}
 */
export function readRecognitionEvent(event) {
  const finals = [];
  let interim = '';
  const results = event?.results;

  if (!results) {
    return { finals, interim };
  }

  for (let index = event.resultIndex ?? 0; index < results.length; index += 1) {
    const result = results[index];
    const text = result?.[0]?.transcript ?? '';

    if (result?.isFinal) {
      finals.push({ index, text });
    } else {
      interim += text;
    }
  }

  return { finals, interim: interim.trim() };
}

/**
 * @param {{ getSupport?: () => ReturnType<typeof getSpeechInputSupport> }} [options]
 */
export function createSpeechInput({ getSupport = getSpeechInputSupport } = {}) {
  let current = null;
  let nextId = 0;

  const invalidate = () => {
    const session = current;
    current = null;

    if (session) {
      session.recognition.onresult = null;
      session.recognition.onerror = null;
      session.recognition.onend = null;
      session.recognition.onstart = null;
    }

    return session;
  };

  return {
    isActive: () => current !== null,

    /**
     * @param {{ language: string, onStart?: () => void, onInterim?: (text: string) => void, onFinal?: (text: string) => void,
     *   onError?: (code: string) => void, onEnd?: (summary: { heardSpeech: boolean, errored: boolean }) => void }} options
     * @returns {{ ok: true } | { ok: false, reason: 'unsupported' | 'insecure' | 'busy' | 'failed' }}
     */
    start({ language, onStart, onInterim, onFinal, onError, onEnd }) {
      const support = getSupport();

      if (!support.supported) {
        return { ok: false, reason: support.reason ?? 'unsupported' };
      }

      if (current) {
        return { ok: false, reason: 'busy' };
      }

      let recognition;

      try {
        recognition = new support.Recognition();
      } catch {
        return { ok: false, reason: 'failed' };
      }

      nextId += 1;
      const session = { id: nextId, recognition, heardSpeech: false, errored: false, delivered: new Set() };
      const isCurrent = () => current === session;

      recognition.lang = isVoiceLanguage(language) ? language : DEFAULT_VOICE_LANGUAGE;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (isCurrent()) {
          onStart?.();
        }
      };

      recognition.onresult = (event) => {
        if (!isCurrent()) {
          return;
        }

        const { finals, interim } = readRecognitionEvent(event);

        for (const { index, text } of finals) {
          if (session.delivered.has(index)) {
            continue;
          }

          session.delivered.add(index);

          if (text.trim()) {
            session.heardSpeech = true;
            onFinal?.(text);
          }
        }

        onInterim?.(finals.length > 0 ? '' : interim);
      };

      recognition.onerror = (event) => {
        if (!isCurrent()) {
          return;
        }

        session.errored = true;
        onError?.(event?.error ?? 'unknown');
      };

      recognition.onend = () => {
        if (!isCurrent()) {
          return;
        }

        invalidate();
        onEnd?.({ heardSpeech: session.heardSpeech, errored: session.errored });
      };

      current = session;

      try {
        recognition.start();
      } catch {
        invalidate();
        return { ok: false, reason: 'failed' };
      }

      return { ok: true };
    },

    /** Ask the browser to finish: a last result may still arrive, then `onEnd` fires. */
    stop() {
      try {
        current?.recognition.stop();
      } catch {
        /* already stopped */
      }
    },

    /** Drop the session immediately. Nothing from it is delivered afterwards. */
    abort() {
      const session = invalidate();

      try {
        session?.recognition.abort();
      } catch {
        /* already stopped */
      }
    }
  };
}
