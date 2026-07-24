import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { EmptyState, Screen } from '@/shared/ui';

/** Route replay is native-only (MapLibre); web gets the friendly fallback. */
export default function RunViewRoute() {
  const { t } = useTranslation();

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <EmptyState message={t('workout.unavailableBody')} />
      </Screen>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- platform gate
  const { RunViewScreen } = require('@/features/run/RunViewScreen') as
    typeof import('@/features/run/RunViewScreen');
  return <RunViewScreen />;
}
