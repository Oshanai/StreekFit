/**
 * Weekly report popup (TZ §17.1): first open after Monday 00:00 shows last
 * week's totals with deltas vs the week before. Reference: Qozgal's report.
 */

import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';

import { AppText, Button, spacing, radii, useTheme } from '@/shared/ui';

import { parseDateKey, addDays } from './period';
import type { WeeklyReport } from './api';

function DeltaTag({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  const { colors } = useTheme();
  if (value == null) return null;
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? colors.textSecondary : up ? colors.success : colors.error;
  const text = flat ? '0' : `${up ? '+' : '−'}${Math.abs(value)}${suffix}`;
  return (
    <View style={[styles.deltaTag, { backgroundColor: flat ? colors.surfaceRaised : `${color}22` }]}>
      {!flat ? (
        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
          <Path
            d={up ? 'M12 19V5m0 0-6 6m6-6 6 6' : 'M12 5v14m0 0 6-6m-6 6-6-6'}
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
      <AppText variant="micro" tabular style={{ color }}>
        {text}
      </AppText>
    </View>
  );
}

function ReportRow({
  label,
  value,
  delta,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  delta: number | null;
  suffix?: string;
  accent?: 'accent' | 'info';
}) {
  return (
    <View style={styles.reportRow}>
      <AppText variant="caption" color="secondary" style={styles.rowLabel}>
        {label}
      </AppText>
      <View style={styles.rowRight}>
        <AppText variant="bodyBold" color={accent} tabular>
          {value}
        </AppText>
        <DeltaTag value={delta} suffix={suffix} />
      </View>
    </View>
  );
}

export function WeeklyReportModal({
  report,
  visible,
  onClose,
}: {
  report: WeeklyReport;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const fmt = (key: string) =>
    parseDateKey(key).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const range = `${fmt(report.weekStart)} – ${fmt(addDays(report.weekStart, 6))}`;
  const { totals, delta } = report;

  const share = async () => {
    if (sharing || cardRef.current == null) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri.startsWith('file://') ? uri : `file://${uri}`, {
          mimeType: 'image/png',
          dialogTitle: 'Streek Fit',
        });
      }
    } catch {
      // Best-effort — sharing must never crash the report.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.cardWrap}>
          <View
            ref={cardRef}
            collapsable={false}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <AppText variant="h2" style={styles.centered}>
              {t('stats.weeklyTitle')}
            </AppText>
            <AppText variant="caption" color="secondary" style={styles.centered}>
              {range}
            </AppText>

            <View style={styles.scoreBlock}>
              <AppText variant="display" color="accent" tabular>
                {totals.score}
              </AppText>
              <View style={styles.scoreCaption}>
                <AppText variant="caption" color="secondary">
                  {t('stats.scoreWeek')}
                </AppText>
                <DeltaTag value={delta?.score ?? null} />
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <ReportRow
              label={t('stats.steps')}
              value={totals.steps.toLocaleString(i18n.language)}
              delta={delta?.steps ?? null}
              accent="info"
            />
            <ReportRow
              label={t('stats.pushups')}
              value={String(totals.pushups)}
              delta={delta?.pushups ?? null}
            />
            <ReportRow
              label={t('stats.squats')}
              value={String(totals.squats)}
              delta={delta?.squats ?? null}
            />
            {totals.runKm > 0 || (delta?.runKm ?? 0) !== 0 ? (
              <ReportRow
                label={t('stats.run')}
                value={`${totals.runKm}`}
                delta={delta?.runKm ?? null}
                suffix=""
                accent="info"
              />
            ) : null}
            <ReportRow
              label={t('stats.fullDays')}
              value={String(totals.fullDays)}
              delta={delta?.fullDays ?? null}
              accent="accent"
            />
          </View>

          <View style={styles.actions}>
            <Button label={t('share.button')} onPress={() => void share()} loading={sharing} />
            <Button label={t('common.close')} variant="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cardWrap: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
  scoreBlock: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  scoreCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  rowLabel: {
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deltaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  actions: {
    gap: spacing.xs,
  },
});
