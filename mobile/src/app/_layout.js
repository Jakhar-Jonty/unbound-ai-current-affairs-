import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { getApiLang, setApiLang } from '../lib/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { useMeta } from '../lib/queries';
import { compareVersions } from '../lib/format';
import { useT } from '../lib/i18n';
import { useTheme } from '../theme';
import { Empty, Button } from '../components/ui';

// Tabs sit under every other screen, so modals (sign-in, Premium) open over them
// even when the app is opened straight on one of those routes.
export const unstable_settings = { anchor: '(tabs)' };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: (count, err) => (err?.status === 0 || err?.status >= 500) && count < 2,
    },
  },
});

/** Opens the right screen when the user taps a push notification. */
function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const open = (response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (data.quizId) router.push(`/quiz/${data.quizId}`);
      else if (data.articleId) router.push(`/article/${data.articleId}`);
    };
    const last = Notifications.getLastNotificationResponse?.();
    if (last) open(last);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

/** Blocks the app when the backend requires a newer version. */
function VersionGate({ children }) {
  const { t } = useT();
  const { data: meta } = useMeta();
  const current = Constants.expoConfig?.version || '0.0.0';
  if (meta && compareVersions(current, meta.minAppVersion) < 0) {
    const storeUrl = Constants.expoConfig?.extra?.storeUrl?.[Platform.OS];
    return (
      <Empty
        icon="arrow-up-circle-outline"
        title={t('update.title')}
        message={t('update.message')}
        action={storeUrl ? <Button title={t('update.button')} onPress={() => WebBrowser.openBrowserAsync(storeUrl)} /> : null}
      />
    );
  }
  return children;
}

/** Sends first-time visitors to the intro (once). Signed-in users skip it. */
function useOnboarding() {
  const { prefs, ready, update } = usePrefs();
  const { user, loading } = useAuth();
  const segments = useSegments();
  useEffect(() => {
    if (!ready || loading || prefs.onboarded) return;
    if (user) { update({ onboarded: true }); return; }
    if (segments[0] !== 'onboarding') router.replace('/onboarding');
  }, [ready, loading, prefs.onboarded, user, segments, update]);
}

/** Sends the chosen content language with every request; reloads content when it changes. */
function useContentLanguage() {
  const { prefs, ready } = usePrefs();
  const { user, updateProfile } = useAuth();
  const qc = useQueryClient();
  // Keep the account's language in step with the app, so reminders arrive in it.
  const accountLang = user?.id && !user.offline ? user.lang : null;
  useEffect(() => {
    if (!ready || !accountLang) return;
    const lang = prefs.lang === 'hi' ? 'hi' : 'en';
    if (accountLang !== lang) updateProfile({ lang }).catch(() => {});
  }, [ready, prefs.lang, accountLang, updateProfile]);
  useEffect(() => {
    if (!ready) return;
    const lang = prefs.lang === 'hi' ? 'hi' : 'en';
    if (getApiLang() === lang) return;
    setApiLang(lang);
    qc.resetQueries();
  }, [ready, prefs.lang, qc]);
}

function RootStack() {
  const c = useTheme();
  const { t } = useT();
  useContentLanguage();
  useNotificationRouting();
  useOnboarding();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <VersionGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: c.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="article/[id]" options={{ title: '' }} />
          <Stack.Screen name="quiz/[id]" options={{ title: t('titles.quiz'), gestureEnabled: false }} />
          <Stack.Screen name="result/[id]" options={{ title: t('titles.result') }} />
          <Stack.Screen name="leaderboard" options={{ title: t('titles.leaderboard') }} />
          <Stack.Screen name="premium" options={{ title: t('titles.premium'), presentation: 'modal' }} />
          <Stack.Screen name="insights" options={{ title: t('titles.insights') }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="account/verify" options={{ title: t('titles.verify') }} />
          <Stack.Screen name="account/subjects" options={{ title: t('titles.subjects') }} />
          <Stack.Screen name="account/exams" options={{ title: t('titles.exams') }} />
          <Stack.Screen name="practice/[subject]" options={{ title: t('titles.practice') }} />
          <Stack.Screen name="account/password" options={{ title: t('titles.password') }} />
          <Stack.Screen name="account/delete" options={{ title: t('titles.delete') }} />
          <Stack.Screen name="briefing" options={{ title: t('titles.briefing') }} />
          <Stack.Screen name="account/notifications" options={{ title: t('titles.notifications') }} />
        </Stack>
      </VersionGate>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PrefsProvider>
            <RootStack />
          </PrefsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
