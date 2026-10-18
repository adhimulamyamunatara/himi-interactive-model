import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const USER_STORAGE_KEY = 'himi.user';
const UserContext = createContext(null);

const EMPTY_PROFILE = {
  college: '',
  branch: '',
  semester: '',
  learningGoal: ''
};

function readStoredUser() {
  const storedValue = window.localStorage.getItem(USER_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

function persistUser(user) {
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function UserProvider({ children }) {
  // localStorage is synchronous, so the session is restored during the first render
  // (no flash of the logged-out UI). `loading` stays in the API for future async auth.
  const [user, setUser] = useState(readStoredUser);

  /**
   * Persist a normalized user profile to local storage.
   *
   * @param {{name: string, email: string}} payload
   */
  const login = useCallback((payload) => {
    const nextUser = {
      ...EMPTY_PROFILE,
      name: payload.name.trim(),
      email: payload.email.trim()
    };

    setUser(nextUser);
    persistUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  /**
   * Merge profile changes into the persisted user state.
   *
   * @param {Record<string, string>} updates
   */
  const updateProfile = useCallback((updates) => {
    const nextUser = { ...EMPTY_PROFILE, ...(readStoredUser() ?? {}), ...updates };

    setUser(nextUser);
    persistUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({ user, loading: false, login, logout, updateProfile }),
    [login, logout, updateProfile, user]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }

  return context;
}
