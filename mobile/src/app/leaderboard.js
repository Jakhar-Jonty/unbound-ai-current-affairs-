import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useLeaderboard } from '../lib/queries';
import { formatDate } from '../lib/format';
import { useTheme, spacing, radius } from '../theme';
import { Button, Card, Empty, ErrorView, Loading, Screen, T } from '../components/ui';

function Row({ e }) {
  const c = useTheme();
  const medal = e.rank <= 3;
  return (
    <View
      accessibilityLabel={`Rank ${e.rank}, ${e.isMe ? 'you' : e.name}, ${e.score} correct out of ${e.total}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: e.isMe ? c.accentSoft : 'transparent' }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: medal ? c.accent : 'transparent', borderWidth: medal ? 0 : 1, borderColor: c.border }}>
        <T variant="small" style={{ fontWeight: '700', color: medal ? c.onAccent : c.text }}>{e.rank}</T>
      </View>
      <T style={{ flex: 1, fontWeight: e.isMe ? '700' : '400' }} numberOfLines={1}>{e.isMe ? `${e.name} (you)` : e.name}</T>
      <View style={{ alignItems: 'flex-end' }}>
        <T variant="heading">{e.score}</T>
        <T variant="caption" color="textSecondary">{e.quizzes} {e.quizzes === 1 ? 'QUIZ' : 'QUIZZES'}</T>
      </View>
    </View>
  );
}

export default function Leaderboard() {
  const c = useTheme();
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useLeaderboard();
  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  const meInTop = data.entries.some((e) => e.isMe);

  return (
    <Screen edges={[]} refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T color="textSecondary">
        Correct answers in daily quizzes this week (from {formatDate(data.week.startDate)}). Resets every Monday at midnight IST. Practice doesn’t count.
      </T>

      {user && !user.showOnLeaderboard ? (
        <Card style={{ marginTop: spacing.lg }}>
          <T variant="small">You’ve chosen not to appear on the leaderboard. You can change this in Profile.</T>
        </Card>
      ) : null}

      {!data.entries.length ? (
        <Empty icon="trophy-outline" title="No scores yet this week" message="Take today’s quiz to be first on the board." action={<Button title="Go to today’s quiz" onPress={() => router.push('/quizzes')} />} />
      ) : (
        <Card style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}>
          {data.entries.map((e, i) => <Row key={`${e.rank}-${i}`} e={e} />)}
        </Card>
      )}

      {data.me && !meInTop ? (
        <>
          <T variant="caption" color="textSecondary" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>YOUR POSITION</T>
          <Card style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}><Row e={data.me} /></Card>
        </>
      ) : null}
      {user && user.showOnLeaderboard && !data.me && data.entries.length ? (
        <T variant="small" color="textSecondary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>Take a daily quiz to get on the board.</T>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xl }}>
        <Ionicons name="people-outline" size={16} color={c.textMuted} />
        <T variant="small" color="textSecondary">{data.participants} {data.participants === 1 ? 'aspirant' : 'aspirants'} this week</T>
      </View>
    </Screen>
  );
}
