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
import { useT } from '../../lib/i18n';
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
  const { t } = useT();
  const [item, setItem] = useState(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    getContinueReading().then((x) => { if (alive) setItem(x); });
    return () => { alive = false; };
  }, []));
  if (!item) return null;
  return (
    <>
      <SectionTitle>{t('today.continueReading')}</SectionTitle>
      <Card onPress={() => router.push(`/article/${item.id}`)} accessibilityLabel={`${t('today.continueReading')}: ${item.title}, ${t('today.percentRead', { p: Math.round(item.progress * 100) })}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="book-outline" size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <T variant="heading" numberOfLines={2}>{item.title}</T>
            <T variant="small" color="textSecondary">{t('today.percentRead', { p: Math.round(item.progress * 100) })}{item.readingMinutes ? ` · ${t('today.minLeft', { n: Math.max(1, Math.round(item.readingMinutes * (1 - item.progress))) })}` : ''}</T>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}><ProgressBar value={item.progress * 100} height={4} /></View>
      </Card>
    </>
  );
}

/** Opens the audio briefing (Premium; the screen explains if it's locked). */
function BriefingCard() {
  const c = useTheme();
  const { t } = useT();
  return (
    <Card onPress={() => router.push('/briefing')} accessibilityLabel={t('today.briefingTitle')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="headset" size={20} color={c.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="heading">{t('today.briefingTitle')}</T>
        <T variant="small" color="textSecondary">{t('today.briefingSubShort')}</T>
      </View>
      <Ionicons name="play-circle-outline" size={26} color={c.text} />
    </Card>
  );
}

function FeedSwitch({ value, onChange, hasSubjects }) {
  const c = useTheme();
  const { t } = useT();
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
        {opt('foryou', t('today.forYou'))}
        {opt('all', t('today.all'))}
      </View>
      {value === 'foryou' ? (
        <Pressable onPress={() => router.push('/account/subjects')} accessibilityRole="button" hitSlop={8}>
          <T variant="small" style={{ textDecorationLine: 'underline' }}>{hasSubjects ? t('today.editSubjects') : t('today.pickSubjects')}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Today() {
  const { user } = useAuth();
  const { prefs, update } = usePrefs();
  const { t } = useT();
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
          <T variant="display" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{firstName ? t('today.hello', { name: firstName }) : t('today.title')}</T>
          {user ? <View style={{ marginBottom: spacing.md }}><StreakBadge /></View> : null}
          <VerifyEmailBanner />
          {!user ? <View style={{ height: spacing.sm }} /> : null}
          <TodayQuizCard />
          <BriefingCard />
          <ContinueReading />
          <FeedSwitch value={feed} onChange={(f) => update({ feed: f })} hasSubjects={subjects.length > 0} />
          {feed === 'foryou' && !subjects.length ? (
            <Empty
              icon="options-outline"
              title={t('today.chooseTitle')}
              message={t('today.chooseMessage')}
              action={<Button title={t('today.pickSubjects')} onPress={() => router.push('/account/subjects')} />}
            />
          ) : null}
          {articles.error?.status === 0 ? (
            <Empty
              icon="cloud-offline-outline"
              title={t('today.offlineTitle')}
              message={t('today.offlineMessage')}
              action={<Button title={t('today.openSaved')} variant="outline" onPress={() => router.push('/saved')} />}
            />
          ) : articles.error ? <ErrorView error={articles.error} onRetry={articles.refetch} /> : null}
        </View>
      }
      empty={articles.error || (feed === 'foryou' && !subjects.length) ? null : (
        <Empty title={forYou ? t('today.noneInSubjects') : t('today.noArticles')} message={forYou ? t('today.switchToAll') : t('today.noArticlesMessage')} />
      )}
    />
  );
}
