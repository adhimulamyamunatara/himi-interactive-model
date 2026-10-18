import { useSyncExternalStore } from 'react';
import { getLearningProfileStore } from '../utils/learningProfileStore';

/** The learning profile snapshot plus the actions to change it. */
export function useLearningProfile() {
  const store = getLearningProfileStore();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return { ...snapshot, store };
}
