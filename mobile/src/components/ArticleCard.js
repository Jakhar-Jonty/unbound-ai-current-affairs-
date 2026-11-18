import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, T } from './ui';
import { useTheme, spacing, radius } from '../theme';
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

/** "GS3 · ENVIRONMENT & ECOLOGY" on one line: a small paper pill and the main subject. */
export function ArticleMeta({ article, onDark, all, style }) {
  const c = useTheme();
  const { data: taxonomy } = useTaxonomy();
  const { lang } = useT();
  const paper = paperLabel(article.tags?.gsPaper, lang);
  const subjects = (article.tags?.subjects || []).slice(0, all ? undefined : 1);
  const subject = subjects.length ? subjects.map((s) => subjectLabel(taxonomy, s, lang).toUpperCase()).join(' · ') : null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}>
      {paper ? (
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: c.accent }}>
          <T variant="caption" color={c.onAccent} style={{ fontWeight: '800' }}>{paper}</T>
        </View>
      ) : null}
      {subject ? (
        <T variant="caption" color={onDark ? c.onInverse : 'textSecondary'} numberOfLines={all ? 2 : 1} style={{ flexShrink: 1, opacity: onDark ? 0.8 : 1 }}>
          {subject}
        </T>
      ) : null}
      <View style={{ flex: 1 }} />
      <PremiumBadge locked={article.premium} />
    </View>
  );
}

function Footer({ article, onDark }) {
  const c = useTheme();
  const { t } = useT();
  return (
    <T variant="caption" color={onDark ? c.onInverse : 'textSecondary'} style={{ marginTop: spacing.md, opacity: onDark ? 0.7 : 1 }}>
      {formatDate(article.publishedAt)}{article.readingMinutes ? ` · ${t('art.minReadCaps', { n: article.readingMinutes })}` : ''}
    </T>
  );
}

/** Feed card. `featured` makes the large dark "Top story" card at the top of Today. */
export default function ArticleCard({ article, featured }) {
  const c = useTheme();
  const { t } = useT();
  const open = () => router.push(`/article/${article.id}`);
  if (featured) {
    return (
      <Card onPress={open} accessibilityLabel={`${t('today.topStory')}: ${article.title}`} style={{ marginBottom: spacing.md, backgroundColor: c.inverse, borderColor: c.inverse, padding: spacing.xl }}>
        {/* Orange text is unreadable on the ivory card used in dark mode, so the label is a pill. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.accent, marginBottom: spacing.md }}>
          <Ionicons name="flash" size={11} color={c.onAccent} />
          <T variant="caption" color={c.onAccent} style={{ fontWeight: '800' }}>{t('today.topStory').toUpperCase()}</T>
        </View>
        <ArticleMeta article={article} onDark />
        <T variant="title" color={c.onInverse} style={{ marginTop: spacing.md }}>{article.title}</T>
        <T variant="small" color={c.onInverse} numberOfLines={3} style={{ marginTop: spacing.sm, opacity: 0.8 }}>{article.summary}</T>
        <Footer article={article} onDark />
      </Card>
    );
  }
  return (
    <Card onPress={open} accessibilityLabel={article.title} style={{ marginBottom: spacing.md }}>
      <ArticleMeta article={article} />
      <T variant="heading" style={{ marginTop: spacing.md }}>{article.title}</T>
      <T variant="small" color="textSecondary" numberOfLines={2} style={{ marginTop: spacing.xs }}>{article.summary}</T>
      <Footer article={article} />
    </Card>
  );
}
