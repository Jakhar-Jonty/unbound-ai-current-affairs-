import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme, spacing, radius, type } from '../theme';
import { T } from './ui';

export default function Field({ label, hint, ...props }) {
  const c = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <T variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>{label.toUpperCase()}</T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        style={[type.body, s.input, { color: c.text, borderColor: c.borderStrong }]}
        {...props}
      />
      {hint ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>{hint}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 50 },
});
