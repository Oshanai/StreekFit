/**
 * The living streak flame — retention through attachment (TZ §0: стрик как
 * центральная механика). The flame literally GROWS with the streak:
 *
 *   0 дней  — тлеющий уголёк (приглушённый, маленький)
 *   1–6     — обычное пламя
 *   7–29    — уверенное пламя (бронзовый рубеж пройден)
 *   30–99   — большое золотое пламя
 *   100+    — легендарное фиолетовое
 *
 * A live flame breathes (gentle scale loop); the ember does not.
 */

import React, { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { tierColors, useTheme } from '@/shared/ui';

const FLAME_PATH =
  'M12 2c.5 4-2.5 5.5-3.5 8C7.5 12.5 8 15 10 16.5c-.2-1.8.4-3 1.5-4 .3 2.2 2.3 2.7 2.5 5 .1 1.4-.6 2.6-1.5 3.5 3.5-.5 6-3.2 6-7 0-4.5-4-5.5-4-10-1.5 1-2.3 2.5-2.5 4C11 5.5 11.5 3.8 12 2Z';

function flameLook(streak: number, colors: { border: string; streakFlame: string; primary: string }) {
  if (streak >= 100) return { size: 34, color: tierColors[5] };
  if (streak >= 30) return { size: 30, color: tierColors[3] };
  if (streak >= 7) return { size: 26, color: colors.primary };
  if (streak >= 1) return { size: 22, color: colors.streakFlame };
  return { size: 18, color: colors.border };
}

export function StreakFlame({ streak }: { streak: number }) {
  const { colors } = useTheme();
  const { size, color } = flameLook(streak, colors);

  const scale = useSharedValue(1);
  useEffect(() => {
    if (streak <= 0) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(scale);
  }, [streak, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={FLAME_PATH} fill={color} opacity={streak > 0 ? 1 : 0.6} />
      </Svg>
    </Animated.View>
  );
}
