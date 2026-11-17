import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '../lib/motion';

/** Fades and slides its content in on mount. Give it a `key` to replay on change. */
export default function FadeIn({ children, from = 16, duration = 220, style }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, duration, reduced]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
