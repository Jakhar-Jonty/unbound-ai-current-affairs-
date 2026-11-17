import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useProgress } from '../lib/queries';
import { useReducedMotion } from '../lib/motion';
import { success } from '../lib/haptics';
import { useTheme, spacing, radius } from '../theme';
import { T } from './ui';

/** Shown on a fresh result: the flame pops in and the streak count is celebrated. */
export default function StreakCelebration() {
  const c = useTheme();
  const reduced = useReducedMotion();
  const { data } = useProgress();
  const streak = data?.progress?.streak;
  const [pop] = useState(() => new Animated.Value(0));
  const [flicker] = useState(() => new Animated.Value(1));
  const n = streak?.current || 0;

  useEffect(() => {
    if (!n) return undefined;
    success();
    if (reduced) { pop.setValue(1); return undefined; }
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 1.12, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(flicker, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]), { iterations: 3 });
    loop.start();
    return () => loop.stop();
  }, [n, reduced, pop, flicker]);

  if (!n) return null;
  const best = n >= (streak.best || 0) && n > 1;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${n}-day streak${best ? ', your best yet' : ''}`}
      style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }], marginTop: spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent }}>
        <Animated.View style={{ transform: [{ scale: flicker }] }}>
          <Ionicons name="flame" size={36} color={c.accent} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <T variant="title">{n}-day streak{best ? '!' : ''}</T>
          <T variant="small" color="textSecondary">{best ? 'Your best yet. ' : ''}Come back tomorrow to keep it going.</T>
        </View>
      </View>
    </Animated.View>
  );
}
