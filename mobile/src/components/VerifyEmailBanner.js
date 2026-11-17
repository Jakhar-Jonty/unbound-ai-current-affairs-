import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useTheme, spacing, radius } from '../theme';
import { T } from './ui';

export default function VerifyEmailBanner() {
  const c = useTheme();
  const { user } = useAuth();
  if (!user || user.offline || user.emailVerified !== false) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Verify your email"
      onPress={() => router.push('/account/verify')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent, marginBottom: spacing.md, opacity: pressed ? 0.8 : 1 })}
    >
      <Ionicons name="mail-unread-outline" size={20} color={c.text} />
      <View style={{ flex: 1 }}>
        <T variant="small" style={{ fontWeight: '700' }}>Verify your email</T>
        <T variant="small" color="textSecondary">So you can recover your account and get receipts.</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}
