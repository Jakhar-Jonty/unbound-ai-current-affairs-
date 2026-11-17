import { useState } from 'react';
import { router } from 'expo-router';
import { useMySubjects } from '../../lib/subjects-pref';
import { spacing } from '../../theme';
import SubjectPicker from '../../components/SubjectPicker';
import { Button, Screen, T } from '../../components/ui';

export default function MySubjects() {
  const { subjects, setSubjects } = useMySubjects();
  const [value, setValue] = useState(subjects);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true);
    try { await setSubjects(value); router.back(); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Screen edges={[]}>
      <T color="textSecondary" style={{ marginBottom: spacing.lg }}>
        Pick the subjects you want to focus on. Your “For you” feed on Today shows these first.
      </T>
      <SubjectPicker value={value} onChange={setValue} />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title={value.length ? `Save ${value.length} ${value.length === 1 ? 'subject' : 'subjects'}` : 'Save (show everything)'} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
