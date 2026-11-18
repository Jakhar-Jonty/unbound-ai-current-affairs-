import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBriefing } from '../lib/queries';
import { errorText, useT } from '../lib/i18n';
import { tap } from '../lib/haptics';
import { useTheme, spacing, radius } from '../theme';
import { PremiumGate, isPremiumError } from '../components/Premium';
import LanguageSwitch from '../components/LanguageSwitch';
import { Card, Empty, ErrorView, Loading, Screen, T } from '../components/ui';

const SPEEDS = [0.9, 1, 1.25];

/**
 * Daily audio briefing, read by the phone's own text-to-speech voice (no audio files).
 * Parts play one after another: intro, each story, outro.
 */
export default function Briefing() {
  const c = useTheme();
  const { t, lang } = useT();
  const { data, isLoading, error, refetch } = useBriefing();
  const [current, setCurrent] = useState(0); // index into parts
  // Playing only counts in the language it started in, so switching language stops it.
  const [playingLang, setPlayingLang] = useState(null);
  const playing = playingLang === lang;
  const setPlaying = (v) => setPlayingLang(v ? lang : null);
  const [speed, setSpeed] = useState(1);
  const [noHindiVoice, setNoHindiVoice] = useState(false);
  const session = useRef(0); // ignores callbacks from speech that was stopped

  const parts = data && data.items.length ? [
    { key: 'intro', title: t('brief.introPart'), text: data.intro },
    ...data.items.map((it) => ({ key: String(it.articleId), title: it.title, text: it.text, articleId: it.articleId })),
    { key: 'outro', title: '', text: data.outro },
  ] : [];

  // Warn when the phone has no Hindi voice (the text would be read badly).
  useEffect(() => {
    if (lang !== 'hi' || Platform.OS === 'web') return undefined;
    let alive = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => { if (alive) setNoHindiVoice(!voices.some((v) => String(v.language).toLowerCase().startsWith('hi'))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [lang]);

  const stop = useCallback(() => { session.current += 1; Speech.stop(); }, []);
  useEffect(() => stop, [stop]); // stop speaking when leaving the screen
  useEffect(() => { stop(); }, [lang, stop]); // new language, new script

  function speakFrom(i) {
    if (!parts[i]) { setPlaying(false); setCurrent(0); return; }
    const mine = ++session.current;
    Speech.stop();
    setCurrent(i);
    setPlaying(true);
    Speech.speak(parts[i].text, {
      language: lang === 'hi' ? 'hi-IN' : 'en-IN',
      rate: speed,
      onDone: () => { if (session.current === mine) speakFrom(i + 1); },
      onError: () => { if (session.current === mine) setPlaying(false); },
    });
  }

  const toggle = () => {
    tap();
    if (playing) { stop(); setPlaying(false); } else speakFrom(current);
  };
  const jump = (i) => { tap(); speakFrom(Math.max(0, Math.min(parts.length - 1, i))); };
  const changeSpeed = (s) => {
    tap();
    setSpeed(s);
    if (playing) { stop(); setPlaying(false); }
  };

  if (isLoading) return <Loading />;
  if (isPremiumError(error)) return <Screen edges={[]}><PremiumGate message={errorText(error, t)} /></Screen>;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const storyIndex = current >= 1 && current <= data.items.length ? current : null;

  return (
    <Screen edges={[]}>
      <T color="textSecondary">{t('brief.intro')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
        <LanguageSwitch />
        {parts.length ? <T variant="small" color="textSecondary">{t('brief.minutes', { n: data.minutes })}</T> : null}
      </View>
      {noHindiVoice ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
          <T variant="small">{t('brief.noHindiVoice')}</T>
        </Card>
      ) : null}

      {!parts.length ? (
        <Empty icon="headset-outline" title={t('brief.empty')} message={lang === 'hi' ? t('brief.emptyHi') : undefined} />
      ) : (
        <>
          <Card style={{ marginTop: spacing.lg, backgroundColor: c.inverse, borderColor: c.inverse, alignItems: 'center', paddingVertical: spacing.xl }}>
            <T variant="caption" color={c.onInverse} style={{ opacity: 0.8 }}>
              {storyIndex ? t('brief.storyOf', { i: storyIndex, n: data.items.length }) : t('titles.briefing').toUpperCase()}
            </T>
            <T variant="heading" color={c.onInverse} style={{ marginTop: spacing.sm, textAlign: 'center' }} numberOfLines={3}>
              {parts[current]?.title || t('brief.introPart')}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: spacing.lg }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('brief.prev')} hitSlop={10} onPress={() => jump(current - 1)}>
                <Ionicons name="play-skip-back" size={28} color={c.onInverse} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={playing ? t('brief.pause') : t('brief.play')} onPress={toggle}
                style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={playing ? 'pause' : 'play'} size={32} color={c.onAccent} style={playing ? null : { marginLeft: 4 }} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('brief.next')} hitSlop={10} onPress={() => jump(current + 1)}>
                <Ionicons name="play-skip-forward" size={28} color={c.onInverse} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
              <T variant="caption" color={c.onInverse} style={{ opacity: 0.8 }}>{t('brief.speed').toUpperCase()}</T>
              {SPEEDS.map((s) => (
                <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: speed === s }} onPress={() => changeSpeed(s)}
                  style={{ paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: speed === s ? c.accent : 'rgba(128,128,128,0.4)', backgroundColor: speed === s ? c.accent : 'transparent' }}>
                  <T variant="small" style={{ fontWeight: '700', color: speed === s ? c.onAccent : c.onInverse }}>{s}×</T>
                </Pressable>
              ))}
            </View>
          </Card>

          {data.items.map((it, i) => {
            const on = current === i + 1;
            return (
              <Card key={String(it.articleId)} onPress={() => jump(i + 1)} accessibilityLabel={`${t('brief.storyOf', { i: i + 1, n: data.items.length })}: ${it.title}`}
                style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: on ? c.accent : c.border }}>
                <Ionicons name={on && playing ? 'volume-high' : 'radio-button-off'} size={20} color={on ? c.accent : c.textMuted} />
                <T variant="small" style={{ flex: 1, fontWeight: on ? '700' : '400' }} numberOfLines={2}>{it.title}</T>
                <Pressable accessibilityRole="link" accessibilityLabel={t('brief.read')} hitSlop={8} onPress={() => { stop(); setPlaying(false); router.push(`/article/${it.articleId}`); }}>
                  <Ionicons name="newspaper-outline" size={20} color={c.text} />
                </Pressable>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
