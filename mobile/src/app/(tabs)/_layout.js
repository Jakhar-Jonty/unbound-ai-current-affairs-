import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme';
import { useT } from '../../lib/i18n';

const TABS = [
  { name: 'index', title: 'tabs.today', icon: 'sunny' },
  { name: 'explore', title: 'tabs.explore', icon: 'compass' },
  { name: 'quizzes', title: 'tabs.quizzes', icon: 'checkbox' },
  { name: 'saved', title: 'tabs.saved', icon: 'bookmark' },
  { name: 'profile', title: 'tabs.profile', icon: 'person' },
];

export default function TabLayout() {
  const c = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Orange is too light as text on ivory, so the active tab uses black/ivory
        // text with an orange icon fill; inactive tabs use the readable grey.
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textSecondary,
        // 56 instead of the default 49 so labels keep their descenders ("Today" was clipped).
        // The library still adds the bottom safe-area padding inside this height.
        tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border, height: 56 + insets.bottom },
        tabBarItemStyle: { padding: 0 },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11, lineHeight: 14 },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? tab.icon : `${tab.icon}-outline`} size={22} color={focused ? c.accent : c.textSecondary} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
