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
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { GlassSurface } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CallMode } from '@/lib/calls';
import { callError } from '@/lib/calls';
import { OrbitEmblem } from './mobile-ui';
import { LiftPressable, Reveal, useMotionAllowed } from './motion';

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
  const [level, setLevel] = useState(0);
  const motion = useMotionAllowed();
  const theme = useTheme();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const pipX = useSharedValue(0);
  const pipY = useSharedValue(0);
  const dragStart = useRef({ x: 0, y: 0 });
  const pipMotion = useAnimatedStyle(() => ({ transform: [{ translateX: pipX.value }, { translateY: pipY.value }] }));
  const pipGesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => { dragStart.current = { x: pipX.value, y: pipY.value }; },
    onPanResponderMove: (_event, gesture) => {
      const width = pipExpanded ? stageSize.width * 0.55 : 90;
      const height = pipExpanded ? stageSize.height * 0.45 : 130;
      pipX.value = Math.max(Math.min(0, -stageSize.width + width + 32), Math.min(0, dragStart.current.x + gesture.dx));
      pipY.value = Math.max(Math.min(0, -stageSize.height + height + 32), Math.min(0, dragStart.current.y + gesture.dy));
    },
  }), [pipExpanded, stageSize, pipX, pipY]);

  useEffect(() => {
    if (!motion || mode !== 'voice') { setLevel(0); return; }
    const sample = setInterval(() => {
      setLevel(Math.max(0, ...room.activeSpeakers.map((participant) => participant.audioLevel)));
    }, 180);
    return () => clearInterval(sample);
  }, [motion, mode, room]);

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
      <View style={styles.statusRow}><GlassSurface radius={20} style={{ paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: together ? theme.glow : theme.tint }} /><ThemedText style={[styles.statusText, { color: theme.text }]}>{status}</ThemedText>
      </GlassSurface></View>

      {mode === 'voice' ? (
        <View style={styles.voiceStage}>
          <OrbitEmblem name={otherName} size={130} level={level} />
          <ThemedText type="subtitle" style={[styles.voiceName, { color: theme.text }]}>
            {otherName}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.videoStage} onLayout={(event) => setStageSize(event.nativeEvent.layout)}>
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
            <Animated.View {...pipGesture.panHandlers} style={[styles.pip, pipExpanded ? styles.pipExpanded : styles.pipSmall, pipMotion]}>
            <LiftPressable accessibilityRole="button" accessibilityLabel="Resize self preview. Drag to move." onPress={() => { setPipExpanded((v) => !v); pipX.value = motion ? withSpring(0) : 0; pipY.value = motion ? withSpring(0) : 0; }} style={styles.fill}>
              {isTrackReference(localTrackRef) ? (
                <VideoTrack trackRef={localTrackRef} style={styles.fill} objectFit="cover" mirror />
              ) : (
                <View style={styles.pipCameraOff} />
              )}
            </LiftPressable></Animated.View>
          )}
        </View>
      )}

      <Reveal style={styles.controls}>
        <LiftPressable
          accessibilityRole="button"
          accessibilityLabel={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          onPress={() => { void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch((error) => Alert.alert('Microphone', callError(error))); }}
        >
          <GlassSurface intensity={35} radius={24} style={[styles.controlButton, !isMicrophoneEnabled && styles.controlButtonOff]}>
            <SymbolView name={isMicrophoneEnabled ? { ios: 'mic', android: 'mic' } : { ios: 'mic.slash', android: 'mic_off' }} tintColor={theme.tint} size={22} />
            <Text style={[styles.controlLabel, { color: theme.text }]}>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</Text>
          </GlassSurface>
        </LiftPressable>
        {mode === 'video' && (
          <LiftPressable
            accessibilityRole="button"
            accessibilityLabel={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            onPress={() => { void localParticipant.setCameraEnabled(!isCameraEnabled).catch((error) => Alert.alert('Camera', callError(error))); }}
          >
            <GlassSurface intensity={35} radius={24} style={[styles.controlButton, !isCameraEnabled && styles.controlButtonOff]}>
              <SymbolView name={isCameraEnabled ? { ios: 'video', android: 'videocam' } : { ios: 'video.slash', android: 'videocam_off' }} tintColor={theme.tint} size={22} />
              <Text style={[styles.controlLabel, { color: theme.text }]}>{isCameraEnabled ? 'Cam off' : 'Cam on'}</Text>
            </GlassSurface>
          </LiftPressable>
        )}
        <LiftPressable accessibilityRole="button" accessibilityLabel="End call" onPress={onLeave}>
          <View style={[styles.controlButton, styles.hangup]}>
            <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end' }} tintColor="#FFFFFF" size={24} />
            <Text style={styles.controlLabel}>End</Text>
          </View>
        </LiftPressable>
      </Reveal>
    </View>
  );
}

export function CallScreen({ token, serverUrl, mode, otherName, onLeave, onError }: CallScreenProps) {
  const theme = useTheme();
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
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      {!audioReady ? <ActivityIndicator color={theme.tint} style={{ flex: 1 }} /> :
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
  root: { flex: 1, backgroundColor: '#0B1024' },
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
  videoStage: { flex: 1, backgroundColor: '#10162D', marginHorizontal: 12, borderRadius: 28, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  videoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  pip: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: 22,
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
    height: 76,
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: { borderColor: 'rgba(255,196,0,0.6)', borderWidth: 1.5 },
  hangup: { backgroundColor: '#C4423B', borderRadius: 24 },
  controlIcon: { fontSize: 24 },
  controlLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
