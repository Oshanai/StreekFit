import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import type { WorkoutExercise } from '@/features/movement/workoutSession';
import { AppText, Card, ScalePressable, Screen, spacing, useTheme } from '@/shared/ui';

/** Movement hub — pick an exercise, the camera counts it (TZ Phase 2). */
export default function MoveScreen() {
  const { t } = useTranslation();
  const { targets } = useAuth();
  const { colors } = useTheme();

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

      <Card style={styles.soonCard}>
        <AppText variant="body" color="secondary">
          {t('movement.steps')} · {t('movement.run')} — {t('workout.comingSoon')}
        </AppText>
      </Card>
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
