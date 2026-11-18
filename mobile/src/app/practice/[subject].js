import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { usePracticeSet, useTaxonomy } from '../../lib/queries';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import { subjectLabel } from '../../components/ArticleCard';
import BookmarkButton from '../../components/BookmarkButton';
import AnswerFeedback from '../../components/AnswerFeedback';
import PressableScale from '../../components/PressableScale';
import FadeIn from '../../components/FadeIn';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import { error as hapticError, success as hapticSuccess, tap } from '../../lib/haptics';
import { errorText, useT } from '../../lib/i18n';
import { Button, Card, Empty, ErrorView, Loading, ProgressBar, Screen, T } from '../../components/ui';

/** Practice: one question at a time, answer and explanation shown right after each pick. */
export default function Practice() {
  const c = useTheme();
  const qc = useQueryClient();
  const { subject } = useLocalSearchParams();
  const { user } = useAuth();
  const { t, lang } = useT();
  const guest = !user?.id;
  const { data: taxonomy } = useTaxonomy();
  const { data, isLoading, error, refetch } = usePracticeSet(subject);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({}); // questionId -> { selectedIndex, isCorrect, correctIndex, explanation }
  const check = useMutation({
    mutationFn: (body) => api('/practice/answers', { method: 'POST', body }),
    onSuccess: (r, body) => {
      if (r.isCorrect) hapticSuccess(); else hapticError();
      setResults((prev) => ({ ...prev, [body.questionId]: { ...r, selectedIndex: body.selectedIndex } }));
    },
  });
  const title = subjectLabel(taxonomy, subject, lang);

  if (isLoading) return <Loading />;
  if (isPremiumError(error)) return <Screen edges={[]}><PremiumGate title={t('premium.practiceLimit')} message={errorText(error, t)} /></Screen>;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (isPremiumError(check.error)) return <Screen edges={[]}><PremiumGate title={t('premium.practiceLimit')} message={errorText(check.error, t)} /></Screen>;
  const questions = data.questions;
  const lastResult = Object.values(results).at(-1);
  const remaining = lastResult && lastResult.remainingToday !== undefined ? lastResult.remainingToday : data.remainingToday;
  if (!questions.length) return <Empty icon="barbell-outline" title={t('practice.noneYet')} message={t('practice.noneYetMsg', { subject: title })} />;

  const finished = index >= questions.length;
  const correct = Object.values(results).filter((r) => r.isCorrect).length;

  const restart = () => {
    qc.invalidateQueries({ queryKey: ['me', user?.id] });
    setResults({});
    setIndex(0);
    refetch();
  };

  if (finished) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen edges={[]}>
          <Card style={{ backgroundColor: c.inverse, borderColor: c.inverse, alignItems: 'center', paddingVertical: spacing.xl }}>
            <T variant="caption" color={c.onInverse} style={{ opacity: 0.8 }}>{t('practice.complete')}</T>
            <T style={{ fontSize: 52, lineHeight: 60, fontWeight: '800', color: c.accent }}>{correct}/{questions.length}</T>
            <T color={c.onInverse}>{title}</T>
          </Card>
          <T variant="small" color="textSecondary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {guest ? t('practice.guestNote') : t('practice.counts')}
          </T>
          {guest ? <Button title={t('common.createFreeAccount')} onPress={() => router.push('/register')} style={{ marginTop: spacing.lg }} /> : null}
          <Button title={t('practice.again')} icon="refresh" onPress={restart} style={{ marginTop: spacing.xl }} />
          <Button title={t('common.done')} variant="outline" onPress={() => { qc.invalidateQueries({ queryKey: ['me', user?.id] }); router.back(); }} style={{ marginTop: spacing.sm }} />
        </Screen>
      </>
    );
  }

  const q = questions[index];
  const r = results[q.id];

  return (
    <>
      <Stack.Screen options={{ title: `${title} · ${index + 1}/${questions.length}` }} />
      <Screen edges={[]}>
        <ProgressBar value={index + (r ? 1 : 0)} max={questions.length} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.lg }}>
          <T variant="heading" style={{ flex: 1 }} accessibilityRole="header">{q.stem}</T>
          <BookmarkButton itemType="question" itemId={q.id} size={22} item={{ id: q.id, stem: q.stem, options: q.options, correctIndex: r?.correctIndex, explanation: r?.explanation, article: r?.article }} />
        </View>
        <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
          {q.options.map((opt, i) => {
            const isAnswer = r && i === r.correctIndex;
            const isWrongPick = r && i === r.selectedIndex && !r.isCorrect;
            const border = isAnswer ? c.correct : isWrongPick ? c.incorrect : c.border;
            const bg = isAnswer ? c.correctSoft : isWrongPick ? c.incorrectSoft : 'transparent';
            return (
              <AnswerFeedback key={i} state={isWrongPick ? 'wrong' : isAnswer ? 'correct' : 'none'}>
              <PressableScale
                accessibilityRole="radio"
                accessibilityState={{ checked: r?.selectedIndex === i, disabled: !!r }}
                accessibilityLabel={t('quiz.option', { l: optionLetter(i), text: opt })}
                disabled={!!r || check.isPending}
                onPress={() => { tap(); check.mutate({ questionId: q.id, selectedIndex: i }); }}
                style={[s.option, { borderColor: border, backgroundColor: bg }]}
              >
                <View style={[s.letter, { borderColor: border === c.border ? c.borderStrong : border }]}>
                  <T variant="small" style={{ fontWeight: '700' }}>{optionLetter(i)}</T>
                </View>
                <T style={{ flex: 1 }}>{opt}</T>
                {isAnswer ? <Ionicons name="checkmark-circle" size={20} color={c.correct} accessibilityLabel={t('result.correctAnswer')} /> : null}
                {isWrongPick ? <Ionicons name="close-circle" size={20} color={c.incorrect} accessibilityLabel={t('result.yourWrong')} /> : null}
              </PressableScale>
              </AnswerFeedback>
            );
          })}
        </View>

        {check.error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{check.error.message}</T> : null}

        {r ? (
          <FadeIn from={0}>
          <Card style={{ marginTop: spacing.lg }} accessibilityLiveRegion="polite">
            <T variant="heading" color={r.isCorrect ? 'correct' : 'incorrect'}>{r.isCorrect ? t('practice.correct') : t('practice.notQuite', { l: optionLetter(r.correctIndex) })}</T>
            <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>{r.explanation}</T>
            {r.article ? <Button title={t('result.readArticle')} variant="ghost" icon="newspaper-outline" onPress={() => router.push(`/article/${r.article}`)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.xs }} /> : null}
          </Card>
          </FadeIn>
        ) : null}

        <Button
          title={index === questions.length - 1 ? t('practice.seeResults') : t('practice.next')}
          variant="dark"
          disabled={!r}
          onPress={() => setIndex(index + 1)}
          style={{ marginTop: spacing.xl }}
        />
        <T variant="small" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>
          {t('practice.soFar', { n: correct })}{remaining !== null && remaining !== undefined ? t('practice.left', { n: remaining }) : ''}
        </T>
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, minHeight: 56 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
