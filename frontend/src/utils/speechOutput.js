import { chunkForSpeech, detectSpeechLang, toSpeakableText } from './speechText.js';
import { pickVoice } from './voice.js';

/**
 * Reads assistant replies aloud with the browser's speech synthesis (no audio is fetched from HIMI's servers).
 *
 * - Only starts from an explicit `speak()` call (a button press); nothing ever plays automatically.
 * - One reply at a time: starting another reply, or calling `stop()`, cancels the current one.
 * - Each `speak()` has a token. Late callbacks from a cancelled reply are ignored, so they cannot
 *   mark a different reply as playing or restart audio after the student pressed Stop.
 * - A reply is spoken sentence by sentence, because browsers can cut off one very long utterance.
 *
 * Real-browser quirks this guards against (a fake engine in tests cannot show them):
 * - Chrome silently drops a `speak()` that comes right after a `cancel()`. A reply that follows a cancel is therefore
 *   started after a short settle delay (React StrictMode in development cancels and re-starts the live greeting).
 * - Chrome can garbage-collect an utterance that is still playing and then never fire `onend`, so the loop would wait
 *   forever. The playing utterance is held in a variable until it ends.
 * - A paused engine stays silent, so `resume()` is called before speaking.
 * - If the engine never reports that it started, a watchdog turns the silence into an error instead of an endless
 *   "Speaking" state.
 */

export function isSpeechOutputSupported(scope = globalThis) {
  return Boolean(scope?.speechSynthesis && scope?.SpeechSynthesisUtterance);
}

const IDLE = Object.freeze({ speakingId: null, lastId: null, errorId: null, error: '' });

/**
 * @param {{ synth?: SpeechSynthesis | null, Utterance?: typeof SpeechSynthesisUtterance | null }} [options]
 */
export function createSpeechOutput({
  synth = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  settleMs = 150,
  watchdogMs = 5000,
  storage = globalThis.localStorage
} = {}) {
  let snapshot = IDLE;
  let token = 0;
  let lastCancelAt = -Infinity;
  let held = null;
  let waitTimer = null;
  let watchdog = null;
  const listeners = new Set();
  const STORAGE_KEY = 'himi_voice_choice_v1';

  /** The voice the student picked per language ("en" -> "Samantha"). Only a name is stored, never any audio. */
  const readChoices = () => {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const clearTimers = () => {
    clearTimeout(waitTimer);
    clearTimeout(watchdog);
    waitTimer = null;
    watchdog = null;
  };

  const set = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const cancelEngine = () => {
    lastCancelAt = Date.now();

    try {
      synth?.cancel();
    } catch {
      /* nothing to cancel */
    }
  };

  const stop = () => {
    token += 1;
    clearTimers();
    held = null;
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
    /** The voice name the student chose for a language code ("en", "te"), or null for automatic. */
    getVoiceChoice: (code) => (typeof readChoices()[code] === 'string' ? readChoices()[code] : null),
    setVoiceChoice(code, name) {
      const next = { ...readChoices() };

      if (name) {
        next[code] = String(name).slice(0, 200);
      } else {
        delete next[code];
      }

      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode: the choice lasts until the page reloads only if storage works; otherwise it is ignored */
      }
    },
    /** The utterance being played. Holding it is what keeps Chrome from garbage-collecting it mid-speech. */
    playing: () => held,
    stop,

    /**
     * Read `text` aloud for the message `id`. Replaces anything already playing.
     * @returns {boolean} false when nothing could be started
     */
    speak(id, text) {
      if (!synth || !Utterance) {
        return false;
      }

      // Only cancel when something is really playing: a needless cancel() makes Chrome drop the next speak().
      const busy = snapshot.speakingId !== null || Boolean(synth.speaking) || Boolean(synth.pending);
      token += 1;
      clearTimers();
      held = null;

      if (busy) {
        cancelEngine();
      }

      if (snapshot.speakingId !== null) {
        set({ speakingId: null });
      }

      const chunks = chunkForSpeech(toSpeakableText(text));

      if (chunks.length === 0) {
        set({ errorId: id, error: 'There is nothing in this reply to read aloud.' });
        return false;
      }

      const mine = token;
      const lang = detectSpeechLang(text);
      let voice = null;

      try {
        // An installed voice for the language reads Telugu and English far better than the device default.
        voice = pickVoice(synth.getVoices?.(), lang, readChoices()[lang.split('-')[0]] ?? null);
      } catch {
        voice = null;
      }

      let position = 0;

      const fail = () => {
        if (mine !== token) {
          return;
        }

        clearTimers();
        held = null;
        cancelEngine();
        set({ speakingId: null, lastId: id, errorId: id, error: 'This browser could not play the reply aloud. You can still read it.' });
      };

      const next = () => {
        if (mine !== token) {
          return;
        }

        clearTimeout(watchdog);

        if (position >= chunks.length) {
          held = null;
          set({ speakingId: null, lastId: id });
          return;
        }

        const utterance = new Utterance(chunks[position]);
        position += 1;
        utterance.lang = lang;
        held = utterance;

        if (voice) {
          utterance.voice = voice;
        }

        utterance.onstart = () => {
          if (mine === token) {
            clearTimeout(watchdog);
          }
        };
        utterance.onend = next;
        utterance.onerror = (event) => {
          // 'interrupted' and 'canceled' come from our own cancel(); anything else is a real failure.
          if (event?.error === 'interrupted' || event?.error === 'canceled') {
            return;
          }

          fail();
        };

        try {
          synth.resume?.();
          synth.speak(utterance);
        } catch {
          fail();
          return;
        }

        if (watchdogMs > 0) {
          watchdog = setTimeout(() => {
            // Nothing started playing: say so instead of sitting on "Speaking" forever.
            if (mine === token && !synth.speaking) {
              fail();
            }
          }, watchdogMs);
          watchdog.unref?.();
        }
      };

      set({ speakingId: id, lastId: id, errorId: null, error: '' });
      const wait = Math.max(0, settleMs - (Date.now() - lastCancelAt));

      if (wait > 0) {
        waitTimer = setTimeout(next, wait);
        waitTimer.unref?.();
      } else {
        next();
      }

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
