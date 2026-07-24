import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePremium } from '@/features/leaderboard/usePremium';
import { formatDuration, formatPace } from '@/features/run/geo';
import { fetchRunHistory, type RunRecord } from '@/features/run/history';
import { AppText, Button, Card, ScalePressable, Screen, spacing } from '@/shared/ui';

/** Past runs: date, distance, time, pace; tap one with a track → route map. */
export default function RunHistoryScreen() {
  const { t, i18n } = useTranslation();
  const { premium } = usePremium();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchRunHistory().then((rows) => {
        if (!alive) return;
        setRuns(rows);
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppText variant="h1" style={styles.title}>
          {t('runHistory.title')}
        </AppText>

        {premium ? (
          <Button variant="gradient" label={t('runHistory.start')} onPress={() => router.push('/run')} />
        ) : (
          <Card style={styles.lockCard}>
            <AppText variant="body" color="secondary" style={styles.centered}>
              {t('run.lockedBody')}
            </AppText>
          </Card>
        )}

        {loaded && runs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AppText variant="body" color="secondary" style={styles.centered}>
              {t('runHistory.empty')}
            </AppText>
          </Card>
        ) : null}

        {runs.map((run) => {
          const km = (run.distanceM / 1000).toFixed(2);
          const pace = run.distanceM >= 100 ? run.minutes / (run.distanceM / 1000) : null;
          const hasTrack = (run.track?.length ?? 0) >= 2;
          const row = (
            <Card style={styles.runCard}>
              <View style={styles.rowBetween}>
                <AppText variant="bodyBold">{formatDate(run.performedAt)}</AppText>
                {hasTrack ? (
                  <AppText variant="caption" color="accent">
                    {t('runHistory.viewMap')}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <AppText variant="h2" color="info" tabular>
                    {km}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('run.km')}
                  </AppText>
                </View>
                <View style={styles.metric}>
                  <AppText variant="h2" tabular>
                    {formatDuration(run.minutes * 60_000)}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('run.time')}
                  </AppText>
                </View>
                <View style={styles.metric}>
                  <AppText variant="h2" color="info" tabular>
                    {formatPace(pace)}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('run.pace')}
                  </AppText>
                </View>
              </View>
            </Card>
          );
          return hasTrack ? (
            <ScalePressable
              key={run.id}
              onPress={() => router.push({ pathname: '/run-view', params: { id: run.id } })}
            >
              {row}
            </ScalePressable>
          ) : (
            <View key={run.id}>{row}</View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
  },
  lockCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  runCard: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  centered: {
    textAlign: 'center',
  },
});
