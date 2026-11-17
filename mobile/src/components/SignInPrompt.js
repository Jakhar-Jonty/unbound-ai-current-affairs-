import { router } from 'expo-router';
import { Empty, Button } from './ui';

/** Shown in place of personal screens when browsing without an account. */
export default function SignInPrompt({ icon = 'person-circle-outline', title = 'Sign in to continue', message }) {
  return (
    <Empty
      icon={icon}
      title={title}
      message={message || 'Create a free account to take quizzes, save articles and track your progress.'}
      action={<Button title="Sign in or create account" onPress={() => router.push('/login')} />}
    />
  );
}
