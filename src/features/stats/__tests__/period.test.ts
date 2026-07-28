import {
  addDays,
  bestDay,
  bestPeriod,
  groupByMonth,
  groupByWeek,
  localDateKey,
  mondayOf,
  monthOf,
  parseDateKey,
} from '../period';

describe('date keys', () => {
  it('localDateKey pads month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('parseDateKey round-trips as local midnight', () => {
    const d = parseDateKey('2026-07-26');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(26);
    expect(d.getHours()).toBe(0);
  });

  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('mondayOf', () => {
  // 2026-07-20 is a Monday.
  it.each([
    ['2026-07-20', '2026-07-20'], // Monday stays
    ['2026-07-22', '2026-07-20'], // Wednesday
    ['2026-07-26', '2026-07-20'], // Sunday belongs to the week that started Monday
    ['2026-07-27', '2026-07-27'], // next Monday
  ])('%s → %s', (day, monday) => {
    expect(mondayOf(day)).toBe(monday);
  });
});

describe('grouping', () => {
  const rows = [
    { date: '2026-07-20', score: 10, steps: 1000 }, // week of 07-20
    { date: '2026-07-26', score: 20, steps: 2000 }, // same week (Sunday)
    { date: '2026-07-27', score: 30, steps: 3000 }, // next week
    { date: '2026-06-30', score: 5, steps: 500 }, // June
  ];

  it('groupByWeek sums into Monday buckets, ascending', () => {
    const weeks = groupByWeek(rows);
    expect(weeks.map((w) => w.period)).toEqual(['2026-06-29', '2026-07-20', '2026-07-27']);
    const mid = weeks[1];
    expect(mid).toEqual({ period: '2026-07-20', score: 30, steps: 3000, days: 2 });
  });

  it('groupByMonth sums into YYYY-MM buckets', () => {
    const months = groupByMonth(rows);
    expect(months.map((m) => m.period)).toEqual(['2026-06', '2026-07']);
    expect(months[1].score).toBe(60);
    expect(monthOf('2026-07-20')).toBe('2026-07');
  });

  it('bestPeriod and bestDay pick the max score', () => {
    expect(bestPeriod(groupByWeek(rows))?.period).toBe('2026-07-20');
    expect(bestDay(rows)?.date).toBe('2026-07-27');
    expect(bestPeriod([])).toBeNull();
    expect(bestDay([])).toBeNull();
  });
});
