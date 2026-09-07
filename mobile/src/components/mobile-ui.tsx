import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ThemedText } from './themed-text';
import { GlassSurface } from './glass';
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
  return (
    <GlassSurface intensity={35} radius={26} style={style}>
      {children}
    </GlassSurface>
  );
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}
    >
      <GlassSurface intensity={45} radius={17} style={styles.actionButton}>
        <SymbolView
          name={
            glyph === '☎'
              ? { ios: 'phone', android: 'call', web: 'call' }
              : glyph === '▣'
                ? { ios: 'video', android: 'videocam', web: 'videocam' }
                : glyph === '+'
                  ? { ios: 'plus', android: 'add', web: 'add' }
                  : { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }
          }
          tintColor={theme.tint}
          size={22}
        />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: 370, height: 370, borderRadius: 190, opacity: 0.09 },
  actionButton: { minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
});
