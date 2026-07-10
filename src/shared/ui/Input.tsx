import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from './AppText';
import { useTheme } from './ThemeProvider';
import { fonts, radii, spacing } from './tokens';

type InputProps = TextInputProps & {
  label: string;
  error?: string | null;
  /** Persistent helper text below the field (not placeholder-only). */
  helper?: string;
};

export function Input({ label, error, helper, style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      <AppText variant="micro" color="secondary" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor,
            color: colors.textPrimary,
          },
          style,
        ]}
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <AppText variant="micro" color="error" accessibilityRole="alert" style={styles.below}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="micro" color="secondary" style={styles.below}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  below: {
    marginTop: 2,
  },
});
