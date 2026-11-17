import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePrefs } from '../lib/prefs';
import { useTheme, spacing } from '../theme';
import { Button, Screen, T } from '../components/ui';

const SLIDES = [
  { icon: 'newspaper', title: 'Current affairs, made for UPSC', body: 'Every day, the news that matters for Prelims and Mains, explained and linked to the syllabus. Each explainer is checked by an editor against its sources.' },
  { icon: 'checkbox', title: 'A 5-minute quiz every morning', body: 'Exam-style questions from the latest news, with explanations. Build a streak and see where you stand on the weekly leaderboard.' },
  { icon: 'barbell', title: 'Practise where you’re weakest', body: 'Practice by subject and track your accuracy by GS paper, so revision goes where it counts.' },
];

/** Shown once, on first launch. */
export default function Onboarding() {
  const c = useTheme();
  const { update } = usePrefs();
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const finish = (to) => { update({ onboarded: true }); router.replace(to); };

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'flex-end' }}>
        {!last ? <Button title="Skip" variant="ghost" onPress={() => finish('/')} /> : <View style={{ height: 48 }} />}
      </View>
      <View>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl }}>
          <Ionicons name={s.icon} size={40} color={c.accent} />
        </View>
        <T variant="display" accessibilityRole="header">{s.title}</T>
        <T color="textSecondary" style={{ marginTop: spacing.md, fontSize: 17, lineHeight: 26 }}>{s.body}</T>
      </View>
      <View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.xl }} accessibilityLabel={`Step ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, n) => <View key={n} style={{ width: n === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: n === i ? c.accent : c.borderStrong }} />)}
        </View>
        {last ? (
          <>
            <Button title="Create a free account" onPress={() => { update({ onboarded: true }); router.replace('/'); router.push('/register'); }} />
            <Button title="Browse first" variant="ghost" onPress={() => finish('/')} style={{ marginTop: spacing.sm }} />
          </>
        ) : (
          <Button title="Next" variant="dark" onPress={() => setI(i + 1)} />
        )}
      </View>
    </Screen>
  );
}
