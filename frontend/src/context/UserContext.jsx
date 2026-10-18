import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const USER_STORAGE_KEY = 'himi.user';
const UserContext = createContext(null);

function readStoredUser() {
  if (typeof window === 'undefined') {
    return null;
  }

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

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setLoading(false);
  }, []);

  const value = useMemo(() => {
    /**
     * Persist a normalized user profile to local storage.
     *
     * @param {{name: string, email: string}} payload
     */
    function login(payload) {
      const nextUser = {
        name: payload.name.trim(),
        email: payload.email.trim(),
        college: '',
        branch: '',
        semester: '',
        learningGoal: ''
      };

      setUser(nextUser);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    }

    function logout() {
      setUser(null);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }

    /**
     * Merge profile changes into the persisted user state.
     *
     * @param {Record<string, string>} updates
     */
    function updateProfile(updates) {
      setUser((currentUser) => {
        const nextUser = {
          ...(currentUser ?? readStoredUser() ?? {}),
          ...updates
        };

        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
        return nextUser;
      });
    }

    return {
      user,
      loading,
      login,
      logout,
      updateProfile
    };
  }, [loading, user]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }

  return context;
}

export function useAuth() {
  return useUser();
}