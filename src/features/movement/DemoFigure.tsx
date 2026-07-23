/**
 * Animated positioning demo — a side-view stick figure looping reps of the
 * chosen exercise so the athlete instantly sees how to stand relative to the
 * camera. Drawn in the same visual language as the live skeleton overlay
 * (polyline + joint dots), pure Reanimated: no re-renders while looping.
 */

import React, { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useTheme } from '@/shared/ui';

import type { WorkoutExercise } from './workoutSession';

type Pt = readonly [number, number];
type Pose = {
  head: Pt;
  shoulder: Pt;
  elbow: Pt;
  wrist: Pt;
  hip: Pt;
  knee: Pt;
  ankle: Pt;
};

/** Side-view keyframes in a normalized 0..1 box (x → right, y → down). */
const PUSHUP_UP: Pose = {
  head: [0.2, 0.52],
  shoulder: [0.32, 0.58],
  elbow: [0.32, 0.7],
  wrist: [0.32, 0.82],
  hip: [0.55, 0.64],
  knee: [0.71, 0.69],
  ankle: [0.86, 0.75],
};
const PUSHUP_DOWN: Pose = {
  head: [0.21, 0.69],
  shoulder: [0.33, 0.74],
  elbow: [0.43, 0.79],
  wrist: [0.32, 0.82],
  hip: [0.56, 0.73],
  knee: [0.72, 0.76],
  ankle: [0.86, 0.78],
};
const SQUAT_UP: Pose = {
  head: [0.5, 0.14],
  shoulder: [0.5, 0.27],
  elbow: [0.5, 0.4],
  wrist: [0.5, 0.51],
  hip: [0.5, 0.52],
  knee: [0.5, 0.68],
  ankle: [0.5, 0.84],
};
const SQUAT_DOWN: Pose = {
  head: [0.46, 0.32],
  shoulder: [0.47, 0.43],
  elbow: [0.58, 0.49],
  wrist: [0.69, 0.49],
  hip: [0.4, 0.6],
  knee: [0.55, 0.7],
  ankle: [0.5, 0.84],
};

const FLOOR_Y: Record<WorkoutExercise, number> = { pushups: 0.85, squats: 0.87 };

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Interpolated point in SVG viewBox units (0..100). */
function joint(up: Pose, down: Pose, key: keyof Pose, t: number): { x: number; y: number } {
  'worklet';
  return {
    x: lerp(up[key][0], down[key][0], t) * 100,
    y: lerp(up[key][1], down[key][1], t) * 100,
  };
}

export function DemoFigure({ exercise }: { exercise: WorkoutExercise }) {
  const { colors } = useTheme();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    // One rep ≈ 2 s, looping until the athlete starts — «пару повторов» on
    // repeat beats exactly two: the demo is there as long as it is needed.
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t, exercise]);

  const up = exercise === 'pushups' ? PUSHUP_UP : SQUAT_UP;
  const down = exercise === 'pushups' ? PUSHUP_DOWN : SQUAT_DOWN;

  const bodyProps = useAnimatedProps(() => {
    const p = t.value;
    const s = joint(up, down, 'shoulder', p);
    const h = joint(up, down, 'hip', p);
    const k = joint(up, down, 'knee', p);
    const a = joint(up, down, 'ankle', p);
    return {
      points: `${s.x},${s.y} ${h.x},${h.y} ${k.x},${k.y} ${a.x},${a.y}`,
    };
  });

  const armProps = useAnimatedProps(() => {
    const p = t.value;
    const s = joint(up, down, 'shoulder', p);
    const e = joint(up, down, 'elbow', p);
    const w = joint(up, down, 'wrist', p);
    return {
      points: `${s.x},${s.y} ${e.x},${e.y} ${w.x},${w.y}`,
    };
  });

  const headProps = useAnimatedProps(() => {
    const p = t.value;
    const h = joint(up, down, 'head', p);
    return { cx: h.x, cy: h.y };
  });

  const floorY = FLOOR_Y[exercise] * 100;

  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <Line
        x1={8}
        y1={floorY}
        x2={92}
        y2={floorY}
        stroke={colors.border}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <AnimatedPolyline
        animatedProps={bodyProps}
        fill="none"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <AnimatedPolyline
        animatedProps={armProps}
        fill="none"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <AnimatedCircle animatedProps={headProps} r={5.5} fill={colors.primary} />
    </Svg>
  );
}
