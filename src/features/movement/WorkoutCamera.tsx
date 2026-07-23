/**
 * Camera workout — the TZ §3.1/§11.1 core. NATIVE ONLY: the route gates this
 * behind a platform check; importing it on web would pull in nitro modules.
 *
 * Threading model (TZ: no per-frame JS-bridge hops):
 * - onFrame worklet (camera thread): pixels → tensor → MoveNet → landmarks →
 *   rep/set FSMs. Engine state lives in the frame runtime's global, results
 *   are mirrored into Reanimated shared values.
 * - UI thread: skeleton overlay reads shared values via animated props.
 * - JS thread: low-rate HUD polling (4 Hz), buttons write command shared
 *   values that the frame worklet consumes — never the other way around.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';
import { useTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { NitroModules, type BoxedHybridObject } from 'react-native-nitro-modules';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  HybridFrameConverter,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';

import Svg, { Path } from 'react-native-svg';

import { AppText, Button, LoadingState, ErrorState, ScalePressable, spacing, useTheme } from '@/shared/ui';

import { DemoFigure } from './DemoFigure';
import { createTensorScratch, packPixelsToTensor, type TensorScratch } from './frameTensor';
import {
  MOVENET_INPUT_SIZE,
  createLandmarkSlots,
  letterboxTransform,
  movenetToLandmarks,
  squareToFrame,
} from './movenet';
import type { Landmark } from './pose';
import { LM } from './pose';
import { restRemainingMs, sessionSummary } from './setTracker';
import { SkeletonOverlay, SKELETON_FLOATS } from './SkeletonOverlay';
import {
  beginSet,
  createWorkoutSession,
  processFrame,
  stopSet,
  type WorkoutExercise,
  type WorkoutSession,
} from './workoutSession';

/**
 * ~12.5 fps analysis — a rep takes ≥700 ms, so the hysteresis FSM has 8+
 * samples per rep. Lower rate = cooler phone and zero dropped-frame stalls
 * (TZ §11.1 caps useful analysis at 15–20 fps anyway).
 */
const ANALYZE_INTERVAL_MS = 80;

/**
 * Frame rotation is NOT guessed. Sensor orientation differs between camera
 * positions and devices, so the first ~0.6 s of frames probe all four
 * rotations and lock the one where MoveNet's summed keypoint confidence is
 * highest. A watchdog re-probes if confidence collapses (e.g. after odd
 * device rotations) — the system self-heals instead of counting garbage.
 */
const ROTATIONS = [0, 90, 180, 270] as const;
const CALIBRATION_ROUNDS = 2;
/** Below this summed score (max 17) the model effectively sees no person. */
const LOW_SCORE = 3;
const LOW_SCORE_STREAK_LIMIT = 30; // ~2.4 s of nothing → recalibrate

type FrameCtx = {
  nonce: number;
  session: WorkoutSession;
  scratch: TensorScratch;
  slots: Landmark[];
  model: TensorflowModel | null;
  lastAnalyzedMs: number;
  lastCommandNonce: number;
  feedbackNonce: number;
  cameraPosition: 'front' | 'back';
  rotLocked: boolean;
  rotBest: number;
  rotScores: number[];
  rotProbe: number;
  rotRounds: number;
  lowScoreStreak: number;
  /** Lazily-created float32 view for models with a float input tensor. */
  float32: Float32Array | null;
};

type FrameGlobal = { __streekWorkout?: FrameCtx };

export type WorkoutSummary = { validReps: number; setsDone: number };

type Props = {
  exercise: WorkoutExercise;
  targetReps: number;
  onFinish: (summary: WorkoutSummary) => void;
};

export function WorkoutCamera({ exercise, targetReps, onFinish }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Release the camera when the app backgrounds (TZ §11.1); unmount handles
  // navigation away since this screen is a full-screen modal.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Front by default: the athlete places the phone facing themselves and can
  // watch the counter while moving. Back stays one tap away.
  const [position, setPosition] = useState<'front' | 'back'>('front');

  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const plugin = useTensorflowModel(
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- metro asset id
    require('../../../assets/models/movenet_lightning_int8.tflite'),
    [],
  );
  const boxedModel: BoxedHybridObject<TensorflowModel> | null = useMemo(
    () => (plugin.state === 'loaded' ? NitroModules.box(plugin.model) : null),
    [plugin],
  );
  // Adapt to whatever input tensor the bundled model actually declares —
  // the int8 MoveNet takes uint8, float16 variants take float32.
  const modelWantsFloat =
    plugin.state === 'loaded' && plugin.model.inputs[0]?.dataType === 'float32';
  useEffect(() => {
    if (plugin.state === 'loaded') {
      console.log(
        '[workout] tflite inputs:',
        JSON.stringify(plugin.model.inputs),
        'outputs:',
        JSON.stringify(plugin.model.outputs),
      );
    } else if (plugin.state === 'error') {
      console.log('[workout] tflite load error:', String(plugin.error));
    }
  }, [plugin]);

  // One nonce per mounted workout — the frame runtime resets its state on change.
  const [sessionNonce] = useState(() => Date.now() + Math.random());

  // --- shared values: frame worklet → UI ---
  const currentReps = useSharedValue(0);
  const setsDone = useSharedValue(0);
  const totalReps = useSharedValue(0);
  const setPhase = useSharedValue<'idle' | 'active' | 'resting'>('idle');
  const restStartedAt = useSharedValue(0);
  const restDurationMs = useSharedValue(0);
  const feedback = useSharedValue<{ event: string; nonce: number }>({ event: 'none', nonce: 0 });
  const poseOk = useSharedValue(false);
  const skeleton = useSharedValue<number[]>([]);
  // --- shared values: UI → frame worklet ---
  const command = useSharedValue<{ type: 'start' | 'stop' | 'none'; nonce: number }>({
    type: 'none',
    nonce: 0,
  });
  const commandAck = useSharedValue(0);

  // No targetResolution: constraining it dragged the WHOLE session (preview
  // included) down to 640×480 — the blurry-preview bug. The session now
  // negotiates native quality; the model path downscales natively instead.
  // YUV: cheapest stream off the sensor; nitro-image converts during resize.
  // No physical buffer rotation: rotating full-res buffers per frame stalls
  // the pipeline — we rotate the tiny 192px image natively instead.
  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      let disposed = false;
      const disposeFrame = () => {
        if (!disposed) {
          disposed = true;
          frame.dispose();
        }
      };
      try {
        const now = Date.now();
        const g = globalThis as unknown as FrameGlobal;
        let ctx = g.__streekWorkout;
        if (ctx == null || ctx.nonce !== sessionNonce) {
          ctx = {
            nonce: sessionNonce,
            session: createWorkoutSession(exercise, targetReps),
            scratch: createTensorScratch(),
            slots: createLandmarkSlots(),
            model: null,
            lastAnalyzedMs: 0,
            lastCommandNonce: 0,
            feedbackNonce: 0,
            cameraPosition: position,
            rotLocked: false,
            rotBest: 0,
            rotScores: [0, 0, 0, 0],
            rotProbe: 0,
            rotRounds: 0,
            lowScoreStreak: 0,
            float32: null,
          };
          g.__streekWorkout = ctx;
          restDurationMs.value = ctx.session.sets.config.restDurationMs;
        }
        if (ctx.cameraPosition !== position) {
          // Camera flipped mid-workout: sensors differ, re-probe rotation
          // (the workout session itself keeps counting as-is).
          ctx.cameraPosition = position;
          ctx.rotLocked = false;
          ctx.rotScores = [0, 0, 0, 0];
          ctx.rotProbe = 0;
          ctx.rotRounds = 0;
          ctx.lowScoreStreak = 0;
        }

        // UI intents first, so start/stop feels instant even between analyses.
        const cmd = command.value;
        if (cmd.nonce !== ctx.lastCommandNonce) {
          ctx.lastCommandNonce = cmd.nonce;
          if (cmd.type === 'start') beginSet(ctx.session);
          if (cmd.type === 'stop') stopSet(ctx.session, now);
          const sum = sessionSummary(ctx.session.sets);
          setsDone.value = sum.setsDone;
          totalReps.value = sum.validReps;
          currentReps.value = ctx.session.sets.currentReps;
          setPhase.value = ctx.session.sets.phase;
          restStartedAt.value = ctx.session.sets.restStartedAt;
          commandAck.value = cmd.nonce;
        }

        if (now - ctx.lastAnalyzedMs < ANALYZE_INTERVAL_MS) return;
        if (ctx.model == null) {
          if (boxedModel == null) return;
          ctx.model = boxedModel.unbox();
        }
        ctx.lastAnalyzedMs = now;

        const srcW = frame.width;
        const srcH = frame.height;
        const dataMirrored = frame.isMirrored; // read before dispose
        // Rotation comes from calibration, not guesswork: while unlocked we
        // probe a different candidate each analysed frame.
        const deg = ctx.rotLocked ? ROTATIONS[ctx.rotBest] : ROTATIONS[ctx.rotProbe];
        const swap = deg === 90 || deg === 270;
        const uw = swap ? srcH : srcW; // upright frame dims
        const uh = swap ? srcW : srcH;
        const maxDim = uw > uh ? uw : uh;
        const contentW = Math.max(1, Math.round((uw / maxDim) * MOVENET_INPUT_SIZE));
        const contentH = Math.max(1, Math.round((uh / maxDim) * MOVENET_INPUT_SIZE));

        // Native downscale of the full frame to the ≤192px content box, THEN
        // rotate the tiny image — never the full-res buffer. All sync nitro
        // calls on this worklet thread; JS touches only ~80 KB of pixels.
        const full = HybridFrameConverter.convertFrameToImage(frame);
        const small = full.resize(swap ? contentH : contentW, swap ? contentW : contentH);
        disposeFrame(); // `small` owns its pixels — free the camera pool slot now
        const upright = deg === 0 ? small : small.rotate(deg, false);
        const raw = upright.toRawPixelData(false);

        const ok = packPixelsToTensor(
          new Uint8Array(raw.buffer),
          raw.width,
          raw.height,
          raw.pixelFormat,
          ctx.scratch,
        );
        if (!ok) {
          poseOk.value = false;
          return;
        }

        let inputBuffer: ArrayBuffer;
        if (modelWantsFloat) {
          if (ctx.float32 == null) ctx.float32 = new Float32Array(ctx.scratch.tensor.length);
          const f = ctx.float32;
          const u = ctx.scratch.tensor;
          for (let i = 0; i < u.length; i += 1) f[i] = u[i];
          inputBuffer = f.buffer as ArrayBuffer;
        } else {
          inputBuffer = ctx.scratch.tensor.buffer as ArrayBuffer;
        }
        const outputs = ctx.model.runSync([inputBuffer]);
        const keypoints = new Float32Array(outputs[0]);

        // Summed model confidence (0..17) — calibration metric + watchdog.
        let score = 0;
        for (let k = 2; k < keypoints.length; k += 3) score += keypoints[k];

        if (!ctx.rotLocked) {
          ctx.rotScores[ctx.rotProbe] += score;
          ctx.rotProbe = (ctx.rotProbe + 1) % ROTATIONS.length;
          if (ctx.rotProbe === 0) {
            ctx.rotRounds += 1;
            if (ctx.rotRounds >= CALIBRATION_ROUNDS) {
              let best = 0;
              for (let i = 1; i < ROTATIONS.length; i += 1) {
                if (ctx.rotScores[i] > ctx.rotScores[best]) best = i;
              }
              ctx.rotBest = best;
              ctx.rotLocked = true;
              console.log(
                `[workout] rotation locked at ${ROTATIONS[best]}° (scores: ${ctx.rotScores
                  .map((s) => s.toFixed(1))
                  .join(' / ')})`,
              );
            }
          }
          // Don't feed the engine with probe frames — half are sideways.
          poseOk.value = false;
          skeleton.value = [];
          return;
        }

        if (score < LOW_SCORE) {
          ctx.lowScoreStreak += 1;
          if (ctx.lowScoreStreak > LOW_SCORE_STREAK_LIMIT) {
            ctx.rotLocked = false;
            ctx.rotScores = [0, 0, 0, 0];
            ctx.rotProbe = 0;
            ctx.rotRounds = 0;
            ctx.lowScoreStreak = 0;
            return;
          }
        } else {
          ctx.lowScoreStreak = 0;
        }

        movenetToLandmarks(keypoints, ctx.slots);

        const outcome = processFrame(ctx.session, ctx.slots, now);
        poseOk.value = outcome.poseUsable;

        if (outcome.repEvent !== 'none' || outcome.setEvent !== 'none') {
          const sum = sessionSummary(ctx.session.sets);
          setsDone.value = sum.setsDone;
          totalReps.value = sum.validReps;
          currentReps.value = ctx.session.sets.currentReps;
          setPhase.value = ctx.session.sets.phase;
          restStartedAt.value = ctx.session.sets.restStartedAt;
          const event = outcome.setEvent !== 'none' ? outcome.setEvent : outcome.repEvent;
          ctx.feedbackNonce += 1;
          feedback.value = { event, nonce: ctx.feedbackNonce };
        }

        // Skeleton for the better-visible side, in frame-normalized coords.
        const slots = ctx.slots;
        const leftVis =
          slots[LM.leftShoulder].visibility +
          slots[LM.leftElbow].visibility +
          slots[LM.leftWrist].visibility +
          slots[LM.leftHip].visibility +
          slots[LM.leftKnee].visibility +
          slots[LM.leftAnkle].visibility;
        const rightVis =
          slots[LM.rightShoulder].visibility +
          slots[LM.rightElbow].visibility +
          slots[LM.rightWrist].visibility +
          slots[LM.rightHip].visibility +
          slots[LM.rightKnee].visibility +
          slots[LM.rightAnkle].visibility;
        const left = leftVis >= rightVis;
        const chain = left
          ? [LM.leftWrist, LM.leftElbow, LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.leftAnkle]
          : [
              LM.rightWrist,
              LM.rightElbow,
              LM.rightShoulder,
              LM.rightHip,
              LM.rightKnee,
              LM.rightAnkle,
            ];
        // Overlay space = upright frame dims (the preview shows upright too).
        const tf = letterboxTransform(uw, uh);
        const pts: number[] = [uw, uh, dataMirrored ? 1 : 0];
        let visibleCount = 0;
        for (let i = 0; i < chain.length; i += 1) {
          const lm = slots[chain[i]];
          const p = squareToFrame(lm.x, lm.y, tf, uw, uh);
          pts.push(p.x, p.y, lm.visibility);
          if (lm.visibility >= 0.35) visibleCount += 1;
        }
        skeleton.value = visibleCount >= 4 ? pts : [];
      } finally {
        disposeFrame();
      }
    },
  });

  // --- JS-side HUD state, polled at 4 Hz (never per-frame) ---
  const [hud, setHud] = useState({
    reps: 0,
    sets: 0,
    total: 0,
    phase: 'idle' as 'idle' | 'active' | 'resting',
    restLeftS: 0,
    feedbackEvent: 'none',
    poseVisible: false,
  });
  const lastFeedbackNonce = useRef(0);
  const feedbackClearAt = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const fb = feedback.value;
      if (fb.nonce !== lastFeedbackNonce.current) {
        lastFeedbackNonce.current = fb.nonce;
        feedbackClearAt.current = now + 1800;
      }
      const restLeftMs = restRemainingMs(
        {
          config: {
            targetReps: 0,
            minRepsToRegister: 0,
            restDurationMs: restDurationMs.value,
          },
          phase: setPhase.value,
          currentReps: 0,
          completedSets: [],
          restStartedAt: restStartedAt.value,
        },
        now,
      );
      setHud({
        reps: currentReps.value,
        sets: setsDone.value,
        total: totalReps.value,
        phase: setPhase.value,
        restLeftS: Math.ceil(restLeftMs / 1000),
        feedbackEvent: now < feedbackClearAt.current ? fb.event : 'none',
        poseVisible: poseOk.value,
      });
    }, 250);
    return () => clearInterval(id);
  }, [
    feedback,
    currentReps,
    setsDone,
    totalReps,
    setPhase,
    restStartedAt,
    restDurationMs,
    poseOk,
  ]);

  const sendCommand = (type: 'start' | 'stop') => {
    command.value = { type, nonce: command.value.nonce + 1 };
  };

  const finishing = useRef(false);
  const handleFinish = () => {
    if (finishing.current) return;
    finishing.current = true;
    if (setPhase.value === 'active') sendCommand('stop');
    // Give the frame worklet a beat to process the stop command, then read
    // the aggregates. If the camera stalled, we still finish with what we have.
    setTimeout(() => {
      onFinish({ validReps: totalReps.value, setsDone: setsDone.value });
    }, 400);
  };

  if (!hasPermission) {
    return (
      <ErrorState
        title={t('workout.permissionTitle')}
        message={t('workout.permissionBody')}
        retryLabel={canRequestPermission ? t('workout.permissionGrant') : undefined}
        onRetry={canRequestPermission ? () => void requestPermission() : undefined}
      />
    );
  }
  if (plugin.state === 'error') {
    return <ErrorState title={t('common.error')} message={t('workout.modelError')} />;
  }
  if (plugin.state === 'loading') {
    return <LoadingState />;
  }

  const feedbackKey = feedbackMessageKey(hud.feedbackEvent);

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        isActive={appActive}
        device={position}
        outputs={[frameOutput]}
        resizeMode="contain"
      />
      <SkeletonOverlay skeleton={skeleton} isFront={position === 'front'} />

      {/* Positioning demo — looping stick-figure reps until the first set. */}
      {hud.phase === 'idle' ? (
        <View style={styles.demoWrap} pointerEvents="none">
          <View style={[styles.demoCard, { backgroundColor: colors.overlay }]}>
            <AppText variant="bodyBold" style={styles.demoText}>
              {t('workout.demoTitle')}
            </AppText>
            <View style={styles.demoFigure}>
              <DemoFigure exercise={exercise} />
            </View>
            <AppText variant="caption" color="secondary" style={styles.demoText}>
              {t('workout.demoHint')}
            </AppText>
          </View>
        </View>
      ) : null}

      {/* Camera flip — top right, under the safe area. */}
      <View style={[styles.flipWrap, { top: insets.top + spacing.md }]}>
        <ScalePressable
          onPress={() => setPosition((p) => (p === 'front' ? 'back' : 'front'))}
          accessibilityLabel={t('workout.flipCamera')}
        >
          <View style={[styles.flipButton, { backgroundColor: colors.overlay }]}>
            <FlipIcon color={colors.textPrimary} />
          </View>
        </ScalePressable>
      </View>

      {/* HUD */}
      <View style={[styles.hud, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <View style={[styles.counterCard, { backgroundColor: colors.overlay }]}>
          <AppText variant="caption" color="secondary">
            {t(`movement.${exercise}`)} · {t('workout.setLabel', { count: hud.sets + 1 })}
          </AppText>
          <AppText variant="display" tabular style={{ color: colors.primary }}>
            {hud.reps}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('workout.target', { count: targetReps })} · {t('workout.total', { count: hud.total })}
          </AppText>
        </View>

        {hud.phase === 'resting' && hud.restLeftS > 0 ? (
          <View style={[styles.banner, { backgroundColor: colors.overlay }]}>
            <AppText variant="bodyBold">{t('workout.rest', { count: hud.restLeftS })}</AppText>
          </View>
        ) : null}

        {feedbackKey != null ? (
          <View style={[styles.banner, { backgroundColor: colors.overlay }]}>
            <AppText variant="body">{t(feedbackKey)}</AppText>
          </View>
        ) : null}

        {!hud.poseVisible && hud.phase === 'active' ? (
          <View style={[styles.banner, { backgroundColor: colors.overlay }]}>
            <AppText variant="body">{t('workout.noPose')}</AppText>
          </View>
        ) : null}
      </View>

      {/* Controls */}
      <View
        style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        {hud.phase === 'active' ? (
          <Button
            variant="secondary"
            label={t('workout.stopSet')}
            onPress={() => sendCommand('stop')}
          />
        ) : (
          <Button
            label={hud.phase === 'resting' ? t('workout.nextSet') : t('workout.startSet')}
            onPress={() => sendCommand('start')}
          />
        )}
        <Button variant="ghost" label={t('workout.finish')} onPress={handleFinish} />
      </View>
    </View>
  );
}

function FlipIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8.5A8.4 8.4 0 0 1 12 4c3.2 0 6 1.7 7.4 4.3M20 15.5A8.4 8.4 0 0 1 12 20c-3.2 0-6-1.7-7.4-4.3M17.5 8.5H20V6M6.5 15.5H4V18"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function feedbackMessageKey(event: string): string | null {
  switch (event) {
    case 'partial':
      return 'workout.feedbackPartial';
    case 'rejectedTooFast':
      return 'workout.feedbackTooFast';
    case 'rejectedForm':
      return 'workout.feedbackForm';
    case 'nearLockout':
      return 'workout.feedbackLockout';
    case 'setCompleted':
      return 'workout.setCompleted';
    case 'setRegistered':
      return 'workout.setRegistered';
    case 'setDiscarded':
      return 'workout.setDiscarded';
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  counterCard: {
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  banner: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  demoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  demoCard: {
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    maxWidth: 320,
    width: '100%',
  },
  demoFigure: {
    width: 260,
    height: 208,
  },
  demoText: {
    textAlign: 'center',
  },
  flipWrap: {
    position: 'absolute',
    right: spacing.lg,
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { SKELETON_FLOATS };
