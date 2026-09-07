import { registerGlobals } from '@livekit/react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { CallOverlay } from '@/components/CallOverlay';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CallsProvider } from '@/context/CallsContext';
import { initSentry, Sentry } from '@/lib/sentry';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

// Must run once before any LiveKit/WebRTC usage.
registerGlobals();
initSentry();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function handle(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const data = (response.notification.request.content.data ?? {}) as { type?: string; conversationId?: string };
      if (data.type === 'message:new' && data.conversationId) {
        // A notification can belong to an account previously signed in here.
        try {
          const { conversations } = await api.listConversations();
          const match = conversations.find((c) => c.id === data.conversationId);
          if (active && match) router.push({ pathname: '/conversation/[id]', params: { id: match.id, name: match.other.displayName } });
        } catch { /* Keep the inbox available when offline. */ }
      }
      if (active) await Notifications.clearLastNotificationResponseAsync();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => { void handle(response); });
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(console.warn);
    return () => { active = false; subscription.remove(); };
  }, [user?.id]);

  if (isLoading) return null;

  const stack = (
    <Stack screenOptions={{ headerShown: false, headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.text, headerShadowVisible: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="conversation/[id]" options={{ headerShown: true }} />
      </Stack.Protected>
    </Stack>
  );

  // CallsProvider must wrap both the Stack (conversation/[id] triggers calls)
  // and CallOverlay (renders them) so they share one call state. Calls only
  // make sense once signed in — the socket isn't authenticated otherwise.
  if (!user) return stack;
  return (
    <CallsProvider key={user.id}>
      {stack}
      <CallOverlay />
    </CallsProvider>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

// Sentry.wrap adds an error boundary around the whole app plus touch-event
// breadcrumbs — standard for the Expo Router + Sentry integration.
export default Sentry.wrap(RootLayout);
