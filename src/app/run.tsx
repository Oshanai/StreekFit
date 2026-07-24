import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { EmptyState, Screen } from '@/shared/ui';

/**
 * Run route (TZ §5): map + GPS are native-only (MapLibre/nitro), so web gets
 * the friendly fallback; the paid gate lives inside RunScreen.
 */
export default function RunRoute() {
  const { t } = useTranslation();

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <EmptyState message={t('workout.unavailableBody')} />
      </Screen>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform gate
  const { RunScreen } = require('@/features/run/RunScreen') as
    typeof import('@/features/run/RunScreen');
  return <RunScreen />;
}
