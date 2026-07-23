/**
 * Positioning demo — a friendly cartoon athlete looping reps of the chosen
 * exercise so the user instantly sees how to set up and move.
 *
 * Proportions are human (head ≈ 1/8 of height, legs ≈ half), the style is
 * cartoon: chunky capsule limbs, sneakers, an eye dot. The scene includes a
 * soft reactive ground shadow, a phone glyph with its field-of-view cone, a
 * depth guide flashing green at counting range, and a «+1» chip popping at
 * every lockout — the demo counts its reps the way the live counter will.
 *
 * Every animated element is a NUMERIC-prop SVG node (Line/Circle/Ellipse):
 * string props like Polyline `points` silently never update through
 * animatedProps on the new architecture.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

import { AppText, useTheme } from '@/shared/ui';

import type { WorkoutExercise } from './workoutSession';

type Pt = readonly [number, number];
type Pose = {
  head: Pt;
  neck: Pt;
  shoulder: Pt;
  elbow: Pt;
  wrist: Pt;
  hip: Pt;
  knee: Pt;
  ankle: Pt;
  toe: Pt;
};
type Keyframes = readonly [Pose, Pose, Pose];

/** viewBox 0 0 200 160, ground y=140. Human proportions: head ≈ 1/8 height. */
const PUSHUP: Keyframes = [
  {
    head: [48, 93],
    neck: [56, 97.5],
    shoulder: [61, 100],
    elbow: [61, 118.5],
    wrist: [60, 136],
    hip: [102, 110],
    knee: [126, 117],
    ankle: [148, 126],
    toe: [154, 139],
  },
  {
    head: [49, 103.5],
    neck: [56.5, 107.5],
    shoulder: [62, 110.5],
    elbow: [69.5, 124.5],
    wrist: [60, 136],
    hip: [102.5, 117],
    knee: [126, 122.3],
    ankle: [148, 129.5],
    toe: [154, 139.2],
  },
  {
    head: [50, 114],
    neck: [57.5, 118],
    shoulder: [63, 121],
    elbow: [76, 131],
    wrist: [60, 136],
    hip: [103, 124],
    knee: [126, 127.5],
    ankle: [148, 133],
    toe: [154, 139.5],
  },
];

const SQUAT: Keyframes = [
  {
    head: [100.5, 37],
    neck: [100, 44],
    shoulder: [100, 48],
    elbow: [100, 64],
    wrist: [100, 79],
    hip: [99, 82],
    knee: [98, 108],
    ankle: [97, 134],
    toe: [106, 139.5],
  },
  {
    head: [98.75, 49],
    neck: [97.6, 56],
    shoulder: [97.5, 60],
    elbow: [104.5, 70.5],
    wrist: [111, 76.5],
    hip: [92.5, 92.5],
    knee: [103, 110],
    ankle: [97, 134],
    toe: [106, 139.5],
  },
  {
    head: [97, 61],
    neck: [95.4, 68],
    shoulder: [95, 72],
    elbow: [109, 77],
    wrist: [122, 74],
    hip: [86, 103],
    knee: [108, 112],
    ankle: [97, 134],
    toe: [106, 139.5],
  },
];

type SceneSpec = {
  poses: Keyframes;
  shadowCx: number;
  shadowRx: [number, number];
  guideY: number;
  guideX: [number, number];
  /** Eye offset from the head centre, along the facing direction. */
  eye: Pt;
};

const SCENES: Record<WorkoutExercise, SceneSpec> = {
  pushups: {
    poses: PUSHUP,
    shadowCx: 102,
    shadowRx: [46, 52],
    guideY: 120,
    guideX: [36, 120],
    eye: [-3.2, 1.2],
  },
  squats: {
    poses: SQUAT,
    shadowCx: 97,
    shadowRx: [24, 32],
    guideY: 104,
    guideX: [56, 128],
    eye: [3.2, -1],
  },
};

const GROUND_Y = 140;
const HEAD_R = 7.5;

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Worklet helpers — declared before use (the worklet transform kills hoisting).
function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Piecewise interpolation through the three keyframes at progress t (0..1). */
function joint(poses: Keyframes, key: keyof Pose, t: number): { x: number; y: number } {
  'worklet';
  const [top, mid, bot] = poses;
  if (t <= 0.5) {
    const k = t * 2;
    return { x: lerp(top[key][0], mid[key][0], k), y: lerp(top[key][1], mid[key][1], k) };
  }
  const k = (t - 0.5) * 2;
  return { x: lerp(mid[key][0], bot[key][0], k), y: lerp(mid[key][1], bot[key][1], k) };
}

/** One capsule limb between two joints, driven by numeric animated props. */
function Bone({
  poses,
  from,
  to,
  t,
  width,
  color,
}: {
  poses: Keyframes;
  from: keyof Pose;
  to: keyof Pose;
  t: SharedValue<number>;
  width: number;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const a = joint(poses, from, t.value);
    const b = joint(poses, to, t.value);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  return <AnimatedLine animatedProps={props} stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

export function DemoFigure({ exercise }: { exercise: WorkoutExercise }) {
  const { colors } = useTheme();
  const scene = SCENES[exercise];
  const poses = scene.poses;

  const t = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    pop.value = 0;
    // Down slower than up (real tempo), micro-hold at depth, breather on top.
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 950, easing: Easing.bezier(0.45, 0, 0.25, 1) }),
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 720, easing: Easing.bezier(0.33, 0, 0.15, 1) }),
        withTiming(0, { duration: 420 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(t);
      cancelAnimation(pop);
    };
  }, [t, pop, exercise]);

  // «+1» pops the moment the figure locks out on top — like the live counter.
  useAnimatedReaction(
    () => t.value,
    (curr, prev) => {
      if (prev != null && prev > 0.15 && curr <= 0.02) {
        pop.value = 0;
        pop.value = withSequence(
          withTiming(1, { duration: 240, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 420 }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
        );
      }
    },
  );

  const popStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ translateY: -12 * pop.value }, { scale: 0.6 + 0.4 * pop.value }],
  }));

  const headProps = useAnimatedProps(() => {
    const h = joint(poses, 'head', t.value);
    return { cx: h.x, cy: h.y };
  });
  const eyeProps = useAnimatedProps(() => {
    const h = joint(poses, 'head', t.value);
    return { cx: h.x + scene.eye[0], cy: h.y + scene.eye[1] };
  });

  const shadowProps = useAnimatedProps(() => {
    const p = t.value;
    return {
      rx: lerp(scene.shadowRx[0], scene.shadowRx[1], p),
      opacity: 0.16 + 0.14 * p,
    };
  });

  // Depth guide turns green exactly when the range would count.
  const guideFlashProps = useAnimatedProps(() => {
    const p = t.value;
    const on = p > 0.82 ? (p - 0.82) / 0.18 : 0;
    return { opacity: on * 0.95 };
  });

  return (
    <View style={styles.root}>
      <Svg viewBox="0 0 200 160" width="100%" height="100%">
        {/* Ground + reactive shadow */}
        <Line
          x1={12}
          y1={GROUND_Y}
          x2={188}
          y2={GROUND_Y}
          stroke={colors.border}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <AnimatedEllipse
          animatedProps={shadowProps}
          cx={scene.shadowCx}
          cy={GROUND_Y + 6}
          ry={4.5}
          fill={colors.overlay}
        />

        {/* Phone filming from the side, dashed field of view */}
        <Rect
          x={14}
          y={98}
          width={11}
          height={36}
          rx={3}
          stroke={colors.textSecondary}
          strokeWidth={1.6}
          fill="none"
        />
        <Circle cx={19.5} cy={104} r={1.4} fill={colors.textSecondary} />
        <Path
          d="M25 106 L40 96 M25 126 L40 136"
          stroke={colors.textSecondary}
          strokeWidth={1.2}
          strokeDasharray="3 3"
          strokeLinecap="round"
          opacity={0.7}
        />

        {/* Depth guide: dashed target + green flash at full range */}
        <Line
          x1={scene.guideX[0]}
          y1={scene.guideY}
          x2={scene.guideX[1]}
          y2={scene.guideY}
          stroke={colors.textSecondary}
          strokeWidth={1.2}
          strokeDasharray="4 4"
          opacity={0.55}
        />
        <AnimatedLine
          animatedProps={guideFlashProps}
          x1={scene.guideX[0]}
          y1={scene.guideY}
          x2={scene.guideX[1]}
          y2={scene.guideY}
          stroke={colors.success}
          strokeWidth={2.2}
          strokeLinecap="round"
        />

        {/* Cartoon athlete: capsule limbs, human proportions, sneakers */}
        <Bone poses={poses} from="hip" to="knee" t={t} width={8} color={colors.primary} />
        <Bone poses={poses} from="knee" to="ankle" t={t} width={7} color={colors.primary} />
        <Bone poses={poses} from="ankle" to="toe" t={t} width={6.5} color={colors.textPrimary} />
        <Bone poses={poses} from="neck" to="hip" t={t} width={10} color={colors.primary} />
        <Bone poses={poses} from="shoulder" to="elbow" t={t} width={7} color={colors.primary} />
        <Bone poses={poses} from="elbow" to="wrist" t={t} width={6} color={colors.primary} />
        <AnimatedCircle animatedProps={headProps} r={HEAD_R} fill={colors.primary} />
        <AnimatedCircle animatedProps={eyeProps} r={1.6} fill={colors.onPrimary} />
      </Svg>

      {/* «+1» chip — the demo counts its own reps */}
      <Animated.View
        style={[styles.plusOne, { backgroundColor: colors.primary }, popStyle]}
        pointerEvents="none"
      >
        <AppText variant="caption" style={{ color: colors.onPrimary }}>
          +1
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
  },
  plusOne: {
    position: 'absolute',
    top: '10%',
    right: '14%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});
