import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTodaySteps } from '@/features/movement/steps';
import type { WorkoutExercise } from '@/features/movement/workoutSession';
import { AppText, Card, ScalePressable, Screen, spacing, useTheme } from '@/shared/ui';

/** Movement hub — pick an exercise, the camera counts it (TZ Phase 2). */
export default function MoveScreen() {
  const { t } = useTranslation();
  const { targets } = useAuth();
  const { colors } = useTheme();
  const stepsState = useTodaySteps();

  const startWorkout = (type: WorkoutExercise) => {
    router.push({ pathname: '/workout', params: { type } });
  };

  const cameraBadge = (
    <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
      <AppText variant="caption" color="accent">
        {t('workout.cameraChip')}
      </AppText>
    </View>
  );

  return (
    <Screen insideTabs>
      <AppText variant="h1" style={styles.title}>
        {t('tabs.move')}
      </AppText>

      <Animated.View entering={FadeInDown.duration(340).springify().damping(16)}>
        <ScalePressable onPress={() => startWorkout('pushups')}>
          <Card style={styles.exerciseCard}>
            <View style={styles.cardRow}>
              <AppText variant="h2">{t('movement.pushups')}</AppText>
              {cameraBadge}
            </View>
            <AppText variant="caption" color="secondary">
              {t('workout.targetHint', { count: targets?.pushup_target ?? 10 })}
            </AppText>
          </Card>
        </ScalePressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(70).duration(340).springify().damping(16)}>
        <ScalePressable onPress={() => startWorkout('squats')}>
          <Card style={styles.exerciseCard}>
            <View style={styles.cardRow}>
              <AppText variant="h2">{t('movement.squats')}</AppText>
              {cameraBadge}
            </View>
            <AppText variant="caption" color="secondary">
              {t('workout.targetHint', { count: targets?.squat_target ?? 10 })}
            </AppText>
          </Card>
        </ScalePressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(340).springify().damping(16)}>
        <Card style={styles.exerciseCard}>
          <View style={styles.cardRow}>
            <AppText variant="h2">{t('movement.steps')}</AppText>
            {stepsState.status === 'ready' ? (
              <AppText variant="bodyBold" color="accent" tabular>
                {t('home.stepsOf', {
                  count: stepsState.steps,
                  target: targets?.steps_target ?? 7000,
                })}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color="secondary">
            {stepsState.status === 'denied'
              ? t('home.motionDenied')
              : stepsState.status === 'unavailable'
                ? t('home.motionUnavailable')
                : t('home.stepsAuto')}
          </AppText>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(210).duration(340).springify().damping(16)}>
        <ScalePressable onPress={() => router.push('/run')}>
          <Card style={styles.exerciseCard}>
            <View style={styles.cardRow}>
              <AppText variant="h2">{t('movement.run')}</AppText>
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="caption" color="accent">
                  {t('run.gpsChip')}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" color="secondary">
              {t('run.cardHint')}
            </AppText>
          </Card>
        </ScalePressable>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  exerciseCard: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soonCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
});
