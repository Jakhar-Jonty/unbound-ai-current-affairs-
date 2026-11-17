import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Small vibrations on answer selection and feedback. No-ops on web.
const on = Platform.OS !== 'web';
export const tap = () => { if (on) Haptics.selectionAsync().catch(() => {}); };
export const success = () => { if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const error = () => { if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); };
