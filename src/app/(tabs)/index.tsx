import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAuth } from '@/features/auth/AuthProvider';
import { friendCodeOf } from '@/features/leaderboard/api';
import { syncToday, type DailySyncResult } from '@/features/movement/dailySync';
import { computeDayGoal, computeDayScore } from '@/features/movement/dayScore';
import { useTodaySteps } from '@/features/movement/steps';
import { StreakFlame } from '@/features/movement/StreakFlame';
import { ShareCard } from '@/features/share/ShareCard';
import { useShareCard } from '@/features/share/useShareCard';
import { AppText, Button, Card, Screen, spacing, useTheme } from '@/shared/ui';

/**
 * Today — the day's single score, streak and goal progress (TZ §6).
 * Every focus/steps change re-syncs daily_scores and may fire progression.
 */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session, targets, refreshProfile } = useAuth();
  const stepsState = useTodaySteps();
  const { cardRef, share, sharing } = useShareCard();

  const [day, setDay] = useState<DailySyncResult | null>(null);
  const [streakAtRisk, setStreakAtRisk] = useState(false);

  const runSync = useCallback(() => {
    if (!targets) return;
    void syncToday(targets, stepsState.steps).then((result) => {
      if (result == null) return;
      setDay(result);
      // Evening + chain alive + today still open → gentle nudge, no pressure.
      setStreakAtRisk(
        result.status === 'none' && result.streak > 0 && new Date().getHours() >= 17,
      );
      // Targets changed in the DB — pull them into the app state.
      if (result.progression.type !== 'none') void refreshProfile();
    });
  }, [targets, stepsState.steps, refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      runSync();
    }, [runSync]),
  );

  const score = computeDayScore({
    pushupReps: day?.pushupReps ?? 0,
    squatReps: day?.squatReps ?? 0,
    steps: stepsState.steps,
    runMinutes: day?.runMinutes ?? 0,
  });
  const goal = targets
    ? computeDayGoal(targets)
    : computeDayGoal({ pushup_target: 10, squat_target: 10, steps_target: 7000 });
  const progress = Math.min(1, goal > 0 ? score.total / goal : 0);
  const stepsTarget = targets?.steps_target ?? 7000;
  const streak = day?.streak ?? 0;

  // The day score pops when it grows — instant reward for movement.
  const scoreScale = useSharedValue(1);
  useEffect(() => {
    if (score.total > 0) {
      scoreScale.value = withSequence(
        withTiming(1.12, { duration: 140 }),
        withSpring(1, { damping: 12 }),
      );
    }
  }, [score.total, scoreScale]);
  const scoreStyle = useAnimatedStyle(() => ({ transform: [{ scale: scoreScale.value }] }));

  return (
    <Screen insideTabs>
      <AppText variant="h1" style={styles.title}>
        {t('common.appName')}
      </AppText>

      <Animated.View entering={FadeInDown.duration(360).springify().damping(16)}>
      <Card style={styles.scoreCard}>
        <AppText variant="caption" color="secondary">
          {t('home.todayScore')}
        </AppText>
        <Animated.View style={[styles.scoreNumberWrap, scoreStyle]}>
          <AppText variant="display" tabular>
            {score.total}
          </AppText>
        </Animated.View>

        <View style={styles.row}>
          <View style={styles.streakLeft}>
            <StreakFlame streak={streak} />
            <AppText variant="caption" color="secondary">
              {t('home.streak')}
            </AppText>
          </View>
          <AppText variant="bodyBold" color="accent" tabular>
            {t('home.streakDays', { count: streak })}
          </AppText>
        </View>

        {streakAtRisk ? (
          <View style={[styles.statusChip, { backgroundColor: colors.primarySoft }]}>
            <AppText variant="caption" color="accent">
              {t('home.streakDanger')}
            </AppText>
          </View>
        ) : null}

        {/* «Вчерашний ты» — beat your own shadow, the honest daily duel. */}
        {day?.yesterdayScore != null && day.yesterdayScore > 0 ? (
          score.total > day.yesterdayScore ? (
            <Animated.View
              entering={ZoomIn.springify().damping(11)}
              style={[styles.statusChip, { backgroundColor: colors.primarySoft }]}
            >
              <AppText variant="caption" color="accent">
                {t('home.yesterdayBeaten', { score: day.yesterdayScore })}
              </AppText>
            </Animated.View>
          ) : (
            <View style={styles.row}>
              <AppText variant="caption" color="secondary">
                {t('home.yesterdayGoal', { score: day.yesterdayScore })}
              </AppText>
              <AppText variant="caption" color="secondary" tabular>
                {score.total} / {day.yesterdayScore}
              </AppText>
            </View>
          )
        ) : null}

        {day?.status === 'full' ? (
          <View style={[styles.statusChip, { backgroundColor: colors.primarySoft }]}>
            <AppText variant="caption" color="accent">
              {t('home.dayClosed')}
            </AppText>
          </View>
        ) : null}
        {day?.status === 'light' ? (
          <View style={[styles.statusChip, { backgroundColor: colors.primarySoft }]}>
            <AppText variant="caption" color="accent">
              {t('home.lightDay')}
            </AppText>
          </View>
        ) : null}

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
        {score.fromRun > 0 ? (
          <View style={styles.row}>
            <AppText variant="caption" color="secondary">
              {t('home.fromRun')}
            </AppText>
            <AppText variant="bodyBold" tabular>
              +{score.fromRun}
            </AppText>
          </View>
        ) : null}
        <View style={styles.row}>
          <AppText variant="caption" color="secondary">
            {t('home.setsToday')}
          </AppText>
          <AppText variant="caption" color="secondary" tabular>
            {t('home.setsValue', { pushups: day?.pushupSets ?? 0, squats: day?.squatSets ?? 0 })}
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
      </Animated.View>

      {day != null && day.newAchievements.length > 0 ? (
        <Card style={styles.banner}>
          <AppText variant="bodyBold" color="accent">
            {t('ach.unlockedBanner', { count: day.newAchievements.length })}
          </AppText>
        </Card>
      ) : null}

      {day?.progression.type === 'increase' ? (
        <Card style={styles.banner}>
          <AppText variant="bodyBold" color="accent">
            {t('home.targetsGrew', {
              pushups: day.progression.pushupTarget,
              squats: day.progression.squatTarget,
            })}
          </AppText>
        </Card>
      ) : null}
      {day?.progression.type === 'deload' ? (
        <Card style={styles.banner}>
          <AppText variant="bodyBold">
            {t('home.deloadApplied', {
              pushups: day.progression.pushupTarget,
              squats: day.progression.squatTarget,
            })}
          </AppText>
        </Card>
      ) : null}

      <Animated.View entering={FadeInDown.delay(90).duration(360).springify().damping(16)}>
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
      </Animated.View>

      {score.total === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="body" color="secondary" style={styles.centered}>
            {t('home.empty')}
          </AppText>
        </Card>
      ) : null}

      <Button label={t('share.button')} variant="secondary" onPress={() => void share()} loading={sharing} />

      {/* Offscreen poster the share button captures at 1080×1920. */}
      <View style={styles.shareCardHost} pointerEvents="none">
        <ShareCard
          ref={cardRef}
          data={{
            streak,
            score: score.total,
            cityRank: null,
            friendCode: session ? friendCodeOf(session.user.id) : '—',
          }}
        />
      </View>
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
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  scoreNumberWrap: {
    alignSelf: 'flex-start',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  banner: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
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
  shareCardHost: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
});
