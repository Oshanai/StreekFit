/**
 * Run geometry (TZ §5) — pure math over GPS points, fully testable.
 * Jittery/inaccurate fixes are filtered BEFORE they reach distance or the
 * polyline, so standing at a traffic light doesn't paint a scribble.
 */

export type GeoPoint = {
  latitude: number;
  longitude: number;
  /** Reported accuracy radius in meters (larger = worse). */
  accuracy: number;
  /** ms epoch. */
  timestamp: number;
};

/** Fixes worse than this are noise (urban canyons, cold GPS). */
export const MAX_ACCURACY_M = 35;
/** Movements shorter than this between fixes are jitter, not running. */
export const MIN_STEP_M = 3;

const EARTH_R = 6_371_000;

/** Haversine distance in meters. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Append a raw fix to the accepted track. Returns the added distance in
 * meters (0 when the fix was rejected). Mutates `track`.
 */
export function appendPoint(track: GeoPoint[], fix: GeoPoint): number {
  if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return 0;
  if (fix.accuracy > MAX_ACCURACY_M) return 0;

  const last = track[track.length - 1];
  if (last == null) {
    track.push(fix);
    return 0;
  }
  const step = haversineM(last, fix);
  if (step < MIN_STEP_M) return 0;
  track.push(fix);
  return step;
}

export type RunStats = {
  distanceM: number;
  durationMs: number;
  /** Minutes per km; null until there's enough movement to be meaningful. */
  paceMinPerKm: number | null;
};

export function runStats(track: GeoPoint[], distanceM: number, nowMs: number): RunStats {
  const start = track[0]?.timestamp ?? nowMs;
  const durationMs = Math.max(0, nowMs - start);
  const km = distanceM / 1000;
  const paceMinPerKm = km >= 0.05 ? durationMs / 60_000 / km : null;
  return { distanceM, durationMs, paceMinPerKm };
}

/** GeoJSON LineString for the map track layer (provider-independent). */
export function trackToGeoJson(track: GeoPoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: track.map((p) => [p.longitude, p.latitude]),
    },
  };
}

/** Even-stride downsample to ≤ maxPoints [lon, lat] pairs for storage. */
export function simplifyTrack(track: GeoPoint[], maxPoints = 200): [number, number][] {
  if (track.length === 0) return [];
  const stride = Math.max(1, Math.ceil(track.length / maxPoints));
  const out: [number, number][] = [];
  for (let i = 0; i < track.length; i += stride) {
    out.push([track[i].longitude, track[i].latitude]);
  }
  const last = track[track.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last.longitude || tail[1] !== last.latitude) {
    out.push([last.longitude, last.latitude]);
  }
  return out;
}

/** [west, south, east, north] of a stored polyline; null when too short. */
export function trackBounds(
  points: [number, number][],
): [number, number, number, number] | null {
  if (points.length < 2) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < west) west = lon;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

export function formatDuration(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatPace(paceMinPerKm: number | null): string {
  if (paceMinPerKm == null || !Number.isFinite(paceMinPerKm)) return '—';
  const m = Math.floor(paceMinPerKm);
  const s = Math.round((paceMinPerKm - m) * 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
}
