import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { storage } from './storage';

// Shows a banner even while the app is foregrounded (default behavior is to
// suppress it), so an incoming call / new message is never silently missed
// just because the app happened to be open on another screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Calls',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

// Requests permission and registers this device's Expo push token with the
// backend, so it can reach us even when the app has no live socket
// connection (backgrounded or fully killed). Safe to call on every login —
// it no-ops quietly if permission is denied or no EAS project is configured.
export async function registerForPushNotifications(): Promise<void> {
  try {
    await ensureAndroidChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Push notifications need an EAS project (run `eas init`) — skipping registration.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await storage.setDeviceToken(token);
  } catch (error) {
    console.warn('Could not register for push notifications', error);
  }
}

export async function unregisterForPushNotifications(): Promise<void> {
  const token = await storage.getDeviceToken();
  if (!token) return;
  try {
    await api.unregisterDevice(token);
  } catch {
    // Best-effort — logging out locally matters more than this succeeding.
  } finally {
    await storage.clearDeviceToken();
  }
}
