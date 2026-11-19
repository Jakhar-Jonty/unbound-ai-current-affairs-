import { useState } from 'react';
import { router } from 'expo-router';
import { useMyExams } from '../../lib/subjects-pref';
import { spacing } from '../../theme';
import ExamPicker from '../../components/ExamPicker';
import { Button, Screen, T } from '../../components/ui';
import { errorText, useT } from '../../lib/i18n';

export default function MyExams() {
  const { exams, setExams } = useMyExams();
  const { t } = useT();
  const [value, setValue] = useState(exams);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true);
    try { await setExams(value); router.back(); } catch (err) { setError(errorText(err, t)); setBusy(false); }
  };
  return (
    <Screen edges={[]}>
      <T color="textSecondary" style={{ marginBottom: spacing.lg }}>{t('exams.intro')}</T>
      <ExamPicker value={value} onChange={setValue} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title={value.length ? t('exams.save', { n: value.length }) : t('exams.saveAll')} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
