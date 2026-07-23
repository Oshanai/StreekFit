/**
 * Light skeleton overlay (TZ §3.1) — one polyline through the tracked side:
 * wrist–elbow–shoulder–hip–knee–ankle, plus joint dots.
 *
 * Driven entirely by a shared value written from the frame worklet; renders
 * via Reanimated animated props on react-native-svg — the React tree never
 * re-renders per frame (TZ §11.1).
 *
 * Shared value layout: [] = hidden, otherwise
 * [frameW, frameH, dataMirrored(0|1), x0,y0,v0, … x5,y5,v5] with x/y
 * normalized to the upright frame and v = model confidence.
 *
 * Mirroring: the iOS front-camera PREVIEW is a mirror. If the frame DATA is
 * not mirrored (dataMirrored=0) while the preview is, overlay x must flip to
 * land on the athlete — and vice versa for exotic back-camera setups.
 * View mapping assumes the preview uses resizeMode="contain".
 */

import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Polyline } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/shared/ui';

/** 3 header floats + 6 points × (x, y, visibility). */
export const SKELETON_FLOATS = 3 + 6 * 3;

const JOINTS = 6;
const MIN_JOINT_VISIBILITY = 0.35;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ViewBox = { w: number; h: number };

function frameToViewFactory(sk: readonly number[], view: ViewBox, isFront: boolean) {
  'worklet';
  const frameW = sk[0];
  const frameH = sk[1];
  const dataMirrored = sk[2] === 1;
  // Mirrored preview + unmirrored data (the normal front-cam case) → flip.
  const flipX = isFront ? !dataMirrored : dataMirrored;
  // resizeMode="contain": scale to fit, center the rest.
  const scale = Math.min(view.w / frameW, view.h / frameH);
  const contentW = frameW * scale;
  const contentH = frameH * scale;
  const offX = (view.w - contentW) / 2;
  const offY = (view.h - contentH) / 2;
  return (nx: number, ny: number) => {
    const x = offX + nx * contentW;
    return { x: flipX ? view.w - x : x, y: offY + ny * contentH };
  };
}

export function SkeletonOverlay({
  skeleton,
  isFront,
}: {
  skeleton: SharedValue<number[]>;
  isFront: boolean;
}) {
  const { colors } = useTheme();
  const [viewBox, setViewBox] = useState<ViewBox>({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewBox({ w: width, h: height });
  };

  const polylineProps = useAnimatedProps(() => {
    const sk = skeleton.value;
    if (sk.length < SKELETON_FLOATS || viewBox.w === 0) {
      return { points: '', opacity: 0 };
    }
    const map = frameToViewFactory(sk, viewBox, isFront);
    let points = '';
    for (let i = 0; i < JOINTS; i += 1) {
      const v = sk[3 + i * 3 + 2];
      if (v < MIN_JOINT_VISIBILITY) continue; // skip unreliable joints
      const p = map(sk[3 + i * 3], sk[3 + i * 3 + 1]);
      points += `${p.x.toFixed(1)},${p.y.toFixed(1)} `;
    }
    return { points: points.trim(), opacity: 0.9 };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {viewBox.w > 0 ? (
        <Svg width={viewBox.w} height={viewBox.h}>
          <AnimatedPolyline
            animatedProps={polylineProps}
            fill="none"
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {Array.from({ length: JOINTS }, (_, i) => (
            <JointDot
              key={i}
              index={i}
              skeleton={skeleton}
              viewBox={viewBox}
              isFront={isFront}
              color={colors.primary}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function JointDot({
  index,
  skeleton,
  viewBox,
  isFront,
  color,
}: {
  index: number;
  skeleton: SharedValue<number[]>;
  viewBox: ViewBox;
  isFront: boolean;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const sk = skeleton.value;
    if (sk.length < SKELETON_FLOATS || viewBox.w === 0) {
      return { cx: -10, cy: -10, opacity: 0 };
    }
    const v = sk[3 + index * 3 + 2];
    if (v < MIN_JOINT_VISIBILITY) return { cx: -10, cy: -10, opacity: 0 };
    const map = frameToViewFactory(sk, viewBox, isFront);
    const p = map(sk[3 + index * 3], sk[3 + index * 3 + 1]);
    return { cx: p.x, cy: p.y, opacity: 0.95 };
  });
  return <AnimatedCircle animatedProps={props} r={5} fill={color} />;
}
