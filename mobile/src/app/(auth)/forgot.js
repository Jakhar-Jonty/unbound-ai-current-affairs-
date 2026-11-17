import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Screen, T } from '../../components/ui';

export default function ForgotPassword() {
  const { applySession } = useAuth();
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
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    await api('/auth/password/forgot', { method: 'POST', body: { email: email.trim() } });
    setNotice(`If an account exists for ${email.trim()}, we’ve emailed a 6-digit code. It expires in 15 minutes.`);
    setStep('code');
  });

  const reset = () => run(async () => {
    if (password.length < 8) throw new Error('Use at least 8 characters for your new password.');
    const session = await api('/auth/password/reset', { method: 'POST', body: { email: email.trim(), code: code.trim(), password } });
    await applySession(session);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ alignSelf: 'flex-start', padding: spacing.sm, marginLeft: -spacing.sm }}>
          <T variant="heading">Back</T>
        </Pressable>
        <T variant="display" style={{ marginTop: spacing.lg }}>Reset password</T>
        {step === 'email' ? (
          <>
            <T color="textSecondary" style={{ marginTop: spacing.sm }}>Enter the email you signed up with and we’ll send you a code.</T>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={sendCode} />
            {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
            <Button title="Send code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} style={{ marginTop: spacing.xl }} />
          </>
        ) : (
          <>
            <T color="textSecondary" style={{ marginTop: spacing.sm }}>{notice}</T>
            <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters." onSubmitEditing={reset} />
            {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
            <Button title="Set new password" onPress={reset} loading={busy} disabled={code.length !== 6 || !password} style={{ marginTop: spacing.xl }} />
            <Button title="Send a new code" variant="ghost" onPress={sendCode} disabled={busy} style={{ marginTop: spacing.sm }} />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
