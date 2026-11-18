import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useBillingPlans, useBookmarks, useGuestSaves } from '../../lib/queries';
import { GUEST_SAVE_LIMIT } from '../../lib/guest';
import { useT } from '../../lib/i18n';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing } from '../../theme';
import ArticleCard from '../../components/ArticleCard';
import { Button, Card, Empty, ErrorView, Loading, OfflineNote, Screen, Tag, T } from '../../components/ui';

function SavedQuestion({ item }) {
  const c = useTheme();
  const { t } = useT();
  const [show, setShow] = useState(false);
  const q = item.item;
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Tag label={t('saved.question')} />
      <T variant="heading" style={{ marginTop: spacing.sm }}>{q.stem}</T>
      {q.options.map((o, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <T variant="small" style={{ fontWeight: '700', color: show && i === q.correctIndex ? c.correct : c.text }}>{optionLetter(i)}.</T>
          <T variant="small" style={{ flex: 1, color: show && i === q.correctIndex ? c.correct : c.text }}>{o}</T>
          {show && i === q.correctIndex ? <Ionicons name="checkmark-circle" size={18} color={c.correct} accessibilityLabel={t('result.correctAnswer')} /> : null}
        </View>
      ))}
      {show ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>{q.explanation}</T> : null}
      <Button title={show ? t('saved.hide') : t('saved.show')} variant="outline" onPress={() => setShow(!show)} style={{ marginTop: spacing.md }} />
    </Card>
  );
}

export default function Saved() {
  const c = useTheme();
  const { t } = useT();
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
        <T variant="display" style={{ marginBottom: spacing.xs }}>{t('saved.title')}</T>
        <T variant="small" color="textSecondary" style={{ marginBottom: spacing.lg }}>
          {t('saved.guestNote', { n: items.length, max: GUEST_SAVE_LIMIT })}
        </T>
        {!items.length ? (
          <Empty icon="bookmark-outline" title={t('saved.empty')} message={t('saved.emptyGuest')} action={<Button title={t('saved.browse')} variant="outline" onPress={() => router.push('/explore')} />} />
        ) : items.map((b) => {
          if (b.itemType === 'article' && b.item) return <ArticleCard key={`a-${b.itemId}`} article={b.item} />;
          if (b.itemType === 'question' && b.item) return <SavedQuestion key={`q-${b.itemId}`} item={b} />;
          return null;
        })}
        {items.length ? <Button title={t('saved.keep')} variant="outline" icon="log-in-outline" onPress={() => router.push('/login')} style={{ marginTop: spacing.lg }} /> : null}
      </Screen>
    );
  }
  return (
    <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T variant="display" style={{ marginBottom: spacing.xs }}>{t('saved.title')}</T>
      <T variant="small" color="textSecondary" style={{ marginBottom: spacing.lg }}>
        {user?.premium?.active
          ? t('saved.offlineNote')
          : t('saved.freeUsed', { n: data?.total ?? 0, max: limits?.bookmarks ?? 20 })}
      </T>
      {data?.offline ? <OfflineNote message={t('common.offlineSaved')} /> : null}
      {isLoading ? <Loading /> : error ? <ErrorView error={error} onRetry={refetch} /> : !data.items.length ? (
        <Empty icon="bookmark-outline" title={t('saved.empty')} message={t('saved.emptyUser')} action={<Button title={t('saved.browse')} variant="outline" onPress={() => router.push('/explore')} />} />
      ) : data.items.map((b) => {
        if (b.unavailable) return null;
        if (b.itemType === 'article') return <ArticleCard key={b.id} article={b.item} />;
        return <SavedQuestion key={b.id} item={b} />;
      })}
    </Screen>
  );
}
