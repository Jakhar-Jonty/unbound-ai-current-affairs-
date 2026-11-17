import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { api } from './api';
import { getItem, setItem, removeItem } from './storage';

const TOKEN_KEY = 'pushToken';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks for notification permission and registers this device's Expo push token
 * with the backend. Silently does nothing on web, simulators, when permission is
 * declined, or before the app is linked to an EAS project (no projectId yet).
 */
export async function registerForPush() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Daily quiz and updates',
        importance: AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push disabled: run `eas init` to add extra.eas.projectId to app.json');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/me/devices', {
      method: 'POST',
      body: { token, platform: Platform.OS, appVersion: Constants.expoConfig?.version },
    });
    await setItem(TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.warn('Push registration failed', err?.message);
    return null;
  }
}

/** Unlinks this device from the account (call before signing out). */
export async function unregisterPush() {
  const token = await getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api('/me/devices', { method: 'DELETE', body: { token } });
  } catch { /* best effort */ }
  await removeItem(TOKEN_KEY);
}
