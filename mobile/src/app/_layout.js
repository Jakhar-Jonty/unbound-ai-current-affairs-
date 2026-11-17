import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/auth';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { useMeta } from '../lib/queries';
import { compareVersions } from '../lib/format';
import { useTheme } from '../theme';
import { Empty, Button } from '../components/ui';

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
  const { data: meta } = useMeta();
  const current = Constants.expoConfig?.version || '0.0.0';
  if (meta && compareVersions(current, meta.minAppVersion) < 0) {
    const storeUrl = Constants.expoConfig?.extra?.storeUrl?.[Platform.OS];
    return (
      <Empty
        icon="arrow-up-circle-outline"
        title="Update required"
        message="A newer version of the app is needed to keep your content up to date."
        action={storeUrl ? <Button title="Update now" onPress={() => WebBrowser.openBrowserAsync(storeUrl)} /> : null}
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

function RootStack() {
  const c = useTheme();
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
          <Stack.Screen name="quiz/[id]" options={{ title: 'Quiz', gestureEnabled: false }} />
          <Stack.Screen name="result/[id]" options={{ title: 'Your result' }} />
          <Stack.Screen name="leaderboard" options={{ title: 'This week’s leaderboard' }} />
          <Stack.Screen name="premium" options={{ title: 'Premium', presentation: 'modal' }} />
          <Stack.Screen name="insights" options={{ title: 'Your insights' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="account/verify" options={{ title: 'Verify email' }} />
          <Stack.Screen name="practice/[subject]" options={{ title: 'Practice' }} />
          <Stack.Screen name="account/password" options={{ title: 'Change password' }} />
          <Stack.Screen name="account/delete" options={{ title: 'Delete account' }} />
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
