import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView } from 'expo-symbols';

export function AmbientScreen({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.orb, { backgroundColor: theme.tint, top: -130, right: -100 }]} />
      <View style={[styles.orb, { backgroundColor: '#63C9B4', bottom: 40, left: -200 }]} />
    </View>
    {children}
  </View>;
}

export function GlassCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</View>;
}

export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const theme = useTheme();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return <View accessibilityElementsHidden style={{ width: size, height: size, borderRadius: size * 0.36, backgroundColor: theme.backgroundSelected, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
    <ThemedText style={{ fontSize: size * 0.33, fontWeight: '700', color: theme.tint }}>{initials}</ThemedText>
  </View>;
}

export function ActionButton({ label, glyph, onPress, disabled, testID }: { label: string; glyph: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} testID={testID} onPress={onPress} style={({ pressed }) => ({ minWidth: 46, minHeight: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSelected, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}>
    <SymbolView name={glyph === '☎' ? { ios: 'phone', android: 'call', web: 'call' } : glyph === '▣' ? { ios: 'video', android: 'videocam', web: 'videocam' } : { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={theme.tint} size={22} />
  </Pressable>;
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: 370, height: 370, borderRadius: 190, opacity: 0.09 },
  card: { borderRadius: 26, borderWidth: 1, padding: 20, boxShadow: '0px 8px 28px rgba(40, 25, 65, 0.05)' },
});
