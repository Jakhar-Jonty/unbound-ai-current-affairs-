import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { THEMES, usePrefs } from '../lib/prefs';
import { tap } from '../lib/haptics';
import { useT } from '../lib/i18n';
import { useTheme, spacing, radius } from '../theme';

const ICONS = { system: 'phone-portrait-outline', light: 'sunny-outline', dark: 'moon-outline' };

/** System / Light / Dark segmented switch (icons; names are read out by screen readers). */
export default function ThemeSwitch() {
  const c = useTheme();
  const { t } = useT();
  const { prefs, update } = usePrefs();
  const current = THEMES.includes(prefs.theme) ? prefs.theme : 'system';
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('theme.title')} style={{ flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border }}>
      {THEMES.map((key) => {
        const on = current === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t(`theme.${key}`)}
            hitSlop={4}
            onPress={() => { if (!on) { tap(); update({ theme: key }); } }}
            style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: on ? c.inverse : 'transparent' }}
          >
            <Ionicons name={ICONS[key]} size={16} color={on ? c.onInverse : c.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}
