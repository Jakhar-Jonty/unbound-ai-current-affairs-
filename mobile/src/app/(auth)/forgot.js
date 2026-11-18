import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Screen, T } from '../../components/ui';
import { errorText, useT } from '../../lib/i18n';

export default function ForgotPassword() {
  const { applySession } = useAuth();
  const { t } = useT();
  const params = useLocalSearchParams();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try { await fn(); } catch (err) { setError(errorText(err, t)); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    await api('/auth/password/forgot', { method: 'POST', body: { email: email.trim() } });
    setNotice(t('forgot.sent', { email: email.trim() }));
    setStep('code');
  });

  const reset = () => run(async () => {
    if (password.length < 8) throw new Error(t('acct.password8'));
    const session = await api('/auth/password/reset', { method: 'POST', body: { email: email.trim(), code: code.trim(), password } });
    await applySession(session);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={{ alignSelf: 'flex-start', padding: spacing.sm, marginLeft: -spacing.sm }}>
          <T variant="heading">{t('common.back')}</T>
        </Pressable>
        <T variant="display" style={{ marginTop: spacing.lg }}>{t('forgot.title')}</T>
        {step === 'email' ? (
          <>
            <T color="textSecondary" style={{ marginTop: spacing.sm }}>{t('forgot.intro')}</T>
            <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={sendCode} />
            {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
            <Button title={t('forgot.sendCode')} onPress={sendCode} loading={busy} disabled={!email.includes('@')} style={{ marginTop: spacing.xl }} />
          </>
        ) : (
          <>
            <T color="textSecondary" style={{ marginTop: spacing.sm }}>{notice}</T>
            <Field label={t('forgot.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Field label={t('forgot.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('forgot.atLeast8')} onSubmitEditing={reset} />
            {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
            <Button title={t('forgot.setPassword')} onPress={reset} loading={busy} disabled={code.length !== 6 || !password} style={{ marginTop: spacing.xl }} />
            <Button title={t('forgot.resend')} variant="ghost" onPress={sendCode} disabled={busy} style={{ marginTop: spacing.sm }} />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
