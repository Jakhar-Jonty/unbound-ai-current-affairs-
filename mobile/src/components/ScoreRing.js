import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { useReducedMotion } from '../lib/motion';
import { T } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Animated ring that fills to score/total, with the score counting up in the middle. */
export default function ScoreRing({ score, total, size = 160, stroke = 12, onDark = true }) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const pct = total ? score / total : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [progress] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced) {
      progress.setValue(pct);
      const t = setTimeout(() => setShown(score), 0);
      return () => clearTimeout(t);
    }
    const id = progress.addListener(({ value }) => setShown(Math.round(value * total)));
    Animated.timing(progress, { toValue: pct, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [pct, total, score, reduced, progress]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  // The card behind the ring is black in light mode and ivory in dark mode.
  const track = !onDark ? c.border : c.scheme === 'dark' ? 'rgba(21,21,21,0.12)' : 'rgba(245,242,236,0.15)';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${score} out of ${total}`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={c.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset} />
      </Svg>
      <T style={{ fontSize: 44, lineHeight: 50, fontWeight: '800', color: onDark ? c.onInverse : c.text }}>{shown}</T>
      <T variant="small" color={onDark ? c.onInverse : 'textSecondary'} style={{ opacity: 0.8 }}>out of {total}</T>
    </View>
  );
}
