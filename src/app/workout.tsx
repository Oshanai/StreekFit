import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { enqueueSession } from '@/features/movement/sessionQueue';
import type { WorkoutExercise } from '@/features/movement/workoutSession';
import { EmptyState, Screen } from '@/shared/ui';

/**
 * Full-screen camera workout route: /workout?type=pushups|squats.
 * The camera module is native-only (nitro), so web gets a friendly empty
 * state instead of a crashed bundle — real training happens on the phone.
 */
export default function WorkoutRoute() {
  const { t } = useTranslation();
  const { targets } = useAuth();
  const params = useLocalSearchParams<{ type?: string }>();
  const exercise: WorkoutExercise = params.type === 'squats' ? 'squats' : 'pushups';

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <EmptyState message={t('workout.unavailableBody')} />
      </Screen>
    );
  }

  // Native-only module: resolved lazily so web bundles never evaluate nitro code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform gate
  const { WorkoutCamera } = require('@/features/movement/WorkoutCamera') as
    typeof import('@/features/movement/WorkoutCamera');

  const targetReps =
    exercise === 'pushups' ? (targets?.pushup_target ?? 10) : (targets?.squat_target ?? 10);

  return (
    <WorkoutCamera
      exercise={exercise}
      targetReps={targetReps}
      onFinish={(summary) => {
        if (summary.setsDone > 0) {
          void enqueueSession({
            type: exercise,
            validReps: summary.validReps,
            setsDone: summary.setsDone,
            verified: true,
            performedAt: new Date().toISOString(),
          });
        }
        router.back();
      }}
    />
  );
}
