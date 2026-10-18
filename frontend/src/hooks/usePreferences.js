import { useSyncExternalStore } from 'react';
import { getPreferencesStore } from '../utils/preferencesStore';

/** The preferences snapshot plus `update(change)`. */
export function usePreferences() {
  const store = getPreferencesStore();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return { ...snapshot, update: store.update };
}
