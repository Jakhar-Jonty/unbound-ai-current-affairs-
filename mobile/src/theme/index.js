import { useContext } from 'react';
import { useColorScheme } from 'react-native';
import { PrefsContext } from '../lib/prefs';
import { light, dark } from './colors';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 25 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
};

/** Current colours: the theme chosen in Profile, or the device's light/dark setting ("system"). */
export function useTheme() {
  const system = useColorScheme();
  const chosen = useContext(PrefsContext)?.prefs?.theme;
  const scheme = chosen === 'light' || chosen === 'dark' ? chosen : system;
  return scheme === 'dark' ? dark : light;
}
