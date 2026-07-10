import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLanguageTransition } from '@/i18n/LanguageTransition';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';
import { AppText, Card, ScalePressable, Screen, radii, spacing, useTheme } from '@/shared/ui';

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  kk: 'settings.languageKk',
  ru: 'settings.languageRu',
  en: 'settings.languageEn',
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { changeLanguage } = useLanguageTransition();
  const { colors } = useTheme();

  return (
    <Screen insideTabs>
      <AppText variant="h1" style={styles.title}>
        {t('tabs.profile')}
      </AppText>

      <Card>
        <AppText variant="h3" style={styles.sectionTitle}>
          {t('settings.language')}
        </AppText>
        <View style={styles.options}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const selected = i18n.language === lang;
            return (
              <ScalePressable
                key={lang}
                onPress={() => changeLanguage(lang)}
                accessibilityRole="radio"
                accessibilityLabel={t(LANGUAGE_LABEL_KEY[lang])}
                accessibilityState={{ selected }}
              >
                <View
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? colors.primarySoft : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <AppText variant="bodyBold" color={selected ? 'accent' : 'primary'}>
                    {t(LANGUAGE_LABEL_KEY[lang])}
                  </AppText>
                </View>
              </ScalePressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});
