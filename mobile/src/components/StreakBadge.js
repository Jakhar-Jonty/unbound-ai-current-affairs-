import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useProgress } from '../lib/queries';
import { useTheme, spacing, radius } from '../theme';
import { T } from './ui';
import { useT } from '../lib/i18n';

/** Small "🔥 5-day streak" pill (`compact`: "🔥 5"). Hidden when there is no active streak. */
export default function StreakBadge({ compact }) {
  const c = useTheme();
  const { t } = useT();
  const { data } = useProgress();
  const n = data?.progress?.streak?.current || 0;
  if (!n) return null;
  return (
    <View
      accessibilityLabel={t('streak.days', { n })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.accentSoft, alignSelf: 'flex-start' }}
    >
      <Ionicons name="flame" size={16} color={c.accent} />
      <T variant="small" style={{ fontWeight: '700' }}>{compact ? n : t('streak.days', { n })}</T>
    </View>
  );
}
