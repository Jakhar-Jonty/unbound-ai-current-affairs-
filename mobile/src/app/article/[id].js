import { Pressable, Share, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useArticle, useTaxonomy } from '../../lib/queries';
import { formatDate } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import BookmarkButton from '../../components/BookmarkButton';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import { TEXT_SCALES, usePrefs } from '../../lib/prefs';
import { tap } from '../../lib/haptics';
import { subjectLabel } from '../../components/ArticleCard';
import { Card, Divider, ErrorView, Loading, OfflineNote, Screen, SectionTitle, Tag, T } from '../../components/ui';

export default function ArticleScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { data: a, isLoading, error, refetch } = useArticle(id);
  const { data: taxonomy } = useTaxonomy();
  const { prefs, update } = usePrefs();
  const scale = prefs.textScale || 1;
  const read = { fontSize: 16 * scale, lineHeight: 25 * scale };

  if (isLoading) return <Loading />;
  if (isPremiumError(error)) {
    return <Screen edges={[]}><PremiumGate title="From the archive" message={error.message} teaser={error.details?.teaser} /></Screen>;
  }
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  const retracted = a.status === 'retracted';

  const cycleSize = () => {
    tap();
    const i = TEXT_SCALES.indexOf(scale);
    update({ textScale: TEXT_SCALES[(i + 1) % TEXT_SCALES.length] });
  };
  const share = () => Share.share({
    title: a.title,
    message: `${a.title}\n\n${a.summary}\n\nShared from Unbound, current affairs for UPSC.`,
  }).catch(() => {});
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Pressable onPress={cycleSize} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Text size ${Math.round(scale * 100)}%. Tap to change`}>
        <T style={{ fontWeight: '700', fontSize: 17 }}>Aa</T>
      </Pressable>
      <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share article">
        <Ionicons name="share-outline" size={22} color={c.text} />
      </Pressable>
      {retracted || a.offline ? null : <BookmarkButton itemType="article" itemId={a.id} />}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <Screen edges={[]}>
        {a.offline ? <OfflineNote /> : null}
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
          <T style={[read, { fontWeight: '600' }]}>{a.summary}</T>
        </View>

        {a.keyPoints?.length ? (
          <>
            <SectionTitle>Key points</SectionTitle>
            {a.keyPoints.map((k, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 10 }} />
                <T style={[read, { flex: 1 }]}>{k}</T>
              </View>
            ))}
          </>
        ) : null}

        <SectionTitle>Explainer</SectionTitle>
        {a.body.split('\n').filter((p) => p.trim()).map((p, i) => <T key={i} style={[read, { marginBottom: spacing.md }]}>{p}</T>)}

        {a.upscRelevance ? (
          <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent', marginTop: spacing.sm }}>
            <T variant="caption" style={{ marginBottom: spacing.xs }}>WHY IT MATTERS FOR UPSC</T>
            <T style={read}>{a.upscRelevance}</T>
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
