import { useEffect } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useBookmarkToggle } from '../lib/queries';
import { useTheme } from '../theme';

export default function BookmarkButton({ itemType, itemId, size = 24 }) {
  const c = useTheme();
  const { signedIn } = useAuth();
  const { bookmarked, toggle, busy, error } = useBookmarkToggle(itemType, itemId);

  // Free accounts have a saved-items limit: offer Premium when it's reached.
  useEffect(() => {
    if (error?.code !== 'premium_required') return;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${error.message}\n\nSee Premium?`)) router.push('/premium');
      return;
    }
    Alert.alert('Saved items limit reached', error.message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'See Premium', onPress: () => router.push('/premium') },
    ]);
  }, [error]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark'}
      accessibilityState={{ selected: bookmarked, busy }}
      hitSlop={12}
      disabled={busy}
      onPress={() => (signedIn ? toggle() : router.push('/login'))}
    >
      <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={size} color={bookmarked ? c.accent : c.text} />
    </Pressable>
  );
}
