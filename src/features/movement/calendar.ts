/**
 * Month grid for the «не разорви цепочку» calendar — pure date math.
 * Weeks start on Monday (RU/KZ convention).
 */

import type { DayRecord, DayStatus } from './streak';

export type CalendarCell = {
  /** 'YYYY-MM-DD', or null for padding cells outside the month. */
  date: string | null;
  day: number | null;
  status: DayStatus;
  isToday: boolean;
  isFuture: boolean;
};

function dateKey(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Weeks (rows of 7, Monday first) for the month containing `todayKey`. */
export function buildMonthGrid(todayKey: string, records: DayRecord[]): CalendarCell[][] {
  const [year, month, todayDay] = todayKey.split('-').map(Number);
  const month0 = month - 1;
  const statusByDate = new Map(records.map((r) => [r.date, r.status]));

  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const firstWeekday = (new Date(year, month0, 1).getDay() + 6) % 7; // 0 = Monday

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ date: null, day: null, status: 'none', isToday: false, isFuture: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = dateKey(year, month0, day);
    cells.push({
      date,
      day,
      status: statusByDate.get(date) ?? 'none',
      isToday: day === todayDay,
      isFuture: day > todayDay,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, status: 'none', isToday: false, isFuture: false });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** Closed (light or full) day count within the month of `todayKey`. */
export function closedDaysInMonth(todayKey: string, records: DayRecord[]): number {
  const prefix = todayKey.slice(0, 7);
  return records.filter((r) => r.date.startsWith(prefix) && r.status !== 'none').length;
}
