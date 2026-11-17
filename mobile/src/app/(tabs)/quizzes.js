import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useLeaderboard, useMyAttempts, usePracticeSubjects, useProgress, useQuizzes, useTaxonomy } from '../../lib/queries';
import { subjectLabel } from '../../components/ArticleCard';
import { formatDate } from '../../lib/format';
import { useTheme, spacing } from '../../theme';
import ListScreen from '../../components/ListScreen';
import TodayQuizCard from '../../components/QuizCard';
import { Card, Empty, ErrorView, SectionTitle, T } from '../../components/ui';

function LeaderboardCard() {
  const c = useTheme();
  const { data } = useLeaderboard();
  const me = data?.me;
  const leader = data?.entries?.[0];
  return (
    <Card onPress={() => router.push('/leaderboard')} accessibilityLabel="Open this week's leaderboard" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
      <Ionicons name="trophy" size={26} color={c.accent} />
      <View style={{ flex: 1 }}>
        <T variant="heading">This week’s leaderboard</T>
        <T variant="small" color="textSecondary">
          {me ? `You’re #${me.rank} of ${data.participants} with ${me.score} correct` : leader ? `${leader.name} leads with ${leader.score} correct` : 'No scores yet this week'}
        </T>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Card>
  );
}

/** Subjects to practise, weakest first (by the user's accuracy), then by question count. */
function PracticeSection() {
  const c = useTheme();
  const { signedIn } = useAuth();
  const { data: taxonomy } = useTaxonomy();
  const { data: counts } = usePracticeSubjects();
  const { data: progress } = useProgress();
  if (!signedIn) {
    return (
      <Card onPress={() => router.push('/login')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name="barbell-outline" size={24} color={c.accent} />
        <T style={{ flex: 1 }}>Sign in to practise questions by subject</T>
      </Card>
    );
  }
  const acc = new Map((progress?.progress?.bySubject || []).map((x) => [x.subject, x.accuracy]));
  const subjects = Object.entries(counts?.subjects || {})
    .sort((a, b) => (acc.get(a[0]) ?? 101) - (acc.get(b[0]) ?? 101) || b[1] - a[1]);
  if (!subjects.length) return <T variant="small" color="textSecondary">Practice opens once questions are published.</T>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {subjects.map(([key, n]) => (
        <Card key={key} onPress={() => router.push(`/practice/${key}`)} accessibilityLabel={`Practise ${subjectLabel(taxonomy, key)}`} style={{ width: '48%', padding: spacing.md }}>
          <T variant="small" style={{ fontWeight: '700' }} numberOfLines={2}>{subjectLabel(taxonomy, key)}</T>
          <T variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
            {n} QUESTIONS{acc.has(key) && acc.get(key) !== null ? ` · ${acc.get(key)}%` : ''}
          </T>
        </Card>
      ))}
    </View>
  );
}

export default function Quizzes() {
  const c = useTheme();
  const { user } = useAuth();
  const quizzes = useQuizzes();
  const attempts = useMyAttempts();
  const attemptByQuiz = new Map((attempts.data?.items || []).map((a) => [String(a.quiz?._id), a]));

  return (
    <ListScreen
      query={quizzes}
      header={
        <View>
          <T variant="display" style={{ marginBottom: spacing.lg }}>Quizzes</T>
          <TodayQuizCard />
          <LeaderboardCard />
          <SectionTitle>Practise by subject</SectionTitle>
          <PracticeSection />
          <SectionTitle>Past daily quizzes</SectionTitle>
          {quizzes.error ? <ErrorView error={quizzes.error} onRetry={quizzes.refetch} /> : null}
        </View>
      }
      renderItem={({ item }) => {
        const attempt = attemptByQuiz.get(String(item.id));
        return (
          <Card
            onPress={() => router.push(attempt ? `/result/${attempt.id}` : `/quiz/${item.id}`)}
            accessibilityLabel={`${item.title}${attempt ? `, scored ${attempt.score} of ${attempt.total}` : ''}`}
            style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <View style={{ flex: 1 }}>
              <T variant="heading">{item.date ? formatDate(item.date) : item.title}</T>
              <T variant="small" color="textSecondary">{item.questionCount} questions</T>
            </View>
            {attempt ? (
              <T variant="heading">{attempt.score}/{attempt.total}</T>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
            )}
          </Card>
        );
      }}
      empty={quizzes.error ? null : <Empty icon="checkbox-outline" title="No quizzes yet" message={user ? 'The first daily quiz will appear here.' : 'Daily quizzes will appear here.'} />}
    />
  );
}
