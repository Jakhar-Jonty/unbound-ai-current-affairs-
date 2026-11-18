import { Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { useTheme, spacing } from '../../theme';
import SignInPrompt from '../../components/SignInPrompt';
import { Card, Screen, T } from '../../components/ui';

function Row({ icon, title, sub, value, onChange }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Ionicons name={icon} size={22} color={c.text} />
      <View style={{ flex: 1 }}>
        <T variant="heading">{title}</T>
        <T variant="small" color="textSecondary">{sub}</T>
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange}
        trackColor={{ true: c.accent, false: c.border }} thumbColor={c.background} activeThumbColor={c.background} />
    </View>
  );
}

/** Which reminders this account gets (stored on the account, so the server can respect it). */
export default function NotificationSettings() {
  const c = useTheme();
  const { t } = useT();
  const { user, signedIn, updateProfile } = useAuth();
  if (!signedIn) return <Screen edges={[]}><SignInPrompt icon="notifications-outline" /></Screen>;
  const prefs = user.notificationPrefs || { dailyReminder: true, mock: true };
  const set = (k) => (v) => updateProfile({ notificationPrefs: { [k]: v } }).catch(() => {});
  return (
    <Screen edges={[]}>
      <T color="textSecondary">{t('notif.intro')}</T>
      <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.xs }}>
        <Row icon="flame-outline" title={t('notif.daily')} sub={t('notif.dailySub')} value={prefs.dailyReminder !== false} onChange={set('dailyReminder')} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Row icon="ribbon-outline" title={t('notif.mock')} sub={t('notif.mockSub')} value={prefs.mock !== false} onChange={set('mock')} />
      </Card>
      <T variant="small" color="textSecondary" style={{ marginTop: spacing.lg }}>{t('notif.morning')}</T>
      <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>{t('notif.permission')}</T>
    </Screen>
  );
}
