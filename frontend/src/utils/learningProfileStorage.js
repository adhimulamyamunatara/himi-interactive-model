/**
 * Local persistence for the learning profile. It lives ONLY in this browser (no account, no cloud sync).
 *
 * - One dedicated, versioned key; user, chat, quiz and planner keys are never touched.
 * - Stored data is re-validated on load, so malformed or tampered data can never crash the app.
 * - Anything unreadable or repaired is copied to a backup key first, so a later save cannot silently destroy it.
 * - The storage object is injectable so the logic can be tested without a browser.
 */
import { createDefaultProfile, normalizeProfile } from './learningProfile.js';

export const LEARNING_PROFILE_STORAGE_KEY = 'himi_learning_profile_v1';
export const LEARNING_PROFILE_BACKUP_KEY = 'himi_learning_profile_v1_unreadable_backup';
export const LEARNING_PROFILE_VERSION = 1;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

export function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // access can throw when storage is blocked
  }
}

export function createDefaultState() {
  return {
    version: LEARNING_PROFILE_VERSION,
    // Personalisation is on by default, but nothing is sent until the student has saved a profile (`touched`).
    enabled: true,
    touched: false,
    updatedAt: null,
    profile: createDefaultProfile()
  };
}

const validTime = (value) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

/**
 * Read the stored state. Never throws.
 *
 * @returns {{state: object, issue: null | 'unavailable' | 'unreadable' | 'repaired'}}
 */
export function loadLearningProfileState(storage = getBrowserStorage()) {
  if (!storage) {
    return { state: createDefaultState(), issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(LEARNING_PROFILE_STORAGE_KEY);
  } catch {
    return { state: createDefaultState(), issue: 'unavailable' };
  }

  if (raw === null || raw === undefined) {
    return { state: createDefaultState(), issue: null };
  }

  const keepBackup = () => {
    try {
      storage.setItem(LEARNING_PROFILE_BACKUP_KEY, raw);
    } catch {
      /* best effort */
    }
  };

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    keepBackup();
    return { state: createDefaultState(), issue: 'unreadable' };
  }

  if (!isObject(parsed) || parsed.version !== LEARNING_PROFILE_VERSION || !isObject(parsed.profile)) {
    keepBackup();
    return { state: createDefaultState(), issue: 'unreadable' };
  }

  const profile = normalizeProfile(parsed.profile);
  // Saved data is always complete and clean, so any difference means it was edited or damaged.
  const repaired = JSON.stringify(profile) !== JSON.stringify(parsed.profile);

  if (repaired) {
    keepBackup();
  }

  return {
    state: {
      version: LEARNING_PROFILE_VERSION,
      enabled: parsed.enabled !== false,
      touched: parsed.touched === true,
      updatedAt: validTime(parsed.updatedAt),
      profile
    },
    issue: repaired ? 'repaired' : null
  };
}

/** Returns false when the browser refuses the write (quota exceeded, storage blocked). */
export function saveLearningProfileState(state, storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(LEARNING_PROFILE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Remove the profile and any recovery copy of it. Returns false when storage could not be changed. */
export function clearLearningProfileStorage(storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(LEARNING_PROFILE_STORAGE_KEY);
    storage.removeItem(LEARNING_PROFILE_BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}
