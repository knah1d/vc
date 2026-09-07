import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthShell } from '@/components/auth-shell';

import { FormError, FormInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Log in" action={<PrimaryButton title="Log in" onPress={handleSubmit} loading={loading} disabled={!email || !password} />}>

          <FormInput
            placeholder="Email address"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <FormInput
            placeholder="Password"
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />

          {error && <FormError message={error} />}


          <Link href="/(auth)/signup" style={styles.link}>
            <ThemedText themeColor="textSecondary">
              New around here? <ThemedText themeColor="tint">Create an account</ThemedText>
            </ThemedText>
          </Link>
    </AuthShell>
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
