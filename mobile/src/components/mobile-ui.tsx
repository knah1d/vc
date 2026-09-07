import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { GlassSurface } from './glass';
import { LiftPressable, MotionContext, useDrift, useMotionAllowed } from './motion';
import { useTheme } from '@/hooks/use-theme';
import { SeasonScene } from './season-scene';
import { SymbolView } from 'expo-symbols';

export function AmbientScreen({ children }: PropsWithChildren) {
  const theme = useTheme();
  const motion = useMotionAllowed();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <MotionContext.Provider value={motion && focused}>
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SeasonScene layer="background" />
      {children}
      <SeasonScene layer="particles" />
    </View>
  </MotionContext.Provider>;
}

export function GlassCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <GlassSurface intensity={35} radius={28} style={[{ padding: 20 }, style]}>{children}</GlassSurface>;
}

export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const theme = useTheme();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  const palette = [theme.tint, theme.glow, theme.accent];
  const hue = palette[Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
  return <View accessibilityElementsHidden style={{ width: size, height: size, borderRadius: size * 0.36, backgroundColor: theme.backgroundSelected, borderWidth: 1, borderColor: hue + '77', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <View style={{ position: 'absolute', width: size, height: size, top: -size * 0.55, left: -size * 0.15, borderRadius: size / 2, backgroundColor: hue, opacity: 0.23 }} />
    <View style={{ position: 'absolute', bottom: 0, left: size * 0.2, right: size * 0.2, height: 1, backgroundColor: hue }} />
    <ThemedText style={{ fontSize: size * 0.33, lineHeight: size * 0.55, fontWeight: '700', color: theme.text }}>{initials}</ThemedText>
  </View>;
}

// Layered lighting + perspective provide depth without a new native 3D engine.
export function OrbitEmblem({ name = 'h', size = 120, level = 0 }: { name?: string; size?: number; level?: number }) {
  const theme = useTheme();
  const motion = useMotionAllowed();
  const drift = useDrift(7000);
  const energy = useSharedValue(0);
  useEffect(() => { energy.value = withTiming(motion ? Math.min(1, Math.max(0, level)) : 0, { duration: 160 }); }, [level, motion, energy]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value * -8 }, { scale: 1 + energy.value * 0.1 }] }));
  const ring = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateZ: `${-24 + drift.value * 48}deg` }, { rotateX: '62deg' }, { scale: 1 + energy.value * 0.22 }] }));
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size * 1.65, height: size * 1.55, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: size * 1.3, height: size * 1.3, borderRadius: size, backgroundColor: theme.tint, opacity: 0.08 }} />
    <Animated.View style={[{ position: 'absolute', width: size * 1.6, height: size * 1.6, borderRadius: size, borderWidth: 1.5, borderColor: theme.tint }, ring]}>
      <View style={{ position: 'absolute', top: size * 0.18, left: size * 0.12, width: 9, height: 9, borderRadius: 5, backgroundColor: theme.glow }} />
    </Animated.View>
    <Animated.View style={[{ borderRadius: size * 0.36, boxShadow: '0px 16px 36px rgba(76, 57, 161, 0.25)' }, float]}>
      <Avatar name={name} size={size} />
    </Animated.View>
  </View>;
}

export function TypingIndicator({ name }: { name: string }) {
  const theme = useTheme();
  return <View accessibilityLabel={`${name} is typing`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={{ flexDirection: 'row', gap: 4 }}>{[0, 1, 2].map((index) => <TypingDot key={index} index={index} />)}</View>
  </View>;
}

function TypingDot({ index }: { index: number }) {
  const theme = useTheme();
  const drift = useDrift(500 + index * 140);
  const animated = useAnimatedStyle(() => ({ opacity: 0.4 + drift.value * 0.6, transform: [{ translateY: -drift.value * 4 }] }));
  return <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.tint }, animated]} />;
}

export function ActionButton({ label, glyph, onPress, disabled, testID }: { label: string; glyph: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const theme = useTheme();
  const send = glyph === '↑';
  return <LiftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} testID={testID} onPress={onPress} style={{ opacity: disabled ? 0.4 : 1 }}>
    <GlassSurface intensity={45} radius={18} style={[styles.actionButton, send && { backgroundColor: theme.accent, borderColor: theme.tint }]}>
      <SymbolView name={glyph === '⚙' ? { ios: 'paintpalette', android: 'palette', web: 'palette' } : glyph === '☺' ? { ios: 'face.smiling', android: 'sentiment_satisfied', web: 'sentiment_satisfied' } : glyph === '☎' ? { ios: 'phone', android: 'call', web: 'call' } : glyph === '▣' ? { ios: 'video', android: 'videocam', web: 'videocam' } : glyph === '+' ? { ios: 'plus', android: 'add', web: 'add' } : { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={send ? '#FFFFFF' : theme.tint} size={22} />
    </GlassSurface>
  </LiftPressable>;
}

const styles = StyleSheet.create({
  nebula: { position: 'absolute', width: 500, height: 500, borderRadius: 250, opacity: 0.14 },
  horizon: { position: 'absolute', width: 720, height: 720, borderRadius: 360, borderWidth: 1, top: '26%', left: -390, opacity: 0.6 },
  actionButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
