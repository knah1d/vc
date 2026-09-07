import { ActivityIndicator, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LiftPressable } from './motion';
import { useState } from 'react';

export function FormInput({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      selectionColor={theme.tint}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={[
        styles.input,
        { borderColor: focused ? theme.tint : theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
        style,
      ]}
      {...props}
    />
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <LiftPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: theme.accent, borderColor: theme.tint, borderWidth: 1, opacity: disabled || loading ? 0.6 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>{title}</ThemedText>}
    </LiftPressable>
  );
}

export function FormError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <ThemedText role="alert" style={{ color: theme.danger }}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
  },
  button: {
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
