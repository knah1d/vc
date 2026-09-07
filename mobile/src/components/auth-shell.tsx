import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { AmbientScreen, GlassCard } from './mobile-ui';
import { Reveal } from './motion';
import { ThemedText } from './themed-text';

export function AuthShell({ children, title, action }: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const keyboardPad = useAnimatedStyle(() => ({ paddingBottom: Math.max(keyboard.height.value, insets.bottom) }));
  const scroll = useRef<ScrollView>(null);
  const [editing, setEditing] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { setEditing(true); scroll.current?.scrollTo({ y: 0, animated: false }); });
    const hide = Keyboard.addListener('keyboardDidHide', () => setEditing(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <AmbientScreen><Animated.View style={[{ flex: 1 }, keyboardPad]}>
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}><ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ flexGrow: 1, justifyContent: editing ? 'flex-start' : 'center', padding: editing ? 16 : 24, gap: editing ? 12 : 28 }}>
      {!editing && <>
      <Reveal style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 }}>
        <ThemedText style={{ fontSize: 56, lineHeight: 64, letterSpacing: -3, fontWeight: '800' }}>hush.</ThemedText>
      </Reveal>
      </>}
      <Reveal delay={120} style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}><GlassCard style={{ padding: 24, gap: 16 }}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {children}
      </GlassCard></Reveal>
    </ScrollView>
    {action && <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8, width: '100%', maxWidth: 488, alignSelf: 'center' }}>{action}</View>}
    </SafeAreaView>
  </Animated.View></AmbientScreen>;
}
