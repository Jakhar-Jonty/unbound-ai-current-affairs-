import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useGuestQuiz, useQuiz, useSubmitAttempt } from '../../lib/queries';
import { api } from '../../lib/api';
import { saveGuestQuiz } from '../../lib/guest';
import { optionLetter } from '../../lib/format';
import { errorText, useT } from '../../lib/i18n';
import { useTheme, spacing, radius } from '../../theme';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import PressableScale from '../../components/PressableScale';
import FadeIn from '../../components/FadeIn';
import SignInPrompt from '../../components/SignInPrompt';
import { tap } from '../../lib/haptics';
import LanguageSwitch from '../../components/LanguageSwitch';
import { Button, Card, Empty, ErrorView, Loading, ProgressBar, Screen, T } from '../../components/ui';

// UPSC Prelims pace: 100 questions in 2 hours.
const SECONDS_PER_QUESTION = 72;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const draftKey = (id) => `mock-answers:${id}`;

function Timer({ endsAt, onExpire }) {
  const c = useTheme();
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; onExpire(); }
  }, [left, onExpire]);
  const low = left <= 60;
  return (
    <View accessibilityLabel={t('quiz.timeLeft', { m: Math.floor(left / 60), s: left % 60 })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: low ? c.incorrectSoft : c.accentSoft }}>
      <Ionicons name="timer-outline" size={16} color={low ? c.incorrect : c.text} />
      <T variant="small" style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color: low ? c.incorrect : c.text }}>{mmss(left)}</T>
    </View>
  );
}

export default function QuizScreen() {
  const c = useTheme();
  const { t, lang } = useT();
  const { id } = useLocalSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const guest = !user?.id;
  const { data, isLoading, error, refetch } = useQuiz(id);
  const isMock = data?.quiz?.type === 'mock';
  const { data: guestDone } = useGuestQuiz(guest && !isMock ? id : null);
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
  // Mock tests: the server starts the clock and only then sends the questions.
  const startMock = useMutation({ mutationFn: () => api(`/quizzes/${id}/start`, { method: 'POST' }) });
  const submit = guest ? guestCheck : saveAttempt;

  const [phase, setPhase] = useState('intro'); // intro | playing | review
  const [localEndsAt, setLocalEndsAt] = useState(null); // optional exam timer on normal quizzes
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> selectedIndex
  const times = useRef({}); // questionId -> ms spent
  const shownAt = useRef(0);
  const startedAt = useRef(0);
  const currentQ = useRef(null);

  const mockTimer = startMock.data?.timer || data?.timer || null;
  const questions = useMemo(() => startMock.data?.questions || data?.questions || [], [startMock.data, data]);
  const endsAt = isMock ? (mockTimer ? new Date(mockTimer.endsAt).getTime() : null) : localEndsAt;
  // A mock that has already started (e.g. the app was reopened) goes straight to the questions.
  const view = isMock && mockTimer && phase === 'intro' ? 'playing' : phase;
  const q = view === 'playing' ? questions[index] : null;

  // Mock answers are kept on the device, so reopening the app doesn't lose them.
  useEffect(() => {
    if (!isMock || !mockTimer) return undefined;
    let alive = true;
    AsyncStorage.getItem(draftKey(id)).then((raw) => { if (alive && raw) setAnswers((a) => ({ ...JSON.parse(raw), ...a })); }).catch(() => {});
    return () => { alive = false; };
  }, [isMock, mockTimer, id]);
  const choose = (qid, i) => {
    tap();
    setAnswers((a) => {
      const next = { ...a, [qid]: i };
      if (isMock) AsyncStorage.setItem(draftKey(id), JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

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
        durationMs: Date.now() - (startedAt.current || Date.now()),
      },
      {
        onSuccess: (r) => {
          if (isMock) AsyncStorage.removeItem(draftKey(id)).catch(() => {});
          router.replace(guest ? `/result/guest?quiz=${id}&fresh=1` : `/result/${r.result.id}?fresh=1`);
        },
      },
    );
  }, [submit, questions, answers, guest, id, isMock]);

  if (isLoading) return <Loading />;
  if (isPremiumError(error)) return <Screen edges={[]}><PremiumGate title={t('premium.archiveTitle')} message={errorText(error, t)} /></Screen>;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (isMock && guest) return <Screen edges={[]}><SignInPrompt icon="ribbon-outline" title={t('quiz.signInTitle')} message={t('mock.signIn')} /></Screen>;
  if (guest && guestDone) {
    return (
      <Screen edges={[]}>
        <Empty icon="checkmark-done-outline" title={t('quiz.youScored', { score: guestDone.result.score, total: guestDone.result.total })} message={t('quiz.guestTaken')} action={<Button title={t('quiz.seeAnswers')} onPress={() => router.replace(`/result/guest?quiz=${id}`)} />} />
      </Screen>
    );
  }
  if (data.myAttempt) {
    return (
      <Screen edges={[]}>
        <Empty icon="checkmark-done-outline"
          title={isMock ? t('mock.yourMarks', { marks: data.myAttempt.marks, max: data.myAttempt.maxMarks }) : t('quiz.youScored', { score: data.myAttempt.score, total: data.myAttempt.total })}
          message={t('quiz.alreadyTaken')} action={<Button title={t('quizCard.review')} onPress={() => router.replace(`/result/${data.myAttempt.id}`)} />} />
      </Screen>
    );
  }
  const total = data.quiz.questionCount;
  if (!total) return <Empty icon="checkbox-outline" title={t('quiz.noQuestions')} message={t('quiz.noQuestionsMsg')} />;

  const answeredCount = Object.keys(answers).length;
  const missing = questions.length - answeredCount;
  const timerHeader = endsAt ? () => <Timer endsAt={endsAt} onExpire={doSubmit} /> : undefined;

  if (view === 'intro') {
    const minutes = isMock ? Math.round(data.quiz.durationSeconds / 60) : Math.round((total * SECONDS_PER_QUESTION) / 60);
    const start = (timed) => {
      startedAt.current = Date.now();
      setLocalEndsAt(timed ? Date.now() + total * SECONDS_PER_QUESTION * 1000 : null);
      setPhase('playing');
    };
    return (
      <>
        <Stack.Screen options={{ title: isMock ? t('titles.mock') : t('titles.quiz') }} />
        <Screen edges={[]}>
          <FadeIn>
            <T variant="caption" color="textSecondary">{isMock ? t('mock.label') : (data.quiz.title || '').toUpperCase()}</T>
            <T variant="display" style={{ marginTop: spacing.xs }}>{t('quiz.nQuestions', { n: total })}</T>
            {!isMock ? <T color="textSecondary" style={{ marginTop: spacing.sm }}>{t('quiz.intro')}</T> : null}
            <View style={{ marginTop: spacing.lg }}><LanguageSwitch /></View>
            {lang === 'hi' && questions.length && questions.some((x) => x.lang !== 'hi') ? (
              <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>
                {questions.every((x) => x.lang !== 'hi') ? t('quiz.hiPending') : t('quiz.hiPartial')}
              </T>
            ) : null}
            {guest ? <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>{t('quiz.guestNote')}</T> : null}
            {isMock ? (
              <Card style={{ marginTop: spacing.xl }}>
                <T variant="heading">{t('mock.rulesTitle')}</T>
                {[t('mock.rule1', { n: total, m: minutes }), t('mock.rule2'), t('mock.rule3'), t('mock.rule4')].map((r) => (
                  <View key={r} style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 8 }} />
                    <T variant="small" style={{ flex: 1 }}>{r}</T>
                  </View>
                ))}
              </Card>
            ) : (
              <Card style={{ marginTop: spacing.xl }}>
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Ionicons name="timer-outline" size={24} color={c.accent} />
                  <View style={{ flex: 1 }}>
                    <T variant="heading">{t('quiz.examMode')}</T>
                    <T variant="small" color="textSecondary">{t('quiz.examModeSub', { m: minutes })}</T>
                  </View>
                </View>
              </Card>
            )}
            {startMock.error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{errorText(startMock.error, t)}</T> : null}
            {isMock ? (
              <Button title={t('mock.begin')} icon="timer-outline" loading={startMock.isPending} onPress={() => { startedAt.current = Date.now(); startMock.mutate(); }} style={{ marginTop: spacing.xl }} />
            ) : (
              <>
                <Button title={t('quiz.start')} icon="play" onPress={() => start(false)} style={{ marginTop: spacing.xl }} />
                <Button title={t('quiz.startTimer', { m: minutes })} variant="outline" icon="timer-outline" onPress={() => start(true)} style={{ marginTop: spacing.sm }} />
              </>
            )}
          </FadeIn>
        </Screen>
      </>
    );
  }

  if (!questions.length) return <Loading />;

  if (view === 'review') {
    return (
      <>
        <Stack.Screen options={{ title: t('quiz.reviewTitle'), headerRight: timerHeader }} />
        <Screen edges={[]}>
          <T color="textSecondary">{t('quiz.reviewIntro')}</T>
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {questions.map((qq, i) => {
              const sel = answers[qq.id];
              return (
                <PressableScale key={qq.id} onPress={() => { setIndex(i); setPhase('playing'); }} accessibilityRole="button"
                  accessibilityLabel={t('quiz.qRow', { i: i + 1, state: sel === undefined ? t('quiz.notAnsweredLower') : t('quiz.answerL', { l: optionLetter(sel) }) })}
                  style={[s.reviewRow, { borderColor: sel === undefined ? c.accent : c.border }]}>
                  <T variant="small" style={{ fontWeight: '700', width: 22 }}>{i + 1}</T>
                  <T variant="small" style={{ flex: 1 }} numberOfLines={2}>{qq.stem}</T>
                  {sel === undefined
                    ? <T variant="caption" style={{ color: c.text }}>{t('quiz.notAnswered')}</T>
                    : <View style={[s.letter, { borderColor: c.accent, backgroundColor: c.accent }]}><T variant="small" style={{ fontWeight: '700', color: c.onAccent }}>{optionLetter(sel)}</T></View>}
                </PressableScale>
              );
            })}
          </View>
          {missing ? <T variant="small" style={{ marginTop: spacing.lg, fontWeight: '600' }}>{isMock ? t('mock.unansweredWarn') : t('quiz.unanswered', { n: missing })}</T> : null}
          {submit.error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{errorText(submit.error, t)}</T> : null}
          <Button title={t('quiz.submit')} icon="checkmark" onPress={doSubmit} loading={submit.isPending} style={{ marginTop: spacing.xl }} />
          <Button title={t('quiz.backToQuestions')} variant="ghost" onPress={() => setPhase('playing')} style={{ marginTop: spacing.sm }} />
        </Screen>
      </>
    );
  }

  const isLast = index === questions.length - 1;
  return (
    <>
      <Stack.Screen options={{ title: t('quiz.questionOf', { i: index + 1, n: questions.length }), headerRight: timerHeader }} />
      <Screen edges={[]}>
        <ProgressBar value={index + 1} max={questions.length} />
        <FadeIn key={q.id}>
          <T style={{ marginTop: spacing.xl, marginBottom: spacing.lg, fontSize: 17, lineHeight: 27, fontWeight: '500' }} accessibilityRole="header">{q.stem}</T>
          <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <PressableScale
                  key={i}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={t('quiz.option', { l: optionLetter(i), text: opt })}
                  onPress={() => choose(q.id, i)}
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
          <Button title={t('common.back')} variant="outline" icon="chevron-back" onPress={() => setIndex(index - 1)} disabled={index === 0} style={{ flex: 1 }} />
          {isLast
            ? <Button title={t('quiz.review')} icon="list" onPress={() => setPhase('review')} style={{ flex: 1.4 }} />
            : <Button title={t('common.next')} variant="dark" onPress={() => setIndex(index + 1)} style={{ flex: 1.4 }} />}
        </View>
        <T variant="small" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>{t('quiz.answeredOf', { a: answeredCount, n: questions.length })}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
          {questions.map((qq, i) => (
            <Pressable key={qq.id} onPress={() => setIndex(i)} accessibilityRole="button" accessibilityLabel={`${t('quiz.goTo', { i: i + 1 })}${answers[qq.id] !== undefined ? `, ${t('quiz.answered')}` : ''}`}
              style={[s.dot, { borderColor: i === index ? c.text : c.borderStrong, backgroundColor: answers[qq.id] !== undefined ? c.accent : 'transparent' }]}>
              {answers[qq.id] !== undefined ? <Ionicons name="checkmark" size={12} color={c.onAccent} /> : null}
            </Pressable>
          ))}
        </View>
        {!isLast ? <Button title={t('quiz.reviewSubmit')} variant="ghost" onPress={() => setPhase('review')} style={{ marginTop: spacing.md }} /> : null}
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
