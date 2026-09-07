import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FormInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { AmbientScreen, ActionButton, Avatar } from '@/components/mobile-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCallsContext } from '@/context/CallsContext';
import { useTheme } from '@/hooks/use-theme';
import { api, type RemoteMessage } from '@/lib/api';
import { dbForUser, type LocalMessage } from '@/lib/db';
import { localMessage, sendMessage, subscribeOutbox } from '@/lib/outbox';
import { getSocket } from '@/lib/socket';

const TYPING_STOP_DELAY_MS = 2000;

// Single check = sent, double check = read. The moment a message flips to
// "read" (not on initial render of an already-read history message): the
// ticks bounce with a little overshoot, sweep from gray to accent color, and
// a soft ring pulses outward behind them — a small "confirmed" flourish.
function MessageTick({ read }: { read: boolean }) {
  const colorProgress = useSharedValue(read ? 1 : 0);
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const wasRead = useRef(read);

  useEffect(() => {
    if (read && !wasRead.current) {
      colorProgress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      scale.value = withSequence(
        withTiming(1.55, { duration: 160, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 6, stiffness: 180 })
      );
      ringScale.value = 0.4;
      ringOpacity.value = 0.5;
      ringScale.value = withTiming(2.6, { duration: 500, easing: Easing.out(Easing.quad) });
      ringOpacity.value = withTiming(0, { duration: 500 });
    } else if (!read) {
      colorProgress.value = 0;
      scale.value = 1;
    }
    wasRead.current = read;
  }, [read, colorProgress, scale, ringScale, ringOpacity]);

  const tickStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    color: interpolateColor(colorProgress.value, [0, 1], ['rgba(255,255,255,0.7)', '#7CD4FF']),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={styles.tickWrap}>
      <Animated.View pointerEvents="none" style={[styles.tickRing, ringStyle]} />
      <Animated.Text style={[styles.tick, tickStyle]}>{read ? '✓✓' : '✓'}</Animated.Text>
    </View>
  );
}

export default function ConversationScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const db = useMemo(() => dbForUser(user!.id), [user!.id]);
  const calls = useCallsContext();
  const theme = useTheme();
  const callDisabled = Boolean(calls.call) || calls.preparing;
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [connected, setConnected] = useState(getSocket().connected);
  const listRef = useRef<FlatList<LocalMessage>>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasTypingRef = useRef(false);

  function markRead() {
    api.markRead(id!).catch(() => {});
    void db.markConversationRead(id!).catch(console.warn);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setOtherTyping(false);

    async function load() {
      // Cache-first: instant render from disk, then reconcile with the server.
      try {
        const cached = await db.listMessages(id);
        if (!cancelled) setMessages(cached);
        const known = new Set(cached.map((message) => message.server_id).filter(Boolean));
        let before: string | undefined;
        // Fill every missed page, not only the latest 100 messages.
        for (;;) {
          const { messages: remote } = await api.listMessages(id, before);
          if (cancelled) return;
          await db.upsertMessages(remote.map(toLocal));
          if (remote.length < 100 || remote.some((message) => known.has(message.id))) break;
          const next = remote[0]?.id;
          if (!next || next === before) break;
          before = next;
        }
        if (!cancelled) setMessages(await db.listMessages(id));
        markRead();
      } catch {
        // Offline — the cached history already rendered above.
      }
    }
    load();

    const socket = getSocket();
    const unsubscribeOutbox = subscribeOutbox(() => {
      void db.listMessages(id).then((rows) => { if (!cancelled) setMessages(rows); }).catch(console.warn);
    });
    async function onNewMessage({ message }: { message: RemoteMessage & { conversationId: string } }) {
      if (message.conversationId !== id) return;
      await db.upsertMessages([toLocal(message)]);
      const rows = await db.listMessages(id);
      if (cancelled) return;
      setMessages(rows);
      markRead();
    }
    function onTyping({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) {
      if (conversationId === id) setOtherTyping(isTyping);
    }
    async function onMessageRead({ conversationId, readAt }: { conversationId: string; readAt: string }) {
      if (conversationId !== id || !user) return;
      await db.markSentMessagesRead(id, user.id, readAt);
      if (!cancelled) setMessages(await db.listMessages(id));
    }
    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('message:read', onMessageRead);
    function reconnect() { setConnected(true); void load(); }
    function disconnect() { setConnected(false); setOtherTyping(false); }
    socket.on('connect', reconnect);
    socket.on('disconnect', disconnect);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => {
      cancelled = true;
      unsubscribeOutbox();
      socket.off('message:new', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('message:read', onMessageRead);
      socket.off('connect', reconnect);
      socket.off('disconnect', disconnect);
      foreground.remove();
      clearTimeout(typingStopTimer.current);
      if (wasTypingRef.current && socket.connected) socket.emit('typing', { conversationId: id, isTyping: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, db]);

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!id) return;
    const socket = getSocket();
    if (!wasTypingRef.current) {
      wasTypingRef.current = true;
      socket.emit('typing', { conversationId: id, isTyping: true });
    }
    clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      wasTypingRef.current = false;
      socket.emit('typing', { conversationId: id, isTyping: false });
    }, TYPING_STOP_DELAY_MS);
  }

  function toLocal(m: RemoteMessage): LocalMessage {
    return {
      client_id: m.clientId ?? m.id,
      server_id: m.id,
      conversation_id: id!,
      sender_id: m.senderId,
      body: m.body,
      created_at: m.createdAt,
      status: 'sent',
      read_at: m.readAt ?? null,
    };
  }

  async function handleSend() {
    if (!draft.trim() || !id || !user) return;
    const socket = getSocket();
    clearTimeout(typingStopTimer.current);
    if (wasTypingRef.current) {
      wasTypingRef.current = false;
      socket.emit('typing', { conversationId: id, isTyping: false });
    }
    const message = localMessage(id, user.id, draft.trim());
    setDraft('');
    await db.upsertMessages([message]);
    setMessages(await db.listMessages(id));
    await sendMessage(user.id, id, message.client_id, message.body);
    setMessages(await db.listMessages(id));
  }

  return (
    <AmbientScreen>
      <Stack.Screen
        options={{
          title: name || 'Chat',
          headerTitle: () => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar name={name || 'Chat'} size={36} /><View style={{ maxWidth: 150 }}><ThemedText numberOfLines={1} style={{ fontWeight: '700' }}>{name || 'Chat'}</ThemedText><ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>{connected ? 'Your conversation' : 'Reconnecting…'}</ThemedText></View></View>,
          headerRight: () => (
            <View style={styles.headerActions}>
              <ActionButton testID="call-voice" label="Start voice call" glyph="☎" disabled={callDisabled || !connected} onPress={() => id && calls.start(id, 'voice')} />
              <ActionButton testID="call-video" label="Start video call" glyph="▣" disabled={callDisabled || !connected} onPress={() => id && calls.start(id, 'video')} />
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.select({ ios: 90, default: 0 })}
      >
        <SafeAreaView style={styles.flex} edges={['bottom']}>
          <FlatList
            ref={listRef}
            style={styles.flex}
            data={messages}
            keyExtractor={(item) => item.client_id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={<ThemedText style={{ textAlign: 'center', fontSize: 11, letterSpacing: 2, color: theme.textSecondary, marginVertical: 16 }}>A LITTLE CLOSER, EVERY MESSAGE</ThemedText>}
            ListEmptyComponent={<View style={{ alignItems: 'center', padding: 32, gap: 16 }}><Avatar name={name || 'Chat'} size={72} /><ThemedText type="subtitle">Say hello.</ThemedText><ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>Good conversations start with a little something.</ThemedText></View>}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View
                    style={[
                      styles.bubble,
                      { backgroundColor: mine ? theme.tint : theme.backgroundElement, borderBottomRightRadius: mine ? 6 : 22, borderBottomLeftRadius: mine ? 22 : 6 },
                    ]}
                  >
                    {/* Reserve a little room after the text so the time/tick corner
                        overlay (below) doesn't sit on top of the last word for
                        typical message lengths — the standard chat-bubble look. */}
                    <ThemedText style={[mine ? styles.bubbleTextMine : undefined, styles.bubbleTextPad]}>
                      {item.body}
                    </ThemedText>
                    <View style={styles.metaFloating}>
                      <ThemedText style={[styles.metaInline, { color: mine ? '#F0E8FF' : theme.textSecondary }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                      {mine && (item.status === 'sent' || item.status === 'sending') && (
                        <MessageTick read={Boolean(item.read_at)} />
                      )}
                    </View>
                  </View>
                  {item.status === 'sending' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Sending…
                    </ThemedText>
                  )}
                  {item.status === 'failed' && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Retry sending message" onPress={async () => { if (!user) return; await sendMessage(user.id, id, item.client_id, item.body); setMessages(await db.listMessages(id)); }} style={{ padding: 8 }}><ThemedText type="small" style={{ color: theme.danger }}>Not sent · Tap to retry</ThemedText></Pressable>
                  )}
                </View>
              );
            }}
          />

          <View style={styles.typingRow}>
            {otherTyping && (
              <ThemedText type="small" themeColor="textSecondary">
                {name ? `${name} is typing…` : 'Typing…'}
              </ThemedText>
            )}
          </View>

          {!connected && <ThemedText style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>Offline · Your messages will send when you reconnect</ThemedText>}
          <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.composerInput}>
              <FormInput
                placeholder="Type a message"
                value={draft}
                onChangeText={handleDraftChange}
                onSubmitEditing={handleSend}
                multiline
                maxLength={10000}
                style={{ maxHeight: 120, textAlignVertical: 'top' }}
              />
            </View>
            <ActionButton label="Send message" glyph="↑" disabled={!draft.trim()} onPress={() => { void handleSend(); }} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AmbientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerIcon: { fontSize: 20 },
  list: { padding: Spacing.three, gap: Spacing.two },
  bubbleRow: { alignItems: 'flex-start', gap: 2 },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    position: 'relative',
    maxWidth: '80%',
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleTextMine: { color: '#fff' },
  // Reserves room in the bottom-right corner for the floating time/tick overlay.
  bubbleTextPad: { paddingRight: 46, paddingBottom: 2 },
  metaFloating: {
    position: 'absolute',
    right: 10,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaInline: { fontSize: 10 },
  tickWrap: { width: 16, height: 12, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 11, fontWeight: '700' },
  tickRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7CD4FF',
  },
  typingRow: { height: 20, paddingHorizontal: Spacing.three },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  composerInput: { flex: 1 },
  sendButton: { fontWeight: '600', paddingBottom: Spacing.two + 4 },
});
