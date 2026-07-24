/**
 * Run screen (TZ §5) — NATIVE ONLY, lazy-required by the route. The map is
 * MapLibre with keyless OpenFreeMap tiles and loads ONLY here; the track
 * layer is plain GeoJSON — provider-independent by construction. The whole
 * screen sits behind the subscription gate (dev builds unlocked).
 */

import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePremium } from '@/features/leaderboard/usePremium';
import { enqueueSession } from '@/features/movement/sessionQueue';
import { AppText, Button, Card, ErrorState, LoadingState, spacing, useTheme } from '@/shared/ui';

import {
  formatDuration,
  formatPace,
  runStats,
  trackToGeoJson,
  type GeoPoint,
} from './geo';
import { isRunActive, requestRunPermissions, runSnapshot, startRun, stopRun, type RunPermission } from './tracker';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const EMPTY_TRACK: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function RunScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { premium } = usePremium();

  const [permission, setPermission] = useState<RunPermission | 'asking'>('asking');
  const [active, setActive] = useState(false);
  const [hud, setHud] = useState({ distanceM: 0, durationMs: 0, pace: null as number | null });
  // A LineString needs ≥2 points — feed an empty collection until then,
  // otherwise MapLibre logs an invalid-geometry warning every poll.
  const [geojson, setGeojson] = useState<GeoJSON.GeoJSON>(EMPTY_TRACK);
  const trackRef = useRef<GeoPoint[]>([]);
  const finishing = useRef(false);

  useEffect(() => {
    if (!premium) return;
    void requestRunPermissions().then(setPermission);
    void isRunActive().then(setActive);
  }, [premium]);

  // 1 Hz HUD/track poll — never per-fix re-renders (TZ §11).
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const snap = runSnapshot();
      trackRef.current = snap.track;
      const stats = runStats(snap.track, snap.distanceM, Date.now());
      setHud({ distanceM: snap.distanceM, durationMs: stats.durationMs, pace: stats.paceMinPerKm });
      setGeojson(snap.track.length >= 2 ? trackToGeoJson(snap.track) : EMPTY_TRACK);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const begin = () => {
    void startRun().then(() => setActive(true));
  };

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    void stopRun().then(({ track, distanceM }) => {
      const stats = runStats(track, distanceM, Date.now());
      // Only meaningful runs land in the day (≥100 m keeps GPS smoke out).
      if (distanceM >= 100) {
        void enqueueSession({
          type: 'run',
          minutes: Math.round((stats.durationMs / 60_000) * 100) / 100,
          distanceM: Math.round(distanceM),
          setsDone: 1,
          verified: true,
          performedAt: new Date().toISOString(),
        });
      }
      router.back();
    });
  };

  if (!premium) {
    return (
      <View style={[styles.lockWrap, { backgroundColor: colors.bg }]}>
        <Card style={styles.lockCard}>
          <AppText variant="h2" style={styles.centered}>
            {t('run.locked')}
          </AppText>
          <AppText variant="body" color="secondary" style={styles.centered}>
            {t('run.lockedBody')}
          </AppText>
          <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }
  if (permission === 'asking') return <LoadingState />;
  if (permission === 'denied') {
    return <ErrorState title={t('run.title')} message={t('run.permissionBody')} />;
  }

  const km = (hud.distanceM / 1000).toFixed(2);

  return (
    <View style={styles.root}>
      <MapLibreMap style={StyleSheet.absoluteFill} mapStyle={STYLE_URL}>
        <Camera trackUserLocation="default" initialViewState={{ zoom: 16 }} />
        <UserLocation />
        <GeoJSONSource id="run-track" data={geojson}>
          <Layer
            id="run-track-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.primary, 'line-width': 4 }}
          />
        </GeoJSONSource>
      </MapLibreMap>

      <View style={[styles.hud, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <Card style={styles.metrics}>
          <View style={styles.metric}>
            <AppText variant="h1" tabular>
              {formatDuration(hud.durationMs)}
            </AppText>
            <AppText variant="micro" color="secondary">
              {t('run.time')}
            </AppText>
          </View>
          <View style={styles.metric}>
            <AppText variant="h1" tabular>
              {km}
            </AppText>
            <AppText variant="micro" color="secondary">
              {t('run.km')}
            </AppText>
          </View>
          <View style={styles.metric}>
            <AppText variant="h1" tabular>
              {formatPace(hud.pace)}
            </AppText>
            <AppText variant="micro" color="secondary">
              {t('run.pace')}
            </AppText>
          </View>
        </Card>
        {permission === 'foreground-only' && active ? (
          <Card style={styles.hintCard}>
            <AppText variant="caption" color="secondary" style={styles.centered}>
              {t('run.foregroundHint')}
            </AppText>
          </Card>
        ) : null}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        {active ? (
          <Button label={t('run.finish')} onPress={finish} />
        ) : (
          <Button label={t('run.start')} onPress={begin} />
        )}
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  hintCard: {
    paddingVertical: spacing.sm,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
});
