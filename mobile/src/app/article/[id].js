import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useArticle, useTaxonomy } from '../../lib/queries';
import { formatDate } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import BookmarkButton from '../../components/BookmarkButton';
import { subjectLabel } from '../../components/ArticleCard';
import { Card, Divider, ErrorView, Loading, Screen, SectionTitle, Tag, T } from '../../components/ui';

export default function ArticleScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { data: a, isLoading, error, refetch } = useArticle(id);
  const { data: taxonomy } = useTaxonomy();

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  const retracted = a.status === 'retracted';

  return (
    <>
      <Stack.Screen options={{ headerRight: () => (retracted ? null : <BookmarkButton itemType="article" itemId={a.id} />) }} />
      <Screen edges={[]}>
        {retracted ? (
          <Card style={{ borderColor: c.incorrect, backgroundColor: c.incorrectSoft, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Ionicons name="alert-circle" size={20} color={c.incorrect} />
              <T variant="heading" color="incorrect">This article was retracted</T>
            </View>
            <T variant="small" style={{ marginTop: spacing.xs }}>{a.retraction?.reason}</T>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Tag label={a.tags?.gsPaper === 'PRELIMS' ? 'Prelims' : a.tags?.gsPaper} />
          {(a.tags?.subjects || []).map((s) => <Tag key={s} label={subjectLabel(taxonomy, s)} />)}
        </View>
        <T variant="title" style={{ marginTop: spacing.md }} accessibilityRole="header">{a.title}</T>
        <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>
          {formatDate(a.publishedAt)}{a.version > 1 ? ` · Updated ${formatDate(a.updatedAt)}` : ''}
        </T>

        <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: spacing.md, marginTop: spacing.lg }}>
          <T style={{ fontWeight: '600' }}>{a.summary}</T>
        </View>

        {a.keyPoints?.length ? (
          <>
            <SectionTitle>Key points</SectionTitle>
            {a.keyPoints.map((k, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 10 }} />
                <T style={{ flex: 1 }}>{k}</T>
              </View>
            ))}
          </>
        ) : null}

        <SectionTitle>Explainer</SectionTitle>
        {a.body.split('\n').filter((p) => p.trim()).map((p, i) => <T key={i} style={{ marginBottom: spacing.md }}>{p}</T>)}

        {a.upscRelevance ? (
          <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent', marginTop: spacing.sm }}>
            <T variant="caption" style={{ marginBottom: spacing.xs }}>WHY IT MATTERS FOR UPSC</T>
            <T>{a.upscRelevance}</T>
          </Card>
        ) : null}

        {a.corrections?.length ? (
          <>
            <SectionTitle>Corrections</SectionTitle>
            {a.corrections.map((corr, i) => (
              <T key={i} variant="small" color="textSecondary" style={{ marginBottom: spacing.xs }}>{formatDate(corr.at)}: {corr.note}</T>
            ))}
          </>
        ) : null}

        <Divider />
        <T variant="caption" color="textSecondary">SOURCES</T>
        {a.sources.map((s) => (
          <T
            key={s.url}
            variant="small"
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(s.url)}
            style={{ marginTop: spacing.sm, color: c.link, textDecorationLine: 'underline', borderRadius: radius.sm }}
          >
            {s.publisher ? `${s.publisher}: ` : ''}{s.title || s.url}
          </T>
        ))}
      </Screen>
    </>
  );
}
