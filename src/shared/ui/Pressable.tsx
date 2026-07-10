import React, { useCallback } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion } from './tokens';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

type ScalePressableProps = PressableProps & {
  children: React.ReactNode;
  /** Disable the scale-on-press feedback (e.g. inside swipeable rows). */
  noScale?: boolean;
};

/**
 * Pressable with the app-wide press feedback: subtle spring scale (HIG/MD
 * `scale-feedback`). All tappable surfaces should build on this.
 */
export function ScalePressable({
  children,
  noScale = false,
  onPressIn,
  onPressOut,
  ...rest
}: ScalePressableProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (!noScale) scale.value = withSpring(motion.pressScale, { damping: 20, stiffness: 400 });
      onPressIn?.(e);
    },
    [noScale, onPressIn, scale],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      if (!noScale) scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      onPressOut?.(e);
    },
    [noScale, onPressOut, scale],
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={animatedStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
