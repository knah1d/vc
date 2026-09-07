import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { FormInput } from './form';
import { ThemedText } from './themed-text';

const groups = {
  Faces: '😀:happy 😃:smile 😄:laugh 😁:grin 😆:laugh 😅:sweat 😂:joy 🤣:laugh 😊:blush 😍:love 🥰:love 😘:kiss 😎:cool 🤔:thinking 🙃:upside-down 😭:cry 😢:sad 😮:surprise 😡:angry 🥺:pleading 😴:sleep 🤗:hug 🤩:star 🤫:quiet',
  Hands: '👋:wave 👍:yes 👎:no 👏:clap 🙌:celebrate 🙏:thanks 🤝:handshake 💪:strong ✌️:peace 🫶:love 👌:okay 🤞:luck',
  Hearts: '❤️:love 🧡:orange 💛:yellow 💚:green 💙:blue 💜:purple 🖤:black 🤍:white 💕:love 💔:broken 💖:sparkle 💯:hundred',
  Nature: '🌿:leaf 🍃:wind 🍂:autumn 🌱:seed 🌳:tree 🌸:blossom 🌺:flower 🌻:sunflower ☀️:sun 🌧️:rain ☁️:cloud 🌈:rainbow 🌙:moon ⭐:star 🔥:fire 🦋:butterfly 🐱:cat 🐶:dog',
  Food: '☕:coffee 🍵:tea 🍕:pizza 🍔:burger 🍰:cake 🎂:birthday 🍎:apple 🥭:mango 🍉:watermelon 🍓:strawberry 🍚:rice 🍜:noodles',
  Fun: '🎉:party 🎊:celebrate 🎁:gift 🎈:balloon 🎵:music 🎧:headphones 🎮:game ⚽:football 🏏:cricket ✈️:travel 🏠:home 📸:camera',
};
const entries = Object.entries(groups).flatMap(([category, values]) => values.split(' ').map(value => { const [emoji, keyword] = value.split(':'); return { emoji, keyword, category }; }));
export function EmojiPicker({ onClose, onPick }: { onClose: () => void; onPick: (emoji: string) => void }) {
  const theme = useTheme(); const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('Faces'); const [recent, setRecent] = useState<string[]>([]);
  const writes = useRef(Promise.resolve());
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const pad = useAnimatedStyle(() => ({ paddingBottom: Math.max(keyboard.height.value, insets.bottom) }));
  useEffect(() => { let active = true; void SecureStore.getItemAsync('hush_recent_emoji').then(raw => { if (!raw || !active) return; const parsed = JSON.parse(raw); if (Array.isArray(parsed)) setRecent(parsed.filter((value): value is string => typeof value === 'string' && entries.some(entry => entry.emoji === value)).slice(0, 24)); }).catch(() => {}); return () => { active = false; }; }, []);
  const visible = query.trim() ? entries.filter(entry => `${entry.keyword} ${entry.category} ${entry.emoji}`.toLowerCase().includes(query.trim().toLowerCase())) : category === 'Recent' ? recent.map(emoji => entries.find(entry => entry.emoji === emoji)!) : entries.filter(entry => entry.category === category);
  return <Modal transparent visible animationType="none" onRequestClose={onClose}><Animated.View style={[{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 12, backgroundColor: '#00000066' }, pad]}>
    <Pressable accessibilityLabel="Close emoji picker" onPress={onClose} style={{ flex: 1 }} />
    <View style={{ maxHeight: '80%', backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ flex: 1 }}><FormInput accessibilityLabel="Search emoji" placeholder="Search emoji" value={query} onChangeText={setQuery} /></View><Pressable accessibilityRole="button" accessibilityLabel="Close emoji picker" onPress={onClose} style={{ padding: 12 }}><ThemedText>✕</ThemedText></Pressable></View>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['Recent', ...Object.keys(groups)].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === category }} onPress={() => { setQuery(''); setCategory(value); }} style={{ padding: 10, borderRadius: 12, backgroundColor: category === value ? theme.backgroundSelected : 'transparent' }}><ThemedText style={{ fontSize: 12 }}>{value}</ThemedText></Pressable>)}</ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}>{visible.map(entry => <Pressable key={entry.emoji} accessibilityRole="button" accessibilityLabel={entry.keyword} onPress={() => { onPick(entry.emoji); const next = [entry.emoji, ...recent.filter(value => value !== entry.emoji)].slice(0, 24); setRecent(next); writes.current = writes.current.catch(() => {}).then(() => SecureStore.setItemAsync('hush_recent_emoji', JSON.stringify(next))).catch(() => {}); }} style={{ width: '16.66%', minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ fontSize: 28, lineHeight: 38 }}>{entry.emoji}</ThemedText></Pressable>)}{!visible.length && <ThemedText themeColor="textSecondary" style={{ padding: 12 }}>{query ? 'No results' : 'No recent emoji'}</ThemedText>}</ScrollView>
    </View>
  </Animated.View></Modal>;
}
