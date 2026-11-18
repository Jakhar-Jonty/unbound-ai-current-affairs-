import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBillingPlans } from '../lib/queries';
import { formatDate } from '../lib/format';
import { useTheme, spacing, radius } from '../theme';
import SignInPrompt from '../components/SignInPrompt';
import { errorText, useT } from '../lib/i18n';
import { Button, Card, ErrorView, Loading, Screen, T } from '../components/ui';

const ROWS = [
  ['prem.row.articles', 'prem.lastDays', 'prem.fullArchive'],
  ['prem.row.quiz', 'prem.lastDays', 'prem.allPast'],
  ['prem.row.mock', true, true],
  ['prem.row.board', true, true],
  ['prem.row.practice', 'prem.perDay', 'prem.unlimited'],
  ['prem.row.saved', 'prem.upTo', 'prem.unlimited'],
  ['prem.row.offline', false, true],
  ['prem.row.insights', false, true],
  ['prem.row.audio', false, true],
  ['prem.row.tutor', false, 'prem.whenLaunch'],
];

function Cell({ v, free, limits }) {
  const c = useTheme();
  const { t } = useT();
  if (v === true) return <Ionicons name="checkmark-circle" size={18} color={free ? c.textSecondary : c.accent} accessibilityLabel={t('prem.included')} />;
  if (v === false) return <Ionicons name="remove" size={18} color={c.textMuted} accessibilityLabel={t('prem.notIncluded')} />;
  const n = v === 'prem.perDay' ? limits.practicePerDay : limits.bookmarks;
  const text = t(v, { days: limits.archiveDays, n });
  return <T variant="small" style={{ textAlign: 'center', fontWeight: free ? '400' : '700' }}>{text}</T>;
}

export default function PremiumScreen() {
  const c = useTheme();
  const { t } = useT();
  const qc = useQueryClient();
  const { user, signedIn, refreshUser } = useAuth();
  const { data: plans, isLoading, error, refetch } = useBillingPlans();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const checkoutOpen = useRef(false);
  const wasPremium = useRef(!!user?.premium?.active);

  // After checkout, reload status when the user returns to the app. (On web the checkout
  // opens in a new window and the app gets no "closed" signal, so focus is the cue.)
  const refreshAfterCheckout = useCallback(async () => {
    if (!checkoutOpen.current) return;
    try {
      const fresh = await refreshUser();
      qc.invalidateQueries({ queryKey: ['me'] });
      if (fresh.premium?.active && !wasPremium.current) {
        checkoutOpen.current = false;
        wasPremium.current = true;
        setMessage(t('prem.welcome'));
      }
    } catch { /* try again on next focus */ }
  }, [refreshUser, qc, t]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshAfterCheckout(); });
    const onFocus = () => refreshAfterCheckout();
    if (Platform.OS === 'web') globalThis.addEventListener?.('focus', onFocus);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') globalThis.removeEventListener?.('focus', onFocus);
    };
  }, [refreshAfterCheckout]);

  if (!signedIn) return <Screen edges={[]}><SignInPrompt icon="sparkles-outline" title={t('prem.signIn')} /></Screen>;
  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const p = user.premium || {};
  const limits = { archiveDays: plans.free.archiveDays, practicePerDay: plans.free.practicePerDay, bookmarks: plans.free.bookmarks };
  const monthly = plans.plans.find((x) => x.id === 'monthly');
  const yearly = plans.plans.find((x) => x.id === 'yearly');
  const saving = monthly && yearly ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;
  const canBuyHere = plans.purchaseAvailable.configured && plans.purchaseAvailable[Platform.OS];
  const paidSubscriber = p.active && p.source === 'razorpay';

  // Opens the secure web checkout (already signed in), then refreshes status on return.
  const openCheckout = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const { url } = await api('/billing/checkout-link', { method: 'POST' });
      checkoutOpen.current = true;
      wasPremium.current = !!p.active;
      await WebBrowser.openBrowserAsync(url);
      await refreshAfterCheckout(); // Native: the browser has been closed by now.
    } catch (err) {
      setMessage(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ backgroundColor: c.inverse, borderColor: c.inverse, paddingVertical: spacing.xl }}>
        <Ionicons name="sparkles" size={28} color={c.accent} />
        {!plans.enabled ? (
          <>
            <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>{t('prem.freeNowTitle')}</T>
            <T variant="small" color={c.onInverse} style={{ marginTop: spacing.xs, opacity: 0.85 }}>{t('prem.freeNowSub')}</T>
          </>
        ) : p.active ? (
          <>
            <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>{t('prem.youAre')}</T>
            <T variant="small" color={c.onInverse} style={{ marginTop: spacing.xs, opacity: 0.85 }}>
              {p.plan === 'complimentary' ? t('prem.complimentary') : p.plan === 'yearly' ? t('prem.yearly') : t('prem.monthly')}
              {p.until ? t(p.status === 'cancelled' ? 'prem.ends' : 'prem.renews', { date: formatDate(p.until) }) : ''}
            </T>
          </>
        ) : (
          <>
            <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>{t('prem.pitch')}</T>
            <T variant="small" color={c.onInverse} style={{ marginTop: spacing.xs, opacity: 0.85 }}>
              {t('prem.from', { m: monthly?.display, y: yearly?.display })}{saving > 0 ? t('prem.save', { p: saving }) : ''}.
            </T>
          </>
        )}
      </Card>

      <View style={{ marginTop: spacing.xl, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: c.accentSoft }}>
          <T variant="caption" style={{ flex: 1.4 }}>{t('prem.feature')}</T>
          <T variant="caption" style={{ flex: 1, textAlign: 'center' }}>{t('prem.free')}</T>
          <T variant="caption" style={{ flex: 1, textAlign: 'center' }}>{t('prem.premium')}</T>
        </View>
        {ROWS.map(([label, free, prem], i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
            <T variant="small" style={{ flex: 1.4 }}>{t(label)}</T>
            <View style={{ flex: 1, alignItems: 'center' }}><Cell v={free} free limits={limits} /></View>
            <View style={{ flex: 1, alignItems: 'center' }}><Cell v={prem} limits={limits} /></View>
          </View>
        ))}
      </View>

      {message ? <T style={{ marginTop: spacing.lg, fontWeight: '600' }} accessibilityLiveRegion="polite">{message}</T> : null}

      {plans.enabled && !p.active ? (
        canBuyHere ? (
          user.emailVerified === false ? (
            <>
              <T variant="small" color="textSecondary" style={{ marginTop: spacing.xl }}>{t('prem.verifyFirst')}</T>
              <Button title={t('titles.verify')} onPress={() => router.push('/account/verify')} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <>
              <Button title={t('prem.continue')} icon="lock-closed" onPress={openCheckout} loading={busy} style={{ marginTop: spacing.xl }} />
              <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                {t('prem.payNote')}
              </T>
            </>
          )
        ) : (
          <T variant="small" color="textSecondary" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
            {Platform.OS === 'ios' ? t('prem.notIos') : t('prem.soon')}
          </T>
        )
      ) : null}

      {paidSubscriber && canBuyHere ? (
        <Button title={t('prem.manage')} variant="outline" onPress={openCheckout} loading={busy} style={{ marginTop: spacing.xl }} />
      ) : null}
    </Screen>
  );
}
