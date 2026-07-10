import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { useTheme } from './ThemeProvider';
import { fonts, radii } from './tokens';

type AvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  /** Frame slot — premium/earned frames render as a ring (Phase 7). */
  frameColor?: string | null;
};

function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, imageUrl, size = 64, frameColor }: AvatarProps) {
  const { colors } = useTheme();
  const ring = frameColor ?? colors.border;

  return (
    <View
      style={[
        styles.frame,
        {
          width: size + 6,
          height: size + 6,
          borderRadius: radii.pill,
          borderColor: ring,
        },
      ]}
      accessibilityLabel={name ?? undefined}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: radii.pill }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: size,
              height: size,
              borderRadius: radii.pill,
              backgroundColor: colors.primarySoft,
            },
          ]}
        >
          <AppText
            style={{
              fontFamily: fonts.displaySemi,
              fontSize: size * 0.38,
              color: colors.primary,
            }}
          >
            {initials(name)}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
