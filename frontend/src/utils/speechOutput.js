import { chunkForSpeech, detectSpeechLang, toSpeakableText } from './speechText.js';

/**
 * Reads assistant replies aloud with the browser's speech synthesis (no audio is fetched from HIMI's servers).
 *
 * - Only starts from an explicit `speak()` call (a button press); nothing ever plays automatically.
 * - One reply at a time: starting another reply, or calling `stop()`, cancels the current one.
 * - Each `speak()` has a token. Late callbacks from a cancelled reply are ignored, so they cannot
 *   mark a different reply as playing or restart audio after the student pressed Stop.
 * - A reply is spoken sentence by sentence, because browsers can cut off one very long utterance.
 */

export function isSpeechOutputSupported(scope = globalThis) {
  return Boolean(scope?.speechSynthesis && scope?.SpeechSynthesisUtterance);
}

const IDLE = Object.freeze({ speakingId: null, lastId: null, errorId: null, error: '' });

/**
 * @param {{ synth?: SpeechSynthesis | null, Utterance?: typeof SpeechSynthesisUtterance | null }} [options]
 */
export function createSpeechOutput({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let snapshot = IDLE;
  let token = 0;
  const listeners = new Set();

  const set = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const cancelEngine = () => {
    try {
      synth?.cancel();
    } catch {
      /* nothing to cancel */
    }
  };

  const stop = () => {
    token += 1;
    cancelEngine();

    if (snapshot.speakingId !== null) {
      set({ speakingId: null });
    }
  };

  return {
    isSupported: () => Boolean(synth && Utterance),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    stop,

    /**
     * Read `text` aloud for the message `id`. Replaces anything already playing.
     * @returns {boolean} false when nothing could be started
     */
    speak(id, text) {
      if (!synth || !Utterance) {
        return false;
      }

      stop();
      const chunks = chunkForSpeech(toSpeakableText(text));

      if (chunks.length === 0) {
        set({ errorId: id, error: 'There is nothing in this reply to read aloud.' });
        return false;
      }

      const mine = token;
      const lang = detectSpeechLang(text);
      let position = 0;

      const fail = () => {
        if (mine !== token) {
          return;
        }

        cancelEngine();
        set({ speakingId: null, lastId: id, errorId: id, error: 'This browser could not play the reply aloud. You can still read it.' });
      };

      const next = () => {
        if (mine !== token) {
          return;
        }

        if (position >= chunks.length) {
          set({ speakingId: null, lastId: id });
          return;
        }

        const utterance = new Utterance(chunks[position]);
        position += 1;
        utterance.lang = lang;
        utterance.onend = next;
        utterance.onerror = (event) => {
          // 'interrupted' and 'canceled' come from our own cancel(); anything else is a real failure.
          if (event?.error === 'interrupted' || event?.error === 'canceled') {
            return;
          }

          fail();
        };

        try {
          synth.speak(utterance);
        } catch {
          fail();
        }
      };

      set({ speakingId: id, lastId: id, errorId: null, error: '' });
      next();
      return true;
    }
  };
}

let shared = null;

/** One output channel for the whole app, so two replies can never talk over each other. */
export function getSpeechOutput() {
  shared ??= createSpeechOutput();
  return shared;
}
