import { Pressable, RefreshControl, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useAuth } from '../../lib/auth';
import { shortName } from '../../lib/format';
import { useProgress, useTaxonomy } from '../../lib/queries';
import { useTheme, spacing } from '../../theme';
import { subjectLabel } from '../../components/ArticleCard';
import SignInPrompt from '../../components/SignInPrompt';
import { Button, Card, Divider, ErrorView, Loading, ProgressBar, Screen, SectionTitle, T } from '../../components/ui';

function AccountRow({ icon, label, onPress, danger }) {
  const c = useTheme();
  const color = danger ? c.incorrect : c.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={color} />
      <T style={{ flex: 1, color }}>{label}</T>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <T variant="title">{value}</T>
      <T variant="small" color="textSecondary">{label}</T>
    </View>
  );
}

export default function Profile() {
  const c = useTheme();
  const { user, signedIn, signOut, updateProfile } = useAuth();
  const { data: taxonomy } = useTaxonomy();
  const { data, isLoading, error, refetch, isRefetching } = useProgress();
  const version = Constants.expoConfig?.version;

  if (!signedIn) {
    return <Screen><T variant="display">Profile</T><SignInPrompt title="Track your progress" message="Sign in to see your accuracy by subject and your quiz history." /></Screen>;
  }
  const p = data?.progress;
  const subjects = [...(p?.bySubject || [])].sort((a, b) => b.seen - a.seen);

  return (
    <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T variant="display">{user.name || 'Profile'}</T>
      {user.email ? <T color="textSecondary">{user.email}</T> : null}

      <SectionTitle>Your progress</SectionTitle>
      {isLoading ? <Loading /> : error ? <ErrorView error={error} onRetry={refetch} /> : (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, backgroundColor: c.inverse, borderColor: c.inverse }}>
            <Ionicons name="flame" size={32} color={c.accent} />
            <View style={{ flex: 1 }}>
              <T variant="title" color={c.onInverse}>{p.streak?.current || 0}-day streak</T>
              <T variant="small" color={c.onInverse} style={{ opacity: 0.8 }}>
                {p.streak?.current ? 'Take today’s quiz to keep it going.' : 'Take a quiz today to start a streak.'} Best: {p.streak?.best || 0} {p.streak?.best === 1 ? 'day' : 'days'}.
              </T>
            </View>
          </Card>
          <Card style={{ flexDirection: 'row' }}>
            <Stat label="Quizzes" value={p.quizzesTaken} />
            <Stat label="Questions" value={p.questionsSeen} />
            <Stat label="Accuracy" value={p.accuracy == null ? '–' : `${p.accuracy}%`} />
          </Card>
          {p.practice?.answered ? (
            <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>
              Plus {p.practice.answered} practice {p.practice.answered === 1 ? 'question' : 'questions'} ({p.practice.correct} correct). Subject accuracy below includes practice.
            </T>
          ) : null}
          {subjects.length ? (
            <>
              <SectionTitle>Accuracy by subject</SectionTitle>
              <Card>
                {subjects.map((s, i) => (
                  <View key={s.subject} style={{ marginTop: i ? spacing.lg : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                      <T variant="small" style={{ fontWeight: '600', flex: 1 }}>{subjectLabel(taxonomy, s.subject)}</T>
                      <T variant="small" color="textSecondary">{s.correct}/{s.seen} · {s.accuracy}%</T>
                    </View>
                    <ProgressBar value={s.accuracy || 0} />
                  </View>
                ))}
              </Card>
            </>
          ) : <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>Take your first quiz to see accuracy by subject.</T>}
        </>
      )}

      <SectionTitle>Account</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
          <Ionicons name="trophy-outline" size={20} color={c.text} />
          <View style={{ flex: 1 }}>
            <T>Show me on the leaderboard</T>
            <T variant="small" color="textSecondary">Shown as “{shortName(user.name)}”</T>
          </View>
          <Switch
            accessibilityLabel="Show me on the leaderboard"
            value={user.showOnLeaderboard !== false}
            onValueChange={(v) => updateProfile({ showOnLeaderboard: v }).catch(() => {})}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor={c.background}
            activeThumbColor={c.background}
          />
        </View>
        <View style={{ height: 1, backgroundColor: c.border }} />
        <AccountRow icon="key-outline" label="Change password" onPress={() => router.push('/account/password')} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <AccountRow icon="trash-outline" label="Delete account" danger onPress={() => router.push('/account/delete')} />
      </Card>
      <Divider />
      <Button title="Sign out" variant="outline" icon="log-out-outline" onPress={signOut} />
      <T variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.lg }}>Version {version}</T>
    </Screen>
  );
}
