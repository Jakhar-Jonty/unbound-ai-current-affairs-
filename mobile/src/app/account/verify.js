import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Screen, T } from '../../components/ui';

export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const request = () => api('/auth/email/send', { method: 'POST' })
    .then((r) => r.sent ? `We’ve sent a 6-digit code to ${user.email}.` : `A code was sent to ${user.email} recently. Check your inbox (and spam).`);
  const send = () => request().then((n) => { setError(null); setNotice(n); }).catch((err) => setError(err.message));

  // Send a code when the screen opens.
  useEffect(() => {
    let alive = true;
    if (user && !user.emailVerified) {
      request().then((n) => { if (alive) setNotice(n); }).catch((err) => { if (alive) setError(err.message); });
    }
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await api('/auth/email/verify', { method: 'POST', body: { code } });
      await setUser(r.user);
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (user?.emailVerified) return <Screen edges={[]}><T variant="heading">Your email is verified.</T></Screen>;
  return (
    <Screen edges={[]}>
      <T color="textSecondary">{notice || 'Sending your code…'}</T>
      <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={verify} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title="Verify" onPress={verify} loading={busy} disabled={code.length !== 6} style={{ marginTop: spacing.xl }} />
      <Button title="Send a new code" variant="ghost" onPress={send} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
