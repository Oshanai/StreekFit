import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { ScalePressable } from './Pressable';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, radii, spacing } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const isBlocked = disabled || loading;

  const containerStyle: ViewStyle = {
    primary: { backgroundColor: colors.primary },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ghost: { backgroundColor: 'transparent' },
  }[variant];

  const textColor = variant === 'primary' ? colors.onPrimary : colors.textPrimary;

  return (
    <ScalePressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
    >
      <View
        style={[
          styles.base,
          containerStyle,
          isBlocked && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <AppText variant="bodyBold" style={{ color: textColor }}>
            {label}
          </AppText>
        )}
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(48, MIN_TOUCH),
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});
