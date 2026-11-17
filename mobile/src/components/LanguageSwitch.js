import { Pressable, View } from 'react-native';
import { usePrefs } from '../lib/prefs';
import { tap } from '../lib/haptics';
import { useTheme, spacing, radius } from '../theme';
import { T } from './ui';

const OPTIONS = [['en', 'English'], ['hi', 'हिंदी']];

/** English / हिंदी segmented switch for article and quiz content. */
export default function LanguageSwitch({ compact = false }) {
  const c = useTheme();
  const { prefs, update } = usePrefs();
  const lang = prefs.lang === 'hi' ? 'hi' : 'en';
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Content language" style={{ flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start' }}>
      {OPTIONS.map(([key, label]) => {
        const on = lang === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={key === 'hi' ? 'Hindi' : 'English'}
            onPress={() => { if (!on) { tap(); update({ lang: key }); } }}
            style={{ paddingHorizontal: compact ? spacing.sm : spacing.md, paddingVertical: compact ? 3 : 6, borderRadius: radius.pill, backgroundColor: on ? c.inverse : 'transparent' }}
          >
            <T variant="small" style={{ fontWeight: '700', color: on ? c.onInverse : c.textSecondary }}>{compact && key === 'en' ? 'EN' : compact ? 'हिं' : label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
