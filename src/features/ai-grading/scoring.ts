/**
 * Score rules decided by the owner on 17/10/2026 (plan §4.5): each question is all-or-nothing,
 * the paper total is rounded to a whole number (.5 up) before the +1 "tích cực tương tác" bonus,
 * and the final score is capped at 10. SQL twin: grading_raw_score in
 * 20261021090000_ai_grading_worker.sql (rounding and the bonus land with approval in phase 3b).
 */

export type Verdict = "correct" | "incorrect" | "missing";

export interface ScoredQuestion {
  label: string;
  max_points: number | null;
}

/** Sum of the points of the questions marked correct. */
export function rawScore(questions: readonly ScoredQuestion[], verdicts: Readonly<Record<string, Verdict>>): number {
  return questions.reduce((sum, question) => sum + (verdicts[question.label] === "correct" ? (question.max_points ?? 0) : 0), 0);
}

/** Half-up rounding that is safe for the quarter-point steps a key allows (7.5 → 8, 7.25 → 7). */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + 1e-9);
}

export function finalScore(raw: number, bonus: boolean): number {
  return Math.min(10, roundHalfUp(raw) + (bonus ? 1 : 0));
}
