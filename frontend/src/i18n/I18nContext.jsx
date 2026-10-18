import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { t as translateKey } from './index.js';

const I18nContext = createContext(null);

/** Provides `t()` and the interface language, kept in sync with the saved preference and `<html lang>`. */
export function I18nProvider({ children }) {
  const { preferences, update } = usePreferences();
  const language = preferences.uiLanguage;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key, params) => translateKey(language, key, params), [language]);
  const setLanguage = useCallback((code) => update({ uiLanguage: code }), [update]);
  const value = useMemo(() => ({ t, language, setLanguage }), [t, language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useT must be used inside <I18nProvider>.');
  }

  return context;
}
