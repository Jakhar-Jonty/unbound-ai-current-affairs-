import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useGuestQuiz, useQuiz, useSubmitAttempt } from '../../lib/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { saveGuestQuiz } from '../../lib/guest';
import { optionLetter } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import PressableScale from '../../components/PressableScale';
import FadeIn from '../../components/FadeIn';
import { tap } from '../../lib/haptics';
import LanguageSwitch from '../../components/LanguageSwitch';
import { usePrefs } from '../../lib/prefs';
import { Button, Card, Empty, ErrorView, Loading, ProgressBar, Screen, T } from '../../components/ui';

// UPSC Prelims pace: 100 questions in 2 hours.
const SECONDS_PER_QUESTION = 72;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Timer({ endsAt, onExpire }) {
  const c = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; onExpire(); }
  }, [left, onExpire]);
  const low = left <= 60;
  return (
    <View accessibilityLabel={`${Math.floor(left / 60)} minutes ${left % 60} seconds left`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: low ? c.incorrectSoft : c.accentSoft }}>
      <Ionicons name="timer-outline" size={16} color={low ? c.incorrect : c.text} />
      <T variant="small" style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color: low ? c.incorrect : c.text }}>{mmss(left)}</T>
    </View>
  );
}

export default function QuizScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const qc = useQueryClient();
  const { prefs } = usePrefs();
  const { user } = useAuth();
  const guest = !user?.id;
  const { data, isLoading, error, refetch } = useQuiz(id);
  const { data: guestDone } = useGuestQuiz(guest ? id : null);
  const saveAttempt = useSubmitAttempt(id);
  // Guests: graded by the server but kept on the device until they sign up.
  const guestCheck = useMutation({
    mutationFn: async (body) => {
      const { result } = await api(`/quizzes/${id}/check`, { method: 'POST', body });
      await saveGuestQuiz(id, { answers: body.answers, durationMs: body.durationMs, result });
      qc.invalidateQueries({ queryKey: ['guest-quiz', id] });
      return { result };
    },
  });
  const submit = guest ? guestCheck : saveAttempt;
  const [phase, setPhase] = useState('intro'); // intro | playing | review
  const [endsAt, setEndsAt] = useState(null); // set when the exam timer is on
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> selectedIndex
  const times = useRef({}); // questionId -> ms spent
  const shownAt = useRef(0);
  const startedAt = useRef(0);
  const currentQ = useRef(null);

  const questions = useMemo(() => data?.questions || [], [data]);
  const q = phase === 'playing' ? questions[index] : null;

  // Time spent on each question (used for insights).
  useEffect(() => {
    if (!q) return undefined;
    const spent = times.current;
    currentQ.current = q.id;
    shownAt.current = Date.now();
    return () => { spent[q.id] = (spent[q.id] || 0) + (Date.now() - shownAt.current); };
  }, [q]);

  const doSubmit = useCallback(() => {
    if (submit.isPending || submit.isSuccess) return;
    if (currentQ.current) {
      times.current[currentQ.current] = (times.current[currentQ.current] || 0) + (Date.now() - shownAt.current);
      shownAt.current = Date.now();
    }
    submit.mutate(
      {
        answers: questions.map((qq) => ({ questionId: qq.id, selectedIndex: answers[qq.id] ?? null, timeMs: Math.round(times.current[qq.id] || 0) })),
        durationMs: Date.now() - startedAt.current,
      },
      { onSuccess: (r) => router.replace(guest ? `/result/guest?quiz=${id}&fresh=1` : `/result/${r.result.id}?fresh=1`) },
    );
  }, [submit, questions, answers, guest, id]);

  if (isLoading) return <Loading />;
  if (isPremiumError(error)) return <Screen edges={[]}><PremiumGate title="From the archive" message={error.message} /></Screen>;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (guest && guestDone) {
    return (
      <Screen edges={[]}>
        <Empty icon="checkmark-done-outline" title={`You scored ${guestDone.result.score}/${guestDone.result.total}`} message="You took this quiz on this device. Create a free account to save the score and start your streak." action={<Button title="See your answers" onPress={() => router.replace(`/result/guest?quiz=${id}`)} />} />
      </Screen>
    );
  }
  if (data.myAttempt) {
    return (
      <Screen edges={[]}>
        <Empty icon="checkmark-done-outline" title={`You scored ${data.myAttempt.score}/${data.myAttempt.total}`} message="You’ve already taken this quiz." action={<Button title="Review answers" onPress={() => router.replace(`/result/${data.myAttempt.id}`)} />} />
      </Screen>
    );
  }
  if (!questions.length) return <Empty icon="checkbox-outline" title="No questions" message="This quiz has no questions right now." />;

  const answeredCount = Object.keys(answers).length;
  const missing = questions.length - answeredCount;
  const timerHeader = endsAt ? () => <Timer endsAt={endsAt} onExpire={doSubmit} /> : undefined;

  const start = (timed) => {
    startedAt.current = Date.now();
    setEndsAt(timed ? Date.now() + questions.length * SECONDS_PER_QUESTION * 1000 : null);
    setPhase('playing');
  };

  if (phase === 'intro') {
    const minutes = Math.round((questions.length * SECONDS_PER_QUESTION) / 60);
    return (
      <Screen edges={[]}>
        <FadeIn>
          <T variant="caption" color="textSecondary">{(data.quiz.title || '').toUpperCase()}</T>
          <T variant="display" style={{ marginTop: spacing.xs }}>{questions.length} questions</T>
          <T color="textSecondary" style={{ marginTop: spacing.sm }}>Exam-style questions from recent news. You’ll see the answers and explanations after you submit.</T>
          <View style={{ marginTop: spacing.lg }}><LanguageSwitch /></View>
          {prefs.lang === 'hi' && questions.some((x) => x.lang !== 'hi') ? (
            <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }} lang="hi">
              {questions.every((x) => x.lang !== 'hi') ? 'इस क्विज़ का हिंदी अनुवाद अभी समीक्षा में है, इसलिए प्रश्न अंग्रेज़ी में हैं।' : 'कुछ प्रश्न अभी केवल अंग्रेज़ी में हैं।'}
            </T>
          ) : null}
          {guest ? (
            <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>
              You’re not signed in: your result stays on this device, and is saved to your account if you sign up afterwards.
            </T>
          ) : null}
          <Card style={{ marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Ionicons name="timer-outline" size={24} color={c.accent} />
              <View style={{ flex: 1 }}>
                <T variant="heading">Exam mode</T>
                <T variant="small" color="textSecondary">{minutes} minutes in total, the Prelims pace. The quiz submits itself when time runs out.</T>
              </View>
            </View>
          </Card>
          <Button title="Start" icon="play" onPress={() => start(false)} style={{ marginTop: spacing.xl }} />
          <Button title={`Start with ${minutes}-minute timer`} variant="outline" icon="timer-outline" onPress={() => start(true)} style={{ marginTop: spacing.sm }} />
        </FadeIn>
      </Screen>
    );
  }

  if (phase === 'review') {
    return (
      <>
        <Stack.Screen options={{ title: 'Review answers', headerRight: timerHeader }} />
        <Screen edges={[]}>
          <T color="textSecondary">Check your answers before submitting. Tap a question to change it.</T>
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {questions.map((qq, i) => {
              const sel = answers[qq.id];
              return (
                <PressableScale key={qq.id} onPress={() => { setIndex(i); setPhase('playing'); }} accessibilityRole="button"
                  accessibilityLabel={`Question ${i + 1}, ${sel === undefined ? 'not answered' : `answer ${optionLetter(sel)}`}. Tap to change`}
                  style={[s.reviewRow, { borderColor: sel === undefined ? c.accent : c.border }]}>
                  <T variant="small" style={{ fontWeight: '700', width: 22 }}>{i + 1}</T>
                  <T variant="small" style={{ flex: 1 }} numberOfLines={2}>{qq.stem}</T>
                  {sel === undefined
                    ? <T variant="caption" style={{ color: c.text }}>NOT ANSWERED</T>
                    : <View style={[s.letter, { borderColor: c.accent, backgroundColor: c.accent }]}><T variant="small" style={{ fontWeight: '700', color: c.onAccent }}>{optionLetter(sel)}</T></View>}
                </PressableScale>
              );
            })}
          </View>
          {missing ? <T variant="small" style={{ marginTop: spacing.lg, fontWeight: '600' }}>{missing} unanswered {missing === 1 ? 'question counts' : 'questions count'} as incorrect.</T> : null}
          {submit.error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{submit.error.message}</T> : null}
          <Button title="Submit quiz" icon="checkmark" onPress={doSubmit} loading={submit.isPending} style={{ marginTop: spacing.xl }} />
          <Button title="Back to questions" variant="ghost" onPress={() => setPhase('playing')} style={{ marginTop: spacing.sm }} />
        </Screen>
      </>
    );
  }

  const isLast = index === questions.length - 1;
  return (
    <>
      <Stack.Screen options={{ title: `Question ${index + 1} of ${questions.length}`, headerRight: timerHeader }} />
      <Screen edges={[]}>
        <ProgressBar value={index + 1} max={questions.length} />
        <FadeIn key={q.id}>
          <T variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.lg }} accessibilityRole="header">{q.stem}</T>
          <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <PressableScale
                  key={i}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Option ${optionLetter(i)}: ${opt}`}
                  onPress={() => { tap(); setAnswers({ ...answers, [q.id]: i }); }}
                  style={[s.option, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : 'transparent' }]}
                >
                  <View style={[s.letter, { borderColor: selected ? c.accent : c.borderStrong, backgroundColor: selected ? c.accent : 'transparent' }]}>
                    <T variant="small" style={{ fontWeight: '700', color: selected ? c.onAccent : c.text }}>{optionLetter(i)}</T>
                  </View>
                  <T style={{ flex: 1 }}>{opt}</T>
                </PressableScale>
              );
            })}
          </View>
        </FadeIn>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          <Button title="Back" variant="outline" icon="chevron-back" onPress={() => setIndex(index - 1)} disabled={index === 0} style={{ flex: 1 }} />
          {isLast
            ? <Button title="Review" icon="list" onPress={() => setPhase('review')} style={{ flex: 1.4 }} />
            : <Button title="Next" variant="dark" onPress={() => setIndex(index + 1)} style={{ flex: 1.4 }} />}
        </View>
        <T variant="small" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>{answeredCount} of {questions.length} answered</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
          {questions.map((qq, i) => (
            <Pressable key={qq.id} onPress={() => setIndex(i)} accessibilityRole="button" accessibilityLabel={`Go to question ${i + 1}${answers[qq.id] !== undefined ? ', answered' : ''}`}
              style={[s.dot, { borderColor: i === index ? c.text : c.borderStrong, backgroundColor: answers[qq.id] !== undefined ? c.accent : 'transparent' }]}>
              {answers[qq.id] !== undefined ? <Ionicons name="checkmark" size={12} color={c.onAccent} /> : null}
            </Pressable>
          ))}
        </View>
        {!isLast ? <Button title="Review and submit" variant="ghost" onPress={() => setPhase('review')} style={{ marginTop: spacing.md }} /> : null}
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, minHeight: 56 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md },
});
