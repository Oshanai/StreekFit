import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';
import { Button } from './Button';
import { useTheme } from './ThemeProvider';
import { spacing } from './tokens';

/** Full-area loading state. Use skeletons for content-shaped loads later. */
export function LoadingState() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.center} accessibilityLabel={t('common.loading')}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      <AppText variant="body" color="secondary" style={styles.centeredText}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.center}>
      <AppText variant="body" color="secondary" style={styles.centeredText}>
        {t('common.error')}
      </AppText>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  centeredText: {
    textAlign: 'center',
  },
});
