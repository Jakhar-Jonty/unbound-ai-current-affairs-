import { View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useArticles } from '../../lib/queries';
import { formatLongDate } from '../../lib/format';
import { spacing } from '../../theme';
import ListScreen from '../../components/ListScreen';
import ArticleCard from '../../components/ArticleCard';
import TodayQuizCard from '../../components/QuizCard';
import { Empty, ErrorView, SectionTitle, T } from '../../components/ui';

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
          <T variant="display" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>{firstName ? `Hello, ${firstName}` : 'Today'}</T>
          <TodayQuizCard />
          <SectionTitle>Latest current affairs</SectionTitle>
          {articles.error ? <ErrorView error={articles.error} onRetry={articles.refetch} /> : null}
        </View>
      }
      empty={articles.error ? null : <Empty title="No articles yet" message="New explainers are published through the day after editorial review." />}
    />
  );
}
