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
import { useT } from '../../lib/i18n';

function OptionRow({ text, i, a }) {
  const c = useTheme();
  const { t } = useT();
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
      {isCorrect ? <Ionicons name="checkmark-circle" size={18} color={c.correct} accessibilityLabel={t('result.correctAnswer')} /> : null}
      {isWrongPick ? <Ionicons name="close-circle" size={18} color={c.incorrect} accessibilityLabel={t('result.yourWrong')} /> : null}
    </View>
  );
}

/** Mock test: marks, correct/wrong/skipped, rank and the top scores. */
function MockSummary({ m }) {
  const c = useTheme();
  const { t } = useT();
  const stat = (label, value, color) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T variant="title" style={color ? { color } : null}>{value}</T>
      <T variant="small" color="textSecondary">{label}</T>
    </View>
  );
  return (
    <>
      <Card style={{ marginTop: spacing.md, flexDirection: 'row' }}>
        {stat(t('mock.correct'), m.correct, c.correct)}
        {stat(t('mock.wrong'), m.wrong, c.incorrect)}
        {stat(t('mock.skipped'), m.unanswered)}
      </Card>
      <Card style={{ marginTop: spacing.md }}>
        {m.late ? <T variant="small">{t('mock.late')}</T> : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="ribbon" size={22} color={c.accent} />
              <T variant="heading">{t('mock.rank', { rank: m.rank, n: m.participants })}</T>
            </View>
            {m.percentile !== null && m.percentile !== undefined ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>{t('mock.percentile', { p: m.percentile })}</T> : null}
          </>
        )}
        {m.top?.length ? (
          <>
            <T variant="caption" color="textSecondary" style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>{t('mock.top')}</T>
            {m.top.map((e, i) => (
              <View key={`${e.name}-${i}`} style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <T variant="small" style={{ width: 28, fontWeight: '700' }}>{i + 1}</T>
                <T variant="small" style={{ flex: 1, fontWeight: e.isMe ? '700' : '400' }}>{e.name}</T>
                <T variant="small" style={{ fontWeight: '700' }}>{e.marks}</T>
              </View>
            ))}
          </>
        ) : null}
      </Card>
    </>
  );
}

export default function ResultScreen() {
  const c = useTheme();
  const { t } = useT();
  const { id, fresh, quiz: guestQuizId } = useLocalSearchParams();
  const { user } = useAuth();
  const isGuestResult = id === 'guest';
  const saved = useAttempt(isGuestResult ? null : id);
  const local = useGuestQuiz(isGuestResult ? guestQuizId : null);
  const { data, isLoading, error, refetch } = isGuestResult ? { ...local, data: local.data ? { result: local.data.result } : null } : saved;
  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!data) return <ErrorView error={{ message: t('result.gone') }} />;
  const r = data.result;
  const m = r.mock;
  const pct = m ? (m.maxMarks ? (m.marks / m.maxMarks) * 100 : 0) : r.total ? Math.round((r.score / r.total) * 100) : 0;
  const message = pct >= 80 ? t('result.excellent') : pct >= 50 ? t('result.good') : t('result.keepGoing');

  return (
    <Screen edges={[]}>
      <Card style={{ backgroundColor: c.inverse, borderColor: c.inverse, alignItems: 'center', paddingVertical: spacing.xl }}>
        <T variant="caption" color={c.onInverse} style={{ opacity: 0.8, marginBottom: spacing.md }}>{m ? t('mock.marks') : t('result.yourScore')}</T>
        {m ? (
          <T style={{ fontSize: 48, lineHeight: 56, fontWeight: '800', color: c.accent }} accessibilityLabel={t('mock.yourMarks', { marks: m.marks, max: m.maxMarks })}>
            {m.marks}<T style={{ fontSize: 22, color: c.onInverse }}> / {m.maxMarks}</T>
          </T>
        ) : <ScoreRing score={r.score} total={r.total} />}
        <T color={c.onInverse} style={{ marginTop: spacing.md, textAlign: 'center' }}>{message}</T>
      </Card>
      {m ? <MockSummary m={m} /> : null}
      {fresh && !isGuestResult ? <StreakCelebration /> : null}
      {isGuestResult && !user?.id ? (
        <Card style={{ marginTop: spacing.md, borderColor: c.accent }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Ionicons name="flame-outline" size={28} color={c.accent} />
            <View style={{ flex: 1 }}>
              <T variant="heading">{t('result.saveScore')}</T>
              <T variant="small" color="textSecondary">{t('result.saveScoreSub')}</T>
            </View>
          </View>
          <Button title={t('common.createFreeAccount')} onPress={() => router.push('/register')} style={{ marginTop: spacing.md }} />
          <Button title={t('common.haveAccount')} variant="ghost" onPress={() => router.push('/login')} />
        </Card>
      ) : null}

      {r.answers.map((a, n) => (
        <FadeIn key={a.questionId} from={0} duration={300 + Math.min(n, 10) * 60}>
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons
              name={a.isCorrect ? 'checkmark-circle' : a.selectedIndex === null ? 'remove-circle' : 'close-circle'}
              size={20}
              color={a.isCorrect ? c.correct : a.selectedIndex === null ? c.textMuted : c.incorrect}
            />
            <T variant="caption" color="textSecondary" style={{ flex: 1 }}>
              {t('result.question', { n: n + 1 })} · {a.isCorrect ? t('result.correct') : a.selectedIndex === null ? t('result.notAnswered') : t('result.incorrect')}
            </T>
            {!a.retired ? <BookmarkButton itemType="question" itemId={a.questionId} size={20} item={{ id: a.questionId, stem: a.stem, options: a.options, correctIndex: a.correctIndex, explanation: a.explanation, article: a.article }} /> : null}
          </View>
          <T variant="heading">{a.stem}</T>
          {(a.options || []).map((o, i) => <OptionRow key={i} text={o} i={i} a={a} />)}
          {a.explanation ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>{a.explanation}</T> : null}
          {a.updatedSinceAttempt ? (
            <T variant="small" style={{ marginTop: spacing.sm, fontWeight: '600' }}>
              {t('result.corrected')}
              {a.currentCorrectIndex !== undefined ? t('result.nowCorrect', { l: optionLetter(a.currentCorrectIndex) }) : ''}{t('result.unchanged')}
            </T>
          ) : null}
          {a.article ? (
            <Button title={t('result.readArticle')} variant="ghost" icon="newspaper-outline" onPress={() => router.push(`/article/${a.article}`)} style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          ) : null}
        </Card>
        </FadeIn>
      ))}
      <Button title={t('common.done')} variant="dark" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
