import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { fetchAllTimeStats, type AllTimeStats } from '@/features/stats/api';
import { addDays, parseDateKey, type PeriodTotals } from '@/features/stats/period';
import { AppText, Card, LoadingState, Screen, spacing, radii, useTheme } from '@/shared/ui';

/** Bars like StepsApp's year list: label, proportional bar, value. */
function PeriodBars({
  data,
  labelOf,
  color,
}: {
  data: PeriodTotals[];
  labelOf: (period: string) => string;
  color: string;
}) {
  const max = Math.max(1, ...data.map((p) => p.score));
  return (
    <View style={styles.bars}>
      {data.map((p) => (
        <View key={p.period} style={styles.barRow}>
          <AppText variant="micro" color="secondary" style={styles.barLabel}>
            {labelOf(p.period)}
          </AppText>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: color, width: `${Math.max(6, (p.score / max) * 100)}%` },
              ]}
            />
          </View>
          <AppText variant="micro" tabular style={styles.barValue}>
            {p.score}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** All-time analytics: totals, records, week/month dynamics (TZ §17.2). */
export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [stats, setStats] = useState<AllTimeStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchAllTimeStats()
        .then((s) => {
          if (!alive) return;
          setStats(s);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
      return () => {
        alive = false;
      };
    }, []),
  );

  const lang = i18n.language;
  const fmtDay = (key: string) =>
    parseDateKey(key).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  const fmtWeek = (monday: string) => `${fmtDay(monday)} – ${fmtDay(addDays(monday, 6))}`;
  const fmtMonth = (period: string) =>
    parseDateKey(`${period}-01`).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  const fmtMonthShort = (period: string) =>
    parseDateKey(`${period}-01`).toLocaleDateString(lang, { month: 'short' });

  if (!loaded) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const hasData = stats != null && stats.totalScore > 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppText variant="h1" style={styles.title}>
          {t('stats.title')}
        </AppText>

        {!hasData ? (
          <Card style={styles.emptyCard}>
            <AppText variant="body" color="secondary" style={styles.centered}>
              {t('stats.empty')}
            </AppText>
          </Card>
        ) : (
          <>
            <Card style={styles.totalsCard}>
              <AppText variant="caption" color="secondary">
                {t('stats.allTime')}
              </AppText>
              <View style={styles.totalsGrid}>
                <View style={styles.totalCell}>
                  <AppText variant="h1" color="accent" tabular>
                    {stats.totalScore.toLocaleString(lang)}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('stats.totalScore')}
                  </AppText>
                </View>
                <View style={styles.totalCell}>
                  <AppText variant="h1" color="info" tabular>
                    {stats.totalSteps.toLocaleString(lang)}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('stats.totalSteps')}
                  </AppText>
                </View>
                <View style={styles.totalCell}>
                  <AppText variant="h2" tabular>
                    {stats.totalWorkouts}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('stats.workouts')}
                  </AppText>
                </View>
                <View style={styles.totalCell}>
                  <AppText variant="h2" tabular>
                    {stats.totalRunKm}
                  </AppText>
                  <AppText variant="micro" color="secondary">
                    {t('stats.runKm')}
                  </AppText>
                </View>
              </View>
            </Card>

            <Card style={styles.recordsCard}>
              <AppText variant="h3">{t('stats.records')}</AppText>
              {stats.best.day != null ? (
                <View style={styles.recordRow}>
                  <View style={styles.recordLeft}>
                    <AppText variant="body">{t('stats.bestDay')}</AppText>
                    <AppText variant="micro" color="secondary">
                      {fmtDay(stats.best.day.date)}
                    </AppText>
                  </View>
                  <AppText variant="bodyBold" color="accent" tabular>
                    {stats.best.day.score}
                  </AppText>
                </View>
              ) : null}
              {stats.best.week != null ? (
                <View style={styles.recordRow}>
                  <View style={styles.recordLeft}>
                    <AppText variant="body">{t('stats.bestWeek')}</AppText>
                    <AppText variant="micro" color="secondary">
                      {fmtWeek(stats.best.week.period)}
                    </AppText>
                  </View>
                  <AppText variant="bodyBold" color="accent" tabular>
                    {stats.best.week.score}
                  </AppText>
                </View>
              ) : null}
              {stats.best.month != null ? (
                <View style={styles.recordRow}>
                  <View style={styles.recordLeft}>
                    <AppText variant="body">{t('stats.bestMonth')}</AppText>
                    <AppText variant="micro" color="secondary">
                      {fmtMonth(stats.best.month.period)}
                    </AppText>
                  </View>
                  <AppText variant="bodyBold" color="accent" tabular>
                    {stats.best.month.score}
                  </AppText>
                </View>
              ) : null}
            </Card>

            {stats.weeks.length > 1 ? (
              <Card style={styles.recordsCard}>
                <AppText variant="h3">{t('stats.byWeeks')}</AppText>
                <PeriodBars data={stats.weeks} labelOf={fmtDay} color={colors.primary} />
              </Card>
            ) : null}

            {stats.months.length > 1 ? (
              <Card style={styles.recordsCard}>
                <AppText variant="h3">{t('stats.byMonths')}</AppText>
                <PeriodBars data={stats.months} labelOf={fmtMonthShort} color={colors.info} />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  centered: {
    textAlign: 'center',
  },
  totalsCard: {
    gap: spacing.md,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  totalCell: {
    width: '50%',
    gap: 2,
  },
  recordsCard: {
    gap: spacing.md,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLeft: {
    gap: 2,
  },
  bars: {
    gap: spacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    width: 76,
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  barValue: {
    minWidth: 44,
    textAlign: 'right',
  },
});
