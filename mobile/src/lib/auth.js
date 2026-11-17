import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { getItem, setItem, removeItem } from './storage';
import { registerForPush, unregisterPush } from './push';
import { clearOffline, setOfflineAllowed } from './offline';
import { clearReading } from './reading';
import { claimGuestData } from './guest';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser'; // Last known profile, so the app knows who's signed in when it starts offline.

const rememberUser = (user) => setItem(USER_KEY, JSON.stringify(user));
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ loading: true, user: null });

  const clear = useCallback(async () => {
    setAuthToken(null);
    await removeItem(TOKEN_KEY);
    await removeItem(USER_KEY);
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
        await rememberUser(user);
        setState({ loading: false, user });
        registerForPush();
      } catch (err) {
        if (err.status !== 0) return clear();
        // Offline: keep the session with the last known profile so saved items still work.
        let cached = null;
        try { cached = JSON.parse((await getItem(USER_KEY)) || 'null'); } catch { /* ignore */ }
        setState({ loading: false, user: { ...(cached || {}), offline: true } });
      }
    })();
  }, [clear]);

  // Started offline: keep checking, and switch back to normal once the server is reachable.
  useEffect(() => {
    if (!state.user?.offline) return undefined;
    const timer = setInterval(async () => {
      try {
        const { user } = await api('/auth/me');
        await rememberUser(user);
        setState({ loading: false, user });
        queryClient.invalidateQueries();
      } catch (err) {
        if (err.status && err.status !== 0) clear();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [state.user?.offline, queryClient, clear]);

  const startSession = useCallback(async ({ user, token }) => {
    setAuthToken(token);
    await setItem(TOKEN_KEY, token);
    await rememberUser(user);
    queryClient.removeQueries({ queryKey: ['me'] });
    setState({ loading: false, user });
    registerForPush();
    // Move anything done as a guest on this device into the account.
    claimGuestData().then((moved) => {
      if (moved.quizzes || moved.saves) queryClient.invalidateQueries();
    }).catch(() => {});
  }, [queryClient]);

  // Offline downloads follow premium status (everyone has it while premium is switched off).
  setOfflineAllowed(!!state.user?.premium?.active);

  const value = useMemo(() => ({
    ...state,
    signedIn: !!state.user,
    signIn: async (email, password) => startSession(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (name, email, password) => startSession(await api('/auth/register', { method: 'POST', body: { name, email, password } })),
    signOut: async () => { await unregisterPush(); await clearOffline(); await clearReading(); await clear(); },
    // Reloads the profile (e.g. after buying Premium or verifying email).
    refreshUser: async () => {
      const { user } = await api('/auth/me');
      await rememberUser(user);
      setState((st) => ({ ...st, user }));
      return user;
    },
    setUser: async (user) => {
      await rememberUser(user);
      setState((st) => ({ ...st, user }));
    },
    signInWithGoogle: async (idToken) => startSession(await api('/auth/google', { method: 'POST', body: { idToken } })),
    signInWithApple: async (identityToken, fullName) => startSession(await api('/auth/apple', { method: 'POST', body: { identityToken, fullName } })),
    updateProfile: async (changes) => {
      const { user } = await api('/auth/me', { method: 'PATCH', body: changes });
      await rememberUser(user);
      setState((st) => ({ ...st, user }));
      return user;
    },
    // For flows that return a fresh session (password reset / change).
    applySession: startSession,
    deleteAccount: async (password) => {
      await unregisterPush();
      await api('/auth/me', { method: 'DELETE', body: password === 'DELETE' ? { confirm: 'DELETE' } : { password } });
      await clearOffline();
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
