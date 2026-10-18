import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_AVATAR_COLOR, isAvatarColor, isValidAvatarDataUrl } from '../utils/avatar';
import { getSpeechOutput } from '../utils/speechOutput';
import { normalizeStoredUser } from '../utils/userProfile';

const USER_STORAGE_KEY = 'himi.user';
const UserContext = createContext(null);

const EMPTY_PROFILE = {
  college: '',
  branch: '',
  semester: '',
  learningGoal: '',
  avatarColor: DEFAULT_AVATAR_COLOR
};

function readStoredUser() {
  const storedValue = window.localStorage.getItem(USER_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const user = normalizeStoredUser(JSON.parse(storedValue));

    if (!user) {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }

    return user;
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

/** @returns {boolean} false when the browser refused the write (for example: storage full or blocked). */
function persistUser(user) {
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return true;
  } catch {
    return false;
  }
}

const STORAGE_FULL_MESSAGE = 'Your browser could not save this change. Free up some storage space and try again.';

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
    getSpeechOutput().stop();
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

  /**
   * Avatar changes are saved first and only shown if the browser accepted them, so a full storage never leaves
   * the screen and the saved data disagreeing.
   *
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  const commitAvatar = useCallback((changes) => {
    const current = readStoredUser();

    if (!current) {
      return { ok: false, error: 'Please log in again to change your avatar.' };
    }

    const next = { ...current, ...changes };

    if (next.avatarImage === undefined) {
      delete next.avatarImage;
    }

    if (!persistUser(next)) {
      return { ok: false, error: STORAGE_FULL_MESSAGE };
    }

    setUser(next);
    return { ok: true };
  }, []);

  const setAvatarImage = useCallback(
    (dataUrl) => (isValidAvatarDataUrl(dataUrl) ? commitAvatar({ avatarImage: dataUrl }) : { ok: false, error: 'That image cannot be used as an avatar.' }),
    [commitAvatar]
  );

  const removeAvatarImage = useCallback(() => commitAvatar({ avatarImage: undefined }), [commitAvatar]);

  const setAvatarColor = useCallback(
    (key) => (isAvatarColor(key) ? commitAvatar({ avatarColor: key }) : { ok: false, error: 'Choose one of the listed colours.' }),
    [commitAvatar]
  );

  const value = useMemo(
    () => ({ user, loading: false, login, logout, updateProfile, setAvatarImage, removeAvatarImage, setAvatarColor }),
    [login, logout, updateProfile, setAvatarImage, removeAvatarImage, setAvatarColor, user]
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
