import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthShell } from '@/components/auth-shell';

import { FormError, FormInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
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
    if (loading) return;
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
    <AuthShell title="Your circle starts here." subtitle="Make a little room for the people who matter.">

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
