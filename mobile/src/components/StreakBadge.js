import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useProgress } from '../lib/queries';
import { useTheme, spacing, radius } from '../theme';
import { T } from './ui';

/** Small "🔥 5-day streak" pill. Hidden when there is no active streak. */
export default function StreakBadge() {
  const c = useTheme();
  const { data } = useProgress();
  const n = data?.progress?.streak?.current || 0;
  if (!n) return null;
  return (
    <View
      accessibilityLabel={`${n}-day streak`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.accentSoft, alignSelf: 'flex-start' }}
    >
      <Ionicons name="flame" size={16} color={c.accent} />
      <T variant="small" style={{ fontWeight: '700' }}>{n}-day streak</T>
    </View>
  );
}
