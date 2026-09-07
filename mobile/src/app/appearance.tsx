import { ScrollView, View, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmbientScreen, GlassCard } from '@/components/mobile-ui';
import { LiftPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { SeasonScene } from '@/components/season-scene';
import { seasons, useAppearance, type Appearance } from '@/context/AppearanceContext';

export default function AppearanceScreen() {
  const { preferences, update, palette, saveError } = useAppearance();
  const insets = useSafeAreaInsets();
  function options<T extends string>(values: readonly T[], current: T, change: (value: T) => void) {
    return <View style={{ flexDirection: 'row', gap: 8 }}>{values.map(value => <LiftPressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === current }} onPress={() => change(value)} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: value === current ? palette.backgroundSelected : palette.backgroundElement, borderWidth: 1, borderColor: value === current ? palette.tint : palette.border }}><ThemedText style={{ textTransform: 'capitalize', fontSize: 13 }}>{value}</ThemedText></LiftPressable>)}</View>;
  }
  return <AmbientScreen><ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 20 }}>
    <View style={{ height: 170, borderRadius: 28, overflow: 'hidden', backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border }}>
      <View pointerEvents="none" style={{ margin: 28, gap: 12 }}><View style={{ borderRadius: 18, padding: 14, backgroundColor: palette.backgroundElement, alignSelf: 'flex-start' }}><ThemedText>Hey 👋</ThemedText></View><View style={{ borderRadius: 18, padding: 14, backgroundColor: palette.accent, alignSelf: 'flex-end' }}><ThemedText style={{ color: '#fff' }}>🌿 ✓✓</ThemedText></View></View>
      <SeasonScene preview />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{(Object.keys(seasons) as Appearance['season'][]).map(key => <LiftPressable key={key} onPress={() => update({ season: key })} accessibilityRole="button" accessibilityLabel={seasons[key].name} accessibilityState={{ selected: preferences.season === key }} style={{ width: '48%', flexGrow: 1, padding: 16, gap: 12, borderRadius: 22, backgroundColor: seasons[key].light, borderWidth: 2, borderColor: preferences.season === key ? seasons[key].accent : 'transparent' }}><ThemedText style={{ fontSize: 30, lineHeight: 38 }}>{seasons[key].icon}</ThemedText><ThemedText style={{ color: seasons[key].accent, fontSize: 14, fontWeight: '600' }}>{seasons[key].name}{preferences.season === key ? ' ✓' : ''}</ThemedText></LiftPressable>)}</View>
    <ThemedText type="subtitle">Display</ThemedText>
    {options(['system', 'light', 'dark'] as const, preferences.mode, mode => update({ mode }))}
    <ThemedText type="subtitle">Motion</ThemedText>
    {options(['full', 'subtle', 'still'] as const, preferences.motion, motion => update({ motion }))}
    <GlassCard style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><ThemedText>Touch leaves</ThemedText><Switch accessibilityLabel="Touch leaves" value={preferences.interactive} onValueChange={interactive => update({ interactive })} trackColor={{ true: palette.accent }} /></GlassCard>
    {saveError && <ThemedText role="alert" themeColor="danger">Could not save appearance. Try changing it again.</ThemedText>}
  </ScrollView></AmbientScreen>;
}
