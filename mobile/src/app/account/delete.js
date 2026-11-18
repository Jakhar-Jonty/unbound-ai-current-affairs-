import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useTheme, spacing } from '../../theme';
import Field from '../../components/Field';
import { Button, Card, Screen, T } from '../../components/ui';
import { errorText, useT } from '../../lib/i18n';

export default function DeleteAccount() {
  const c = useTheme();
  const { deleteAccount, user } = useAuth();
  const hasPassword = user?.hasPassword !== false;
  const { t } = useT();
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
      setError(errorText(err, t));
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ borderColor: c.incorrect, backgroundColor: c.incorrectSoft }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Ionicons name="warning" size={20} color={c.incorrect} />
          <T variant="heading" color="incorrect">{t('acct.cantUndo')}</T>
        </View>
        <T variant="small" style={{ marginTop: spacing.sm }}>
          {t('acct.deleteNote')}
        </T>
      </Card>
      {hasPassword
        ? <Field label={t('acct.confirmPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
        : <Field label={t('acct.typeDelete')} value={password} onChangeText={setPassword} autoCapitalize="characters" autoCorrect={false} />}
      {user?.premium?.source === 'razorpay' && user?.premium?.active ? (
        <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>{t('acct.premiumCancel')}</T>
      ) : null}
      {error ? <T variant="small" color="incorrect" style={{ marginTop: spacing.md }}>{error}</T> : null}
      <Button title={t('acct.deleteButton')} variant="dark" icon="trash-outline" onPress={confirmDelete} loading={busy} disabled={hasPassword ? !password : password !== 'DELETE'} style={{ marginTop: spacing.xl }} />
      <Button title={t('common.cancel')} variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
