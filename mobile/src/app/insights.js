import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInsights, useTaxonomy } from '../lib/queries';
import { formatDate } from '../lib/format';
import { useTheme, spacing, radius } from '../theme';
import { subjectLabel } from '../components/ArticleCard';
import { PremiumGate, isPremiumError } from '../components/Premium';
import { Bone } from '../components/Skeleton';
import { Button, Card, Empty, ErrorView, ProgressBar, Screen, SectionTitle, T } from '../components/ui';

const PAPER = { GS1: 'GS Paper I', GS2: 'GS Paper II', GS3: 'GS Paper III', GS4: 'GS Paper IV', PRELIMS: 'Prelims facts' };

function Trend({ value }) {
  const c = useTheme();
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} accessibilityLabel={`${up ? 'Up' : 'Down'} ${Math.abs(value)} points in the last 2 weeks`}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={up ? c.correct : c.incorrect} />
      <T variant="caption" color={up ? 'correct' : 'incorrect'}>{Math.abs(value)}</T>
    </View>
  );
}

/** Weekly bars: height = questions answered, orange fill = accuracy. */
function WeekChart({ weeks }) {
  const c = useTheme();
  const max = Math.max(1, ...weeks.map((w) => w.answered));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 110 }}>
        {weeks.map((w) => (
          <View key={w.weekStart} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={`Week of ${formatDate(w.weekStart)}: ${w.answered} answered, ${w.accuracy ?? 0}% correct`}>
            <View style={{ width: '100%', height: Math.max(4, (w.answered / max) * 100), borderRadius: 4, backgroundColor: c.border, overflow: 'hidden', justifyContent: 'flex-end' }}>
              <View style={{ height: `${w.accuracy || 0}%`, backgroundColor: c.accent }} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
        <T variant="caption" color="textSecondary">{formatDate(weeks[0].weekStart)}</T>
        <T variant="caption" color="textSecondary">THIS WEEK</T>
      </View>
      <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>Bar height: questions answered. Orange: share answered correctly.</T>
    </View>
  );
}

export default function Insights() {
  const c = useTheme();
  const { data: taxonomy } = useTaxonomy();
  const { data, isLoading, error, refetch, isRefetching } = useInsights();

  if (isPremiumError(error)) return <Screen edges={[]}><PremiumGate title="Insights are part of Premium" message={error.message} /></Screen>;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (isLoading) return <Screen edges={[]}><Bone height={90} /><Bone height={160} style={{ marginTop: spacing.lg }} /><Bone height={200} style={{ marginTop: spacing.lg }} /></Screen>;
  if (!data.totals.answered) {
    return <Screen edges={[]}><Empty icon="analytics-outline" title="Not enough answers yet" message="Take a few daily quizzes or practice sets and your insights will appear here." action={<Button title="Practise now" onPress={() => router.push('/quizzes')} />} /></Screen>;
  }

  return (
    <Screen edges={[]} refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T color="textSecondary">Based on your daily quizzes and practice in the last {data.periodDays} days.</T>
      <Card style={{ flexDirection: 'row', marginTop: spacing.lg }}>
        {[['Answered', data.totals.answered], ['Accuracy', data.totals.accuracy === null ? '–' : `${data.totals.accuracy}%`], ['Avg time', data.totals.avgSeconds ? `${data.totals.avgSeconds}s` : '–']].map(([l, v]) => (
          <View key={l} style={{ flex: 1 }}><T variant="title">{v}</T><T variant="small" color="textSecondary">{l}</T></View>
        ))}
      </Card>

      {data.weakest.length ? (
        <>
          <SectionTitle>Focus on these</SectionTitle>
          {data.weakest.map((w) => (
            <Card key={w.key} onPress={() => router.push(`/practice/${w.key}`)} accessibilityLabel={`Practise ${subjectLabel(taxonomy, w.key)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="small" style={{ fontWeight: '800' }}>{Math.round(w.accuracy)}%</T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="heading">{subjectLabel(taxonomy, w.key)}</T>
                <T variant="small" color="textSecondary">{w.correct} of {w.answered} correct · tap to practise</T>
              </View>
              <Ionicons name="barbell-outline" size={20} color={c.text} />
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>Last 8 weeks</SectionTitle>
      <Card><WeekChart weeks={data.weeks} /></Card>

      <SectionTitle>By subject</SectionTitle>
      <Card>
        {data.bySubject.map((s, i) => (
          <View key={s.key} style={{ marginTop: i ? spacing.lg : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <T variant="small" style={{ fontWeight: '600', flex: 1 }}>{subjectLabel(taxonomy, s.key)}</T>
              <Trend value={s.trend} />
              <T variant="small" color="textSecondary">{s.correct}/{s.answered} · {s.accuracy}%{s.avgSeconds ? ` · ${s.avgSeconds}s` : ''}</T>
            </View>
            <ProgressBar value={s.accuracy || 0} />
          </View>
        ))}
      </Card>

      <SectionTitle>By GS paper</SectionTitle>
      <Card>
        {data.byPaper.map((s, i) => (
          <View key={s.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
            <T variant="small">{PAPER[s.key] || s.key}</T>
            <T variant="small" style={{ fontWeight: '700' }}>{s.accuracy}% <T variant="small" color="textSecondary">({s.answered})</T></T>
          </View>
        ))}
      </Card>

      {data.toRevisit.length ? (
        <>
          <SectionTitle>Questions to revisit</SectionTitle>
          {data.toRevisit.map((q) => (
            <Card key={q.id} onPress={q.article ? () => router.push(`/article/${q.article}`) : undefined} accessibilityLabel="Open the related article" style={{ marginBottom: spacing.sm, borderRadius: radius.md }}>
              <T variant="small" numberOfLines={3}>{q.stem}</T>
              {q.article ? <T variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>READ THE ARTICLE</T> : null}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
