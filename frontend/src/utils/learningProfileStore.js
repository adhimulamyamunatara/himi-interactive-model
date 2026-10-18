/**
 * A small framework-free store for the learning profile, so the page, chat, quiz and planner all
 * read the same value without a provider. React reads it through `useLearningProfile`.
 */
import {
  addDifficultTopic,
  attachProfile,
  buildProfilePayload,
  createDefaultProfile,
  normalizeProfile
} from './learningProfile.js';
import {
  clearLearningProfileStorage,
  createDefaultState,
  getBrowserStorage,
  loadLearningProfileState,
  LEARNING_PROFILE_STORAGE_KEY,
  saveLearningProfileState
} from './learningProfileStorage.js';

export function createLearningProfileStore({ storage = getBrowserStorage(), now = () => new Date() } = {}) {
  const listeners = new Set();
  const loaded = loadLearningProfileState(storage);
  let snapshot = { state: loaded.state, issue: loaded.issue, saveFailed: false };

  const publish = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  /** Persist a new state and publish it. @returns {boolean} whether the browser accepted the write. */
  const commit = (state) => {
    const saved = saveLearningProfileState(state, storage);
    publish({ state, saveFailed: !saved });
    return saved;
  };

  const stamp = () => now().toISOString();

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Save an edited profile (the student pressed "Save"). */
    saveProfile(profile) {
      const state = { ...snapshot.state, profile: normalizeProfile(profile), touched: true, updatedAt: stamp() };
      return { saved: commit(state) };
    },

    setEnabled(enabled) {
      return { saved: commit({ ...snapshot.state, enabled: Boolean(enabled) }) };
    },

    /** Mark one topic as difficult (for example from the progress page). */
    markTopicDifficult(subject, topic) {
      const result = addDifficultTopic(snapshot.state.profile.difficultTopics, { subject, topic });

      if (result.error) {
        return { added: false, error: result.error, saved: true };
      }

      const profile = { ...snapshot.state.profile, difficultTopics: result.list };
      return { added: true, error: null, saved: commit({ ...snapshot.state, profile, touched: true, updatedAt: stamp() }) };
    },

    /** Back to the default preferences. Keeps the on/off choice. */
    reset() {
      const state = { ...snapshot.state, profile: createDefaultProfile(), touched: false, updatedAt: stamp() };
      return { saved: commit(state) };
    },

    /** Remove everything this feature stored, including the recovery copy. */
    deleteAll() {
      const cleared = clearLearningProfileStorage(storage);
      publish({ state: createDefaultState(), issue: null, saveFailed: !cleared });
      return { cleared };
    },

    dismissIssue() {
      publish({ issue: null });
    },

    /** Re-read storage (another tab changed it). */
    reload() {
      const next = loadLearningProfileState(storage);
      publish({ state: next.state, issue: next.issue, saveFailed: false });
    },

    /** The profile to attach to an AI request, or null when personalisation is off or not set up yet. */
    getPersonalizationPayload() {
      const { enabled, touched, profile } = snapshot.state;
      return enabled && touched ? buildProfilePayload(profile) : null;
    },

    /** Convenience for services: add the profile to a request when appropriate. */
    personalize(request, key) {
      return attachProfile(request, key, this.getPersonalizationPayload());
    }
  };
}

let sharedStore = null;

/** The one store the app uses. Created on first use so that importing this module is side-effect free. */
export function getLearningProfileStore() {
  if (!sharedStore) {
    sharedStore = createLearningProfileStore();

    if (typeof window !== 'undefined') {
      // Another tab edited the profile.
      window.addEventListener('storage', (event) => {
        if (event.key === null || event.key === LEARNING_PROFILE_STORAGE_KEY) {
          sharedStore.reload();
        }
      });
    }
  }

  return sharedStore;
}
