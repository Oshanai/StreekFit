import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import { radii, spacing } from './tokens';

type CardProps = ViewProps & {
  /** Raised cards sit above regular surfaces (sheets, popovers). */
  raised?: boolean;
};

export function Card({ raised = false, style, children, ...rest }: CardProps) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: raised ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
        },
        // Shadows only in light theme; dark theme separates via border + surface tone.
        theme === 'light' && raised && styles.lightShadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  lightShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
