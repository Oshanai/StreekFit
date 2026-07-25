import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { fetchCatalog } from '@/features/achievements/api';
import { Badge } from '@/features/achievements/Badge';
import { type CatalogRow } from '@/features/achievements/catalog';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCurrentStreak } from '@/features/movement/useStreak';
import { useLanguageTransition } from '@/i18n/LanguageTransition';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Chip,
  ScalePressable,
  Screen,
  spacing,
  useTheme,
} from '@/shared/ui';
import type { ThemeMode } from '@/shared/ui/ThemeProvider';

const THEME_MODES: ThemeMode[] = ['dark', 'light', 'violet'];

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  kk: 'settings.languageKk',
  ru: 'settings.languageRu',
  en: 'settings.languageEn',
};

function Chevron({ open, color }: { open: boolean; color: string }) {
  const rotation = useSharedValue(open ? 180 : 0);
  React.useEffect(() => {
    rotation.value = withTiming(open ? 180 : 0, { duration: 200 });
  }, [open, rotation]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="m6 9 6 6 6-6"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** Collapsed row shows the current value; tap slides the options open below. */
function SettingsDisclosure({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <ScalePressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={label}>
        <View style={styles.disclosureHeader}>
          <AppText variant="body" color="secondary">
            {label}
          </AppText>
          <View style={styles.disclosureValue}>
            <AppText variant="bodyBold">{value}</AppText>
            <Chevron open={open} color={colors.textSecondary} />
          </View>
        </View>
      </ScalePressable>
      {open ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutUp.duration(150)}
          style={styles.disclosureBody}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { changeLanguage } = useLanguageTransition();
  const { profile, signOut } = useAuth();
  const { mode, setMode, colors } = useTheme();
  const streak = useCurrentStreak();
  const [openSection, setOpenSection] = useState<'theme' | 'language' | null>(null);

  const featured = profile?.featured_achievements ?? [];
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (featured.length === 0) return;
      let alive = true;
      void fetchCatalog().then((rows) => {
        if (alive) setCatalog(rows);
      });
      return () => {
        alive = false;
      };
       
    }, [featured.length]),
  );
  const featuredRows = featured
    .map((id) => catalog.find((r) => r.id === id))
    .filter((r): r is CatalogRow => r != null);

  const locationLine = [profile?.city, profile?.country].filter(Boolean).join(', ');

  return (
    <Screen insideTabs>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Avatar name={profile?.name} imageUrl={profile?.avatar_url} size={72} />
          <View style={styles.headerText}>
            <AppText variant="h2">{profile?.name ?? '—'}</AppText>
            {locationLine ? (
              <AppText variant="caption" color="secondary">
                {locationLine}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <AppText variant="micro" color="secondary">
              {t('profile.streak')}
            </AppText>
            <AppText variant="h1" color="accent" tabular>
              {streak}
            </AppText>
          </Card>
          <Card style={styles.statCard}>
            <AppText variant="micro" color="secondary">
              {t('profile.cityRank')}
            </AppText>
            <AppText variant="h1" tabular>
              {t('profile.noRankYet')}
            </AppText>
          </Card>
        </View>

        <Card style={styles.featured}>
          {featuredRows.length > 0 ? (
            <View style={styles.featuredRow}>
              {featuredRows.map((row) => (
                <Badge key={row.id} code={row.code} tier={row.tier} size={56} />
              ))}
            </View>
          ) : (
            <AppText variant="caption" color="secondary" style={styles.centered}>
              {t('profile.featuredEmpty')}
            </AppText>
          )}
        </Card>

        <Animated.View layout={LinearTransition.duration(220)}>
          <Card style={styles.settingsCard}>
            <SettingsDisclosure
              label={t('settings.theme')}
              value={t(`settings.theme_${mode}`)}
              open={openSection === 'theme'}
              onToggle={() => setOpenSection(openSection === 'theme' ? null : 'theme')}
            >
              <View style={styles.options}>
                {THEME_MODES.map((m) => (
                  <Chip
                    key={m}
                    label={t(`settings.theme_${m}`)}
                    selected={mode === m}
                    onPress={() => setMode(m)}
                  />
                ))}
              </View>
            </SettingsDisclosure>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <SettingsDisclosure
              label={t('settings.language')}
              value={t(LANGUAGE_LABEL_KEY[(i18n.language as AppLanguage) ?? 'ru'] ?? 'settings.languageRu')}
              open={openSection === 'language'}
              onToggle={() => setOpenSection(openSection === 'language' ? null : 'language')}
            >
              <View style={styles.options}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Chip
                    key={lang}
                    label={t(LANGUAGE_LABEL_KEY[lang])}
                    selected={i18n.language === lang}
                    onPress={() => changeLanguage(lang)}
                  />
                ))}
              </View>
            </SettingsDisclosure>
          </Card>
        </Animated.View>

        <Button label={t('auth.signOut')} onPress={signOut} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    gap: spacing.xs,
  },
  featured: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  featuredRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  centered: {
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.sm,
  },
  settingsCard: {
    gap: spacing.sm,
  },
  disclosureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  disclosureValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  disclosureBody: {
    paddingTop: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
