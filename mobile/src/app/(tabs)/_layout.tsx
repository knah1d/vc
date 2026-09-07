import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: Platform.select({ ios: 20, default: 18 }) }}>💬</Text>,
        }}
      />
    </Tabs>
  );
}
