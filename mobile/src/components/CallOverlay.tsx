import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCallsContext } from '@/context/CallsContext';
import { useTheme } from '@/hooks/use-theme';
import { dbForUser } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from './mobile-ui';

import { CallScreen } from './CallScreen';

// Renders as a native Modal so it appears above whatever screen (tab or stack)
// is currently active — the mobile equivalent of the web app's <dialog>-based
// CallDialog, which similarly floats above the whole page regardless of route.
export function CallOverlay() {
  const calls = useCallsContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [otherName, setOtherName] = useState('Your contact');

  const conversationId = calls.call?.conversationId;
  useEffect(() => {
    setOtherName('Your contact');
    if (!conversationId || !user) return;
    let active = true;
    dbForUser(user.id).listConversations().then((rows) => {
      const match = rows.find((r) => r.id === conversationId);
      if (active && match) setOtherName(match.other_name);
    }).catch(console.warn);
    return () => { active = false; };
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (calls.notice) {
      Alert.alert('Call', calls.notice, [{ text: 'OK', onPress: calls.dismissNotice }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls.notice]);

  if (calls.preparing) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => calls.close()}>
        <View style={styles.backdrop}>
          <GlassSurface intensity={55} radius={32} style={styles.card}>
            <ActivityIndicator />
            <ThemedText style={styles.cardText}>
              Getting your call ready. Allow microphone or camera access when prompted.
            </ThemedText>
            <Pressable onPress={() => calls.close()}>
              <ThemedText themeColor="danger">Cancel</ThemedText>
            </Pressable>
          </GlassSurface>
        </View>
      </Modal>
    );
  }

  if (!calls.call) return null;

  if (calls.call.phase === 'active' && calls.call.token && calls.call.url) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => calls.close()}>
        <CallScreen
          token={calls.call.token}
          serverUrl={calls.call.url}
          mode={calls.call.mode}
          otherName={otherName}
          onLeave={() => calls.close()}
          onError={(message) => calls.close(message)}
        />
      </Modal>
    );
  }

  const phase = calls.call.phase;
  const label =
    phase === 'incoming'
      ? `Incoming ${calls.call.mode} call`
      : phase === 'outgoing'
        ? `Ringing · ${calls.call.mode} call`
        : 'Connecting your call…';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => phase === 'incoming' ? calls.decline() : calls.close()}>
      <View style={styles.backdrop}>
        <SafeAreaView style={{ width: '100%', alignItems: 'center' }}>
          <GlassSurface intensity={55} radius={32} style={styles.card}>
            <Avatar name={otherName} size={88} />
            <ThemedText type="subtitle" style={styles.cardText}>
              {otherName}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.cardText}>
              {label}
            </ThemedText>
            <View style={styles.actions}>
              {phase === 'incoming' ? (
                <>
                  <Pressable
                    onPress={calls.decline}
                    style={[styles.button, { backgroundColor: theme.danger }]}
                  >
                    <ThemedText style={styles.buttonText}>Decline</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => calls.accept()} style={[styles.button, { backgroundColor: theme.tint }]}>
                    <ThemedText style={styles.buttonText}>Accept</ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => calls.close()} style={[styles.button, { backgroundColor: theme.danger }]}>
                  <ThemedText style={styles.buttonText}>Cancel call</ThemedText>
                </Pressable>
              )}
            </View>
          </GlassSurface>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,12,33,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '85%',
    maxWidth: 360,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardText: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  button: { borderRadius: 12, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  buttonText: { color: '#fff', fontWeight: '600' },
});
