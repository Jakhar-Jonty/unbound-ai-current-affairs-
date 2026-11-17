import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme';

const TABS = [
  { name: 'index', title: 'Today', icon: 'sunny' },
  { name: 'explore', title: 'Explore', icon: 'compass' },
  { name: 'quizzes', title: 'Quizzes', icon: 'checkbox' },
  { name: 'saved', title: 'Saved', icon: 'bookmark' },
  { name: 'profile', title: 'Profile', icon: 'person' },
];

export default function TabLayout() {
  const c = useTheme();
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
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, size }) => (
              <Ionicons name={focused ? t.icon : `${t.icon}-outline`} size={size} color={focused ? c.accent : c.textSecondary} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
