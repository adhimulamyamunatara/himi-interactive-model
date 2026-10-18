/**
 * Interface and tutoring preferences. They are non-sensitive, live only in this browser, and are kept when the
 * student logs out (they describe the device's setup, not the student's work).
 *
 * The UI language and the explanation language are deliberately separate: a student can read the interface in
 * English while asking the tutor to explain a concept in Telugu, or the other way round.
 */

export const PREFERENCES_STORAGE_KEY = 'himi_preferences_v1';
export const PREFERENCES_BACKUP_KEY = 'himi_preferences_v1_unreadable_backup';
export const PREFERENCES_VERSION = 1;

/** Add a language here (and a dictionary in `src/i18n`) to support another one. */
export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' }
];

export const HELP_MODES = ['hint', 'guided', 'full'];

/** 'system' follows the device's light/dark setting. */
export const THEMES = ['system', 'light', 'dark'];

export const DEFAULT_PREFERENCES = Object.freeze({
  uiLanguage: 'en',
  explanationLanguage: 'en',
  helpMode: 'guided',
  // Voice: everything is opt-in. Nothing is spoken or recorded unless the student asks.
  voiceEnabled: true,
  autoReadReplies: false,
  // Camera: allows the live camera to be requested at all. It never starts by itself, and choosing a photo from
  // the device's files does not depend on it.
  cameraEnabled: true,
  // Appearance: follows the device unless the student picks light or dark.
  theme: 'system'
});

export const isLanguageCode = (value) => LANGUAGES.some((language) => language.code === value);
export const isHelpMode = (value) => HELP_MODES.includes(value);
export const isTheme = (value) => THEMES.includes(value);

/** Turn anything into a complete, valid preferences object. Unknown or invalid fields fall back to defaults. */
export function normalizePreferences(raw) {
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};

  return {
    uiLanguage: isLanguageCode(source.uiLanguage) ? source.uiLanguage : DEFAULT_PREFERENCES.uiLanguage,
    explanationLanguage: isLanguageCode(source.explanationLanguage) ? source.explanationLanguage : DEFAULT_PREFERENCES.explanationLanguage,
    helpMode: isHelpMode(source.helpMode) ? source.helpMode : DEFAULT_PREFERENCES.helpMode,
    voiceEnabled: typeof source.voiceEnabled === 'boolean' ? source.voiceEnabled : DEFAULT_PREFERENCES.voiceEnabled,
    autoReadReplies: typeof source.autoReadReplies === 'boolean' ? source.autoReadReplies : DEFAULT_PREFERENCES.autoReadReplies,
    cameraEnabled: typeof source.cameraEnabled === 'boolean' ? source.cameraEnabled : DEFAULT_PREFERENCES.cameraEnabled,
    theme: isTheme(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme
  };
}

/** Merge a partial change into the current preferences (invalid values are ignored, not stored). */
export function applyPreferenceChange(current, change) {
  return normalizePreferences({ ...current, ...change });
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read stored preferences. Never throws.
 * @returns {{preferences: object, issue: null | 'unavailable' | 'unreadable'}}
 */
export function loadPreferences(storage = getBrowserStorage()) {
  if (!storage) {
    return { preferences: { ...DEFAULT_PREFERENCES }, issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(PREFERENCES_STORAGE_KEY);
  } catch {
    return { preferences: { ...DEFAULT_PREFERENCES }, issue: 'unavailable' };
  }

  if (raw === null || raw === undefined) {
    return { preferences: { ...DEFAULT_PREFERENCES }, issue: null };
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed?.version !== PREFERENCES_VERSION || typeof parsed.preferences !== 'object') {
      throw new Error('unsupported');
    }

    return { preferences: normalizePreferences(parsed.preferences), issue: null };
  } catch {
    try {
      storage.setItem(PREFERENCES_BACKUP_KEY, raw);
    } catch {
      /* best effort */
    }

    return { preferences: { ...DEFAULT_PREFERENCES }, issue: 'unreadable' };
  }
}

/** @returns {boolean} whether the browser accepted the write. */
export function savePreferences(preferences, storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ version: PREFERENCES_VERSION, preferences: normalizePreferences(preferences) }));
    return true;
  } catch {
    return false;
  }
}
