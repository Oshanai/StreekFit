/**
 * «Не разорви цепочку» — the month at a glance. Full days are solid primary
 * dots, light days are soft, today wears a ring. The visible chain is the
 * retention hook: a hole in it hurts more than any push notification.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, spacing, useTheme } from '@/shared/ui';

import { buildMonthGrid } from './calendar';
import type { DayRecord } from './streak';

const DOT = 22;

export function MonthCalendar({
  todayKey,
  records,
}: {
  todayKey: string;
  records: DayRecord[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const weeks = buildMonthGrid(todayKey, records);
  const weekdays = t('home.weekdays').split(',');

  return (
    <View style={styles.root}>
      <View style={styles.week}>
        {weekdays.map((d, i) => (
          <AppText key={i} variant="micro" color="secondary" style={styles.weekday}>
            {d}
          </AppText>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((cell, ci) => {
            if (cell.day == null) return <View key={ci} style={styles.cell} />;
            const closed = cell.status !== 'none';
            const bg =
              cell.status === 'full'
                ? colors.primary
                : cell.status === 'light'
                  ? colors.primarySoft
                  : 'transparent';
            const textColor = cell.status === 'full' ? colors.onPrimary : undefined;
            return (
              <View key={ci} style={styles.cell}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: bg },
                    cell.isToday && { borderWidth: 1.5, borderColor: colors.primary },
                    !closed && !cell.isToday && !cell.isFuture && styles.pastOpen,
                  ]}
                >
                  <AppText
                    variant="micro"
                    color={closed ? undefined : 'secondary'}
                    style={[
                      styles.dayText,
                      textColor != null && { color: textColor },
                      cell.isFuture && styles.future,
                    ]}
                    tabular
                  >
                    {cell.day}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekday: {
    width: DOT,
    textAlign: 'center',
  },
  cell: {
    width: DOT,
    alignItems: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 10,
    lineHeight: 12,
  },
  pastOpen: {
    opacity: 0.55,
  },
  future: {
    opacity: 0.4,
  },
});
