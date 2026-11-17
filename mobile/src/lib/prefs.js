import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device preferences: article text size and whether the intro has been seen. */
const KEY = 'prefs:v1';
const DEFAULTS = { textScale: 1, onboarded: false, subjects: [], feed: 'all' };
export const TEXT_SCALES = [0.9, 1, 1.15, 1.3];

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setPrefs({ ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) }))
      .catch(() => setPrefs(DEFAULTS));
  }, []);
  const update = useCallback((changes) => {
    setPrefs((p) => {
      const next = { ...p, ...changes };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const value = useMemo(() => ({ prefs: prefs || DEFAULTS, ready: !!prefs, update }), [prefs, update]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
