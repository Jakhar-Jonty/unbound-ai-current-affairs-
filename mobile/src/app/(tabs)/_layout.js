import { Tabs } from 'expo-router';
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Orange is too light as text on ivory, so the active tab uses black/ivory
        // text with an orange icon fill; inactive tabs use the readable grey.
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ focused, size }) => (
              <Ionicons name={focused ? tab.icon : `${tab.icon}-outline`} size={size} color={focused ? c.accent : c.textSecondary} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
