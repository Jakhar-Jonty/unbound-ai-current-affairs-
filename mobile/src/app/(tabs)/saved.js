import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useBookmarks } from '../../lib/queries';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing } from '../../theme';
import ArticleCard from '../../components/ArticleCard';
import SignInPrompt from '../../components/SignInPrompt';
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
  const { signedIn } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useBookmarks();

  if (!signedIn) {
    return <Screen><T variant="display">Saved</T><SignInPrompt icon="bookmark-outline" title="Save articles and questions" message="Sign in to bookmark items for revision." /></Screen>;
  }
  return (
    <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T variant="display" style={{ marginBottom: spacing.xs }}>Saved</T>
      <T variant="small" color="textSecondary" style={{ marginBottom: spacing.lg }}>Saved articles are downloaded so you can read them offline.</T>
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
