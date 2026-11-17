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
