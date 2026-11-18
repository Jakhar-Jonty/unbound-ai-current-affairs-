import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useTheme, spacing, radius } from '../theme';
import { Button, Card, T } from './ui';
import { useT } from '../lib/i18n';

export const isPremiumError = (err) => err?.code === 'premium_required';

/** Small "PREMIUM" label for locked items in lists (hidden for premium users). */
export function PremiumBadge({ locked }) {
  const c = useTheme();
  const { user } = useAuth();
  const { t } = useT();
  if (!locked || user?.premium?.active) return null;
  return (
    <View accessibilityLabel={t('titles.premium')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.inverse, alignSelf: 'flex-start' }}>
      <Ionicons name="lock-closed" size={10} color={c.accent} />
      <T variant="caption" color={c.onInverse}>{t('premium.label')}</T>
    </View>
  );
}

/** Shown in place of a premium feature: what it is and how to get it. */
export function PremiumGate({ title, message, teaser }) {
  const c = useTheme();
  const { t } = useT();
  const { signedIn } = useAuth();
  return (
    <View style={{ paddingVertical: spacing.lg }}>
      {teaser ? (
        <View style={{ marginBottom: spacing.lg }}>
          <T variant="title">{teaser.title}</T>
          <T color="textSecondary" style={{ marginTop: spacing.sm }}>{teaser.summary}</T>
        </View>
      ) : null}
      <Card style={{ backgroundColor: c.inverse, borderColor: c.inverse }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="sparkles" size={20} color={c.accent} />
          <T variant="heading" color={c.onInverse}>{title || t('premium.part')}</T>
        </View>
        {message ? <T variant="small" color={c.onInverse} style={{ marginTop: spacing.sm, opacity: 0.85 }}>{message}</T> : null}
        <Button
          title={signedIn ? t('premium.see') : t('common.signIn')}
          icon={signedIn ? 'sparkles-outline' : 'log-in-outline'}
          onPress={() => router.push(signedIn ? '/premium' : '/login')}
          style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}
        />
      </Card>
    </View>
  );
}
