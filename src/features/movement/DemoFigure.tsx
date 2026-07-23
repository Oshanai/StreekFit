/**
 * Positioning demo — a polished side-view figure looping reps of the chosen
 * exercise so the athlete instantly sees how to set up and move.
 *
 * Scene: capsule-limb figure with a soft ground shadow, a phone glyph with a
 * dashed field-of-view cone («поставь телефон сбоку»), a depth guide that
 * flashes green when the figure hits full range, and a «+1» chip popping at
 * every lockout — the demo literally counts its own reps the way the live
 * counter will.
 *
 * Pure Reanimated: one progress value drives every element via animated
 * props; the React tree never re-renders during the loop.
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
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Polyline, Rect } from 'react-native-svg';

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

/** viewBox 0 0 200 160, ground at y = 140. Three keyframes: top → mid → bottom. */
const PUSHUP: [Pose, Pose, Pose] = [
  {
    head: [46, 88],
    neck: [54, 93],
    shoulder: [62, 97],
    elbow: [62, 117],
    wrist: [62, 136],
    hip: [104, 105],
    knee: [127, 110],
    ankle: [146, 118],
    toe: [153, 138],
  },
  {
    head: [47, 100],
    neck: [55, 105],
    shoulder: [63, 109],
    elbow: [69, 124],
    wrist: [62, 136],
    hip: [104.5, 114.5],
    knee: [127, 118.5],
    ankle: [146, 123.5],
    toe: [153, 138],
  },
  {
    head: [48, 113],
    neck: [56, 117],
    shoulder: [64, 121],
    elbow: [78, 131],
    wrist: [62, 136],
    hip: [105, 124],
    knee: [127, 127],
    ankle: [146, 129],
    toe: [153, 138],
  },
];

const SQUAT: [Pose, Pose, Pose] = [
  {
    head: [98, 44],
    neck: [97.5, 51],
    shoulder: [97, 58],
    elbow: [97, 76],
    wrist: [97, 93],
    hip: [96, 86],
    knee: [95, 110],
    ankle: [94, 134],
    toe: [86, 140],
  },
  {
    head: [95.5, 54],
    neck: [94, 61],
    shoulder: [93.5, 68],
    elbow: [100.5, 80],
    wrist: [107, 86.5],
    hip: [89, 96],
    knee: [99, 111.5],
    ankle: [94, 134],
    toe: [86, 140],
  },
  {
    head: [93, 64],
    neck: [91, 71],
    shoulder: [90, 78],
    elbow: [104, 84],
    wrist: [118, 80],
    hip: [82, 106],
    knee: [104, 112],
    ankle: [94, 134],
    toe: [86, 140],
  },
];

type SceneSpec = {
  poses: [Pose, Pose, Pose];
  shadowCx: number;
  shadowRx: [number, number];
  /** Dashed depth guide: y level + x span; flashes green near the bottom. */
  guideY: number;
  guideX: [number, number];
};

const SCENES: Record<WorkoutExercise, SceneSpec> = {
  pushups: { poses: PUSHUP, shadowCx: 104, shadowRx: [46, 54], guideY: 121, guideX: [38, 122] },
  squats: { poses: SQUAT, shadowCx: 96, shadowRx: [24, 33], guideY: 106, guideX: [58, 128] },
};

const GROUND_Y = 140;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// Worklet helpers — declared before use (the worklet transform kills hoisting).
function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Piecewise interpolation through the three keyframes at progress t (0..1). */
function joint(poses: [Pose, Pose, Pose], key: keyof Pose, t: number): { x: number; y: number } {
  'worklet';
  const [top, mid, bot] = poses;
  if (t <= 0.5) {
    const k = t * 2;
    return { x: lerp(top[key][0], mid[key][0], k), y: lerp(top[key][1], mid[key][1], k) };
  }
  const k = (t - 0.5) * 2;
  return { x: lerp(mid[key][0], bot[key][0], k), y: lerp(mid[key][1], bot[key][1], k) };
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

  const legProps = useAnimatedProps(() => {
    const p = t.value;
    const h = joint(poses, 'hip', p);
    const k = joint(poses, 'knee', p);
    const a = joint(poses, 'ankle', p);
    const toe = joint(poses, 'toe', p);
    return { points: `${h.x},${h.y} ${k.x},${k.y} ${a.x},${a.y} ${toe.x},${toe.y}` };
  });

  const torsoProps = useAnimatedProps(() => {
    const p = t.value;
    const n = joint(poses, 'neck', p);
    const s = joint(poses, 'shoulder', p);
    const h = joint(poses, 'hip', p);
    return { points: `${n.x},${n.y} ${s.x},${s.y} ${h.x},${h.y}` };
  });

  const armProps = useAnimatedProps(() => {
    const p = t.value;
    const s = joint(poses, 'shoulder', p);
    const e = joint(poses, 'elbow', p);
    const w = joint(poses, 'wrist', p);
    return { points: `${s.x},${s.y} ${e.x},${e.y} ${w.x},${w.y}` };
  });

  const headProps = useAnimatedProps(() => {
    const p = t.value;
    const h = joint(poses, 'head', p);
    return { cx: h.x, cy: h.y };
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

        {/* Figure: capsule limbs, torso thicker, joint pins on top */}
        <AnimatedPolyline
          animatedProps={legProps}
          fill="none"
          stroke={colors.primary}
          strokeWidth={7}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <AnimatedPolyline
          animatedProps={torsoProps}
          fill="none"
          stroke={colors.primary}
          strokeWidth={9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <AnimatedPolyline
          animatedProps={armProps}
          fill="none"
          stroke={colors.primary}
          strokeWidth={7}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <AnimatedCircle animatedProps={headProps} r={9.5} fill={colors.primary} />
        {(['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'] as const).map((key) => (
          <JointPin key={key} poses={poses} jointKey={key} t={t} color={colors.onPrimary} />
        ))}
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

function JointPin({
  poses,
  jointKey,
  t,
  color,
}: {
  poses: [Pose, Pose, Pose];
  jointKey: keyof Pose;
  t: { value: number };
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const p = joint(poses, jointKey, t.value);
    return { cx: p.x, cy: p.y };
  });
  return <AnimatedCircle animatedProps={props} r={2.4} fill={color} opacity={0.95} />;
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
