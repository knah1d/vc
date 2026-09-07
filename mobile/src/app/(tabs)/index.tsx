import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput, PrimaryButton } from '@/components/form';
import { GlassSurface } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { AmbientScreen, Avatar, GlassCard, ActionButton } from '@/components/mobile-ui';
import { LiftPressable, Reveal } from '@/components/motion';
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
  const [newChat, setNewChat] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

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
      setNewChat(false);
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
          <ThemedText style={{ fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -1 }}>hush.</ThemedText>
          <ActionButton label="Appearance" glyph="⚙" onPress={() => router.push('/appearance')} />
          <LiftPressable accessibilityRole="button" accessibilityLabel="Log out" onPress={() => { void logout().catch((err) => setError(err.message)); }} style={{ alignItems: 'center', gap: 4 }}>
            <Avatar name={user?.displayName || 'You'} size={42} />
            <ThemedText themeColor="textSecondary" style={{ fontSize: 10 }}>Log out</ThemedText>
          </LiftPressable>
        </View>
        <FlatList
          data={conversations.filter((c) => c.other_name.toLowerCase().includes(search.toLowerCase()) && (!unreadOnly || c.unread_count > 0))}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } }}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<View style={{ gap: 20, marginBottom: 20 }}>
            <FormInput accessibilityLabel="Search conversations" placeholder="Search" value={search} onChangeText={setSearch} />
            {offline && <ThemedText themeColor="textSecondary">Offline</ThemedText>}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['All chats', 'Unread'].map((label, index) => <LiftPressable key={label} accessibilityRole="button" accessibilityState={{ selected: unreadOnly === (index === 1) }} onPress={() => setUnreadOnly(index === 1)} style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: unreadOnly === (index === 1) ? theme.backgroundSelected : 'transparent' }}><ThemedText style={{ fontSize: 12, fontWeight: '700', color: unreadOnly === (index === 1) ? theme.text : theme.textSecondary }}>{label}</ThemedText></LiftPressable>)}
              </View>
              <ActionButton label="Start a new conversation" glyph="+" onPress={() => { setError(null); setNewChat(true); }} />
            </View>
            {error && !newChat && <ThemedText role="alert" themeColor="danger">{error}</ThemedText>}
          </View>}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 5) * 45}>
              <LiftPressable onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: item.id, name: item.other_name } })}
                accessibilityRole="button" accessibilityLabel={`Chat with ${item.other_name}${item.unread_count ? `, ${item.unread_count} unread messages` : ''}`}>
                <GlassSurface intensity={30} radius={25} style={[styles.row, item.unread_count > 0 && { borderColor: theme.tint }]}>
                  <Avatar name={item.other_name} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <ThemedText numberOfLines={1} style={styles.rowName}>{item.other_name}</ThemedText>
                    {(item.last_body || item.last_attachment) && <ThemedText numberOfLines={1} themeColor="textSecondary" style={{ fontSize: 13 }}>{item.last_body || (item.last_attachment === 'image' ? 'Photo' : 'File')}</ThemedText>}
                  </View>
                  {item.unread_count > 0 ? <View style={[styles.badge, { backgroundColor: theme.accent }]}><ThemedText style={styles.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</ThemedText></View> : <ThemedText themeColor="textSecondary">↗</ThemedText>}
                </GlassSurface>
              </LiftPressable>
            </Reveal>
          )}
          ListEmptyComponent={<Reveal><GlassCard style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
            <ThemedText type="subtitle">{search ? 'No results' : unreadOnly ? 'All caught up' : 'No chats yet'}</ThemedText>
            {!search && !unreadOnly && <PrimaryButton title="New chat" onPress={() => setNewChat(true)} />}
          </GlassCard></Reveal>}
        />
        <Modal visible={newChat} transparent animationType="fade" onRequestClose={() => setNewChat(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(7,10,27,0.7)' }}>
            <GlassCard style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><ThemedText type="subtitle">New chat</ThemedText><Pressable accessibilityRole="button" accessibilityLabel="Close new conversation" onPress={() => setNewChat(false)} style={{ padding: 12 }}><ThemedText>✕</ThemedText></Pressable></View>
              <FormInput placeholder="Their email address" accessibilityLabel="Contact email" autoCapitalize="none" keyboardType="email-address" value={otherEmail} onChangeText={setOtherEmail} onSubmitEditing={handleStartConversation} />
              {error && <ThemedText role="alert" themeColor="danger">{error}</ThemedText>}
              <PrimaryButton title="Start conversation" onPress={handleStartConversation} loading={starting} disabled={!otherEmail.trim()} />
            </GlassCard>
          </KeyboardAvoidingView>
        </Modal>
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
