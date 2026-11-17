import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import SignInPrompt from '../../components/SignInPrompt';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import { error as hapticError, success as hapticSuccess, tap } from '../../lib/haptics';
import { Button, Card, Empty, ErrorView, Loading, ProgressBar, Screen, T } from '../../components/ui';

/** Practice: one question at a time, answer and explanation shown right after each pick. */
export default function Practice() {
  const c = useTheme();
  const qc = useQueryClient();
  const { subject } = useLocalSearchParams();
  const { signedIn, user } = useAuth();
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
  const title = subjectLabel(taxonomy, subject);

  if (!signedIn) return <Screen edges={[]}><SignInPrompt icon="barbell-outline" title="Sign in to practise" /></Screen>;
  if (isLoading) return <Loading />;
  if (isPremiumError(error)) return <Screen edges={[]}><PremiumGate title="Daily practice limit reached" message={error.message} /></Screen>;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (isPremiumError(check.error)) return <Screen edges={[]}><PremiumGate title="Daily practice limit reached" message={check.error.message} /></Screen>;
  const questions = data.questions;
  const lastResult = Object.values(results).at(-1);
  const remaining = lastResult && lastResult.remainingToday !== undefined ? lastResult.remainingToday : data.remainingToday;
  if (!questions.length) return <Empty icon="barbell-outline" title="No questions yet" message={`There are no ${title} questions yet. Check back after the next news cycle.`} />;

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
            <T variant="caption" color={c.onInverse} style={{ opacity: 0.8 }}>PRACTICE COMPLETE</T>
            <T style={{ fontSize: 52, lineHeight: 60, fontWeight: '800', color: c.accent }}>{correct}/{questions.length}</T>
            <T color={c.onInverse}>{title}</T>
          </Card>
          <T variant="small" color="textSecondary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            Practice counts toward your streak and subject accuracy.
          </T>
          <Button title="Practise again" icon="refresh" onPress={restart} style={{ marginTop: spacing.xl }} />
          <Button title="Done" variant="outline" onPress={() => { qc.invalidateQueries({ queryKey: ['me', user?.id] }); router.back(); }} style={{ marginTop: spacing.sm }} />
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
          <BookmarkButton itemType="question" itemId={q.id} size={22} />
        </View>
        <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
          {q.options.map((opt, i) => {
            const isAnswer = r && i === r.correctIndex;
            const isWrongPick = r && i === r.selectedIndex && !r.isCorrect;
            const border = isAnswer ? c.correct : isWrongPick ? c.incorrect : c.border;
            const bg = isAnswer ? c.correctSoft : isWrongPick ? c.incorrectSoft : 'transparent';
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ checked: r?.selectedIndex === i, disabled: !!r }}
                accessibilityLabel={`Option ${optionLetter(i)}: ${opt}`}
                disabled={!!r || check.isPending}
                onPress={() => { tap(); check.mutate({ questionId: q.id, selectedIndex: i }); }}
                style={({ pressed }) => [s.option, { borderColor: border, backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[s.letter, { borderColor: border === c.border ? c.borderStrong : border }]}>
                  <T variant="small" style={{ fontWeight: '700' }}>{optionLetter(i)}</T>
                </View>
                <T style={{ flex: 1 }}>{opt}</T>
                {isAnswer ? <Ionicons name="checkmark-circle" size={20} color={c.correct} accessibilityLabel="Correct answer" /> : null}
                {isWrongPick ? <Ionicons name="close-circle" size={20} color={c.incorrect} accessibilityLabel="Your answer, incorrect" /> : null}
              </Pressable>
            );
          })}
        </View>

        {check.error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{check.error.message}</T> : null}

        {r ? (
          <Card style={{ marginTop: spacing.lg }} accessibilityLiveRegion="polite">
            <T variant="heading" color={r.isCorrect ? 'correct' : 'incorrect'}>{r.isCorrect ? 'Correct' : `Not quite. The answer is ${optionLetter(r.correctIndex)}.`}</T>
            <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>{r.explanation}</T>
            {r.article ? <Button title="Read the article" variant="ghost" icon="newspaper-outline" onPress={() => router.push(`/article/${r.article}`)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.xs }} /> : null}
          </Card>
        ) : null}

        <Button
          title={index === questions.length - 1 ? 'See results' : 'Next question'}
          variant="dark"
          disabled={!r}
          onPress={() => setIndex(index + 1)}
          style={{ marginTop: spacing.xl }}
        />
        <T variant="small" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>
          {correct} correct so far{remaining !== null && remaining !== undefined ? ` · ${remaining} free ${remaining === 1 ? 'question' : 'questions'} left today` : ''}
        </T>
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, minHeight: 56 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
