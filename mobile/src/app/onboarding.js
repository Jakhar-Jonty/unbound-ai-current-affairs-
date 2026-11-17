import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePrefs } from '../lib/prefs';
import { useTheme, spacing } from '../theme';
import { Button, Screen, T } from '../components/ui';
import SubjectPicker from '../components/SubjectPicker';

const SLIDES = [
  { icon: 'newspaper', title: 'Current affairs, made for UPSC', body: 'Every day, the news that matters for Prelims and Mains, explained and linked to the syllabus. Each explainer is checked by an editor against its sources.' },
  { icon: 'checkbox', title: 'A 5-minute quiz every morning', body: 'Exam-style questions from the latest news, with explanations. Build a streak and see where you stand on the weekly leaderboard.' },
  { icon: 'barbell', title: 'Practise where you’re weakest', body: 'Practice by subject and track your accuracy by GS paper, so revision goes where it counts.' },
];

function Dots({ i, n }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.xl }} accessibilityLabel={`Step ${i + 1} of ${n}`}>
      {Array.from({ length: n }, (_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? c.accent : c.borderStrong }} />)}
    </View>
  );
}

/** Shown once, on first launch. */
export default function Onboarding() {
  const c = useTheme();
  const { update } = usePrefs();
  const [i, setI] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const steps = SLIDES.length + 1; // slides + subject picker
  const s = SLIDES[i];
  const last = i === steps - 1;
  const done = () => update({ onboarded: true, subjects, feed: subjects.length ? 'foryou' : 'all' });
  const finish = (to) => { done(); router.replace(to); };

  if (last) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="display" accessibilityRole="header" style={{ marginTop: spacing.xl }}>What are you focusing on?</T>
          <T color="textSecondary" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Pick subjects for your “For you” feed. You can change this any time.</T>
          <ScrollView style={{ flex: 1 }}><SubjectPicker value={subjects} onChange={setSubjects} /></ScrollView>
        </View>
        <View style={{ paddingTop: spacing.lg }}>
          <Dots i={i} n={steps} />
          <Button title="Create a free account" onPress={() => { done(); router.replace('/'); router.push('/register'); }} />
          <Button title="Browse first" variant="ghost" onPress={() => finish('/')} style={{ marginTop: spacing.sm }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'flex-end' }}>
        <Button title="Skip" variant="ghost" onPress={() => setI(steps - 1)} />
      </View>
      <View>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl }}>
          <Ionicons name={s.icon} size={40} color={c.accent} />
        </View>
        <T variant="display" accessibilityRole="header">{s.title}</T>
        <T color="textSecondary" style={{ marginTop: spacing.md, fontSize: 17, lineHeight: 26 }}>{s.body}</T>
      </View>
      <View>
        <Dots i={i} n={steps} />
        <Button title="Next" variant="dark" onPress={() => setI(i + 1)} />
      </View>
    </Screen>
  );
}
