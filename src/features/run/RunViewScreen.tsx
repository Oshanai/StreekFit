/**
 * Route replay: a past run's stored polyline on the map, camera fitted to
 * the track bounds. NATIVE ONLY — lazy-required by the /run-view route.
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
} from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration, formatPace, trackBounds } from '@/features/run/geo';
import { fetchRun, type RunRecord } from '@/features/run/history';
import { AppText, Button, Card, LoadingState, spacing, useTheme } from '@/shared/ui';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function RunViewScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();

  const [run, setRun] = useState<RunRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    void fetchRun(params.id).then((r) => {
      setRun(r);
      setLoaded(true);
    });
  }, [params.id]);

  if (!loaded) return <LoadingState />;

  const track = run?.track ?? [];
  const bounds = trackBounds(track);
  if (run == null || bounds == null) {
    router.back();
    return null;
  }

  const km = (run.distanceM / 1000).toFixed(2);
  const pace = run.distanceM >= 100 ? run.minutes / (run.distanceM / 1000) : null;
  const date = new Date(run.performedAt).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.root}>
      <MapLibreMap style={StyleSheet.absoluteFill} mapStyle={STYLE_URL}>
        <Camera
          initialViewState={{
            bounds,
            padding: { top: 140, bottom: 140, left: 48, right: 48 },
          }}
        />
        <GeoJSONSource
          id="run-view-track"
          data={{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: track },
          }}
        >
          <Layer
            id="run-view-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.primary, 'line-width': 4 }}
          />
        </GeoJSONSource>
      </MapLibreMap>

      <View style={[styles.top, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <Card style={styles.summary}>
          <AppText variant="bodyBold">{date}</AppText>
          <View style={styles.metricsRow}>
            <AppText variant="h2" color="info" tabular>
              {km} {t('run.km')}
            </AppText>
            <AppText variant="h2" tabular>
              {formatDuration(run.minutes * 60_000)}
            </AppText>
            <AppText variant="h2" color="info" tabular>
              {formatPace(pace)}
            </AppText>
          </View>
        </Card>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={[styles.controlsPanel, { backgroundColor: colors.overlay }]}>
          <Button label={t('common.back')} variant="translucent" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  summary: {
    gap: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  controlsPanel: {
    borderRadius: 20,
    padding: spacing.sm,
  },
});
