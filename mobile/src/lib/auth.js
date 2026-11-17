import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { getItem, setItem, removeItem } from './storage';
import { registerForPush, unregisterPush } from './push';

const TOKEN_KEY = 'authToken';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ loading: true, user: null });

  const clear = useCallback(async () => {
    setAuthToken(null);
    await removeItem(TOKEN_KEY);
    queryClient.removeQueries({ queryKey: ['me'] });
    setState({ loading: false, user: null });
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => { clear(); });
    (async () => {
      const token = await getItem(TOKEN_KEY);
      if (!token) return setState({ loading: false, user: null });
      setAuthToken(token);
      try {
        const { user } = await api('/auth/me');
        setState({ loading: false, user });
        registerForPush();
      } catch (err) {
        // Offline: keep the session and let screens show their own errors.
        if (err.status === 0) setState({ loading: false, user: { offline: true } });
        else await clear();
      }
    })();
  }, [clear]);

  const startSession = useCallback(async ({ user, token }) => {
    setAuthToken(token);
    await setItem(TOKEN_KEY, token);
    queryClient.removeQueries({ queryKey: ['me'] });
    setState({ loading: false, user });
    registerForPush();
  }, [queryClient]);

  const value = useMemo(() => ({
    ...state,
    signedIn: !!state.user,
    signIn: async (email, password) => startSession(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (name, email, password) => startSession(await api('/auth/register', { method: 'POST', body: { name, email, password } })),
    signOut: async () => { await unregisterPush(); await clear(); },
    // For flows that return a fresh session (password reset / change).
    applySession: startSession,
    deleteAccount: async (password) => {
      await unregisterPush();
      await api('/auth/me', { method: 'DELETE', body: { password } });
      await clear();
    },
  }), [state, startSession, clear]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
