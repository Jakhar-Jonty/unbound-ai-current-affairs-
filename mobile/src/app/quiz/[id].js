import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useQuiz, useSubmitAttempt } from '../../lib/queries';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import SignInPrompt from '../../components/SignInPrompt';
import { Button, Empty, ErrorView, Loading, ProgressBar, Screen, T } from '../../components/ui';

function confirm(title, message, onYes) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [{ text: 'Keep going', style: 'cancel' }, { text: 'Submit', onPress: onYes }]);
}

export default function QuizScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { signedIn } = useAuth();
  const { data, isLoading, error, refetch } = useQuiz(id);
  const submit = useSubmitAttempt(id);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> selectedIndex
  const times = useRef({}); // questionId -> ms spent
  const shownAt = useRef(0);
  const startedAt = useRef(0);

  const questions = data?.questions || [];
  const q = questions[index];

  useEffect(() => { startedAt.current = Date.now(); }, []);

  // Track time spent on each question (used for future analytics).
  useEffect(() => {
    if (!q) return undefined;
    const spent = times.current;
    shownAt.current = Date.now();
    return () => {
      spent[q.id] = (spent[q.id] || 0) + (Date.now() - shownAt.current);
    };
  }, [q]);

  if (!signedIn) return <Screen edges={[]}><SignInPrompt icon="checkbox-outline" title="Sign in to take the quiz" message="Your score and progress are saved to your account." /></Screen>;
  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (data.myAttempt) {
    return (
      <Screen edges={[]}>
        <Empty icon="checkmark-done-outline" title={`You scored ${data.myAttempt.score}/${data.myAttempt.total}`} message="You’ve already taken this quiz." action={<Button title="Review answers" onPress={() => router.replace(`/result/${data.myAttempt.id}`)} />} />
      </Screen>
    );
  }
  if (!questions.length) return <Empty icon="checkbox-outline" title="No questions" message="This quiz has no questions right now." />;

  const answeredCount = Object.keys(answers).length;
  const isLast = index === questions.length - 1;

  const doSubmit = () => {
    if (q) times.current[q.id] = (times.current[q.id] || 0) + (Date.now() - shownAt.current);
    shownAt.current = Date.now();
    submit.mutate(
      {
        answers: questions.map((qq) => ({
          questionId: qq.id,
          selectedIndex: answers[qq.id] ?? null,
          timeMs: Math.round(times.current[qq.id] || 0),
        })),
        durationMs: Date.now() - startedAt.current,
      },
      { onSuccess: (r) => router.replace(`/result/${r.result.id}`) },
    );
  };

  const onSubmitPress = () => {
    const missing = questions.length - answeredCount;
    if (missing) confirm('Submit quiz?', `You have ${missing} unanswered question${missing > 1 ? 's' : ''}. Unanswered questions count as incorrect.`, doSubmit);
    else doSubmit();
  };

  return (
    <>
      <Stack.Screen options={{ title: `Question ${index + 1} of ${questions.length}` }} />
      <Screen edges={[]}>
        <ProgressBar value={index + 1} max={questions.length} />
        <T variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.lg }} accessibilityRole="header">{q.stem}</T>
        <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Option ${optionLetter(i)}: ${opt}`}
                onPress={() => setAnswers({ ...answers, [q.id]: i })}
                style={({ pressed }) => [s.option, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : 'transparent', opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[s.letter, { borderColor: selected ? c.accent : c.borderStrong, backgroundColor: selected ? c.accent : 'transparent' }]}>
                  <T variant="small" style={{ fontWeight: '700', color: selected ? c.onAccent : c.text }}>{optionLetter(i)}</T>
                </View>
                <T style={{ flex: 1 }}>{opt}</T>
              </Pressable>
            );
          })}
        </View>

        {submit.error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.lg }}>{submit.error.message}</T> : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          <Button title="Back" variant="outline" icon="chevron-back" onPress={() => setIndex(index - 1)} disabled={index === 0} style={{ flex: 1 }} />
          {isLast ? (
            <Button title="Submit" icon="checkmark" onPress={onSubmitPress} loading={submit.isPending} style={{ flex: 1.4 }} />
          ) : (
            <Button title="Next" variant="dark" onPress={() => setIndex(index + 1)} style={{ flex: 1.4 }} />
          )}
        </View>
        <T variant="small" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>
          {answeredCount} of {questions.length} answered
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
          {questions.map((qq, i) => (
            <Pressable key={qq.id} onPress={() => setIndex(i)} accessibilityRole="button" accessibilityLabel={`Go to question ${i + 1}${answers[qq.id] !== undefined ? ', answered' : ''}`}
              style={[s.dot, { borderColor: i === index ? c.text : c.borderStrong, backgroundColor: answers[qq.id] !== undefined ? c.accent : 'transparent' }]}>
              {answers[qq.id] !== undefined ? <Ionicons name="checkmark" size={12} color={c.onAccent} /> : null}
            </Pressable>
          ))}
        </View>
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, minHeight: 56 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
