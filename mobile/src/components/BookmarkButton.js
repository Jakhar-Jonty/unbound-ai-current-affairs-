import { Pressable } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useBookmarkToggle } from '../lib/queries';
import { useTheme } from '../theme';

export default function BookmarkButton({ itemType, itemId, size = 24 }) {
  const c = useTheme();
  const { signedIn } = useAuth();
  const { bookmarked, toggle, busy } = useBookmarkToggle(itemType, itemId);
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
