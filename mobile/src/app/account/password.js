import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Screen, T } from '../../components/ui';
import { errorText, useT } from '../../lib/i18n';

export default function ChangePassword() {
  const { applySession, user } = useAuth();
  const hasPassword = user?.hasPassword !== false;
  const { t } = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (next.length < 8) return setError(t('acct.password8'));
    setBusy(true);
    try {
      const session = await api('/auth/password/change', { method: 'POST', body: { ...(hasPassword ? { currentPassword: current } : {}), newPassword: next } });
      await applySession(session);
      router.back();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <T color="textSecondary">{hasPassword ? t('acct.changeNote') : t('acct.setNote')}</T>
      {hasPassword ? <Field label={t('acct.current')} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" /> : null}
      <Field label={t('forgot.newPassword')} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('forgot.atLeast8')} onSubmitEditing={save} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title={hasPassword ? t('profile.changePassword') : t('acct.setPassword')} onPress={save} loading={busy} disabled={(hasPassword && !current) || !next} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
