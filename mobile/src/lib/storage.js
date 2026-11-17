import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// The session token lives in the device keychain/keystore. On web (used for
// development and testing) it falls back to localStorage.
const web = Platform.OS === 'web';

export async function getItem(key) {
  if (web) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key, value) {
  if (web) {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* storage unavailable */ }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key) {
  if (web) {
    try { globalThis.localStorage?.removeItem(key); } catch { /* storage unavailable */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
