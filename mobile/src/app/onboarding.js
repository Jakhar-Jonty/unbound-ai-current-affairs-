import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePrefs } from '../lib/prefs';
import { useTheme, spacing } from '../theme';
import { Button, Screen, T } from '../components/ui';
import SubjectPicker from '../components/SubjectPicker';
import ExamPicker from '../components/ExamPicker';
import LanguageSwitch from '../components/LanguageSwitch';
import { useT } from '../lib/i18n';

const SLIDES = [
  { icon: 'newspaper', title: 'onb.s1.title', body: 'onb.s1.body' },
  { icon: 'checkbox', title: 'onb.s2.title', body: 'onb.s2.body' },
  { icon: 'barbell', title: 'onb.s3.title', body: 'onb.s3.body' },
];

function Dots({ i, n }) {
  const c = useTheme();
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.xl }} accessibilityLabel={t('onb.step', { i: i + 1, n })}>
      {Array.from({ length: n }, (_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? c.accent : c.borderStrong }} />)}
    </View>
  );
}

/** Shown once, on first launch. */
export default function Onboarding() {
  const c = useTheme();
  const { update } = usePrefs();
  const { t } = useT();
  const [i, setI] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const steps = SLIDES.length + 2; // slides + exam picker + subject picker
  const s = SLIDES[i];
  const last = i === steps - 1;
  const examStep = i === steps - 2;
  const done = () => update({ onboarded: true, subjects, exams, feed: subjects.length ? 'foryou' : 'all' });
  const finish = (to) => { done(); router.replace(to); };

  if (examStep) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="display" accessibilityRole="header" style={{ marginTop: spacing.xl }}>{t('onb.exams')}</T>
          <T color="textSecondary" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('onb.examsSub')}</T>
          <ExamPicker value={exams} onChange={setExams} />
        </View>
        <View style={{ paddingTop: spacing.lg }}>
          <Dots i={i} n={steps} />
          <Button title={t('common.next')} variant="dark" onPress={() => setI(i + 1)} />
        </View>
      </Screen>
    );
  }

  if (last) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="display" accessibilityRole="header" style={{ marginTop: spacing.xl }}>{t('onb.focus')}</T>
          <T color="textSecondary" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('onb.focusSub')}</T>
          <ScrollView style={{ flex: 1 }}><SubjectPicker value={subjects} onChange={setSubjects} /></ScrollView>
        </View>
        <View style={{ paddingTop: spacing.lg }}>
          <Dots i={i} n={steps} />
          <Button title={t('common.createFreeAccount')} onPress={() => { done(); router.replace('/'); router.push('/register'); }} />
          <Button title={t('onb.browse')} variant="ghost" onPress={() => finish('/')} style={{ marginTop: spacing.sm }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {i === 0 ? <LanguageSwitch /> : <View />}
        <Button title={t('onb.skip')} variant="ghost" onPress={() => setI(steps - 2)} />
      </View>
      <View>
        <T variant="caption" style={{ letterSpacing: 2, fontWeight: '800', marginBottom: spacing.xl }}>
          UNBOUND <T variant="caption" color={c.accent} style={{ letterSpacing: 2, fontWeight: '800' }}>DAILY</T>
        </T>
        <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={s.icon} size={42} color={c.accent} />
          </View>
        </View>
        <T variant="display" accessibilityRole="header">{t(s.title)}</T>
        <T color="textSecondary" style={{ marginTop: spacing.md, fontSize: 17, lineHeight: 26 }}>{t(s.body)}</T>
      </View>
      <View>
        <Dots i={i} n={steps} />
        <Button title={t('common.next')} variant="dark" onPress={() => setI(i + 1)} />
      </View>
    </Screen>
  );
}
