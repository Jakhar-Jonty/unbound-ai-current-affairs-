import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { spacing } from '../theme';
import Field from './Field';
import SocialSignIn from './SocialSignIn';
import { errorText, useT } from '../lib/i18n';
import { Button, Screen, T } from './ui';

export default function AuthForm({ mode }) {
  const { signIn, register } = useAuth();
  const { t } = useT();
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (isRegister && password.length < 8) return setError(t('errors.password8'));
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      setError(err.status === 400 ? t('errors.checkDetails') : errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'flex-end', padding: spacing.sm }}>
          <T variant="heading">{t('common.close')}</T>
        </Pressable>
        <T variant="display" style={{ marginTop: spacing.lg }}>{isRegister ? t('auth.createTitle') : t('auth.welcomeBack')}</T>
        <T color="textSecondary" style={{ marginTop: spacing.sm }}>
          {isRegister ? t('auth.createIntro') : t('auth.signInIntro')}
        </T>
        <SocialSignIn onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {isRegister ? <Field label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" /> : null}
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete={isRegister ? 'new-password' : 'current-password'} textContentType={isRegister ? 'newPassword' : 'password'} onSubmitEditing={submit} />
        {!isRegister ? (
          <T variant="small" accessibilityRole="link" onPress={() => router.push(email ? `/forgot?email=${encodeURIComponent(email.trim())}` : '/forgot')} style={{ marginTop: spacing.md, alignSelf: 'flex-end', textDecorationLine: 'underline' }}>
            {t('auth.forgot')}
          </T>
        ) : null}
        {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">{error}</T> : null}
        <Button title={isRegister ? t('auth.createAccount') : t('common.signIn')} onPress={submit} loading={busy} disabled={!email || !password || (isRegister && !name)} style={{ marginTop: spacing.xl }} />
        <Button
          title={isRegister ? t('common.haveAccount') : t('common.createFreeAccount')}
          variant="ghost"
          onPress={() => router.replace(isRegister ? '/login' : '/register')}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
