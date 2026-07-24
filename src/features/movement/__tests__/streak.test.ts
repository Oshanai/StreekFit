import {
  DELOAD_EVERY,
  consecutiveFullDays,
  progressionDecision,
} from '../progression';
import { computeStreak, daysBetween, evaluateDay, type DayRecord } from '../streak';

describe('evaluateDay (TZ §6.2 — full / light / none)', () => {
  const base = { pushupSets: 3, squatSets: 3, steps: 7000, stepsTarget: 7000 };

  it('full day = 3+3 sets and the steps goal', () => {
    expect(evaluateDay(base)).toBe('full');
  });

  it('light day = steps goal without the strength volume', () => {
    expect(evaluateDay({ ...base, pushupSets: 2 })).toBe('light');
    expect(evaluateDay({ ...base, pushupSets: 0, squatSets: 0 })).toBe('light');
  });

  it('no steps goal — day stays open regardless of sets', () => {
    expect(evaluateDay({ ...base, steps: 6999 })).toBe('none');
  });
});

describe('computeStreak — chain with a single rest-day grace', () => {
  const rec = (date: string, status: DayRecord['status']): DayRecord => ({ date, status });

  it('counts consecutive closed days', () => {
    const records = [
      rec('2026-07-22', 'full'),
      rec('2026-07-23', 'light'),
      rec('2026-07-24', 'full'),
    ];
    expect(computeStreak(records, '2026-07-24')).toBe(3);
  });

  it('one rest day between closed days keeps the chain', () => {
    const records = [
      rec('2026-07-20', 'full'),
      // 21st — rest
      rec('2026-07-22', 'full'),
      rec('2026-07-23', 'full'),
    ];
    expect(computeStreak(records, '2026-07-23')).toBe(3);
  });

  it('two consecutive empty days break the chain', () => {
    const records = [
      rec('2026-07-18', 'full'),
      // 19th, 20th — rest
      rec('2026-07-21', 'full'),
    ];
    expect(computeStreak(records, '2026-07-21')).toBe(1);
  });

  it('an unclosed today keeps yesterday-ending chains alive', () => {
    const records = [rec('2026-07-22', 'full'), rec('2026-07-23', 'full')];
    expect(computeStreak(records, '2026-07-24')).toBe(2);
  });

  it('a chain that ended 2 days ago is still rescuable today (grace)', () => {
    const records = [rec('2026-07-22', 'full')];
    expect(computeStreak(records, '2026-07-24')).toBe(1);
  });

  it('a chain that ended 3 days ago is dead', () => {
    const records = [rec('2026-07-21', 'full')];
    expect(computeStreak(records, '2026-07-24')).toBe(0);
  });

  it('daysBetween handles month boundaries', () => {
    expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1);
    expect(daysBetween('2026-08-01', '2026-07-31')).toBe(-1);
  });
});

describe('progression (TZ §6.3 — gentle growth with a deload wave)', () => {
  const rec = (date: string, status: DayRecord['status']): DayRecord => ({ date, status });

  it('counts strictly consecutive calendar full days', () => {
    const records = [
      rec('2026-07-22', 'full'),
      rec('2026-07-23', 'full'),
      rec('2026-07-24', 'full'),
    ];
    expect(consecutiveFullDays(records, '2026-07-24')).toBe(3);
    // a light day in the middle breaks the run
    expect(
      consecutiveFullDays(
        [rec('2026-07-22', 'full'), rec('2026-07-23', 'light'), rec('2026-07-24', 'full')],
        '2026-07-24',
      ),
    ).toBe(1);
    // a календарный gap breaks it too
    expect(
      consecutiveFullDays([rec('2026-07-21', 'full'), rec('2026-07-24', 'full')], '2026-07-24'),
    ).toBe(1);
  });

  it('fires +1 on every 3rd consecutive full day', () => {
    const state = { pushupTarget: 10, squatTarget: 12, increasesCount: 0 };
    expect(progressionDecision(state, 2).type).toBe('none');
    const d = progressionDecision(state, 3);
    expect(d).toEqual({ type: 'increase', pushupTarget: 11, squatTarget: 13, increasesCount: 1 });
    expect(progressionDecision(state, 4).type).toBe('none'); // not a multiple
    expect(progressionDecision(state, 6).type).toBe('increase');
  });

  it(`every ${DELOAD_EVERY}th change is a deload with a floor of 5`, () => {
    const d = progressionDecision({ pushupTarget: 20, squatTarget: 6, increasesCount: 3 }, 3);
    expect(d.type).toBe('deload');
    if (d.type === 'deload') {
      expect(d.pushupTarget).toBe(17); // 20 * 0.85
      expect(d.squatTarget).toBe(5); // floor
      expect(d.increasesCount).toBe(4);
    }
  });
});
