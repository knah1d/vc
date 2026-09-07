import { useEffect, useMemo, useState } from 'react';
import { Image as RNImage, Keyboard, PanResponder, StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppearance } from '@/context/AppearanceContext';
import { useDrift, useMotionAllowed } from './motion';
import { MeshBackground } from './mesh-background';

// Deterministic pseudo-random in [0, 1) from an integer seed. Every particle's
// size/speed/position/etc. is derived from its own index this way, so the
// scene looks the same on every render (no re-shuffling on re-mount) while
// still avoiding the obviously-formulaic look of a plain `index / count` —
// nearby seeds land nowhere near each other.
function seedFrac(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
// Fades a 0..1 loop progress in/out at its very start/end so a particle
// respawning at the top never visibly "pops" — the reset happens while it's
// already invisible.
function edgeFade(p: number, margin: number) {
  'worklet';
  if (p < margin) return p / margin;
  if (p > 1 - margin) return (1 - p) / margin;
  return 1;
}

function RainDrop({ index, height, animated, wind }: { index: number; height: number; animated: boolean; wind: SharedValue<number> }) {
  const progress = useSharedValue(seedFrac(index));
  const duration = 620 + seedFrac(index * 5.9) * 640;
  const length = 30 + seedFrac(index * 2.3) * 44;
  const thickness = 1 + seedFrac(index * 4.1) * 1.1;
  const leftPct = seedFrac(index * 1.618) * 100;
  const baseOpacity = 0.16 + seedFrac(index * 7.2) * 0.16;
  const windSensitivity = 6 + seedFrac(index * 3.3) * 10;

  useEffect(() => {
    if (animated) progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    else cancelAnimation(progress);
    return () => cancelAnimation(progress);
  }, [animated, duration, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: baseOpacity * edgeFade(p, 0.1),
      transform: [
        { translateY: p * (height + length * 2) - length },
        { translateX: (wind.value - 0.5) * windSensitivity },
        { rotate: '11deg' },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, left: `${leftPct}%`, width: thickness, height: length, borderRadius: thickness, backgroundColor: '#E4EEF3' },
        style,
      ]}
    />
  );
}

function RainLayer({ height, count, animated, wind }: { height: number; count: number; animated: boolean; wind: SharedValue<number> }) {
  if (count <= 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, index) => (
        <RainDrop key={index} index={index} height={height} animated={animated} wind={wind} />
      ))}
    </View>
  );
}

// Large, very soft drifting bands standing in for distant ground mist — no
// blur dependency needed, just size + low opacity + slow horizontal travel.
function MistLayer({ animated, wind }: { animated: boolean; wind: SharedValue<number> }) {
  const bands = [
    { top: '8%', height: 220, opacity: 0.1, sensitivity: 40 },
    { top: '38%', height: 170, opacity: 0.07, sensitivity: -55 },
    { top: '62%', height: 200, opacity: 0.09, sensitivity: 30 },
  ] as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bands.map((band, index) => (
        <MistBand key={index} band={band} animated={animated} wind={wind} />
      ))}
    </View>
  );
}
function MistBand({ band, animated, wind }: { band: { top: DimensionValue; height: number; opacity: number; sensitivity: number }; animated: boolean; wind: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: animated ? (wind.value - 0.5) * band.sensitivity : 0 }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: band.top, left: '-15%', right: '-15%', height: band.height, borderRadius: band.height / 2, backgroundColor: '#F4F8F6', opacity: band.opacity },
        style,
      ]}
    />
  );
}

// A single leaf photo, reused with size/rotation/flip/tint variation to read
// as several distinct leaves rather than one sprite copy-pasted. Lanes near
// the screen edges are real "exposed background" — outside where the message
// list or composer ever renders — so only those are draggable; center-lane
// leaves are purely decorative and never intercept touches, no matter what
// they happen to be drifting over.
function Particle({ index, height, width, preview, quiet, count, wind }: { index: number; height: number; width: number; preview: boolean; quiet: boolean; count: number; wind: SharedValue<number> }) {
  const { preferences, palette } = useAppearance();
  const allowed = useMotionAllowed();
  const progress = useSharedValue(seedFrac(index));
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  const leaf = preferences.season === 'monsoon' || preferences.season === 'lateAutumn';
  const lanePct = ((index + 0.5) / count) * 100 + (seedFrac(index * 9.1) - 0.5) * (100 / count) * 0.6;
  const gutter = lanePct < 15 || lanePct > 85;
  const depth = seedFrac(index * 6.4); // 0 = distant/small, 1 = near/large
  const size = preview ? 40 : 13 + depth * 22;
  const duration = (preview ? 16000 : 15000 + (1 - depth) * 14000) + seedFrac(index * 2.6) * 5000;
  const spin = seedFrac(index * 3.9) > 0.5 ? 1 : -1;
  const flip = seedFrac(index * 8.8) > 0.5;
  const flutterAmp = 10 + seedFrac(index * 4.7) * 18;
  const flutterFreq = 2 + seedFrac(index * 1.3) * 2.5;
  const windSensitivity = 14 + seedFrac(index * 5.5) * 20;

  // Subtle keeps scenery static but still touchable; Still turns off both
  // motion and the drag gesture entirely; only Full actually falls.
  const moving = allowed && !quiet && preferences.motion === 'full';
  const draggable = leaf && allowed && !quiet && preferences.interactive && preferences.motion !== 'still' && gutter;

  useEffect(() => {
    if (moving) progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    else cancelAnimation(progress);
    return () => cancelAnimation(progress);
  }, [moving, duration, progress]);

  const gestures = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => draggable,
        onMoveShouldSetPanResponder: () => draggable,
        onPanResponderGrant: () => cancelAnimation(progress),
        onPanResponderMove: (_, gesture) => {
          dx.value = Math.max(-90, Math.min(90, gesture.dx));
          dy.value = Math.max(-140, Math.min(140, gesture.dy));
        },
        onPanResponderRelease: () => {
          dx.value = withTiming(0, { duration: 900 });
          dy.value = withTiming(0, { duration: 900 });
          if (moving) progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
        },
        onPanResponderTerminate: () => {
          dx.value = 0;
          dy.value = 0;
          if (moving) progress.value = withRepeat(withTiming(1, { duration }), -1, false);
        },
      }),
    [draggable, moving, duration, dx, dy, progress]
  );

  const animated = useAnimatedStyle(() => {
    const p = progress.value;
    const flutter = Math.sin(p * Math.PI * 2 * flutterFreq) * flutterAmp;
    return {
      opacity: (quiet ? 0.12 : 0.6) * edgeFade(p, 0.06),
      transform: [
        { translateY: p * (height + size * 2) - size },
        { translateX: dx.value + flutter * 0.3 + (wind.value - 0.5) * windSensitivity },
        { rotate: `${spin * (index * 41 + p * 220 + flutter)}deg` },
        { scaleX: flip ? -1 : 1 },
      ],
    };
  });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value }] }));

  const left = (preview ? `${(index * 31 + 7) % 85}%` : `${Math.max(0, Math.min(96, lanePct))}%`) as DimensionValue;
  return (
    <Animated.View
      {...gestures.panHandlers}
      pointerEvents={draggable ? 'auto' : 'none'}
      accessible={false}
      style={[{ position: 'absolute', top: 0, left, width: size, height: size }, animated, dragStyle]}
    >
      {leaf ? (
        <RNImage
          source={require('../../assets/seasons/forest-leaf.png')}
          resizeMode="contain"
          style={{ width: size, height: size, tintColor: preferences.season === 'lateAutumn' ? '#B38A41' : undefined }}
        />
      ) : (
        <View
          style={{
            width: preferences.season === 'winter' ? 5 : size * 0.65,
            height: preferences.season === 'winter' ? 8 : preferences.season === 'spring' ? size * 0.4 : 3,
            borderRadius: 18,
            backgroundColor: palette.glow,
            opacity: 0.7,
            transform: [{ rotate: '35deg' }],
          }}
        />
      )}
    </Animated.View>
  );
}

// Interactive leaves are limited to the outer lanes (real exposed background,
// not just an arbitrary edge column) so they never sit over the message list
// or composer; every particle stays pointerEvents:none unless it's both a
// leaf and in one of those lanes. The scene's own root view is box-none, so
// nothing here ever blocks scrolling, typing, long-presses, or buttons.
export function SeasonScene({ preview = false, layer = 'all' }: { preview?: boolean; layer?: 'all' | 'background' | 'particles' }) {
  const { palette, preferences, dark } = useAppearance();
  const allowed = useMotionAllowed();
  const [size, setSize] = useState({ width: 360, height: 600 });
  const [quiet, setQuiet] = useState(Keyboard.isVisible());
  const wind = useDrift(10000);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setQuiet(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setQuiet(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const monsoon = preferences.season === 'monsoon';
  const weatherAnimated = allowed && !quiet && preferences.motion === 'full';
  const rainCount = preferences.motion === 'full' ? 16 : preferences.motion === 'subtle' ? 7 : 0;
  const particleCount = preferences.motion === 'full' ? 10 : preferences.motion === 'subtle' ? 5 : 4;

  return (
    <View
      pointerEvents="box-none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {layer !== 'particles' && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {monsoon ? (
            <>
              <MeshBackground season="monsoon" dark={dark} width={size.width} height={size.height} motion={preferences.motion} quiet={quiet} />
              <MistLayer animated={weatherAnimated} wind={wind} />
              <RainLayer height={size.height} count={rainCount} animated={weatherAnimated} wind={wind} />
            </>
          ) : (
            <>
              {(preferences.season === 'winter' || preferences.season === 'lateAutumn' || preferences.season === 'autumn') && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {[0, 1, 2].map((index) => (
                    <View
                      key={index}
                      style={{
                        position: 'absolute',
                        top: `${20 + index * 27}%`,
                        left: -80 + index * 40,
                        width: 500,
                        height: preferences.season === 'autumn' ? 90 : 130,
                        borderRadius: 100,
                        backgroundColor: palette.glow,
                        opacity: 0.07,
                      }}
                    />
                  ))}
                </View>
              )}
              <View pointerEvents="none" style={{ position: 'absolute', top: -140, right: -100, width: 420, height: 420, borderRadius: 210, backgroundColor: palette.glow, opacity: preferences.season === 'winter' ? 0.08 : 0.12 }} />
              <View pointerEvents="none" style={{ position: 'absolute', bottom: -140, left: -140, width: 420, height: 420, borderRadius: 210, backgroundColor: palette.accent, opacity: 0.07 }} />
            </>
          )}
        </View>
      )}
      {layer !== 'background' &&
        Array.from({ length: particleCount }, (_, index) => (
          <Particle key={`${preferences.season}-${index}`} index={index} height={size.height} width={size.width} preview={preview} quiet={quiet} count={particleCount} wind={wind} />
        ))}
    </View>
  );
}
