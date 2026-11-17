import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, spacing, radius } from '../theme';
import { useTodayQuiz } from '../lib/queries';
import { Button, Card, T } from './ui';

/** "Today's quiz" call to action, inverted (black on light, ivory on dark) to stand out. */
export default function TodayQuizCard() {
  const c = useTheme();
  const { data, isLoading, error, refetch } = useTodayQuiz();

  let body;
  if (isLoading) {
    body = <T color={c.onInverse}>Loading today’s quiz…</T>;
  } else if (error?.status === 404) {
    body = (
      <>
        <T variant="title" color={c.onInverse}>Today’s quiz is on its way</T>
        <T variant="small" color={c.onInverse} style={{ opacity: 0.8, marginTop: spacing.xs }}>It’s published every morning at 7:00 IST. Read today’s news while you wait.</T>
      </>
    );
  } else if (error) {
    body = (
      <>
        <T variant="heading" color={c.onInverse}>Couldn’t load today’s quiz</T>
        <Button title="Try again" variant="primary" onPress={() => refetch()} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
      </>
    );
  } else {
    const done = data.myAttempt;
    body = (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
          <T variant="caption" color={c.onInverse}>DAILY QUIZ</T>
        </View>
        <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>
          {done ? `You scored ${done.score}/${done.total}` : `${data.quiz.questionCount} questions from today’s news`}
        </T>
        <T variant="small" color={c.onInverse} style={{ opacity: 0.8, marginTop: spacing.xs }}>
          {done ? 'Review the explanations to lock in what you learned.' : 'About 5 minutes. Explanations after you submit.'}
        </T>
        <Button
          title={done ? 'Review answers' : 'Start quiz'}
          icon={done ? 'reader-outline' : 'play'}
          onPress={() => router.push(done ? `/result/${done.id}` : `/quiz/${data.quiz.id}`)}
          style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}
        />
      </>
    );
  }

  return (
    <Card style={{ backgroundColor: c.inverse, borderColor: c.inverse, borderRadius: radius.lg, marginBottom: spacing.sm }}>
      <Ionicons name="flash" size={22} color={c.accent} style={{ position: 'absolute', right: spacing.lg, top: spacing.lg }} />
      {body}
    </Card>
  );
}
