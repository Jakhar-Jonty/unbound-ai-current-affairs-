import { useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from '../lib/motion';

/**
 * Pressable that shrinks slightly while pressed, for tactile feedback. The scale is
 * applied to an outer Animated.View so the Pressable keeps its own layout styles.
 */
export default function PressableScale({ style, containerStyle, scaleTo = 0.97, onPressIn, onPressOut, children, ...props }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  // Width-affecting styles go on the wrapper so flex layouts still work.
  const flat = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) || {};
  const { flex, width, alignSelf, ...inner } = flat;
  return (
    <Animated.View style={[{ flex, width, alignSelf }, containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPressIn={(e) => { if (!reduced) to(scaleTo); onPressIn?.(e); }}
        onPressOut={(e) => { if (!reduced) to(1); onPressOut?.(e); }}
        style={typeof style === 'function' ? (st) => { const { flex: _f, width: _w, alignSelf: _a, ...rest } = StyleSheet.flatten(style(st)) || {}; return rest; } : inner}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
