import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput, PrimaryButton } from '@/components/form';
import { GlassSurface } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { AmbientScreen, Avatar, GlassCard } from '@/components/mobile-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { dbForUser, type LocalConversation } from '@/lib/db';
import { getSocket } from '@/lib/socket';

export default function ChatsScreen() {
  const { user, logout } = useAuth();
  const db = useMemo(() => dbForUser(user!.id), [user!.id]);
  const mounted = useRef(true);
  const theme = useTheme();
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [otherEmail, setOtherEmail] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    // Cache-first: render whatever's on disk immediately, then reconcile with the server.
    try {
      const cached = await db.listConversations();
      if (!mounted.current) return;
      setConversations(cached);
      const { conversations: remote } = await api.listConversations();
      if (!mounted.current) return;
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
      setOffline(false);
    } catch {
      if (mounted.current) setOffline(true);
      // Offline or the server is unreachable — the cached list already rendered above.
    }
  }, [db]);

  // Reflects badges the conversation screen just zeroed locally (via
  // db.markConversationRead) the instant you come back to this list — no
  // need to wait on a network round-trip for that.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    mounted.current = true;
    const socket = getSocket();
    function onNewMessage() {
      refresh();
    }
    socket.on('message:new', onNewMessage);
    socket.on('conversation:new', onNewMessage);
    socket.on('connect', onNewMessage);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => {
      mounted.current = false;
      socket.off('message:new', onNewMessage);
      socket.off('conversation:new', onNewMessage);
      socket.off('connect', onNewMessage);
      foreground.remove();
    };
  }, [refresh]);

  async function handleStartConversation() {
    if (starting || !otherEmail.trim()) return;
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
    <AmbientScreen>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <View><ThemedText style={{ fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -1.5 }}>hush.</ThemedText><ThemedText themeColor="textSecondary" style={{ fontSize: 12 }}>A little space for your people.</ThemedText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={() => { void logout().catch((err) => setError(err.message)); }} style={{ alignItems: 'center', gap: 4 }}>
            <Avatar name={user?.displayName || 'You'} size={42} />
            <ThemedText themeColor="textSecondary" style={{ fontSize: 10 }}>Log out</ThemedText>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 6, marginBottom: 20 }}><ThemedText type="title">Your people</ThemedText><ThemedText themeColor="textSecondary">{offline ? 'Offline · Showing saved conversations' : `Hey ${user?.displayName?.split(' ')[0] || 'there'}, pick up where you left off.`}</ThemedText></View>
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}><FormInput accessibilityLabel="Search conversations" placeholder="Search your conversations…" value={search} onChangeText={setSearch} /></View>
        <GlassCard style={{ marginHorizontal: 24, marginBottom: 20, padding: 16, gap: 12 }}>
        <ThemedText style={{ fontWeight: '700', fontSize: 13 }}>MAKE A NEW CONNECTION</ThemedText>
        <View style={styles.startRow}>
          <View style={styles.startInput}>
            <FormInput
              placeholder="Their email address"
              autoCapitalize="none"
              keyboardType="email-address"
              value={otherEmail}
              onChangeText={setOtherEmail}
              onSubmitEditing={handleStartConversation}
            />
          </View>
          <PrimaryButton title="Chat" onPress={handleStartConversation} loading={starting} disabled={!otherEmail.trim()} />
        </View>
        </GlassCard>
        {error && (
          <ThemedText role="alert" style={{ color: theme.danger, paddingHorizontal: Spacing.four }}>
            {error}
          </ThemedText>
        )}

        <FlatList
          data={conversations.filter((c) => c.other_name.toLowerCase().includes(search.toLowerCase()))}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } }}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/conversation/[id]', params: { id: item.id, name: item.other_name } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${item.other_name}${item.unread_count ? `, ${item.unread_count} unread messages` : ''}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <GlassSurface intensity={30} radius={24} style={styles.row}>
                <Avatar name={item.other_name} />
                <View style={{ flex: 1, gap: 4 }}><ThemedText numberOfLines={1} style={styles.rowName}>{item.other_name}</ThemedText><ThemedText themeColor="textSecondary" style={{ fontSize: 12 }}>{item.unread_count ? 'New messages are waiting' : 'Message, call, stay close'}</ThemedText></View>
                {item.unread_count > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                    <ThemedText style={styles.badgeText}>{item.unread_count}</ThemedText>
                  </View>
                )}
                {!item.unread_count && <ThemedText themeColor="textSecondary">›</ThemedText>}
              </GlassSurface>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 24, gap: 12 }}><Avatar name="h" size={76} /><ThemedText type="subtitle">{search ? 'No matches yet' : 'Good company starts here.'}</ThemedText><ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>{search ? 'Try another name.' : 'Add someone by email. Send a hello. Make their day.'}</ThemedText></View>
          }
        />
      </SafeAreaView>
    </AmbientScreen>
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
    alignItems: 'center',
  },
  startInput: { flex: 1 },
  list: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  separator: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: 14,
  },
  rowName: { fontSize: 16, fontWeight: '700' },
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
