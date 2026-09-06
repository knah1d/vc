import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCallsContext } from '@/context/CallsContext';
import { useTheme } from '@/hooks/use-theme';
import { api, type RemoteMessage } from '@/lib/api';
import { db, type LocalMessage } from '@/lib/db';
import { localMessage, sendMessage } from '@/lib/outbox';
import { getSocket } from '@/lib/socket';

const TYPING_STOP_DELAY_MS = 2000;

export default function ConversationScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const calls = useCallsContext();
  const theme = useTheme();
  const callDisabled = Boolean(calls.call) || calls.preparing;
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const listRef = useRef<FlatList<LocalMessage>>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasTypingRef = useRef(false);

  function markRead() {
    api.markRead(id!).catch(() => {});
    db.markConversationRead(id!);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setOtherTyping(false);

    async function load() {
      // Cache-first: instant render from disk, then reconcile with the server.
      setMessages(await db.listMessages(id));
      try {
        const { messages: remote } = await api.listMessages(id);
        await db.upsertMessages(remote.map(toLocal));
        if (!cancelled) setMessages(await db.listMessages(id));
        markRead();
      } catch {
        // Offline — the cached history already rendered above.
      }
    }
    load();

    const socket = getSocket();
    async function onNewMessage({ message }: { message: RemoteMessage & { conversationId: string } }) {
      if (message.conversationId !== id) return;
      await db.upsertMessages([toLocal(message)]);
      setMessages(await db.listMessages(id));
      markRead();
    }
    function onTyping({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) {
      if (conversationId === id) setOtherTyping(isTyping);
    }
    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);
    return () => {
      cancelled = true;
      socket.off('message:new', onNewMessage);
      socket.off('typing', onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      client_id: m.id,
      server_id: m.id,
      conversation_id: id!,
      sender_id: m.senderId,
      body: m.body,
      created_at: m.createdAt,
      status: 'sent',
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
    await sendMessage(id, message.client_id, message.body);
    setMessages(await db.listMessages(id));
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          title: name || 'Chat',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                testID="call-voice"
                disabled={callDisabled}
                onPress={() => id && calls.start(id, 'voice')}
                style={{ opacity: callDisabled ? 0.4 : 1 }}
                hitSlop={8}
              >
                <ThemedText style={styles.headerIcon}>📞</ThemedText>
              </Pressable>
              <Pressable
                testID="call-video"
                disabled={callDisabled}
                onPress={() => id && calls.start(id, 'video')}
                style={{ opacity: callDisabled ? 0.4 : 1 }}
                hitSlop={8}
              >
                <ThemedText style={styles.headerIcon}>📹</ThemedText>
              </Pressable>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 90, default: 0 })}
      >
        <SafeAreaView style={styles.flex} edges={['bottom']}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.client_id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View
                    style={[
                      styles.bubble,
                      { backgroundColor: mine ? theme.tint : theme.backgroundElement },
                    ]}
                  >
                    <ThemedText style={mine ? styles.bubbleTextMine : undefined}>{item.body}</ThemedText>
                  </View>
                  {item.status === 'sending' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Sending…
                    </ThemedText>
                  )}
                  {item.status === 'failed' && (
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      Failed to send
                    </ThemedText>
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

          <View style={[styles.composer, { borderTopColor: theme.border }]}>
            <View style={styles.composerInput}>
              <FormInput
                placeholder="Type a message"
                value={draft}
                onChangeText={handleDraftChange}
                onSubmitEditing={handleSend}
                multiline
              />
            </View>
            <ThemedText themeColor="tint" onPress={handleSend} style={styles.sendButton}>
              Send
            </ThemedText>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: Spacing.three, marginRight: Spacing.two },
  headerIcon: { fontSize: 20 },
  list: { padding: Spacing.three, gap: Spacing.two },
  bubbleRow: { alignItems: 'flex-start', gap: 2 },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleTextMine: { color: '#fff' },
  typingRow: { height: 20, paddingHorizontal: Spacing.three },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: { flex: 1 },
  sendButton: { fontWeight: '600', paddingBottom: Spacing.two + 4 },
});
