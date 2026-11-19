import { useCallback } from 'react';
import { useAuth } from './auth';
import { usePrefs } from './prefs';

/**
 * "My subjects": saved to the account when signed in (so it follows the user to
 * other devices), otherwise kept on this device.
 */
export function useMySubjects() {
  const { user, updateProfile } = useAuth();
  const { prefs, update } = usePrefs();
  const signedIn = !!user?.id && !user.offline;
  const subjects = signedIn ? (user.preferredSubjects?.length ? user.preferredSubjects : prefs.subjects) : prefs.subjects;
  const setSubjects = useCallback(async (next) => {
    update({ subjects: next });
    if (signedIn) await updateProfile({ preferredSubjects: next });
  }, [signedIn, update, updateProfile]);
  return { subjects: subjects || [], setSubjects };
}

/** "My exams": the feed shows stories tagged for these. Synced to the account like subjects. Empty = all exams. */
export function useMyExams() {
  const { user, updateProfile } = useAuth();
  const { prefs, update } = usePrefs();
  const signedIn = !!user?.id && !user.offline;
  const exams = signedIn ? (user.preferredExams?.length ? user.preferredExams : prefs.exams) : prefs.exams;
  const setExams = useCallback(async (next) => {
    update({ exams: next });
    if (signedIn) await updateProfile({ preferredExams: next });
  }, [signedIn, update, updateProfile]);
  return { exams: exams || [], setExams };
}
