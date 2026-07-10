import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from './ThemeProvider';
import { spacing } from './tokens';

type ScreenProps = ViewProps & {
  /** Skip bottom inset when the screen sits inside a tab bar. */
  insideTabs?: boolean;
};

export function Screen({ insideTabs = false, style, children, ...rest }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insideTabs ? 0 : insets.bottom,
        },
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
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
