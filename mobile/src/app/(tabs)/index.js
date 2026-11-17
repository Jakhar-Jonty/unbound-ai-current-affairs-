import { View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useArticles } from '../../lib/queries';
import { formatLongDate } from '../../lib/format';
import { spacing } from '../../theme';
import ListScreen from '../../components/ListScreen';
import ArticleCard from '../../components/ArticleCard';
import TodayQuizCard from '../../components/QuizCard';
import StreakBadge from '../../components/StreakBadge';
import VerifyEmailBanner from '../../components/VerifyEmailBanner';
import { Button, Empty, ErrorView, SectionTitle, T } from '../../components/ui';
import { router } from 'expo-router';

export default function Today() {
  const { user } = useAuth();
  const articles = useArticles();
  const firstName = user?.name?.split(' ')[0];
  return (
    <ListScreen
      query={articles}
      renderItem={({ item }) => <ArticleCard article={item} />}
      header={
        <View>
          <T variant="caption" color="textSecondary">{formatLongDate().toUpperCase()}</T>
          <T variant="display" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{firstName ? `Hello, ${firstName}` : 'Today'}</T>
          {user ? <View style={{ marginBottom: spacing.md }}><StreakBadge /></View> : null}
          <VerifyEmailBanner />
          {!user ? <View style={{ height: spacing.sm }} /> : null}
          <TodayQuizCard />
          <SectionTitle>Latest current affairs</SectionTitle>
          {articles.error?.status === 0 ? (
            <Empty
              icon="cloud-offline-outline"
              title="You’re offline"
              message="Your saved articles and the ones you read recently are available offline."
              action={<Button title="Open saved articles" variant="outline" onPress={() => router.push('/saved')} />}
            />
          ) : articles.error ? <ErrorView error={articles.error} onRetry={articles.refetch} /> : null}
        </View>
      }
      empty={articles.error ? null : <Empty title="No articles yet" message="New explainers are published through the day after editorial review." />}
    />
  );
}
