import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Screen, spacing } from '@/shared/ui';

/**
 * Today screen — daily score, streak and goal progress.
 * Phase 0: design-system placeholder; real data arrives in Phase 5.
 */
export default function TodayScreen() {
  const { t } = useTranslation();

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
          0
        </AppText>
        <View style={styles.row}>
          <AppText variant="caption" color="secondary">
            {t('home.streak')}
          </AppText>
          <AppText variant="bodyBold" color="accent" tabular>
            {t('home.streakDays', { count: 0 })}
          </AppText>
        </View>
      </Card>

      <Card style={styles.emptyCard}>
        <AppText variant="body" color="secondary" style={styles.centered}>
          {t('home.empty')}
        </AppText>
      </Card>
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
    marginTop: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  centered: {
    textAlign: 'center',
  },
});
