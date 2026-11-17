import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from '../lib/motion';

/** Wraps an answer option: shakes when it's a wrong pick, pulses when it's the right answer. */
export default function AnswerFeedback({ state, children }) {
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced || state === 'none') return;
    if (state === 'wrong') {
      Animated.sequence([10, -10, 7, -7, 3, 0].map((v) => Animated.timing(x, { toValue: v, duration: 50, useNativeDriver: true }))).start();
    } else if (state === 'correct') {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.04, speed: 30, bounciness: 12, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [state, reduced, x, scale]);
  return <Animated.View style={{ transform: [{ translateX: x }, { scale }] }}>{children}</Animated.View>;
}
