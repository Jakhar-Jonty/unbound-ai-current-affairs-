import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, T, Tag } from './ui';
import { spacing } from '../theme';
import { formatDate } from '../lib/format';
import { useTaxonomy } from '../lib/queries';
import { SUBJECT_LABELS } from '../lib/subjects';

export function subjectLabel(taxonomy, key) {
  return taxonomy?.subjects?.[key]?.label || SUBJECT_LABELS[key] || key;
}

export default function ArticleCard({ article }) {
  const { data: taxonomy } = useTaxonomy();
  return (
    <Card onPress={() => router.push(`/article/${article.id}`)} accessibilityLabel={article.title} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
        <Tag label={article.tags?.gsPaper === 'PRELIMS' ? 'Prelims' : article.tags?.gsPaper || ''} />
        {(article.tags?.subjects || []).slice(0, 2).map((s) => <Tag key={s} label={subjectLabel(taxonomy, s)} />)}
      </View>
      <T variant="heading">{article.title}</T>
      <T variant="small" color="textSecondary" numberOfLines={3} style={{ marginTop: spacing.xs }}>{article.summary}</T>
      <T variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>{formatDate(article.publishedAt)}</T>
    </Card>
  );
}
