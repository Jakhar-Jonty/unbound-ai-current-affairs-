import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, Share, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useArticle, useRelated } from '../../lib/queries';
import { saveProgress } from '../../lib/reading';
import { formatDate } from '../../lib/format';
import { useTheme, spacing, radius } from '../../theme';
import BookmarkButton from '../../components/BookmarkButton';
import { PremiumGate, isPremiumError } from '../../components/Premium';
import { TEXT_SCALES, usePrefs } from '../../lib/prefs';
import { tap } from '../../lib/haptics';
import ArticleCard, { ArticleMeta } from '../../components/ArticleCard';
import { examLabel } from '../../lib/subjects';
import LanguageSwitch from '../../components/LanguageSwitch';
import { errorText, useT } from '../../lib/i18n';
import { Card, Divider, ErrorView, Loading, OfflineNote, Screen, SectionTitle, T } from '../../components/ui';

export default function ArticleScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { data: a, isLoading, error, refetch } = useArticle(id);
  const { prefs, update } = usePrefs();
  const { t, lang } = useT();
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
    return <Screen edges={[]}><PremiumGate title={t('premium.archiveTitle')} message={errorText(error, t)} teaser={error.details?.teaser} /></Screen>;
  }
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  const retracted = a.status === 'retracted';
  // Devanagari needs a little more line height to stay readable.
  const read = a.lang === 'hi' ? { fontSize: 17 * scale, lineHeight: 30 * scale } : baseRead;

  const cycleSize = () => {
    tap();
    const i = TEXT_SCALES.indexOf(scale);
    update({ textScale: TEXT_SCALES[(i + 1) % TEXT_SCALES.length] });
  };
  const share = () => Share.share({
    title: a.title,
    message: `${a.title}\n\n${a.summary}\n\n${t('art.shareFooter')}`,
  }).catch(() => {});
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Pressable onPress={cycleSize} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('art.textSize', { p: Math.round(scale * 100) })}>
        <T style={{ fontWeight: '700', fontSize: 17 }}>Aa</T>
      </Pressable>
      <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('art.share')}>
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
        {lang === 'hi' && a.lang !== 'hi' ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
            <T variant="small" lang="hi">{t('art.noHindi')}</T>
          </Card>
        ) : null}
        {retracted ? (
          <Card style={{ borderColor: c.incorrect, backgroundColor: c.incorrectSoft, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Ionicons name="alert-circle" size={20} color={c.incorrect} />
              <T variant="heading" color="incorrect">{t('art.retracted')}</T>
            </View>
            <T variant="small" style={{ marginTop: spacing.xs }}>{a.retraction?.reason}</T>
          </Card>
        ) : null}

        <ArticleMeta article={a} all />
        <T variant="display" style={{ marginTop: spacing.md, fontSize: 28 * Math.min(scale, 1.15), lineHeight: 35 * Math.min(scale, 1.15) }} accessibilityRole="header">{a.title}</T>
        <T variant="small" color="textSecondary" style={{ marginTop: spacing.xs }}>
          {formatDate(a.publishedAt)}{a.readingMinutes ? ` · ${t('art.minRead', { n: a.readingMinutes })}` : ''}{a.version > 1 ? ` · ${t('art.updated', { date: formatDate(a.updatedAt) })}` : ''}
        </T>

        <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: spacing.md, marginTop: spacing.lg }}>
          <T style={[read, { fontSize: read.fontSize + 1, lineHeight: read.lineHeight + 2 }]}>{a.summary}</T>
        </View>

        {a.keyPoints?.length ? (
          <>
            <SectionTitle>{t('art.keyPoints')}</SectionTitle>
            <Card style={{ paddingVertical: spacing.md }}>
              {a.keyPoints.map((k, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <T variant="caption" style={{ fontWeight: '800' }}>{i + 1}</T>
                  </View>
                  <T style={[read, { flex: 1 }]}>{k}</T>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle>{t('art.explainer')}</SectionTitle>
        {a.body.split('\n').filter((p) => p.trim()).map((p, i) => <T key={i} style={[read, { marginBottom: spacing.md }]}>{p}</T>)}

        {a.upscRelevance ? (
          <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent', marginTop: spacing.sm }}>
            <T variant="caption" style={{ marginBottom: spacing.xs }}>{t('art.whyExams')}</T>
            {a.tags?.exams?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }} accessibilityLabel={`${t('art.usefulFor')}: ${a.tags.exams.map((k) => examLabel(k, lang)).join(', ')}`}>
                {a.tags.exams.map((k) => (
                  <View key={k} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: c.inverse }}>
                    <T variant="caption" color={c.onInverse}>{examLabel(k, lang)}</T>
                  </View>
                ))}
              </View>
            ) : null}
            <T style={read}>{a.upscRelevance}</T>
          </Card>
        ) : null}

        {a.corrections?.length ? (
          <>
            <SectionTitle>{t('art.corrections')}</SectionTitle>
            {a.corrections.map((corr, i) => (
              <T key={i} variant="small" color="textSecondary" style={{ marginBottom: spacing.xs }}>{formatDate(corr.at)}: {corr.note}</T>
            ))}
          </>
        ) : null}

        <Divider />
        <T variant="caption" color="textSecondary">{t('art.sources')}</T>
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
            <T variant="caption" color="textSecondary" style={{ marginBottom: spacing.md }}>{t('art.related')}</T>
            {related.map((r) => <ArticleCard key={r.id} article={r} />)}
          </>
        ) : null}
      </Screen>
    </>
  );
}
