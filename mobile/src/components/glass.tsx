import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

// The one recipe every "glass" surface in the app uses, so they all read as
// one consistent material rather than a pile of one-off translucent panels.
//
// Android note: expo-blur renders a flat semi-transparent view by default —
// blurMethod must be set explicitly to get an actual blur. SDK31+ covers
// effectively all real devices; older ones quietly fall back to the flat tint.
export function GlassSurface({
  children,
  style,
  intensity = 40,
  radius = 24,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; intensity?: number; radius?: number }>) {
  const scheme = useColorScheme();
  const tint = scheme === 'dark' ? 'dark' : 'light';

  return (
    <View style={[styles.clip, { borderRadius: radius }, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

// For `headerBackground` — a full-bleed panel with no rounded corners/border,
// just a hairline at the very bottom (matching how translucent nav bars read
// on both platforms) instead of GlassSurface's all-around card border.
export function GlassHeaderBackground() {
  const scheme = useColorScheme();
  const tint = scheme === 'dark' ? 'dark' : 'light';
  return (
    <View style={styles.headerClip}>
      <BlurView intensity={55} tint={tint} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  headerClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
});
