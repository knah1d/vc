import { PermissionsAndroid, Platform } from 'react-native';

export type CallMode = 'voice' | 'video';

export interface CallInvite {
  callId: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
}

export function callError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The call could not connect. Please try again.';
}

// Ask for mic/camera up front so we never ring the other person only to fail
// locally a moment later. iOS prompts automatically on first publish instead.
export async function checkMedia(mode: CallMode) {
  if (Platform.OS !== 'android') return;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (mode === 'video') permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);

  const results = await PermissionsAndroid.requestMultiple(permissions);
  const cameraDenied = mode === 'video' && results[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED;
  const micDenied = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED;

  if (cameraDenied) throw new Error('Camera access was denied. Allow it in Settings to make video calls.');
  if (micDenied) throw new Error('Microphone access was denied. Allow it in Settings to make calls.');
}
