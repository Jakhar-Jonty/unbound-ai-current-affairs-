import { RefreshControl, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../../lib/auth';
import { useProgress, useTaxonomy } from '../../lib/queries';
import { useTheme, spacing } from '../../theme';
import { subjectLabel } from '../../components/ArticleCard';
import SignInPrompt from '../../components/SignInPrompt';
import { Button, Card, Divider, ErrorView, Loading, ProgressBar, Screen, SectionTitle, T } from '../../components/ui';

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
  const { user, signedIn, signOut } = useAuth();
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
          <Card style={{ flexDirection: 'row' }}>
            <Stat label="Quizzes" value={p.quizzesTaken} />
            <Stat label="Questions" value={p.questionsSeen} />
            <Stat label="Accuracy" value={p.accuracy == null ? '–' : `${p.accuracy}%`} />
          </Card>
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

      <Divider />
      <Button title="Sign out" variant="outline" icon="log-out-outline" onPress={signOut} />
      <T variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.lg }}>Version {version}</T>
    </Screen>
  );
}
