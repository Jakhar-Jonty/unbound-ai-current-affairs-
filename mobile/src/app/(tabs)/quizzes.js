import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useLeaderboard, useMockCurrent, useMyAttempts, usePracticeSubjects, useProgress, useQuizzes, useTaxonomy } from '../../lib/queries';
import { subjectLabel } from '../../components/ArticleCard';
import { PremiumBadge } from '../../components/Premium';
import { formatDate } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useTheme, spacing } from '../../theme';
import ListScreen from '../../components/ListScreen';
import TodayQuizCard from '../../components/QuizCard';
import { Button, Card, Empty, ErrorView, SectionTitle, T } from '../../components/ui';

/** This week's mock test: start, resume, or your marks and rank. */
function MockCard() {
  const c = useTheme();
  const { t } = useT();
  const { signedIn } = useAuth();
  const { data, error, isLoading } = useMockCurrent();
  if (isLoading) return null;
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons name="ribbon" size={18} color={c.accent} />
      <T variant="caption" color="textSecondary">{t('mock.label')}</T>
    </View>
  );
  if (error) {
    return <Card style={{ marginTop: spacing.md }}>{header}<T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>{t('mock.notYet')}</T></Card>;
  }
  const q = data.quiz;
  const done = data.myAttempt;
  const minutes = Math.round((q.durationSeconds || 0) / 60);
  return (
    <Card style={{ marginTop: spacing.md, borderColor: c.accent }}>
      {header}
      <T variant="heading" style={{ marginTop: spacing.sm }}>{formatDate(q.week || q.publishedAt)}</T>
      {done ? (
        <>
          <T style={{ marginTop: spacing.xs }}>{t('mock.yourMarks', { marks: done.marks, max: done.maxMarks })}</T>
          <Button title={t('mock.seeResult')} variant="outline" onPress={() => router.push(`/result/${done.id}`)} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
        </>
      ) : (
        <>
          <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>{t('mock.summary', { n: q.questionCount, m: minutes })}</T>
          <Button
            title={data.timer ? t('mock.resume') : t('mock.start')}
            icon="timer-outline"
            onPress={() => router.push(signedIn ? `/quiz/${q.id}` : '/login')}
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
          />
        </>
      )}
    </Card>
  );
}

function LeaderboardCard() {
  const c = useTheme();
  const { t } = useT();
  const { data } = useLeaderboard();
  const me = data?.me;
  const leader = data?.entries?.[0];
  return (
    <Card onPress={() => router.push('/leaderboard')} accessibilityLabel={t('quizzes.openLeaderboard')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
      <Ionicons name="trophy" size={26} color={c.accent} />
      <View style={{ flex: 1 }}>
        <T variant="heading">{t('quizzes.leaderboard')}</T>
        <T variant="small" color="textSecondary">
          {me ? t('quizzes.youAre', { rank: me.rank, n: data.participants, score: me.score })
            : leader ? t('quizzes.leads', { name: leader.name, score: leader.score }) : t('quizzes.noScores')}
        </T>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Card>
  );
}

/** Subjects to practise, weakest first (by the user's accuracy), then by question count. */
function PracticeSection() {
  const { t, lang } = useT();
  const { data: taxonomy } = useTaxonomy();
  const { data: counts } = usePracticeSubjects();
  const { data: progress } = useProgress();
  const acc = new Map((progress?.progress?.bySubject || []).map((x) => [x.subject, x.accuracy]));
  const subjects = Object.entries(counts?.subjects || {})
    .sort((a, b) => (acc.get(a[0]) ?? 101) - (acc.get(b[0]) ?? 101) || b[1] - a[1]);
  if (!subjects.length) return <T variant="small" color="textSecondary">{t('quizzes.practiceSoon')}</T>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {subjects.map(([key, n]) => (
        <Card key={key} onPress={() => router.push(`/practice/${key}`)} accessibilityLabel={t('quizzes.practiseSubject', { subject: subjectLabel(taxonomy, key, 'en') })} style={{ width: '48%', padding: spacing.md }}>
          <T variant="small" style={{ fontWeight: '700' }} numberOfLines={2}>{subjectLabel(taxonomy, key, lang)}</T>
          <T variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
            {t('quizzes.nQuestions', { n })}{acc.has(key) && acc.get(key) !== null ? ` · ${acc.get(key)}%` : ''}
          </T>
        </Card>
      ))}
    </View>
  );
}

export default function Quizzes() {
  const c = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const quizzes = useQuizzes();
  const attempts = useMyAttempts();
  const attemptByQuiz = new Map((attempts.data?.items || []).map((a) => [String(a.quiz?._id), a]));

  return (
    <ListScreen
      query={quizzes}
      header={
        <View>
          <T variant="display" style={{ marginBottom: spacing.lg }}>{t('quizzes.title')}</T>
          <TodayQuizCard />
          <MockCard />
          <LeaderboardCard />
          <SectionTitle>{t('quizzes.practise')}</SectionTitle>
          <PracticeSection />
          <SectionTitle>{t('quizzes.past')}</SectionTitle>
          {quizzes.error ? <ErrorView error={quizzes.error} onRetry={quizzes.refetch} /> : null}
        </View>
      }
      renderItem={({ item }) => {
        const attempt = attemptByQuiz.get(String(item.id));
        return (
          <Card
            onPress={() => router.push(attempt ? `/result/${attempt.id}` : `/quiz/${item.id}`)}
            accessibilityLabel={`${item.title}${attempt ? `, ${t('quizzes.scoredOf', { score: attempt.score, total: attempt.total })}` : ''}`}
            style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <View style={{ flex: 1 }}>
              <T variant="heading">{item.date ? formatDate(item.date) : item.title}</T>
              <T variant="small" color="textSecondary">{t('common.questions', { n: item.questionCount })}</T>
            </View>
            {!attempt ? <PremiumBadge locked={item.premium} /> : null}
            {attempt ? (
              <T variant="heading">{attempt.score}/{attempt.total}</T>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
            )}
          </Card>
        );
      }}
      empty={quizzes.error ? null : <Empty icon="checkbox-outline" title={t('quizzes.none')} message={user ? t('quizzes.firstSoon') : t('quizzes.willAppear')} />}
    />
  );
}
