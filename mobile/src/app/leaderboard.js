import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useLeaderboard } from '../lib/queries';
import { formatDate } from '../lib/format';
import { useTheme, spacing, radius } from '../theme';
import { Button, Card, Empty, ErrorView, Loading, Screen, T } from '../components/ui';
import { useT } from '../lib/i18n';

function Row({ e }) {
  const c = useTheme();
  const { t } = useT();
  const medal = e.rank <= 3;
  return (
    <View
      accessibilityLabel={t('board.row', { rank: e.rank, name: e.isMe ? t('board.you') : e.name, score: e.score, total: e.total })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: e.isMe ? c.accentSoft : 'transparent' }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: medal ? c.accent : 'transparent', borderWidth: medal ? 0 : 1, borderColor: c.border }}>
        <T variant="small" style={{ fontWeight: '700', color: medal ? c.onAccent : c.text }}>{e.rank}</T>
      </View>
      <T style={{ flex: 1, fontWeight: e.isMe ? '700' : '400' }} numberOfLines={1}>{e.isMe ? t('board.youSuffix', { name: e.name }) : e.name}</T>
      <View style={{ alignItems: 'flex-end' }}>
        <T variant="heading">{e.score}</T>
        <T variant="caption" color="textSecondary">{t('board.quizzes', { n: e.quizzes })}</T>
      </View>
    </View>
  );
}

export default function Leaderboard() {
  const c = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useLeaderboard();
  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  const meInTop = data.entries.some((e) => e.isMe);

  return (
    <Screen edges={[]} refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T color="textSecondary">
        {t('board.intro', { date: formatDate(data.week.startDate) })}
      </T>

      {user && !user.showOnLeaderboard ? (
        <Card style={{ marginTop: spacing.lg }}>
          <T variant="small">{t('board.optedOut')}</T>
        </Card>
      ) : null}

      {!data.entries.length ? (
        <Empty icon="trophy-outline" title={t('board.empty')} message={t('board.emptyMsg')} action={<Button title={t('board.goToQuiz')} onPress={() => router.push('/quizzes')} />} />
      ) : (
        <Card style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}>
          {data.entries.map((e, i) => <Row key={`${e.rank}-${i}`} e={e} />)}
        </Card>
      )}

      {data.me && !meInTop ? (
        <>
          <T variant="caption" color="textSecondary" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('board.position')}</T>
          <Card style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}><Row e={data.me} /></Card>
        </>
      ) : null}
      {user && user.showOnLeaderboard && !data.me && data.entries.length ? (
        <T variant="small" color="textSecondary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>{t('board.getOn')}</T>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xl }}>
        <Ionicons name="people-outline" size={16} color={c.textMuted} />
        <T variant="small" color="textSecondary">{t('board.people', { n: data.participants })}</T>
      </View>
    </Screen>
  );
}
