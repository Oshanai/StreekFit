import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { ScalePressable } from './Pressable';
import { useTheme } from './ThemeProvider';
import { radii, spacing } from './tokens';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityRole?: 'radio' | 'checkbox' | 'button';
};

/** Selectable option chip: language switcher, gender, filters. */
export function Chip({ label, selected, onPress, accessibilityRole = 'radio' }: ChipProps) {
  const { colors } = useTheme();

  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <AppText variant="bodyBold" color={selected ? 'accent' : 'primary'}>
          {label}
        </AppText>
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});
