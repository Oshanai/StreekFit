import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { ScalePressable } from './Pressable';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, fonts, radii, spacing } from './tokens';

type StepButtonProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ label, disabled, onPress }: StepButtonProps) {
  const { colors } = useTheme();

  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View
        style={[
          styles.button,
          { backgroundColor: colors.surface, borderColor: colors.border },
          disabled && styles.disabled,
        ]}
      >
        <AppText variant="h3" color={disabled ? 'disabled' : 'accent'}>
          {label}
        </AppText>
      </View>
    </ScalePressable>
  );
}

type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Adds ±bigStep buttons for longer ranges. */
  bigStep?: number;
};

export function Stepper({ value, onChange, min = 0, max = 200, step = 1, bigStep }: StepperProps) {
  const { colors } = useTheme();

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const change = (delta: number) => onChange(clamp(value + delta));
  const stuck = (delta: number) => clamp(value + delta) === value;

  return (
    <View style={styles.row}>
      {bigStep ? (
        <StepButton label={`−${bigStep}`} disabled={stuck(-bigStep)} onPress={() => change(-bigStep)} />
      ) : null}
      <StepButton label="−" disabled={stuck(-step)} onPress={() => change(-step)} />
      <View style={styles.valueBox}>
        <AppText
          tabular
          style={{
            fontFamily: fonts.display,
            fontSize: 44,
            lineHeight: 50,
            color: colors.textPrimary,
          }}
        >
          {value}
        </AppText>
      </View>
      <StepButton label="+" disabled={stuck(step)} onPress={() => change(step)} />
      {bigStep ? (
        <StepButton label={`+${bigStep}`} disabled={stuck(bigStep)} onPress={() => change(bigStep)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  button: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  disabled: {
    opacity: 0.4,
  },
  valueBox: {
    minWidth: 96,
    alignItems: 'center',
  },
});
