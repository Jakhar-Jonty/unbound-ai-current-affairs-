import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAttempt, useGuestQuiz } from '../../lib/queries';
import { useAuth } from '../../lib/auth';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import BookmarkButton from '../../components/BookmarkButton';
import ScoreRing from '../../components/ScoreRing';
import StreakCelebration from '../../components/StreakCelebration';
import FadeIn from '../../components/FadeIn';
import { Button, Card, ErrorView, Loading, Screen, T } from '../../components/ui';

function OptionRow({ text, i, a }) {
  const c = useTheme();
  const isCorrect = i === a.correctIndex;
  const isWrongPick = i === a.selectedIndex && !a.isCorrect;
  const color = isCorrect ? c.correct : isWrongPick ? c.incorrect : c.text;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.xs, borderRadius: radius.sm,
      backgroundColor: isCorrect ? c.correctSoft : isWrongPick ? c.incorrectSoft : 'transparent',
    }}>
      <T variant="small" style={{ fontWeight: '700', color }}>{optionLetter(i)}.</T>
      <T variant="small" style={{ flex: 1, color, fontWeight: isCorrect || isWrongPick ? '600' : '400' }}>{text}</T>
      {isCorrect ? <Ionicons name="checkmark-circle" size={18} color={c.correct} accessibilityLabel="Correct answer" /> : null}
      {isWrongPick ? <Ionicons name="close-circle" size={18} color={c.incorrect} accessibilityLabel="Your answer, incorrect" /> : null}
    </View>
  );
}

export default function ResultScreen() {
  const c = useTheme();
  const { id, fresh, quiz: guestQuizId } = useLocalSearchParams();
  const { user } = useAuth();
  const isGuestResult = id === 'guest';
  const saved = useAttempt(isGuestResult ? null : id);
  const local = useGuestQuiz(isGuestResult ? guestQuizId : null);
  const { data, isLoading, error, refetch } = isGuestResult ? { ...local, data: local.data ? { result: local.data.result } : null } : saved;
  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!data) return <ErrorView error={{ message: 'This result is no longer on this device.' }} />;
  const r = data.result;
  const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
  const message = pct >= 80 ? 'Excellent work.' : pct >= 50 ? 'Good effort. Review the ones you missed.' : 'Keep going. The explanations below will help.';

  return (
    <Screen edges={[]}>
      <Card style={{ backgroundColor: c.inverse, borderColor: c.inverse, alignItems: 'center', paddingVertical: spacing.xl }}>
        <T variant="caption" color={c.onInverse} style={{ opacity: 0.8, marginBottom: spacing.md }}>YOUR SCORE</T>
        <ScoreRing score={r.score} total={r.total} />
        <T color={c.onInverse} style={{ marginTop: spacing.md, textAlign: 'center' }}>{message}</T>
      </Card>
      {fresh && !isGuestResult ? <StreakCelebration /> : null}
      {isGuestResult && !user?.id ? (
        <Card style={{ marginTop: spacing.md, borderColor: c.accent }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Ionicons name="flame-outline" size={28} color={c.accent} />
            <View style={{ flex: 1 }}>
              <T variant="heading">Save this score</T>
              <T variant="small" color="textSecondary">Create a free account to keep this result, start your daily streak and join the leaderboard.</T>
            </View>
          </View>
          <Button title="Create a free account" onPress={() => router.push('/register')} style={{ marginTop: spacing.md }} />
          <Button title="I already have an account" variant="ghost" onPress={() => router.push('/login')} />
        </Card>
      ) : null}

      {r.answers.map((a, n) => (
        <FadeIn key={a.questionId} from={0} duration={300 + n * 60}>
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons
              name={a.isCorrect ? 'checkmark-circle' : a.selectedIndex === null ? 'remove-circle' : 'close-circle'}
              size={20}
              color={a.isCorrect ? c.correct : a.selectedIndex === null ? c.textMuted : c.incorrect}
            />
            <T variant="caption" color="textSecondary" style={{ flex: 1 }}>
              QUESTION {n + 1} · {a.isCorrect ? 'CORRECT' : a.selectedIndex === null ? 'NOT ANSWERED' : 'INCORRECT'}
            </T>
            {!a.retired ? <BookmarkButton itemType="question" itemId={a.questionId} size={20} item={{ id: a.questionId, stem: a.stem, options: a.options, correctIndex: a.correctIndex, explanation: a.explanation, article: a.article }} /> : null}
          </View>
          <T variant="heading">{a.stem}</T>
          {(a.options || []).map((o, i) => <OptionRow key={i} text={o} i={i} a={a} />)}
          {a.explanation ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>{a.explanation}</T> : null}
          {a.updatedSinceAttempt ? (
            <T variant="small" style={{ marginTop: spacing.sm, fontWeight: '600' }}>
              Note: this question was corrected after you answered.
              {a.currentCorrectIndex !== undefined ? ` The correct answer is now ${optionLetter(a.currentCorrectIndex)}.` : ''} Your score is unchanged.
            </T>
          ) : null}
          {a.article ? (
            <Button title="Read the article" variant="ghost" icon="newspaper-outline" onPress={() => router.push(`/article/${a.article}`)} style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          ) : null}
        </Card>
        </FadeIn>
      ))}
      <Button title="Done" variant="dark" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
