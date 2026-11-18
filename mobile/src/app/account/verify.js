import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Screen, T } from '../../components/ui';
import { errorText, useT } from '../../lib/i18n';

export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const { t } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const request = () => api('/auth/email/send', { method: 'POST' })
    .then((r) => (r.sent ? t('verify.sent', { email: user.email }) : t('verify.recent', { email: user.email })));
  const send = () => request().then((n) => { setError(null); setNotice(n); }).catch((err) => setError(errorText(err, t)));

  // Send a code when the screen opens.
  useEffect(() => {
    let alive = true;
    if (user && !user.emailVerified) {
      request().then((n) => { if (alive) setNotice(n); }).catch((err) => { if (alive) setError(errorText(err, t)); });
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
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (user?.emailVerified) return <Screen edges={[]}><T variant="heading">{t('verify.done')}</T></Screen>;
  return (
    <Screen edges={[]}>
      <T color="textSecondary">{notice || t('verify.sending')}</T>
      <Field label={t('forgot.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={verify} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title={t('verify.button')} onPress={verify} loading={busy} disabled={code.length !== 6} style={{ marginTop: spacing.xl }} />
      <Button title={t('forgot.resend')} variant="ghost" onPress={send} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
