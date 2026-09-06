import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

// One-time native setup — must run before displayIncomingCall/endCall are used.
// android.foregroundService is what satisfies Play Store's policy for using
// the mic/camera while backgrounded during an active call (Android 14+
// requires a declared foreground-service type for that, which CallKeep's
// ConnectionService integration provides).
export async function setupCallKeep() {
  if (Platform.OS !== 'android') return;
  try {
    await RNCallKeep.setup({
      ios: { appName: 'Hush' },
      android: {
        alertTitle: 'Calling permission',
        alertDescription: 'Hush needs access to manage calls so it can ring you properly.',
        cancelButton: 'Cancel',
        okButton: 'OK',
        additionalPermissions: [],
        foregroundService: {
          channelId: 'com.hush.calls',
          channelName: 'Calls',
          notificationTitle: 'Call in progress',
        },
      },
    });
    RNCallKeep.setAvailable(true);
  } catch (error) {
    console.warn('CallKeep setup failed — falling back to in-app ringing UI only.', error);
  }
}

// Surfaces the native (lock-screen-visible) incoming-call UI alongside our
// own in-app modal. Deliberately one-directional for now: accepting/declining
// still happens through our own UI, not the native buttons — wiring that back
// into the call state machine needs real-device testing to get races right
// (e.g. answering natively while the in-app modal is also open).
export function showNativeIncomingCall(callId: string, callerName: string, hasVideo: boolean) {
  if (Platform.OS !== 'android') return;
  RNCallKeep.displayIncomingCall(callId, callerName, callerName, 'generic', hasVideo);
}

export function clearNativeCall(callId: string) {
  if (Platform.OS !== 'android') return;
  RNCallKeep.endCall(callId);
}
