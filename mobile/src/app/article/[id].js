import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, Share, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useArticle, useRelated, useTaxonomy } from '../../lib/queries';
import { saveProgress } from '../../lib/reading';
import { formatDate } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import BookmarkButton from '../../components/BookmarkButton';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import { TEXT_SCALES, usePrefs } from '../../lib/prefs';
import { tap } from '../../lib/haptics';
import ArticleCard, { paperLabel, subjectLabel } from '../../components/ArticleCard';
import LanguageSwitch from '../../components/LanguageSwitch';
import { strings } from '../../lib/strings';
import { Card, Divider, ErrorView, Loading, OfflineNote, Screen, SectionTitle, Tag, T } from '../../components/ui';

export default function ArticleScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { data: a, isLoading, error, refetch } = useArticle(id);
  const { data: taxonomy } = useTaxonomy();
  const { prefs, update } = usePrefs();
  const { data: related } = useRelated(a?.offline ? null : a?.id);
  // Reading progress: a thin orange bar under the header, remembered for "Continue reading".
  const [progress] = useState(() => new Animated.Value(0));
  const lastSaved = useRef(0);
  const onScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    const p = Math.min(1, Math.max(0, contentOffset.y / max));
    progress.setValue(p);
    if (a && Math.abs(p - lastSaved.current) >= 0.05) {
      lastSaved.current = p;
      saveProgress(a, p);
    }
  }, [a, progress]);
  const scale = prefs.textScale || 1;
  const baseRead = { fontSize: 16 * scale, lineHeight: 25 * scale };

  if (isLoading) return <Loading />;
  if (isPremiumError(error)) {
    return <Screen edges={[]}><PremiumGate title="From the archive" message={error.message} teaser={error.details?.teaser} /></Screen>;
  }
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  const retracted = a.status === 'retracted';
  const L = strings(a.lang);
  // Devanagari needs a little more line height to stay readable.
  const read = a.lang === 'hi' ? { fontSize: 17 * scale, lineHeight: 30 * scale } : baseRead;

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
      {retracted || a.offline ? null : (
        <BookmarkButton itemType="article" itemId={a.id} item={{ id: a.id, slug: a.slug, title: a.title, summary: a.summary, tags: a.tags, publishedAt: a.publishedAt, readingMinutes: a.readingMinutes }} />
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <View style={{ height: 3, backgroundColor: c.border }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={{ height: 3, backgroundColor: c.accent, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      <Screen edges={[]} onScroll={onScroll}>
        {a.offline ? <OfflineNote /> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md }}>
          <LanguageSwitch compact />
        </View>
        {prefs.lang === 'hi' && a.lang !== 'hi' ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
            <T variant="small" lang="hi">{strings('hi').noHindi}</T>
          </Card>
        ) : null}
        {retracted ? (
          <Card style={{ borderColor: c.incorrect, backgroundColor: c.incorrectSoft, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Ionicons name="alert-circle" size={20} color={c.incorrect} />
              <T variant="heading" color="incorrect">{L.retracted}</T>
            </View>
            <T variant="small" style={{ marginTop: spacing.xs }}>{a.retraction?.reason}</T>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Tag label={paperLabel(a.tags?.gsPaper, a.lang)} />
          {(a.tags?.subjects || []).map((s) => <Tag key={s} label={subjectLabel(taxonomy, s, a.lang)} />)}
        </View>
        <T variant="title" style={{ marginTop: spacing.md }} accessibilityRole="header">{a.title}</T>
        <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>
          {formatDate(a.publishedAt)}{a.readingMinutes ? ` · ${L.minRead(a.readingMinutes)}` : ''}{a.version > 1 ? ` · ${L.updated} ${formatDate(a.updatedAt)}` : ''}
        </T>

        <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: spacing.md, marginTop: spacing.lg }}>
          <T style={[read, { fontWeight: '600' }]}>{a.summary}</T>
        </View>

        {a.keyPoints?.length ? (
          <>
            <SectionTitle>{L.keyPoints}</SectionTitle>
            {a.keyPoints.map((k, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 10 }} />
                <T style={[read, { flex: 1 }]}>{k}</T>
              </View>
            ))}
          </>
        ) : null}

        <SectionTitle>{L.explainer}</SectionTitle>
        {a.body.split('\n').filter((p) => p.trim()).map((p, i) => <T key={i} style={[read, { marginBottom: spacing.md }]}>{p}</T>)}

        {a.upscRelevance ? (
          <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent', marginTop: spacing.sm }}>
            <T variant="caption" style={{ marginBottom: spacing.xs }}>{L.whyUpsc}</T>
            <T style={read}>{a.upscRelevance}</T>
          </Card>
        ) : null}

        {a.corrections?.length ? (
          <>
            <SectionTitle>{L.corrections}</SectionTitle>
            {a.corrections.map((corr, i) => (
              <T key={i} variant="small" color="textSecondary" style={{ marginBottom: spacing.xs }}>{formatDate(corr.at)}: {corr.note}</T>
            ))}
          </>
        ) : null}

        <Divider />
        <T variant="caption" color="textSecondary">{L.sources}</T>
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
        {related?.length ? (
          <>
            <Divider />
            <T variant="caption" color="textSecondary" style={{ marginBottom: spacing.md }}>{L.related}</T>
            {related.map((r) => <ArticleCard key={r.id} article={r} />)}
          </>
        ) : null}
      </Screen>
    </>
  );
}
