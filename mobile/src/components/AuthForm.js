import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useTheme, spacing, radius, type } from '../theme';
import { Button, Screen, T } from './ui';

function Field({ label, ...props }) {
  const c = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <T variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>{label.toUpperCase()}</T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        style={[type.body, s.input, { color: c.text, borderColor: c.borderStrong }]}
        {...props}
      />
    </View>
  );
}

export default function AuthForm({ mode }) {
  const { signIn, register } = useAuth();
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (isRegister && password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      setError(err.status === 400 ? 'Please check your details and try again.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'flex-end', padding: spacing.sm }}>
          <T variant="heading">Close</T>
        </Pressable>
        <T variant="display" style={{ marginTop: spacing.lg }}>{isRegister ? 'Create your account' : 'Welcome back'}</T>
        <T color="textSecondary" style={{ marginTop: spacing.sm }}>
          {isRegister ? 'Daily current affairs, quizzes and progress tracking for UPSC.' : 'Sign in to continue your preparation.'}
        </T>
        {isRegister ? <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isRegister ? 'new-password' : 'current-password'} textContentType={isRegister ? 'newPassword' : 'password'} onSubmitEditing={submit} />
        {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">{error}</T> : null}
        <Button title={isRegister ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} disabled={!email || !password || (isRegister && !name)} style={{ marginTop: spacing.xl }} />
        <Button
          title={isRegister ? 'I already have an account' : 'Create a free account'}
          variant="ghost"
          onPress={() => router.replace(isRegister ? '/login' : '/register')}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 50 },
});
