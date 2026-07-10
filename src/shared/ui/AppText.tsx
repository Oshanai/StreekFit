import React from 'react';
import { Text, type TextProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import { typeScale, type TextVariant } from './tokens';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'disabled' | 'accent' | 'error' | 'success';
  /** Tabular figures for scores, timers, ranks — prevents layout shift. */
  tabular?: boolean;
};

export function AppText({
  variant = 'body',
  color = 'primary',
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();

  const colorValue = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    disabled: colors.textDisabled,
    accent: colors.primary,
    error: colors.error,
    success: colors.success,
  }[color];

  return (
    <Text
      style={[
        typeScale[variant],
        { color: colorValue },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    />
  );
}
