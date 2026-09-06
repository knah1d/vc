import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { db, type LocalConversation } from '@/lib/db';
import { getSocket } from '@/lib/socket';

export default function ChatsScreen() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [otherEmail, setOtherEmail] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Cache-first: render whatever's on disk immediately, then reconcile with the server.
    setConversations(await db.listConversations());
    try {
      const { conversations: remote } = await api.listConversations();
      await db.upsertConversations(
        remote.map((c) => ({
          id: c.id,
          other_id: c.other.id,
          other_name: c.other.displayName,
          unread_count: c.unreadCount,
          created_at: c.createdAt,
        }))
      );
      setConversations(await db.listConversations());
    } catch {
      // Offline or the server is unreachable — the cached list already rendered above.
    }
  }, []);

  // Reflects badges the conversation screen just zeroed locally (via
  // db.markConversationRead) the instant you come back to this list — no
  // need to wait on a network round-trip for that.
  useFocusEffect(
    useCallback(() => {
      db.listConversations().then(setConversations);
    }, [])
  );

  useEffect(() => {
    refresh();
    const socket = getSocket();
    function onNewMessage() {
      refresh();
    }
    socket.on('message:new', onNewMessage);
    return () => {
      socket.off('message:new', onNewMessage);
    };
  }, [refresh]);

  async function handleStartConversation() {
    setError(null);
    setStarting(true);
    try {
      const { conversation } = await api.startConversation(otherEmail.trim());
      setOtherEmail('');
      await refresh();
      const created = (await db.listConversations()).find((c) => c.id === conversation.id);
      router.push({
        pathname: '/conversation/[id]',
        params: { id: conversation.id, name: created?.other_name ?? '' },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{user?.displayName}</ThemedText>
          <Pressable onPress={logout}>
            <ThemedText themeColor="tint">Log out</ThemedText>
          </Pressable>
        </View>

        <View style={styles.startRow}>
          <View style={styles.startInput}>
            <FormInput
              placeholder="Start a chat by email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={otherEmail}
              onChangeText={setOtherEmail}
              onSubmitEditing={handleStartConversation}
            />
          </View>
          <PrimaryButton title="Start" onPress={handleStartConversation} loading={starting} disabled={!otherEmail} />
        </View>
        {error && (
          <ThemedText role="alert" style={{ color: theme.danger, paddingHorizontal: Spacing.four }}>
            {error}
          </ThemedText>
        )}

        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/conversation/[id]', params: { id: item.id, name: item.other_name } })
              }
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}
            >
              <ThemedText style={styles.rowName}>{item.other_name}</ThemedText>
              {item.unread_count > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                  <ThemedText style={styles.badgeText}>{item.unread_count}</ThemedText>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              No conversations yet — start one above.
            </ThemedText>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  startRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  startInput: { flex: 1 },
  list: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  rowName: { fontSize: 16 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});
