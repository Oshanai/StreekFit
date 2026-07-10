/**
 * Light skeleton overlay (TZ §3.1) — one polyline through the tracked side:
 * wrist–elbow–shoulder–hip–knee–ankle, plus joint dots.
 *
 * Driven entirely by a shared value written from the frame worklet; renders
 * via Reanimated animated props on react-native-svg — the React tree never
 * re-renders per frame (TZ §11.1).
 *
 * Shared value layout: [] = hidden, otherwise
 * [frameW, frameH, x0,y0,v0, x1,y1,v1, ... x5,y5,v5] with x/y normalized to
 * the frame and v = model confidence. View mapping assumes the camera preview
 * uses resizeMode="contain" (the overlay letterboxes identically).
 */

import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Polyline } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/shared/ui';

/** 2 header floats + 6 points × (x, y, visibility). */
export const SKELETON_FLOATS = 2 + 6 * 3;

const JOINTS = 6;
const MIN_JOINT_VISIBILITY = 0.35;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ViewBox = { w: number; h: number };

function frameToViewFactory(sk: readonly number[], view: ViewBox) {
  'worklet';
  const frameW = sk[0];
  const frameH = sk[1];
  // resizeMode="contain": scale to fit, center the rest.
  const scale = Math.min(view.w / frameW, view.h / frameH);
  const contentW = frameW * scale;
  const contentH = frameH * scale;
  const offX = (view.w - contentW) / 2;
  const offY = (view.h - contentH) / 2;
  return (nx: number, ny: number) => {
    return { x: offX + nx * contentW, y: offY + ny * contentH };
  };
}

export function SkeletonOverlay({ skeleton }: { skeleton: SharedValue<number[]> }) {
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
    const map = frameToViewFactory(sk, viewBox);
    let points = '';
    for (let i = 0; i < JOINTS; i += 1) {
      const v = sk[2 + i * 3 + 2];
      if (v < MIN_JOINT_VISIBILITY) continue; // skip unreliable joints
      const p = map(sk[2 + i * 3], sk[2 + i * 3 + 1]);
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
            <JointDot key={i} index={i} skeleton={skeleton} viewBox={viewBox} color={colors.primary} />
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
  color,
}: {
  index: number;
  skeleton: SharedValue<number[]>;
  viewBox: ViewBox;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const sk = skeleton.value;
    if (sk.length < SKELETON_FLOATS || viewBox.w === 0) {
      return { cx: -10, cy: -10, opacity: 0 };
    }
    const v = sk[2 + index * 3 + 2];
    if (v < MIN_JOINT_VISIBILITY) return { cx: -10, cy: -10, opacity: 0 };
    const map = frameToViewFactory(sk, viewBox);
    const p = map(sk[2 + index * 3], sk[2 + index * 3 + 1]);
    return { cx: p.x, cy: p.y, opacity: 0.95 };
  });
  return <AnimatedCircle animatedProps={props} r={5} fill={color} />;
}
