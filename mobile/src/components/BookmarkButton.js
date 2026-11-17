import { useEffect } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBookmarkToggle } from '../lib/queries';
import { tap } from '../lib/haptics';
import { useTheme } from '../theme';

function offer(title, message, label, to) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${message}\n\n${label}?`)) router.push(to);
    return;
  }
  Alert.alert(title, message, [{ text: 'Not now', style: 'cancel' }, { text: label, onPress: () => router.push(to) }]);
}

/**
 * Save/unsave an article or question. Works without an account (saved on this
 * device). `item` is a small snapshot used to show guest saves offline.
 */
export default function BookmarkButton({ itemType, itemId, item, size = 24 }) {
  const c = useTheme();
  const { bookmarked, toggle, busy, error } = useBookmarkToggle(itemType, itemId, item);

  // Limits: free accounts are offered Premium; guests are offered an account.
  useEffect(() => {
    if (error?.code === 'premium_required') offer('Saved items limit reached', error.message, 'See Premium', '/premium');
    else if (error?.code === 'guest_limit') offer('Saved items limit reached', error.message, 'Sign in', '/login');
  }, [error]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark'}
      accessibilityState={{ selected: bookmarked, busy }}
      hitSlop={12}
      disabled={busy}
      onPress={() => { tap(); toggle(); }}
    >
      <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={size} color={bookmarked ? c.accent : c.text} />
    </Pressable>
  );
}
