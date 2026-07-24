/**
 * Badge visual language (TZ §1.6/§8): a silhouette inside a circle with the
 * tier carried by the ring colour (бронза → легенда). Locked badges render
 * with a dashed ring and dimmed silhouette. `pop` plays the unlock
 * micro-animation (springy scale-in) on mount.
 */

import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { tierColors, useTheme } from '@/shared/ui';

import type { BadgeCode, Tier } from './catalog';

/** Stroke silhouettes in a 24×24 box — same visual language as tab icons. */
const SILHOUETTES: Record<BadgeCode, string> = {
  // plank figure: ground + straight body over it
  volume_pushups: 'M4 17h16M6.5 14.5l3-4.5 5.5 1 4-3.5M9.5 10a1.4 1.4 0 1 0 0-.01',
  // squat figure: bent knees, hips back
  volume_squats: 'M9 5a1.5 1.5 0 1 0 .01 0M9.5 8.5l-1 4 4 1-1 4.5M8.5 12.5l4-1 3 2.5',
  // plank + bolt: one max effort
  single_pushups: 'M5 18h14M7 15.5l3-4 4.5 1 3.5-3M14 4l-2.5 3.5h3L12 11',
  // squat + bolt
  single_squats: 'M8 6a1.3 1.3 0 1 0 .01 0M8.5 9l-1 3.5 3.5 1-1 4M16 4l-2.5 3.5h3L14 11',
  // flame (streak) — echoes the Today tab
  streak_days:
    'M12 4c.4 3-2 4.2-2.8 6.2-.7 1.9-.3 3.8 1.3 5-.2-1.4.3-2.3 1.2-3.1.2 1.7 1.8 2.1 2 3.9.1 1.1-.5 2-1.2 2.7 2.8-.4 4.8-2.5 4.8-5.5 0-3.5-3.2-4.3-3.2-7.8-1.2.8-1.9 2-2.1 3.2-.4-1.5 0-2.9 0-3.6Z',
  // walking shoe
  volume_steps: 'M4 16.5h16M5 14.5c3 0 4-3.5 6-3.5 1.5 0 1.5 1.5 3.5 2 1.7.4 3.5.5 4.5 1.5',
};

export function Badge({
  code,
  tier,
  size = 64,
  locked = false,
  pop = false,
}: {
  code: BadgeCode;
  tier: Tier;
  size?: number;
  locked?: boolean;
  pop?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(pop ? 0.3 : 1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!pop) return;
    scale.value = withSequence(
      withTiming(1.15, { duration: 340, easing: Easing.out(Easing.back(2.2)) }),
      withTiming(1, { duration: 180 }),
    );
    glow.value = withSequence(
      withTiming(1, { duration: 340 }),
      withDelay(500, withTiming(0, { duration: 600 })),
    );
  }, [pop, scale, glow]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value * 0.9,
  }));

  const ring = locked ? colors.border : tierColors[tier];
  const figure = locked ? colors.textDisabled : colors.textPrimary;
  const r = 10.4;

  return (
    <Animated.View style={[{ shadowColor: tierColors[tier], shadowRadius: 12 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle
          cx={12}
          cy={12}
          r={r}
          stroke={ring}
          strokeWidth={locked ? 1.4 : 1.9}
          strokeDasharray={locked ? '3 3' : undefined}
          fill={locked ? 'none' : colors.surfaceRaised}
        />
        <Path
          d={SILHOUETTES[code]}
          stroke={figure}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={locked ? 0.45 : 1}
          transform="translate(2.4 2.4) scale(0.8)"
        />
      </Svg>
    </Animated.View>
  );
}
