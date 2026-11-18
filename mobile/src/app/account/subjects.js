import { useState } from 'react';
import { router } from 'expo-router';
import { useMySubjects } from '../../lib/subjects-pref';
import { spacing } from '../../theme';
import SubjectPicker from '../../components/SubjectPicker';
import { Button, Screen, T } from '../../components/ui';
import { errorText, useT } from '../../lib/i18n';

export default function MySubjects() {
  const { subjects, setSubjects } = useMySubjects();
  const { t } = useT();
  const [value, setValue] = useState(subjects);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true);
    try { await setSubjects(value); router.back(); } catch (err) { setError(errorText(err, t)); setBusy(false); }
  };
  return (
    <Screen edges={[]}>
      <T color="textSecondary" style={{ marginBottom: spacing.lg }}>
        {t('acct.subjectsIntro')}
      </T>
      <SubjectPicker value={value} onChange={setValue} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title={value.length ? t('acct.saveSubjects', { n: value.length }) : t('acct.saveAll')} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
