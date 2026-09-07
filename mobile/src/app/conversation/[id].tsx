import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedKeyboard,
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
import { dbForUser, parseReactions, type LocalMessage } from '@/lib/db';
import { localMessage, sendMessage, subscribeOutbox, type OutgoingAttachment } from '@/lib/outbox';
import { getSocket } from '@/lib/socket';
import { uploadAttachment } from '@/lib/upload';

const TYPING_STOP_DELAY_MS = 2000;
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

// Single check = sent, double check = read. The moment a message flips to
// "read" (not on initial render of an already-read history message), the
// ticks bounce with a little overshoot and sweep from gray to accent color.
// Rendered as a nested Text (see the bubble below), so it flows inline right
// after the message like Telegram/WhatsApp — that rules out an Animated.View
// ring effect here, since React Native can't nest a View inside Text.
function MessageTick({ read, mine }: { read: boolean; mine: boolean }) {
  const colorProgress = useSharedValue(read ? 1 : 0);
  const scale = useSharedValue(1);
  const wasRead = useRef(read);

  useEffect(() => {
    if (read && !wasRead.current) {
      colorProgress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      scale.value = withSequence(
        withTiming(1.55, { duration: 160, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 6, stiffness: 180 })
      );
    } else if (!read) {
      colorProgress.value = 0;
      scale.value = 1;
    }
    wasRead.current = read;
  }, [read, colorProgress, scale]);

  const tickStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    color: interpolateColor(colorProgress.value, [0, 1], [mine ? 'rgba(255,255,255,0.7)' : '#9C9C9C', '#7CD4FF']),
  }));

  return <Animated.Text style={[styles.tick, tickStyle]}>{read ? ' ✓✓' : ' ✓'}</Animated.Text>;
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
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<FlatList<LocalMessage>>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasTypingRef = useRef(false);
  // Modern Android's edge-to-edge display mode silently breaks the legacy
  // KeyboardAvoidingView/adjustResize approach — the OS reports the keyboard
  // inset correctly, it just stops auto-resizing the window for it. Reading
  // that inset directly and applying it ourselves works on both platforms.
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const keyboardPad = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));

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
    async function onMessageReaction({ conversationId, messageId, reactions }: { conversationId: string; messageId: string; reactions: { userId: string; emoji: string }[] }) {
      if (conversationId !== id) return;
      await db.setReactionsByServerId(messageId, JSON.stringify(reactions));
      if (!cancelled) setMessages(await db.listMessages(id));
    }
    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('message:read', onMessageRead);
    socket.on('message:reaction', onMessageReaction);
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
      socket.off('message:reaction', onMessageReaction);
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
      reactions: JSON.stringify(m.reactions ?? []),
      attachment_url: m.attachmentUrl ?? null,
      attachment_type: m.attachmentType ?? null,
      attachment_name: m.attachmentName ?? null,
    };
  }

  function reactTo(serverId: string, emoji: string) {
    setReactingTo(null);
    getSocket().emit('message:react', { messageId: serverId, emoji });
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

  async function sendAttachment(localUri: string, filename: string, contentType: string, kind: 'image' | 'file') {
    if (!id || !user) return;
    setAttachSheetOpen(false);
    setUploading(true);
    try {
      const publicUrl = await uploadAttachment(localUri, filename, contentType);
      const attachment: OutgoingAttachment = { url: publicUrl, type: kind, name: filename };
      const caption = draft.trim();
      setDraft('');
      const message = localMessage(id, user.id, caption, attachment);
      await db.upsertMessages([message]);
      setMessages(await db.listMessages(id));
      await sendMessage(user.id, id, message.client_id, message.body, attachment);
      setMessages(await db.listMessages(id));
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Could not send the attachment.');
    } finally {
      setUploading(false);
    }
  }

  async function pickPhoto(fromCamera: boolean) {
    setAttachSheetOpen(false);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow ${fromCamera ? 'camera' : 'photo library'} access to attach a photo.`);
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await sendAttachment(asset.uri, asset.fileName ?? 'photo.jpg', asset.mimeType ?? 'image/jpeg', 'image');
  }

  async function pickFile() {
    setAttachSheetOpen(false);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await sendAttachment(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', 'file');
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
      <Animated.View style={[styles.flex, keyboardPad]}>
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
              const reactions = parseReactions(item.reactions);
              const distinctEmoji = [...new Set(reactions.map((r) => r.emoji))];
              return (
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <Pressable
                    disabled={!item.server_id}
                    onLongPress={() => item.server_id && setReactingTo(item.server_id)}
                    delayLongPress={220}
                    style={[
                      styles.bubble,
                      { backgroundColor: mine ? theme.tint : theme.backgroundElement, borderBottomRightRadius: mine ? 6 : 22, borderBottomLeftRadius: mine ? 22 : 6 },
                    ]}
                  >
                    {item.attachment_type === 'image' && item.attachment_url && (
                      <Image source={{ uri: item.attachment_url }} style={styles.attachmentImage} contentFit="cover" />
                    )}
                    {item.attachment_type === 'file' && item.attachment_url && (
                      <Pressable
                        onPress={() => Linking.openURL(item.attachment_url!)}
                        style={[styles.filePill, { borderColor: mine ? 'rgba(255,255,255,0.4)' : theme.border }]}
                      >
                        <ThemedText style={mine ? styles.bubbleTextMine : undefined}>📎</ThemedText>
                        <ThemedText numberOfLines={1} style={[styles.fileName, mine ? styles.bubbleTextMine : undefined]}>
                          {item.attachment_name ?? 'File'}
                        </ThemedText>
                      </Pressable>
                    )}
                    {/* Time/tick nested as inline Text (not a separate row) — Telegram's
                        look: it flows right after the last word when the message is
                        short, and wraps to its own line only when the text is long
                        enough to need it. An image-only message has no text to attach
                        to, so it keeps the small overlay chip on the photo instead. */}
                    {item.body.length > 0 ? (
                      <ThemedText style={mine ? styles.bubbleTextMine : undefined}>
                        {item.body}
                        {'  '}
                        <ThemedText style={[styles.metaInline, { color: mine ? '#F0E8FF' : theme.textSecondary }]}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                        {mine && (item.status === 'sent' || item.status === 'sending') && (
                          <MessageTick read={Boolean(item.read_at)} mine={mine} />
                        )}
                      </ThemedText>
                    ) : (
                      <View style={[styles.metaFloating, item.attachment_type === 'image' && styles.metaFloatingOnImage]}>
                        <ThemedText style={[styles.metaInline, { color: '#fff' }]}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                        {mine && (item.status === 'sent' || item.status === 'sending') && (
                          <MessageTick read={Boolean(item.read_at)} mine />
                        )}
                      </View>
                    )}
                    {distinctEmoji.length > 0 && (
                      <View style={[styles.reactionPill, { borderColor: theme.border, backgroundColor: theme.background }, mine ? { left: 6 } : { right: 6 }]}>
                        <ThemedText style={styles.reactionPillText}>
                          {distinctEmoji.slice(0, 3).join('')}
                          {reactions.length > 1 ? ` ${reactions.length}` : ''}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
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

          <Modal visible={reactingTo !== null} transparent animationType="fade" onRequestClose={() => setReactingTo(null)}>
            <Pressable style={styles.reactionBackdrop} onPress={() => setReactingTo(null)}>
              <View style={[styles.reactionSheet, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    hitSlop={6}
                    onPress={() => reactingTo && reactTo(reactingTo, emoji)}
                    style={styles.reactionOption}
                  >
                    <ThemedText style={styles.reactionOptionText}>{emoji}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>

          <View style={styles.typingRow}>
            {otherTyping && (
              <ThemedText type="small" themeColor="textSecondary">
                {name ? `${name} is typing…` : 'Typing…'}
              </ThemedText>
            )}
          </View>

          {uploading && <ThemedText style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>Uploading…</ThemedText>}
          {!connected && <ThemedText style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>Offline · Your messages will send when you reconnect</ThemedText>}
          <View style={styles.composer}>
            <ActionButton label="Attach a photo or file" glyph="+" disabled={uploading} onPress={() => setAttachSheetOpen(true)} />
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

          <Modal visible={attachSheetOpen} transparent animationType="fade" onRequestClose={() => setAttachSheetOpen(false)}>
            <Pressable style={styles.reactionBackdrop} onPress={() => setAttachSheetOpen(false)}>
              <View style={[styles.attachSheet, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Pressable style={styles.attachOption} onPress={() => { void pickPhoto(false); }}>
                  <ThemedText style={styles.attachOptionIcon}>🖼️</ThemedText>
                  <ThemedText>Photo library</ThemedText>
                </Pressable>
                <Pressable style={styles.attachOption} onPress={() => { void pickPhoto(true); }}>
                  <ThemedText style={styles.attachOptionIcon}>📸</ThemedText>
                  <ThemedText>Camera</ThemedText>
                </Pressable>
                <Pressable style={styles.attachOption} onPress={() => { void pickFile(); }}>
                  <ThemedText style={styles.attachOptionIcon}>📎</ThemedText>
                  <ThemedText>File</ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </SafeAreaView>
      </Animated.View>
    </AmbientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerIcon: { fontSize: 20 },
  list: { padding: Spacing.three, gap: Spacing.two },
  bubbleRow: { alignItems: 'flex-start', gap: 2, marginBottom: 6 },
  bubbleRowMine: { alignItems: 'flex-end' },
  reactionPill: {
    position: 'absolute',
    bottom: -12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionPillText: { fontSize: 12 },
  reactionBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  reactionSheet: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionOption: { padding: 6 },
  reactionOptionText: { fontSize: 28 },
  attachSheet: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 8,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  attachOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  attachOptionIcon: { fontSize: 22 },
  attachmentImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  filePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
    maxWidth: 220,
  },
  fileName: { flexShrink: 1, fontSize: 13 },
  bubble: {
    position: 'relative',
    maxWidth: '80%',
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleTextMine: { color: '#fff' },
  // Used only for an image-only message (no caption text to attach the meta
  // to inline) — a small overlay chip in the photo's corner instead.
  metaFloating: {
    position: 'absolute',
    right: 10,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaFloatingOnImage: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaInline: { fontSize: 10 },
  tick: { fontSize: 11, fontWeight: '700' },
  typingRow: { height: 20, paddingHorizontal: Spacing.three },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: 'transparent',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  composerInput: { flex: 1 },
  sendButton: { fontWeight: '600', paddingBottom: Spacing.two + 4 },
});
