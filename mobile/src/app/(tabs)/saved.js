import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useBillingPlans, useBookmarks, useGuestSaves } from '../../lib/queries';
import { GUEST_SAVE_LIMIT } from '../../lib/guest';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing } from '../../theme';
import ArticleCard from '../../components/ArticleCard';
import { Button, Card, Empty, ErrorView, Loading, OfflineNote, Screen, Tag, T } from '../../components/ui';

function SavedQuestion({ item }) {
  const c = useTheme();
  const [show, setShow] = useState(false);
  const q = item.item;
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Tag label="Question" />
      <T variant="heading" style={{ marginTop: spacing.sm }}>{q.stem}</T>
      {q.options.map((o, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <T variant="small" style={{ fontWeight: '700', color: show && i === q.correctIndex ? c.correct : c.text }}>{optionLetter(i)}.</T>
          <T variant="small" style={{ flex: 1, color: show && i === q.correctIndex ? c.correct : c.text }}>{o}</T>
          {show && i === q.correctIndex ? <Ionicons name="checkmark-circle" size={18} color={c.correct} accessibilityLabel="Correct answer" /> : null}
        </View>
      ))}
      {show ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>{q.explanation}</T> : null}
      <Button title={show ? 'Hide answer' : 'Show answer'} variant="outline" onPress={() => setShow(!show)} style={{ marginTop: spacing.md }} />
    </Card>
  );
}

export default function Saved() {
  const c = useTheme();
  const { signedIn, user } = useAuth();
  const { data: plans } = useBillingPlans();
  const limits = plans?.free;
  const { data, isLoading, error, refetch, isRefetching } = useBookmarks();
  const guestSaves = useGuestSaves();

  // Guests: items saved on this device, moved to the account at sign-in.
  if (!signedIn) {
    const items = guestSaves.data || [];
    return (
      <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={guestSaves.isRefetching} onRefresh={guestSaves.refetch} />}>
        <T variant="display" style={{ marginBottom: spacing.xs }}>Saved</T>
        <T variant="small" color="textSecondary" style={{ marginBottom: spacing.lg }}>
          Saved on this device ({items.length} of {GUEST_SAVE_LIMIT}). Sign in to keep them in your account and on your other devices.
        </T>
        {!items.length ? (
          <Empty icon="bookmark-outline" title="Nothing saved yet" message="Tap the bookmark on any article or quiz question to save it for revision. No account needed." action={<Button title="Browse articles" variant="outline" onPress={() => router.push('/explore')} />} />
        ) : items.map((b) => {
          if (b.itemType === 'article' && b.item) return <ArticleCard key={`a-${b.itemId}`} article={b.item} />;
          if (b.itemType === 'question' && b.item) return <SavedQuestion key={`q-${b.itemId}`} item={b} />;
          return null;
        })}
        {items.length ? <Button title="Sign in to keep them" variant="outline" icon="log-in-outline" onPress={() => router.push('/login')} style={{ marginTop: spacing.lg }} /> : null}
      </Screen>
    );
  }
  return (
    <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T variant="display" style={{ marginBottom: spacing.xs }}>Saved</T>
      <T variant="small" color="textSecondary" style={{ marginBottom: spacing.lg }}>
        {user?.premium?.active
          ? 'Saved articles are downloaded so you can read them offline.'
          : `${data?.total ?? 0} of ${limits?.bookmarks ?? 20} free saves used. Premium adds unlimited saves and offline reading.`}
      </T>
      {data?.offline ? <OfflineNote message="You’re offline. Showing your saved items." /> : null}
      {isLoading ? <Loading /> : error ? <ErrorView error={error} onRetry={refetch} /> : !data.items.length ? (
        <Empty icon="bookmark-outline" title="Nothing saved yet" message="Tap the bookmark on any article or quiz question to save it for revision." action={<Button title="Browse articles" variant="outline" onPress={() => router.push('/explore')} />} />
      ) : data.items.map((b) => {
        if (b.unavailable) return null;
        if (b.itemType === 'article') return <ArticleCard key={b.id} article={b.item} />;
        return <SavedQuestion key={b.id} item={b} />;
      })}
    </Screen>
  );
}
