/**
 * Story share card (TZ §9) — the viral loop's face. Rendered OFFSCREEN at
 * 360×640 and captured at 1080×1920 for stories. Always the dark brand look
 * regardless of the app theme — it's a poster, not a screen.
 *
 * Content: streak flame + days, day score, optional city rank, friend code
 * (the receiver types it in «Рейтинг» → instant friendship — referral v1).
 */

import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { AppText, fonts, palette, spacing } from '@/shared/ui';

const CARD = palette.dark;

export type ShareCardData = {
  streak: number;
  score: number;
  cityRank: number | null;
  friendCode: string;
};

function Flame({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c.5 4-2.5 5.5-3.5 8C7.5 12.5 8 15 10 16.5c-.2-1.8.4-3 1.5-4 .3 2.2 2.3 2.7 2.5 5 .1 1.4-.6 2.6-1.5 3.5 3.5-.5 6-3.2 6-7 0-4.5-4-5.5-4-10-1.5 1-2.3 2.5-2.5 4C11 5.5 11.5 3.8 12 2Z"
        fill={CARD.streakFlame}
        stroke={CARD.streakFlame}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const ShareCard = forwardRef<View, { data: ShareCardData }>(function ShareCard(
  { data },
  ref,
) {
  const { t } = useTranslation();

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <AppText style={styles.wordmark}>STREEK FIT</AppText>

      <View style={styles.center}>
        <Flame size={96} />
        <AppText style={styles.streakNumber} tabular>
          {data.streak}
        </AppText>
        <AppText style={styles.streakLabel}>{t('share.daysStreak', { count: data.streak })}</AppText>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <AppText style={styles.statValue} tabular>
              {data.score}
            </AppText>
            <AppText style={styles.statLabel}>{t('share.scoreLabel')}</AppText>
          </View>
          {data.cityRank != null ? (
            <View style={styles.stat}>
              <AppText style={styles.statValue} tabular>
                #{data.cityRank}
              </AppText>
              <AppText style={styles.statLabel}>{t('share.rankLabel')}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <AppText style={styles.catchUp}>{t('share.catchUp')}</AppText>
        <View style={styles.codePill}>
          <AppText style={styles.code} tabular>
            {data.friendCode}
          </AppText>
        </View>
        <AppText style={styles.codeHint}>{t('share.codeHint')}</AppText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 640,
    backgroundColor: CARD.bg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 6,
    color: CARD.primary,
  },
  center: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakNumber: {
    fontFamily: fonts.display,
    fontSize: 120,
    lineHeight: 126,
    color: CARD.textPrimary,
  },
  streakLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: CARD.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.xl,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: CARD.streakFlame,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: CARD.textSecondary,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  catchUp: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: CARD.textPrimary,
  },
  codePill: {
    backgroundColor: CARD.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: 3,
    color: CARD.primary,
  },
  codeHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: CARD.textSecondary,
  },
});
