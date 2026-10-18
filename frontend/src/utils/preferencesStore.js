/**
 * Framework-free store for the preferences, so the navbar, tutor, voice controls and every page read the same
 * value without a provider. React reads it through `usePreferences`.
 */
import { applyPreferenceChange, loadPreferences, PREFERENCES_STORAGE_KEY, savePreferences } from './preferences.js';

export function createPreferencesStore({ storage } = {}) {
  const listeners = new Set();
  const loaded = storage === undefined ? loadPreferences() : loadPreferences(storage);
  let snapshot = { preferences: loaded.preferences, issue: loaded.issue, saveFailed: false };

  const publish = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Change one or more preferences. Returns whether the browser accepted the write. */
    update(change) {
      const preferences = applyPreferenceChange(snapshot.preferences, change);
      const saved = storage === undefined ? savePreferences(preferences) : savePreferences(preferences, storage);
      publish({ preferences, saveFailed: !saved });
      return saved;
    },

    /** Re-read storage (another tab changed it). */
    reload() {
      const next = storage === undefined ? loadPreferences() : loadPreferences(storage);
      publish({ preferences: next.preferences, issue: next.issue, saveFailed: false });
    }
  };
}

let sharedStore = null;

/** The one store the app uses. Created on first use so importing this module has no side effects. */
export function getPreferencesStore() {
  if (!sharedStore) {
    sharedStore = createPreferencesStore();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === null || event.key === PREFERENCES_STORAGE_KEY) {
          sharedStore.reload();
        }
      });
    }
  }

  return sharedStore;
}
