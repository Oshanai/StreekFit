/**
 * Period math for stats (TZ §17): local-date keys, Monday-based weeks,
 * grouping day rows into week/month buckets and picking records.
 * Pure functions — no I/O, fully unit-tested.
 */

export type DayRow = {
  /** Local YYYY-MM-DD. */
  date: string;
  score: number;
  steps: number;
};

/** Local YYYY-MM-DD of a Date (device timezone — how users think of days). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as LOCAL midnight (new Date('YYYY-MM-DD') would be UTC). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** Monday of the week containing the given day (weeks run Mon → Sun). */
export function mondayOf(key: string): string {
  const d = parseDateKey(key);
  const shift = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - shift);
  return localDateKey(d);
}

/** YYYY-MM of a day key. */
export function monthOf(key: string): string {
  return key.slice(0, 7);
}

export type PeriodTotals = {
  /** Week-start or month key. */
  period: string;
  score: number;
  steps: number;
  days: number;
};

function accumulate(map: Map<string, PeriodTotals>, period: string, row: DayRow): void {
  const bucket = map.get(period) ?? { period, score: 0, steps: 0, days: 0 };
  bucket.score += row.score;
  bucket.steps += row.steps;
  bucket.days += 1;
  map.set(period, bucket);
}

/** Group day rows into Monday-keyed weeks, ascending by period. */
export function groupByWeek(rows: DayRow[]): PeriodTotals[] {
  const map = new Map<string, PeriodTotals>();
  for (const row of rows) accumulate(map, mondayOf(row.date), row);
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/** Group day rows into YYYY-MM months, ascending by period. */
export function groupByMonth(rows: DayRow[]): PeriodTotals[] {
  const map = new Map<string, PeriodTotals>();
  for (const row of rows) accumulate(map, monthOf(row.date), row);
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/** Highest-scoring entry, or null when empty. */
export function bestPeriod(periods: PeriodTotals[]): PeriodTotals | null {
  let best: PeriodTotals | null = null;
  for (const p of periods) {
    if (best == null || p.score > best.score) best = p;
  }
  return best;
}

export function bestDay(rows: DayRow[]): DayRow | null {
  let best: DayRow | null = null;
  for (const r of rows) {
    if (best == null || r.score > best.score) best = r;
  }
  return best;
}
