import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import { useCurrentStreak } from '@/features/movement/useStreak';
import { useLanguageTransition } from '@/i18n/LanguageTransition';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';
import { AppText, Avatar, Button, Card, Chip, Screen, spacing } from '@/shared/ui';

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  kk: 'settings.languageKk',
  ru: 'settings.languageRu',
  en: 'settings.languageEn',
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { changeLanguage } = useLanguageTransition();
  const { profile, signOut } = useAuth();
  const streak = useCurrentStreak();

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
          <AppText variant="caption" color="secondary" style={styles.centered}>
            {t('profile.featuredEmpty')}
          </AppText>
        </Card>

        <Card>
          <AppText variant="h3" style={styles.sectionTitle}>
            {t('settings.language')}
          </AppText>
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
        </Card>

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
  centered: {
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.sm,
  },
});
