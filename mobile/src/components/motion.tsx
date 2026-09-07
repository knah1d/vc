import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, AppState, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useAppearance } from '@/context/AppearanceContext';

export const MotionContext = createContext(false);
export const useMotionAllowed = () => useContext(MotionContext);

export function MotionProvider({ children }: PropsWithChildren) {
  const { preferences } = useAppearance();
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); }).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const foreground = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => { mounted = false; preference.remove(); foreground.remove(); };
  }, []);
  return <MotionContext.Provider value={active && !reduced && preferences.motion !== 'still'}>{children}</MotionContext.Provider>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Transform-only springs keep tactile feedback off the JS render path.
export function LiftPressable({ style, children, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style' | 'children'> & PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const motion = useMotionAllowed();
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { scale: 1 - press.value * 0.035 }, { rotateX: `${press.value * 3}deg` }, { translateY: -press.value * 2 }],
  }));
  useEffect(() => { if (!motion) { cancelAnimation(press); press.value = 0; } }, [motion, press]);
  return <AnimatedPressable {...props} style={[style, animated]}
    onPressIn={(event) => { if (motion) press.value = withSpring(1, { damping: 18, stiffness: 300 }); onPressIn?.(event); }}
    onPressOut={(event) => { press.value = withSpring(0, { damping: 12, stiffness: 220 }); onPressOut?.(event); }}>
    {children}
  </AnimatedPressable>;
}

export function Reveal({ children, delay = 0, style }: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const motion = useMotionAllowed();
  const progress = useSharedValue(motion ? 0 : 1);
  useEffect(() => {
    if (motion) { progress.value = 0; progress.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })); }
    else { cancelAnimation(progress); progress.value = 1; }
    return () => cancelAnimation(progress);
  }, [motion, delay, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.97 + progress.value * 0.03 }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export function useDrift(duration = 12000) {
  const motion = useMotionAllowed();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (motion) drift.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    else { cancelAnimation(drift); drift.value = 0; }
    return () => cancelAnimation(drift);
  }, [motion, drift, duration]);
  return drift;
}
