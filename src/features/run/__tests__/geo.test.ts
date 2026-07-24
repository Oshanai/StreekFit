import {
  MAX_ACCURACY_M,
  appendPoint,
  formatDuration,
  formatPace,
  haversineM,
  runStats,
  simplifyTrack,
  trackBounds,
  trackToGeoJson,
  type GeoPoint,
} from '../geo';

const pt = (
  latitude: number,
  longitude: number,
  accuracy = 5,
  timestamp = 0,
): GeoPoint => ({ latitude, longitude, accuracy, timestamp });

describe('run geometry (TZ §5)', () => {
  it('haversine matches a known distance (~111.19 km per degree of latitude)', () => {
    const d = haversineM(pt(43.238949, 76.889709), pt(44.238949, 76.889709));
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('accepts clean fixes and accumulates distance', () => {
    const track: GeoPoint[] = [];
    appendPoint(track, pt(43.2389, 76.8897, 5, 0));
    // ~87 m north
    const added = appendPoint(track, pt(43.23968, 76.8897, 5, 30_000));
    expect(track).toHaveLength(2);
    expect(added).toBeGreaterThan(80);
    expect(added).toBeLessThan(95);
  });

  it('rejects poor-accuracy fixes (urban canyon)', () => {
    const track: GeoPoint[] = [];
    appendPoint(track, pt(43.2389, 76.8897, 5, 0));
    const added = appendPoint(track, pt(43.24, 76.89, MAX_ACCURACY_M + 1, 5_000));
    expect(added).toBe(0);
    expect(track).toHaveLength(1);
  });

  it('rejects jitter below the minimum step (standing still)', () => {
    const track: GeoPoint[] = [];
    appendPoint(track, pt(43.2389, 76.8897, 5, 0));
    // ~1 m wiggle
    const added = appendPoint(track, pt(43.238909, 76.8897, 5, 3_000));
    expect(added).toBe(0);
    expect(track).toHaveLength(1);
  });

  it('computes duration and pace once movement is meaningful', () => {
    const track = [pt(43.2389, 76.8897, 5, 0)];
    // 1 km in 6 minutes → pace 6:00
    const stats = runStats(track, 1000, 360_000);
    expect(stats.durationMs).toBe(360_000);
    expect(stats.paceMinPerKm).toBeCloseTo(6, 5);
    // too little distance → pace withheld
    expect(runStats(track, 20, 60_000).paceMinPerKm).toBeNull();
  });

  it('serializes the track as GeoJSON lon/lat pairs', () => {
    const gj = trackToGeoJson([pt(43.2, 76.8), pt(43.3, 76.9)]);
    expect(gj.geometry.coordinates).toEqual([
      [76.8, 43.2],
      [76.9, 43.3],
    ]);
  });

  it('simplifies a long track to ≤ maxPoints keeping the endpoint', () => {
    const track: GeoPoint[] = Array.from({ length: 1000 }, (_, i) =>
      pt(43.2 + i * 0.0001, 76.8 + i * 0.0001, 5, i * 1000),
    );
    const simple = simplifyTrack(track, 200);
    expect(simple.length).toBeLessThanOrEqual(201);
    expect(simple[0]).toEqual([76.8, 43.2]);
    const last = simple[simple.length - 1];
    expect(last[1]).toBeCloseTo(43.2 + 999 * 0.0001, 6);
    // short tracks pass through untouched
    expect(simplifyTrack(track.slice(0, 3), 200)).toHaveLength(3);
    expect(simplifyTrack([], 200)).toEqual([]);
  });

  it('computes [west, south, east, north] bounds of a stored polyline', () => {
    expect(
      trackBounds([
        [76.8, 43.2],
        [76.9, 43.25],
        [76.85, 43.3],
      ]),
    ).toEqual([76.8, 43.2, 76.9, 43.3]);
    expect(trackBounds([[76.8, 43.2]])).toBeNull();
  });

  it('formats durations and pace for the HUD', () => {
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatPace(5.5)).toBe("5'30\"");
    expect(formatPace(null)).toBe('—');
  });
});
