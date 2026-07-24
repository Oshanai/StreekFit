import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppText } from './AppText';
import { ScalePressable } from './Pressable';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, radii, spacing } from './tokens';

type ButtonVariant = 'primary' | 'gradient' | 'secondary' | 'ghost' | 'translucent';

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
    gradient: { backgroundColor: colors.primary, overflow: 'hidden' as const },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ghost: { backgroundColor: 'transparent' },
    // Reads on ANY background (camera feed, map tiles) — §MASTER media rule.
    translucent: { backgroundColor: colors.overlay },
  }[variant];

  const textColor =
    variant === 'primary' || variant === 'gradient'
      ? colors.onPrimary
      : variant === 'translucent'
        ? colors.onOverlay
        : colors.textPrimary;

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
        {variant === 'gradient' ? (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="btn-grad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.primaryGradient[0]} />
                <Stop offset="1" stopColor={colors.primaryGradient[1]} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#btn-grad)" />
          </Svg>
        ) : null}
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
