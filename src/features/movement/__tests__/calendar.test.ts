import { buildMonthGrid, closedDaysInMonth } from '../calendar';
import type { DayRecord } from '../streak';

const rec = (date: string, status: DayRecord['status']): DayRecord => ({ date, status });

describe('month calendar grid (Monday-first)', () => {
  // July 2026: the 1st is a Wednesday, 31 days.
  const today = '2026-07-25';

  it('pads the first week to Monday and fills the tail', () => {
    const weeks = buildMonthGrid(today, []);
    expect(weeks[0]).toHaveLength(7);
    // Wednesday start → two padding cells (Mon, Tue)
    expect(weeks[0][0].date).toBeNull();
    expect(weeks[0][1].date).toBeNull();
    expect(weeks[0][2].day).toBe(1);
    // total cells divisible by 7, all 31 days present
    const days = weeks.flat().filter((c) => c.day != null);
    expect(days).toHaveLength(31);
    expect(weeks.flat().length % 7).toBe(0);
  });

  it('marks statuses, today and the future', () => {
    const weeks = buildMonthGrid(today, [
      rec('2026-07-24', 'full'),
      rec('2026-07-23', 'light'),
    ]);
    const flat = weeks.flat();
    expect(flat.find((c) => c.day === 24)?.status).toBe('full');
    expect(flat.find((c) => c.day === 23)?.status).toBe('light');
    expect(flat.find((c) => c.day === 25)?.isToday).toBe(true);
    expect(flat.find((c) => c.day === 26)?.isFuture).toBe(true);
    expect(flat.find((c) => c.day === 24)?.isFuture).toBe(false);
  });

  it('counts closed days only within the current month', () => {
    const n = closedDaysInMonth(today, [
      rec('2026-07-24', 'full'),
      rec('2026-07-23', 'light'),
      rec('2026-07-20', 'none'),
      rec('2026-06-30', 'full'), // прошлый месяц — не в счёт
    ]);
    expect(n).toBe(2);
  });
});
