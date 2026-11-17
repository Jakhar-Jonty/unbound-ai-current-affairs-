import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Screen, T } from '../../components/ui';

export default function ChangePassword() {
  const { applySession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (next.length < 8) return setError('Use at least 8 characters for your new password.');
    setBusy(true);
    try {
      const session = await api('/auth/password/change', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      await applySession(session);
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <T color="textSecondary">Changing your password signs you out on your other devices.</T>
      <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters." onSubmitEditing={save} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title="Change password" onPress={save} loading={busy} disabled={!current || !next} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
