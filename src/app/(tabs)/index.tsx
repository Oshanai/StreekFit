import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import { computeDayGoal, computeDayScore } from '@/features/movement/dayScore';
import { useTodaySteps } from '@/features/movement/steps';
import { fetchTodayReps, type TodayReps } from '@/features/movement/todayActivity';
import { AppText, Card, Screen, spacing, useTheme } from '@/shared/ui';

/** Today screen — the day's single score: workouts + steps (run in Phase 4). */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { targets } = useAuth();
  const stepsState = useTodaySteps();

  const [reps, setReps] = useState<TodayReps>({ pushupReps: 0, squatReps: 0 });
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchTodayReps().then((r) => {
        if (alive) setReps(r);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const score = computeDayScore({
    pushupReps: reps.pushupReps,
    squatReps: reps.squatReps,
    steps: stepsState.steps,
    runMinutes: 0,
  });
  const goal = targets
    ? computeDayGoal(targets)
    : computeDayGoal({ pushup_target: 10, squat_target: 10, steps_target: 7000 });
  const progress = Math.min(1, goal > 0 ? score.total / goal : 0);
  const stepsTarget = targets?.steps_target ?? 7000;

  return (
    <Screen insideTabs>
      <AppText variant="h1" style={styles.title}>
        {t('common.appName')}
      </AppText>

      <Card style={styles.scoreCard}>
        <AppText variant="caption" color="secondary">
          {t('home.todayScore')}
        </AppText>
        <AppText variant="display" tabular>
          {score.total}
        </AppText>

        <View style={styles.row}>
          <AppText variant="caption" color="secondary">
            {t('home.fromWorkouts')}
          </AppText>
          <AppText variant="bodyBold" tabular>
            +{score.fromReps}
          </AppText>
        </View>
        <View style={styles.row}>
          <AppText variant="caption" color="secondary">
            {t('home.fromSteps')}
          </AppText>
          <AppText variant="bodyBold" tabular>
            +{score.fromSteps}
          </AppText>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.primarySoft }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progress * 100}%` },
            ]}
          />
        </View>
        <View style={styles.row}>
          <AppText variant="caption" color="secondary">
            {t('home.dailyGoal')}
          </AppText>
          <AppText variant="caption" color="secondary" tabular>
            {score.total} / {goal}
          </AppText>
        </View>
      </Card>

      <Card style={styles.stepsCard}>
        <View style={styles.row}>
          <AppText variant="bodyBold">{t('movement.steps')}</AppText>
          {stepsState.status === 'ready' ? (
            <AppText variant="bodyBold" color="accent" tabular>
              {t('home.stepsOf', { count: stepsState.steps, target: stepsTarget })}
            </AppText>
          ) : null}
        </View>
        {stepsState.status === 'denied' ? (
          <AppText variant="caption" color="secondary">
            {t('home.motionDenied')}
          </AppText>
        ) : null}
        {stepsState.status === 'unavailable' ? (
          <AppText variant="caption" color="secondary">
            {t('home.motionUnavailable')}
          </AppText>
        ) : null}
      </Card>

      {score.total === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="body" color="secondary" style={styles.centered}>
            {t('home.empty')}
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  scoreCard: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  stepsCard: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  centered: {
    textAlign: 'center',
  },
});
