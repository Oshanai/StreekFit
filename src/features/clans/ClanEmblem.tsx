/**
 * Preset clan emblems — six simple SVG marks in a tinted circle. Codes match
 * the DB check constraint; никаких пользовательских картинок в MVP.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/shared/ui';

import type { ClanEmblemCode } from './api';

const PATHS: Record<ClanEmblemCode, string> = {
  flame:
    'M12 3c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1.5-.8-2.4-.8-2.4S17 10 17 13a5 5 0 0 1-10 0c0-4.5 4-6 5-10Z',
  bolt: 'M13 2 5 13h5l-1 9 8-11h-5l1-9Z',
  mountain: 'M3 19 9.5 7l3 5.5L15 9l6 10H3Z',
  wolf: 'M4 5l4 3h8l4-3-1.5 6.5L12 20 5.5 11.5 4 5Zm6 8h.01M14 13h.01',
  star: 'm12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7L12 3Z',
  crown: 'M4 8l4 4 4-6 4 6 4-4-1.5 10h-13L4 8Z',
};

export function ClanEmblem({ code, size = 48 }: { code: ClanEmblemCode; size?: number }) {
  const { colors } = useTheme();
  const icon = size * 0.58;
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primarySoft,
        },
      ]}
    >
      <Svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
        <Path
          d={PATHS[code]}
          stroke={colors.primary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
