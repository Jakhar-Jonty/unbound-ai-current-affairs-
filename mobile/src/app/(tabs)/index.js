import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useArticles } from '../../lib/queries';
import { usePrefs } from '../../lib/prefs';
import { useMySubjects } from '../../lib/subjects-pref';
import { getContinueReading } from '../../lib/reading';
import { formatLongDate } from '../../lib/format';
import { tap } from '../../lib/haptics';
import { useTheme, spacing, radius } from '../../theme';
import ListScreen from '../../components/ListScreen';
import ArticleCard from '../../components/ArticleCard';
import TodayQuizCard from '../../components/QuizCard';
import StreakBadge from '../../components/StreakBadge';
import VerifyEmailBanner from '../../components/VerifyEmailBanner';
import { Button, Card, Empty, ErrorView, ProgressBar, SectionTitle, T } from '../../components/ui';

/** The article you started reading most recently but didn't finish. */
function ContinueReading() {
  const c = useTheme();
  const [item, setItem] = useState(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    getContinueReading().then((x) => { if (alive) setItem(x); });
    return () => { alive = false; };
  }, []));
  if (!item) return null;
  return (
    <>
      <SectionTitle>Continue reading</SectionTitle>
      <Card onPress={() => router.push(`/article/${item.id}`)} accessibilityLabel={`Continue reading ${item.title}, ${Math.round(item.progress * 100)}% read`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="book-outline" size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <T variant="heading" numberOfLines={2}>{item.title}</T>
            <T variant="small" color="textSecondary">{Math.round(item.progress * 100)}% read{item.readingMinutes ? ` · about ${Math.max(1, Math.round(item.readingMinutes * (1 - item.progress)))} min left` : ''}</T>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}><ProgressBar value={item.progress * 100} height={4} /></View>
      </Card>
    </>
  );
}

function FeedSwitch({ value, onChange, hasSubjects }) {
  const c = useTheme();
  const opt = (key, label) => {
    const on = value === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        onPress={() => { tap(); onChange(key); }}
        style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: on ? c.inverse : 'transparent' }}
      >
        <T variant="small" style={{ fontWeight: '700', color: on ? c.onInverse : c.textSecondary }}>{label}</T>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border }}>
        {opt('foryou', 'For you')}
        {opt('all', 'All')}
      </View>
      {value === 'foryou' ? (
        <Pressable onPress={() => router.push('/account/subjects')} accessibilityRole="button" hitSlop={8}>
          <T variant="small" style={{ textDecorationLine: 'underline' }}>{hasSubjects ? 'Edit subjects' : 'Pick subjects'}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Today() {
  const { user } = useAuth();
  const { prefs, update } = usePrefs();
  const { subjects } = useMySubjects();
  const feed = prefs.feed === 'foryou' ? 'foryou' : 'all';
  const forYou = feed === 'foryou' && subjects.length > 0;
  const articles = useArticles(forYou ? { subjects } : {});
  const firstName = user?.name?.split(' ')[0];

  return (
    <ListScreen
      query={articles}
      renderItem={({ item }) => <ArticleCard article={item} />}
      header={
        <View>
          <T variant="caption" color="textSecondary">{formatLongDate().toUpperCase()}</T>
          <T variant="display" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{firstName ? `Hello, ${firstName}` : 'Today'}</T>
          {user ? <View style={{ marginBottom: spacing.md }}><StreakBadge /></View> : null}
          <VerifyEmailBanner />
          {!user ? <View style={{ height: spacing.sm }} /> : null}
          <TodayQuizCard />
          <ContinueReading />
          <FeedSwitch value={feed} onChange={(f) => update({ feed: f })} hasSubjects={subjects.length > 0} />
          {feed === 'foryou' && !subjects.length ? (
            <Empty
              icon="options-outline"
              title="Choose your subjects"
              message="Pick the UPSC subjects you’re focusing on and this feed will show them first."
              action={<Button title="Pick subjects" onPress={() => router.push('/account/subjects')} />}
            />
          ) : null}
          {articles.error?.status === 0 ? (
            <Empty
              icon="cloud-offline-outline"
              title="You’re offline"
              message="Your saved articles and the ones you read recently are available offline."
              action={<Button title="Open saved articles" variant="outline" onPress={() => router.push('/saved')} />}
            />
          ) : articles.error ? <ErrorView error={articles.error} onRetry={articles.refetch} /> : null}
        </View>
      }
      empty={articles.error || (feed === 'foryou' && !subjects.length) ? null : (
        <Empty title={forYou ? 'Nothing in your subjects yet' : 'No articles yet'} message={forYou ? 'Switch to All to see every story.' : 'New explainers are published through the day after editorial review.'} />
      )}
    />
  );
}
