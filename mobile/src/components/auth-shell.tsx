import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientScreen, GlassCard } from './mobile-ui';
import { ThemedText } from './themed-text';

export function AuthShell({ children, title, subtitle }: PropsWithChildren<{ title: string; subtitle: string }>) {
  return <AmbientScreen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 }}>
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 }}>
        <ThemedText style={{ fontSize: 56, lineHeight: 64, letterSpacing: -3, fontWeight: '800' }}>hush.</ThemedText>
        <ThemedText themeColor="textSecondary" style={{ fontSize: 18, lineHeight: 27 }}>Less noise. More connection.</ThemedText>
      </View>
      <GlassCard style={{ width: '100%', maxWidth: 440, alignSelf: 'center', padding: 24, gap: 16 }}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText themeColor="textSecondary" style={{ marginBottom: 8 }}>{subtitle}</ThemedText>
        {children}
      </GlassCard>
      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 11, letterSpacing: 2 }}>MESSAGES · VOICE · FACE TO FACE</ThemedText>
    </ScrollView></SafeAreaView>
  </KeyboardAvoidingView></AmbientScreen>;
}
