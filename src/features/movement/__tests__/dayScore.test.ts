import { computeDayGoal, computeDayScore } from '../dayScore';

describe('day score v1 (TZ §6.1 — one number for the day)', () => {
  it('folds workouts, steps and run into one number', () => {
    const s = computeDayScore({ pushupReps: 20, squatReps: 30, steps: 7000, runMinutes: 0 });
    expect(s.fromReps).toBe(500); // 50 reps × 10
    expect(s.fromSteps).toBe(700); // 7000 steps / 10
    expect(s.fromRun).toBe(0);
    expect(s.total).toBe(1200);
  });

  it('floors partial step points and clamps negative inputs', () => {
    const s = computeDayScore({ pushupReps: -5, squatReps: 0, steps: 9, runMinutes: -3 });
    expect(s.fromReps).toBe(0);
    expect(s.fromSteps).toBe(0);
    expect(s.fromRun).toBe(0);
    expect(s.total).toBe(0);
  });

  it('counts run minutes once Phase 4 lands', () => {
    const s = computeDayScore({ pushupReps: 0, squatReps: 0, steps: 0, runMinutes: 20 });
    expect(s.fromRun).toBe(300);
  });

  it('daily goal = 3 sets of each exercise at target + the steps goal', () => {
    const goal = computeDayGoal({ pushup_target: 10, squat_target: 12, steps_target: 7000 });
    expect(goal).toBe(3 * 22 * 10 + 700); // 1360
  });
});
