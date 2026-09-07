import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/react-native';
import { ConnectionState, Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CallMode } from '@/lib/calls';
import { callError } from '@/lib/calls';

interface CallScreenProps {
  token: string;
  serverUrl: string;
  mode: CallMode;
  otherName: string;
  onLeave: () => void;
  onError: (message: string) => void;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function CallStage({ mode, otherName, onLeave }: Pick<CallScreenProps, 'mode' | 'otherName' | 'onLeave'>) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const participants = useRemoteParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const localTrackRef = cameraTracks.find((t) => t.participant.isLocal);
  const remoteTrackRef = cameraTracks.find((t) => !t.participant.isLocal);
  const [pipExpanded, setPipExpanded] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const together = connection === ConnectionState.Connected && participants.length > 0;

  useEffect(() => {
    if (!together) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [together]);

  const status = together
    ? formatDuration(seconds)
    : connection === ConnectionState.Connected
      ? `Waiting for ${otherName}…`
      : connection === ConnectionState.Reconnecting
        ? 'Reconnecting…'
        : 'Connecting…';

  return (
    <View style={styles.stageFlex}>
      <View style={styles.statusRow}>
        <ThemedText style={styles.statusText}>{status}</ThemedText>
      </View>

      {mode === 'voice' ? (
        <View style={styles.voiceStage}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarInitial}>{otherName.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <ThemedText type="subtitle" style={styles.voiceName}>
            {otherName}
          </ThemedText>
          <ThemedText style={{ color: '#B6ACC9' }}>Just the two of you. All ears.</ThemedText>
        </View>
      ) : (
        <View style={styles.videoStage}>
          {remoteTrackRef && isTrackReference(remoteTrackRef) ? (
            <VideoTrack trackRef={remoteTrackRef} style={styles.fill} objectFit="cover" />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.placeholderText}>
                {participants.length > 0 ? `${otherName}'s camera is off` : `Waiting for ${otherName} to join…`}
              </Text>
            </View>
          )}
          {localTrackRef && (
            <Pressable
              onPress={() => setPipExpanded((v) => !v)}
              style={[styles.pip, pipExpanded ? styles.pipExpanded : styles.pipSmall]}
            >
              {isTrackReference(localTrackRef) ? (
                <VideoTrack trackRef={localTrackRef} style={styles.fill} objectFit="cover" mirror />
              ) : (
                <View style={styles.pipCameraOff} />
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          onPress={() => { void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch((error) => Alert.alert('Microphone', callError(error))); }}
        >
          <GlassSurface intensity={35} radius={24} style={[styles.controlButton, !isMicrophoneEnabled && styles.controlButtonOff]}>
            <Text style={styles.controlLabel}>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</Text>
          </GlassSurface>
        </Pressable>
        {mode === 'video' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            onPress={() => { void localParticipant.setCameraEnabled(!isCameraEnabled).catch((error) => Alert.alert('Camera', callError(error))); }}
          >
            <GlassSurface intensity={35} radius={24} style={[styles.controlButton, !isCameraEnabled && styles.controlButtonOff]}>
              <Text style={styles.controlLabel}>{isCameraEnabled ? 'Cam off' : 'Cam on'}</Text>
            </GlassSurface>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={onLeave}>
          <View style={[styles.controlButton, styles.hangup]}>
            <Text style={styles.controlLabel}>End</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export function CallScreen({ token, serverUrl, mode, otherName, onLeave, onError }: CallScreenProps) {
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    let active = true;
    const start = AudioSession.startAudioSession();
    void start.then(() => { if (active) setAudioReady(true); }).catch((error) => { if (active) onError(callError(error)); });
    return () => {
      active = false;
      void start.catch(() => {}).then(() => AudioSession.stopAudioSession()).catch(console.warn);
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      {!audioReady ? <ActivityIndicator color="#C6AEFF" style={{ flex: 1 }} /> :
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        audio
        video={mode === 'video'}
        onDisconnected={onLeave}
        onError={(error) => onError(`Could not connect the call: ${callError(error)}`)}
        onMediaDeviceFailure={(failure) =>
          onError(`Couldn't access your microphone or camera (${failure ?? 'device unavailable'}).`)
        }
      >
        <CallStage mode={mode} otherName={otherName} onLeave={onLeave} />
      </LiveKitRoom>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#171224' },
  stageFlex: { flex: 1 },
  statusRow: { alignItems: 'center', paddingVertical: Spacing.three },
  statusText: { color: '#fff', fontSize: 13 },
  voiceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 48,
    backgroundColor: '#332544',
    borderWidth: 2,
    borderColor: '#8462B5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '600' },
  voiceName: { color: '#fff' },
  videoStage: { flex: 1, backgroundColor: '#000' },
  fill: { width: '100%', height: '100%' },
  videoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  pip: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  pipSmall: { width: 90, height: 130 },
  pipExpanded: { width: '55%', height: '45%' },
  pipCameraOff: { flex: 1, backgroundColor: '#333' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  controlButton: {
    width: 72,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: { borderColor: 'rgba(255,196,0,0.6)', borderWidth: 1.5 },
  hangup: { backgroundColor: '#C4423B', borderRadius: 24 },
  controlIcon: { fontSize: 24 },
  controlLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
