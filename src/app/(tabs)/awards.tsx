import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fetchCatalog, fetchMyUnlocks, toggleFeatured, type UnlockedMap } from '@/features/achievements/api';
import { Badge } from '@/features/achievements/Badge';
import {
  BADGE_CODES,
  badgeNameKey,
  formatThreshold,
  tierNameKey,
  type CatalogRow,
} from '@/features/achievements/catalog';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppText, Card, ScalePressable, Screen, spacing, useTheme } from '@/shared/ui';

const POP_WINDOW_MS = 60 * 60 * 1000; // badges unlocked within the hour pop in

/** Awards tab: 6 silhouettes × 5 tiers; tap an earned badge → featured slot. */
export default function AwardsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [unlocked, setUnlocked] = useState<UnlockedMap>(new Map());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const featured = profile?.featured_achievements ?? [];

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([fetchCatalog(), fetchMyUnlocks()]).then(([rows, mine]) => {
        if (!alive) return;
        setCatalog(rows);
        setUnlocked(mine);
        // Freshness is computed at load time — render stays pure.
        const now = Date.now();
        setFreshIds(
          new Set(
            [...mine.entries()]
              .filter(([, at]) => now - new Date(at).getTime() < POP_WINDOW_MS)
              .map(([id]) => id),
          ),
        );
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const onBadgePress = (row: CatalogRow) => {
    if (!unlocked.has(row.id)) return;
    void toggleFeatured(featured, row.id).then(() => refreshProfile());
  };

  const unlockedCount = catalog.filter((r) => unlocked.has(r.id)).length;

  return (
    <Screen insideTabs>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppText variant="h1" style={styles.title}>
          {t('ach.title')}
        </AppText>
        <AppText variant="caption" color="secondary" style={styles.subtitle}>
          {t('ach.progress', { count: unlockedCount, total: catalog.length })} ·{' '}
          {t('ach.featuredHint')}
        </AppText>

        {BADGE_CODES.map((code) => {
          const rows = catalog.filter((r) => r.code === code);
          if (rows.length === 0) return null;
          return (
            <Card key={code} style={styles.groupCard}>
              <AppText variant="h3">{t(badgeNameKey(code))}</AppText>
              <View style={styles.tierRow}>
                {rows.map((row) => {
                  const isUnlocked = unlocked.has(row.id);
                  const isFresh = freshIds.has(row.id);
                  const isFeatured = featured.includes(row.id);
                  return (
                    <ScalePressable key={row.id} onPress={() => onBadgePress(row)}>
                      <View
                        style={[
                          styles.badgeCell,
                          isFeatured && {
                            backgroundColor: colors.primarySoft,
                            borderRadius: 14,
                          },
                        ]}
                      >
                        <Badge code={code} tier={row.tier} size={56} locked={!isUnlocked} pop={isFresh} />
                        <AppText variant="micro" color={isUnlocked ? 'accent' : 'secondary'} tabular>
                          {formatThreshold(row.threshold)}
                        </AppText>
                        <AppText variant="micro" color="secondary">
                          {t(tierNameKey(row.tier))}
                        </AppText>
                      </View>
                    </ScalePressable>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  groupCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badgeCell: {
    alignItems: 'center',
    gap: 2,
    padding: spacing.xs,
  },
});
