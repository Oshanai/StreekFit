/**
 * The one number of the day (TZ §6.1): push-ups + squats + steps (+ run in
 * Phase 4) fold into a single score.
 *
 * v1 weights, deliberately simple and documented so they are easy to tune:
 * - 1 valid rep = 10 points → a 3-set strength day at target 12 ≈ 360/exercise
 * - 10 steps = 1 point → the 7000-step goal ≈ 700
 * A full day (both exercises + steps) lands ≈ 1400–1500 — movement of any
 * kind matters, no single source dominates (комфорт, не насилие: §0).
 */

export const SCORE_WEIGHTS = {
  repPoints: 10,
  stepsPerPoint: 10,
  runMinutePoints: 15,
} as const;

export type DayInputs = {
  pushupReps: number;
  squatReps: number;
  steps: number;
  runMinutes: number;
};

export type DayScore = {
  total: number;
  fromReps: number;
  fromSteps: number;
  fromRun: number;
};

export function computeDayScore(inputs: DayInputs): DayScore {
  const fromReps = Math.max(0, inputs.pushupReps + inputs.squatReps) * SCORE_WEIGHTS.repPoints;
  const fromSteps = Math.floor(Math.max(0, inputs.steps) / SCORE_WEIGHTS.stepsPerPoint);
  const fromRun = Math.max(0, Math.round(inputs.runMinutes)) * SCORE_WEIGHTS.runMinutePoints;
  return { total: fromReps + fromSteps + fromRun, fromReps, fromSteps, fromRun };
}

export type DayTargets = {
  pushup_target: number;
  squat_target: number;
  steps_target: number;
};

/** Daily goal in points: 3 sets of each exercise at target + the steps goal. */
export function computeDayGoal(targets: DayTargets): number {
  const strength = 3 * (targets.pushup_target + targets.squat_target) * SCORE_WEIGHTS.repPoints;
  const steps = Math.floor(targets.steps_target / SCORE_WEIGHTS.stepsPerPoint);
  return strength + steps;
}
