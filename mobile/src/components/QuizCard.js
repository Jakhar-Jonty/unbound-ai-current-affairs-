import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, spacing, radius } from '../theme';
import { useGuestQuiz, useTodayQuiz } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { Button, Card, T } from './ui';
import { useT } from '../lib/i18n';

/** "Today's quiz" call to action, inverted (black on light, ivory on dark) to stand out. */
export default function TodayQuizCard() {
  const c = useTheme();
  const { data, isLoading, error, refetch } = useTodayQuiz();
  const { user } = useAuth();
  const { t } = useT();
  const guest = !user?.id;
  const { data: guestDone } = useGuestQuiz(guest ? data?.quiz?.id : null);

  let body;
  if (isLoading) {
    body = <T color={c.onInverse}>{t('quizCard.loading')}</T>;
  } else if (error?.status === 404) {
    body = (
      <>
        <T variant="title" color={c.onInverse}>{t('quizCard.onItsWay')}</T>
        <T variant="small" color={c.onInverse} style={{ opacity: 0.8, marginTop: spacing.xs }}>{t('quizCard.onItsWayMessage')}</T>
      </>
    );
  } else if (error) {
    body = (
      <>
        <T variant="heading" color={c.onInverse}>{t('quizCard.couldNotLoad')}</T>
        <Button title={t('common.tryAgain')} variant="primary" onPress={() => refetch()} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
      </>
    );
  } else {
    const done = data.myAttempt || (guestDone ? { ...guestDone.result, id: 'guest', guest: true } : null);
    body = (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
          <T variant="caption" color={c.onInverse}>{t('quizCard.label')}</T>
        </View>
        <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>
          {done ? t('quizCard.scored', { score: done.score, total: done.total }) : t('quizCard.fromNews', { n: data.quiz.questionCount })}
        </T>
        <T variant="small" color={c.onInverse} style={{ opacity: 0.8, marginTop: spacing.xs }}>
          {done?.guest ? t('quizCard.guestDone') : done ? t('quizCard.reviewHint') : t('quizCard.startHint')}
        </T>
        <Button
          title={done ? t('quizCard.review') : t('quizCard.start')}
          icon={done ? 'reader-outline' : 'play'}
          onPress={() => router.push(done ? (done.guest ? `/result/guest?quiz=${data.quiz.id}` : `/result/${done.id}`) : `/quiz/${data.quiz.id}`)}
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
