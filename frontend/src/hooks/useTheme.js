import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { applyTheme, DARK_QUERY, resolveTheme, systemPrefersDark } from '../utils/theme';
import { usePreferences } from './usePreferences';

function subscribeToSystem(callback) {
  const query = typeof window !== 'undefined' ? window.matchMedia?.(DARK_QUERY) : null;
  query?.addEventListener?.('change', callback);
  return () => query?.removeEventListener?.('change', callback);
}

/**
 * The student's theme choice and the theme actually drawn ('light' | 'dark'). Following the device ('system')
 * updates live when the device switches. Pass `{ apply: true }` once, near the app root, to keep `<html>` in sync.
 */
export function useTheme({ apply = false } = {}) {
  const { preferences, update } = usePreferences();
  const prefersDark = useSyncExternalStore(subscribeToSystem, () => systemPrefersDark(), () => false);
  const choice = preferences.theme;
  const resolved = resolveTheme(choice, prefersDark);

  useEffect(() => {
    if (apply) {
      applyTheme(resolved);
    }
  }, [apply, resolved]);

  const setTheme = useCallback((theme) => update({ theme }), [update]);

  return { choice, resolved, setTheme };
}
