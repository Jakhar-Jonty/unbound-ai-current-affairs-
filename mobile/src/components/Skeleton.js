import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useTheme, spacing, radius } from '../theme';

/** Pulsing grey block shown while content loads. */
export function Bone({ width = '100%', height = 14, style }) {
  const c = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: c.border, opacity: pulse }, style]} />;
}

/** Placeholder shaped like an article card. */
export function ArticleCardSkeleton() {
  const c = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}><Bone width={44} height={20} /><Bone width={110} height={20} /></View>
      <Bone height={18} width="92%" />
      <Bone height={18} width="70%" />
      <Bone width="100%" />
      <Bone width="85%" />
    </View>
  );
}

export function ListSkeleton({ count = 3 }) {
  return <View>{Array.from({ length: count }, (_, i) => <ArticleCardSkeleton key={i} />)}</View>;
}
