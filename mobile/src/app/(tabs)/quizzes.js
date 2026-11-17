import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useMyAttempts, useQuizzes } from '../../lib/queries';
import { formatDate } from '../../lib/format';
import { useTheme, spacing } from '../../theme';
import ListScreen from '../../components/ListScreen';
import TodayQuizCard from '../../components/QuizCard';
import { Card, Empty, ErrorView, SectionTitle, T } from '../../components/ui';

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
