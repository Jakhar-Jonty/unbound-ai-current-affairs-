import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, T, Tag } from './ui';
import { spacing } from '../theme';
import { formatDate } from '../lib/format';
import { useTaxonomy } from '../lib/queries';
import { SUBJECT_LABELS, SUBJECT_LABELS_HI } from '../lib/subjects';
import { getApiLang } from '../lib/api';
import { PremiumBadge } from './Premium';
import { useT } from '../lib/i18n';

/** Subject name in the current content language. */
export function subjectLabel(taxonomy, key, lang = getApiLang()) {
  if (lang === 'hi') return taxonomy?.subjects?.[key]?.labelHi || SUBJECT_LABELS_HI[key] || subjectLabel(taxonomy, key, 'en');
  return taxonomy?.subjects?.[key]?.label || SUBJECT_LABELS[key] || key;
}

const PAPER_HI = { GS1: 'सा.अ. I', GS2: 'सा.अ. II', GS3: 'सा.अ. III', GS4: 'सा.अ. IV', PRELIMS: 'प्रारंभिक' };
export function paperLabel(key, lang = getApiLang()) {
  if (lang === 'hi') return PAPER_HI[key] || key;
  return key === 'PRELIMS' ? 'Prelims' : key || '';
}

export default function ArticleCard({ article }) {
  const { data: taxonomy } = useTaxonomy();
  const { t, lang } = useT();
  return (
    <Card onPress={() => router.push(`/article/${article.id}`)} accessibilityLabel={article.title} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
        <Tag label={paperLabel(article.tags?.gsPaper, lang)} />
        {(article.tags?.subjects || []).slice(0, 2).map((s) => <Tag key={s} label={subjectLabel(taxonomy, s, lang)} />)}
        <PremiumBadge locked={article.premium} />
      </View>
      <T variant="heading">{article.title}</T>
      <T variant="small" color="textSecondary" numberOfLines={3} style={{ marginTop: spacing.xs }}>{article.summary}</T>
      <T variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>
        {formatDate(article.publishedAt)}{article.readingMinutes ? ` · ${t('art.minReadCaps', { n: article.readingMinutes })}` : ''}
      </T>
    </Card>
  );
}
