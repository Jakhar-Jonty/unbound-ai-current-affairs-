import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, spacing, radius, type } from '../theme';

export function T({ variant = 'body', color, style, ...props }) {
  const c = useTheme();
  return <Text style={[type[variant], { color: color ? c[color] ?? color : c.text }, style]} {...props} />;
}

/** Full-screen scrollable container with safe-area padding. */
export function Screen({ children, scroll = true, padded = true, edges = ['top'], refreshControl, contentStyle, onScroll, scrollRef }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top + spacing.md : spacing.md,
    paddingBottom: insets.bottom + spacing.xl,
    paddingHorizontal: padded ? spacing.lg : 0,
  };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.background }, pad, contentStyle]}>{children}</View>;
  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={[pad, contentStyle]} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={onScroll ? 32 : undefined}>
      {children}
    </ScrollView>
  );
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, accessibilityLabel }) {
  const c = useTheme();
  const styles = {
    primary: { bg: c.accent, fg: c.onAccent, border: c.accent },
    dark: { bg: c.inverse, fg: c.onInverse, border: c.inverse },
    outline: { bg: 'transparent', fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [s.button, { backgroundColor: styles.bg, borderColor: styles.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={styles.fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={styles.fg} /> : null}
          <Text style={[type.heading, { color: styles.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, onPress, style, accessibilityLabel }) {
  const c = useTheme();
  const base = [s.card, { borderColor: c.border, backgroundColor: c.surface }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

export function Tag({ label, active, onPress }) {
  const c = useTheme();
  const body = (
    <Text style={[type.caption, { color: active ? c.onAccent : c.textSecondary }]} numberOfLines={1}>{label.toUpperCase()}</Text>
  );
  const style = [s.tag, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accent : 'transparent' }];
  if (!onPress) return <View style={style}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={style}>{body}</Pressable>;
}

export function Loading({ label = 'Loading' }) {
  const c = useTheme();
  return (
    <View style={s.center} accessibilityLabel={label}>
      <ActivityIndicator color={c.accent} size="large" />
    </View>
  );
}

export function Empty({ icon = 'newspaper-outline', title, message, action }) {
  const c = useTheme();
  return (
    <View style={[s.center, { paddingVertical: spacing.xxl }]}>
      <Ionicons name={icon} size={40} color={c.textMuted} />
      <T variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>{title}</T>
      {message ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs, textAlign: 'center', maxWidth: 300 }}>{message}</T> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }) {
  return (
    <Empty
      icon="cloud-offline-outline"
      title="Something went wrong"
      message={error?.message || 'Please try again.'}
      action={onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : null}
    />
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={s.sectionRow}>
      <T variant="caption" color="textSecondary">{String(children).toUpperCase()}</T>
      {right}
    </View>
  );
}

export function ProgressBar({ value, max = 100, height = 6 }) {
  const c = useTheme();
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.border, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: c.accent, borderRadius: height }} />
    </View>
  );
}

/** Small notice shown when content comes from the offline copy. */
export function OfflineNote({ message = 'You’re offline. Showing your saved copy.' }) {
  const c = useTheme();
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.accentSoft, marginBottom: spacing.lg }}>
      <Ionicons name="cloud-offline-outline" size={18} color={c.text} />
      <T variant="small" style={{ flex: 1 }}>{message}</T>
    </View>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong, marginVertical: spacing.lg }} />;
}

const s = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
});
