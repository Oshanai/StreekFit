import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from './ThemeProvider';
import { spacing } from './tokens';

type ScreenProps = ViewProps & {
  /** Skip bottom inset when the screen sits inside a tab bar. */
  insideTabs?: boolean;
};

export function Screen({ insideTabs = false, style, children, ...rest }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Themes may paint the backdrop as a vertical gradient (e.g. «Аметист»);
  // equal stops mean flat — skip the SVG layer entirely.
  const hasGradient = colors.bgGradient[0] !== colors.bgGradient[1];

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
      {hasGradient ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="screen-bg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bgGradient[0]} />
              <Stop offset="1" stopColor={colors.bgGradient[1]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#screen-bg)" />
        </Svg>
      ) : null}
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
