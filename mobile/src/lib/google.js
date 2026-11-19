import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Native Google Sign-In (Android and iOS builds). Not available in Expo Go or on the
 * web, so it's loaded lazily and `nativeGoogle` is null there.
 *
 * Google returns an ID token whose audience is the *web* client ID, which is why
 * the app is configured with `webClientId` and the server's GOOGLE_CLIENT_IDS must
 * include it. The Android client (package + SHA-1) only has to exist in Google Cloud.
 */
export const googleClientIds = Constants.expoConfig?.extra?.googleClientIds || {};

function load() {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return null;
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

export const nativeGoogle = googleClientIds.web ? load() : null;

if (nativeGoogle) {
  nativeGoogle.GoogleSignin.configure({ webClientId: googleClientIds.web, iosClientId: googleClientIds.ios || undefined });
}

/** Forget the Google account on sign-out, so the account picker shows next time. */
export async function googleSignOut() {
  if (!nativeGoogle) return;
  try { await nativeGoogle.GoogleSignin.signOut(); } catch { /* not signed in with Google */ }
}
