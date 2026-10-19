/**
 * Pure helpers for the voice features: which language to listen in, which installed voice can read a reply,
 * and when a new reply may be read aloud automatically. No browser APIs are touched here, so all of it is
 * covered by unit tests.
 */

/** Dictation language that matches the language the student asked HIMI to explain in. */
export function voiceInputLanguageFor(explanationLanguage) {
  return explanationLanguage === 'te' ? 'te-IN' : 'en-IN';
}

/** `te-IN` -> `te`. */
const primary = (lang) => String(lang ?? '').toLowerCase().split(/[-_]/)[0];

/**
 * Pick the best installed speech voice for `lang`.
 *
 * 1. A voice the student chose (by name) for this language always wins.
 * 2. Otherwise, among voices for the same language: the device's default voice first (it is the one the system
 *    really plays; some listed regional voices, such as an Indian-English voice that was never downloaded, are
 *    silent), then an exact region match, then the first one.
 *
 * Returns null when none is installed (the reader then falls back to the device default).
 */
export function pickVoice(voices, lang, preferredName = null) {
  const list = Array.isArray(voices) ? voices.filter((voice) => voice && typeof voice.lang === 'string') : [];
  const wanted = String(lang ?? '').toLowerCase().replace('_', '-');
  const sameLanguage = list.filter((voice) => primary(voice.lang) === primary(wanted));

  if (preferredName) {
    const chosen = sameLanguage.find((voice) => voice.name === preferredName);

    if (chosen) {
      return chosen;
    }
  }

  return (
    sameLanguage.find((voice) => voice.default === true) ??
    sameLanguage.find((voice) => voice.lang.toLowerCase().replace('_', '-') === wanted) ??
    sameLanguage[0] ??
    null
  );
}

/** The voices installed for a language ("en", "te"), for a picker. */
export function voicesForLanguage(voices, languageCode) {
  return (Array.isArray(voices) ? voices : []).filter((voice) => voice && typeof voice.lang === 'string' && typeof voice.name === 'string' && primary(voice.lang) === primary(languageCode));
}

/**
 * Whether a voice for `lang` is installed.
 * `unknown` means the browser has not listed any voices yet (many load them lazily), so nothing can be claimed.
 */
export function voiceAvailability(voices, lang) {
  if (!Array.isArray(voices) || voices.length === 0) {
    return 'unknown';
  }

  return pickVoice(voices, lang) ? 'available' : 'missing';
}

/**
 * Decides which new reply (if any) should be read aloud automatically.
 *
 * The first call for an owner (a conversation, or the Mentor page) only records what is already there, so
 * opening old history never speaks. After that, the newest reply that was not there before is returned once.
 * Call `next` on every change even when auto-read is off, so turning it on later never reads old replies.
 */
export function createAutoReadTracker() {
  let owner;
  let started = false;
  let seen = new Set();

  return {
    /**
     * @param {string | number | null} ownerKey which conversation these ids belong to
     * @param {string[]} ids ids of the replies that can be read aloud, oldest first
     * @returns {string | null}
     */
    next(ownerKey, ids) {
      if (!started || owner !== ownerKey) {
        started = true;
        owner = ownerKey;
        seen = new Set(ids);
        return null;
      }

      let fresh = null;

      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          fresh = id;
        }
      }

      return fresh;
    }
  };
}

/** Auto-read needs voice on, the preference on, and a browser that can speak. */
export function canAutoRead({ voiceEnabled, autoReadReplies, supported }) {
  return Boolean(voiceEnabled && autoReadReplies && supported);
}
