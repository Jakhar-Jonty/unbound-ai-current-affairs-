import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device preferences: text size, intro seen, feed, language and theme (system | light | dark). */
const KEY = 'prefs:v1';
const DEFAULTS = { textScale: 1, onboarded: false, subjects: [], feed: 'all', lang: 'en', theme: 'system' };
export const THEMES = ['system', 'light', 'dark'];
export const TEXT_SCALES = [0.9, 1, 1.15, 1.3];

export const PrefsContext = createContext(null);

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
  // Native pieces we don't draw ourselves (alerts, keyboard, pickers) follow the chosen theme too.
  const theme = prefs?.theme;
  useEffect(() => {
    if (Platform.OS === 'web' || !theme) return;
    try { Appearance.setColorScheme(theme === 'system' ? 'auto' : theme); } catch { /* older native runtime */ }
  }, [theme]);
  const value = useMemo(() => ({ prefs: prefs || DEFAULTS, ready: !!prefs, update }), [prefs, update]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
