import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useTheme, spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Card, Screen, T } from '../../components/ui';

export default function DeleteAccount() {
  const c = useTheme();
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(password);
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ borderColor: c.incorrect, backgroundColor: c.incorrectSoft }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Ionicons name="warning" size={20} color={c.incorrect} />
          <T variant="heading" color="incorrect">This can’t be undone</T>
        </View>
        <T variant="small" style={{ marginTop: spacing.sm }}>
          Your account, quiz history, progress, streak and saved items will be permanently deleted.
        </T>
      </Card>
      <Field label="Enter your password to confirm" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title="Delete my account" variant="dark" icon="trash-outline" onPress={confirmDelete} loading={busy} disabled={!password} style={{ marginTop: spacing.xl }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
