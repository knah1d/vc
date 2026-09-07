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

// Must run once before any LiveKit/WebRTC usage.
registerGlobals();
initSentry();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  useEffect(() => {
    // Tapping a "new message" notification jumps straight to that
    // conversation. A "call:incoming" notification needs no handling here —
    // opening the app reconnects the socket (see AuthContext's AppState
    // listener), and the call is still ringing server-side within its
    // window, so CallOverlay picks it up on its own.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; conversationId?: string };
      if (data.type === 'message:new' && data.conversationId) {
        router.push({ pathname: '/conversation/[id]', params: { id: data.conversationId } });
      }
    });
    return () => subscription.remove();
  }, []);

  if (isLoading) return null;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
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
    <CallsProvider>
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
