import { useEffect, useState } from 'react';

import { Platform, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../lib/auth';
import { googleClientIds, nativeGoogle } from '../lib/google';
import { useMeta } from '../lib/queries';
import { useTheme, spacing } from '../theme';
import { Button, T } from './ui';
import { errorText, useT } from '../lib/i18n';

WebBrowser.maybeCompleteAuthSession();

const googleAvailable = Platform.OS === 'web' ? !!googleClientIds.web : !!nativeGoogle;

/** Android and iOS builds: the system Google account picker. */
function NativeGoogleButton({ onDone, onError }) {
  const { signInWithGoogle } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = nativeGoogle;
  const onPress = async () => {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();
      if (isSuccessResponse(res)) {
        if (!res.data.idToken) throw new Error('No ID token from Google');
        await signInWithGoogle(res.data.idToken);
        onDone();
      }
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS)) onError(e);
    } finally {
      setBusy(false);
    }
  };
  return <Button title={t('auth.google')} icon="logo-google" variant="outline" loading={busy} onPress={onPress} />;
}

/** Web: Google's sign-in popup. */
function WebGoogleButton({ onDone, onError }) {
  const { signInWithGoogle } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({ webClientId: googleClientIds.web });
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
  return <Button title={t('auth.google')} icon="logo-google" variant="outline" loading={busy} disabled={!request} onPress={onPress} />;
}

const GoogleButton = Platform.OS === 'web' ? WebGoogleButton : NativeGoogleButton;

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

/** Google (app builds and web, when configured; not Expo Go) and Apple (iOS) sign-in buttons. */
export default function SocialSignIn({ onDone }) {
  const { data: meta } = useMeta();
  const { t } = useT();
  const [error, setError] = useState(null);
  const showGoogle = googleAvailable && meta?.signIn?.google;
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
