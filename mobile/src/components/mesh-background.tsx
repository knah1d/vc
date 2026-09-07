import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { seasons } from '@/context/AppearanceContext';
import { useMotionAllowed } from './motion';

// Per-season gradient blob colors, derived from the existing accent/glow/light/dark
// palette in AppearanceContext — kept local here rather than restructuring that file.
// Each list is [deepest, mid, accent, wash], outer stop always transparent.
const MESH: Record<keyof typeof seasons, { dark: string[]; light: string[] }> = {
  summer: { dark: ['#3A2A12', '#6B4A1E', '#B76421'], light: ['#FFE8B8', '#FFD79A', '#F5BE63'] },
  monsoon: { dark: ['#0E1B16', '#16332A', '#267458'], light: ['#DCEFE3', '#BFE0CE', '#87CBA4'] },
  autumn: { dark: ['#0E1A22', '#1C3B4C', '#367799'], light: ['#D6EDF7', '#B7DEF0', '#A4D5E9'] },
  lateAutumn: { dark: ['#1C160C', '#4A3418', '#93652C'], light: ['#F3E3C2', '#EAD4A0', '#DEB977'] },
  winter: { dark: ['#0B1417', '#1E3338', '#547982'], light: ['#DCEDEE', '#C4DEE0', '#BCDADB'] },
  spring: { dark: ['#1C1017', '#4A2536', '#AE5578'], light: ['#FBDDEA', '#F5C1DA', '#ECB2CB'] },
};

// One soft radial blob, slowly orbiting an anchor point. Coordinates are
// fractions of the canvas size so blobs stay well-placed at any screen size.
function Blob({
  width,
  height,
  color,
  anchor,
  radius,
  orbit,
  duration,
  phase,
  animated,
}: {
  width: number;
  height: number;
  color: string;
  anchor: { x: number; y: number };
  radius: number;
  orbit: number;
  duration: number;
  phase: number;
  animated: boolean;
}) {
  const progress = useSharedValue(phase);
  useEffect(() => {
    if (animated) progress.value = withRepeat(withTiming(phase + 1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    else cancelAnimation(progress);
    return () => cancelAnimation(progress);
  }, [animated, duration, phase, progress]);

  const center = useDerivedValue(() => {
    const angle = progress.value * Math.PI * 2;
    return vec(anchor.x * width + Math.cos(angle) * orbit * width, anchor.y * height + Math.sin(angle) * orbit * height);
  });
  const r = radius * Math.max(width, height);

  return (
    <Circle c={center} r={r}>
      <RadialGradient c={center} r={r} colors={[color, `${color}00`]} />
    </Circle>
  );
}

// Animated seasonal mesh gradient — replaces literal photo scenery with a
// soft, color-graded blend of the season's own palette. Slow blob drift is
// gated by the Full/Subtle/Still motion setting exactly like other ambient
// motion in the app; Subtle/Still render a frozen (but still present) mesh.
export function MeshBackground({ season, dark, width, height, motion, quiet }: { season: keyof typeof seasons; dark: boolean; width: number; height: number; motion: 'full' | 'subtle' | 'still'; quiet: boolean }) {
  const allowed = useMotionAllowed() && motion === 'full' && !quiet;
  const colors = dark ? MESH[season].dark : MESH[season].light;
  const base = dark ? colors[0] : colors[2];

  if (width <= 0 || height <= 0) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group>
        <Circle cx={width / 2} cy={height / 2} r={Math.max(width, height)}>
          <RadialGradient c={vec(width / 2, height / 2)} r={Math.max(width, height)} colors={[base, base]} />
        </Circle>
        <Blob width={width} height={height} color={colors[1]} anchor={{ x: 0.18, y: 0.22 }} radius={0.62} orbit={0.06} duration={16000} phase={0} animated={allowed} />
        <Blob width={width} height={height} color={colors[2]} anchor={{ x: 0.82, y: 0.3 }} radius={0.55} orbit={0.05} duration={19000} phase={0.4} animated={allowed} />
        <Blob width={width} height={height} color={colors[0]} anchor={{ x: 0.3, y: 0.85 }} radius={0.6} orbit={0.055} duration={21000} phase={0.7} animated={allowed} />
        <Blob width={width} height={height} color={colors[1]} anchor={{ x: 0.75, y: 0.9 }} radius={0.5} orbit={0.045} duration={17500} phase={0.15} animated={allowed} />
      </Group>
    </Canvas>
  );
}
