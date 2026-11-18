import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePrefs } from '../lib/prefs';
import { useTheme, spacing } from '../theme';
import { Button, Screen, T } from '../components/ui';
import SubjectPicker from '../components/SubjectPicker';
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
  const steps = SLIDES.length + 1; // slides + subject picker
  const s = SLIDES[i];
  const last = i === steps - 1;
  const done = () => update({ onboarded: true, subjects, feed: subjects.length ? 'foryou' : 'all' });
  const finish = (to) => { done(); router.replace(to); };

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
        <Button title={t('onb.skip')} variant="ghost" onPress={() => setI(steps - 1)} />
      </View>
      <View>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl }}>
          <Ionicons name={s.icon} size={40} color={c.accent} />
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
