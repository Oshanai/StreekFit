import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fonts, useTheme } from '@/shared/ui';

function FlameIcon({ color, size = 24 }: { color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c.5 4-2.5 5.5-3.5 8C7.5 12.5 8 15 10 16.5c-.2-1.8.4-3 1.5-4 .3 2.2 2.3 2.7 2.5 5 .1 1.4-.6 2.6-1.5 3.5 3.5-.5 6-3.2 6-7 0-4.5-4-5.5-4-10-1.5 1-2.3 2.5-2.5 4C11 5.5 11.5 3.8 12 2Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BoltIcon({ color, size = 24 }: { color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 4.5 13.5h5.5L11 22l8.5-11.5H14L13 2Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonIcon({ color, size = 24 }: { color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9.5c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color }) => <FlameIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="move"
        options={{
          title: t('tabs.move'),
          tabBarIcon: ({ color }) => <BoltIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <PersonIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
