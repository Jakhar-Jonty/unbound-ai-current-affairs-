import { router } from 'expo-router';
import { Empty, Button } from './ui';
import { useT } from '../lib/i18n';

/** Shown in place of personal screens when browsing without an account. */
export default function SignInPrompt({ icon = 'person-circle-outline', title, message }) {
  const { t } = useT();
  return (
    <Empty
      icon={icon}
      title={title || t('auth.signInToContinue')}
      message={message || t('auth.signInPrompt')}
      action={<Button title={t('auth.signInOrCreate')} onPress={() => router.push('/login')} />}
    />
  );
}
