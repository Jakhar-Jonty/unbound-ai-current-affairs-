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
import { Button, Card, ErrorView, Loading, Screen, T } from '../components/ui';

const ROWS = [
  ['Daily articles and explainers', 'Last {days} days', 'Full archive'],
  ['Daily quiz with explanations', 'Last {days} days', 'All past quizzes'],
  ['Weekly leaderboard', true, true],
  ['Practice by subject', '{practice} a day', 'Unlimited'],
  ['Saved articles and questions', 'Up to {bookmarks}', 'Unlimited'],
  ['Offline reading', false, true],
  ['Weak-topic insights', false, true],
  ['AI tutor and audio briefings', false, 'When they launch'],
];

function Cell({ v, free, limits }) {
  const c = useTheme();
  if (v === true) return <Ionicons name="checkmark-circle" size={18} color={free ? c.textSecondary : c.accent} accessibilityLabel="Included" />;
  if (v === false) return <Ionicons name="remove" size={18} color={c.textMuted} accessibilityLabel="Not included" />;
  const text = String(v).replace('{days}', limits.archiveDays).replace('{practice}', limits.practicePerDay).replace('{bookmarks}', limits.bookmarks);
  return <T variant="small" style={{ textAlign: 'center', fontWeight: free ? '400' : '700' }}>{text}</T>;
}

export default function PremiumScreen() {
  const c = useTheme();
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
        setMessage('Welcome to Premium!');
      }
    } catch { /* try again on next focus */ }
  }, [refreshUser, qc]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshAfterCheckout(); });
    const onFocus = () => refreshAfterCheckout();
    if (Platform.OS === 'web') globalThis.addEventListener?.('focus', onFocus);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') globalThis.removeEventListener?.('focus', onFocus);
    };
  }, [refreshAfterCheckout]);

  if (!signedIn) return <Screen edges={[]}><SignInPrompt icon="sparkles-outline" title="Sign in to see Premium" /></Screen>;
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
      setMessage(err.message);
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
            <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>Everything is free right now</T>
            <T variant="small" color={c.onInverse} style={{ marginTop: spacing.xs, opacity: 0.85 }}>You already have every feature. Premium plans will start later.</T>
          </>
        ) : p.active ? (
          <>
            <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>You’re Premium</T>
            <T variant="small" color={c.onInverse} style={{ marginTop: spacing.xs, opacity: 0.85 }}>
              {p.plan === 'complimentary' ? 'Complimentary access' : `${p.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan`}
              {p.until ? ` · ${p.status === 'cancelled' ? 'ends' : 'renews'} ${formatDate(p.until)}` : ''}
            </T>
          </>
        ) : (
          <>
            <T variant="title" color={c.onInverse} style={{ marginTop: spacing.sm }}>Prepare without limits</T>
            <T variant="small" color={c.onInverse} style={{ marginTop: spacing.xs, opacity: 0.85 }}>
              From {monthly?.display}/month, or {yearly?.display}/year{saving > 0 ? ` (save ${saving}%)` : ''}.
            </T>
          </>
        )}
      </Card>

      <View style={{ marginTop: spacing.xl, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: c.accentSoft }}>
          <T variant="caption" style={{ flex: 1.4 }}>FEATURE</T>
          <T variant="caption" style={{ flex: 1, textAlign: 'center' }}>FREE</T>
          <T variant="caption" style={{ flex: 1, textAlign: 'center' }}>PREMIUM</T>
        </View>
        {ROWS.map(([label, free, prem], i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
            <T variant="small" style={{ flex: 1.4 }}>{label}</T>
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
              <T variant="small" color="textSecondary" style={{ marginTop: spacing.xl }}>Verify your email first. Your receipts are sent there.</T>
              <Button title="Verify email" onPress={() => router.push('/account/verify')} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <>
              <Button title="Continue to secure payment" icon="lock-closed" onPress={openCheckout} loading={busy} style={{ marginTop: spacing.xl }} />
              <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                Pay with UPI, card or net banking through Razorpay. Cancel any time and keep Premium until the end of the period you paid for.
              </T>
            </>
          )
        ) : (
          <T variant="small" color="textSecondary" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
            {Platform.OS === 'ios' ? 'Premium isn’t available in the iOS app yet.' : 'Premium will be available here soon.'}
          </T>
        )
      ) : null}

      {paidSubscriber && canBuyHere ? (
        <Button title="Manage subscription" variant="outline" onPress={openCheckout} loading={busy} style={{ marginTop: spacing.xl }} />
      ) : null}
    </Screen>
  );
}
