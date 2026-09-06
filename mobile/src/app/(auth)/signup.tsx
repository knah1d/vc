import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError, FormInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SignupScreen() {
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signup(email.trim(), password, displayName.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <SafeAreaView style={styles.container}>
          <ThemedText type="title" style={styles.title}>
            hush.
          </ThemedText>
          <ThemedText type="subtitle">Your circle starts here.</ThemedText>

          <FormInput
            placeholder="What should we call you?"
            autoComplete="name"
            maxLength={60}
            value={displayName}
            onChangeText={setDisplayName}
          />
          <FormInput
            placeholder="Email address"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <FormInput
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />

          {error && <FormError message={error} />}

          <PrimaryButton
            title="Create account"
            onPress={handleSubmit}
            loading={loading}
            disabled={!displayName || !email || password.length < 8}
          />

          <Link href="/(auth)/login" style={styles.link}>
            <ThemedText themeColor="textSecondary">
              Already part of the circle? <ThemedText themeColor="tint">Log in</ThemedText>
            </ThemedText>
          </Link>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 40 },
  link: { alignSelf: 'center', marginTop: Spacing.two },
});
