import { useEffect, useState } from 'react';

import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/queries';
import { useTheme, spacing } from '../theme';
import { Button, T } from './ui';
import { errorText, useT } from '../lib/i18n';

WebBrowser.maybeCompleteAuthSession();

const ids = Constants.expoConfig?.extra?.googleClientIds || {};
const googleConfigured = !!(ids.web || ids.ios || ids.android);

function GoogleButton({ onDone, onError }) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: ids.web, iosClientId: ids.ios, androidClientId: ids.android,
  });
  const onPress = async () => {
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === 'success') {
        await signInWithGoogle(result.params?.id_token);
        onDone();
      }
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const { t } = useT();
  return <Button title={t('auth.google')} icon="logo-google" variant="outline" loading={busy} disabled={!request} onPress={onPress} />;
}

function AppleButton({ onDone, onError }) {
  const c = useTheme();
  const { signInWithApple } = useAuth();
  const [available, setAvailable] = useState(false);
  useEffect(() => { AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => {}); }, []);
  if (!available) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={c.scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={10}
      style={{ height: 48 }}
      onPress={async () => {
        try {
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          });
          const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
          await signInWithApple(cred.identityToken, name);
          onDone();
        } catch (e) {
          if (e?.code !== 'ERR_REQUEST_CANCELED') onError(e);
        }
      }}
    />
  );
}

/** Google (all platforms, when configured) and Apple (iOS) sign-in buttons. */
export default function SocialSignIn({ onDone }) {
  const { data: meta } = useMeta();
  const { t } = useT();
  const [error, setError] = useState(null);
  const showGoogle = googleConfigured && meta?.signIn?.google;
  const showApple = Platform.OS === 'ios' && meta?.signIn?.apple;
  if (!showGoogle && !showApple) return null;
  const onError = (e) => setError(e?.status !== undefined ? errorText(e, t) : t('errors.signInFailed'));
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
      {showApple ? <AppleButton onDone={onDone} onError={onError} /> : null}
      {showGoogle ? <GoogleButton onDone={onDone} onError={onError} /> : null}
      {error ? <T variant="small" color="incorrect">{error}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(119,119,119,0.3)' }} />
        <T variant="caption" color="textSecondary">{t('auth.orEmail')}</T>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(119,119,119,0.3)' }} />
      </View>
    </View>
  );
}
