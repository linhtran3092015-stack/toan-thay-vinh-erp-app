import type { CombinedGrade, StoredKey } from "@/features/ai-grading/grading";
import { rawScore, roundHalfUp, type Verdict } from "@/features/ai-grading/scoring";

/**
 * Regression set for AI grading (plan §7 "Bộ đề hồi quy"): papers a TA already approved, graded
 * again with the production request, and compared with what the TA confirmed. Pure part, unit
 * tested in tests/unit/ai-grading-regression.test.ts.
 */

export interface RegressionPaper {
  answerText: string;
  grade: number | null;
  key: StoredKey;
  keyVersion: number;
  /** The production AI result the TA reviewed (null when the AI did not grade it). */
  live: { color: string | null; flags: string[]; verdicts: Record<string, Verdict> | null };
  sessionDate: string;
  submissionId: string;
  /** What the TA approved: verdict per question and the rounded paper score (no +1). */
  ta: { paperScore: number | null; verdicts: Record<string, Verdict> };
  testTitle: string | null;
}

/** Blank forms (the test was done on paper and the TA ticked it by hand) say nothing about the AI. */
export function excludeReason(paper: RegressionPaper): "blank" | null {
  if (!paper.answerText.trim() || paper.live.flags.includes("empty")) return "blank";
  return null;
}

/** "missing" and "incorrect" both score 0, so only right/wrong counts as a difference. */
const isRight = (verdict: Verdict | undefined) => verdict === "correct";

export function paperScore(key: StoredKey, verdicts: Readonly<Record<string, Verdict>>): number {
  return roundHalfUp(rawScore(key.questions, verdicts));
}

export interface PaperComparison {
  aiScore: number | null;
  color: CombinedGrade["color"];
  /** Questions where the regrade and the TA disagree on right/wrong. */
  differences: Array<{ ai: Verdict | null; extracted: string; label: string; reason: string; ta: Verdict }>;
  /** The regrade agrees with the production run the TA saw, question by question. */
  liveAgrees: boolean | null;
  questionCount: number;
  runsAgree: boolean;
  submissionId: string;
  taScore: number;
  usedTiebreak: boolean;
}

export function comparePaper(paper: RegressionPaper, combined: CombinedGrade): PaperComparison {
  const verdicts = combined.verdicts;
  const differences: PaperComparison["differences"] = [];
  for (const question of paper.key.questions) {
    const ta = paper.ta.verdicts[question.label];
    const ai = verdicts ? verdicts[question.label] : null;
    if (verdicts && isRight(ai ?? undefined) === isRight(ta)) continue;
    const detail = combined.questions.find((item) => item.label === question.label);
    differences.push({ ai, extracted: detail?.extracted_final_answer ?? "", label: question.label, reason: detail?.reason_for_teacher ?? "", ta });
  }
  const liveVerdicts = paper.live.verdicts;
  return {
    aiScore: verdicts ? paperScore(paper.key, verdicts) : null,
    color: combined.color,
    differences,
    liveAgrees:
      liveVerdicts && verdicts
        ? paper.key.questions.every((question) => isRight(liveVerdicts[question.label]) === isRight(verdicts[question.label]))
        : null,
    questionCount: paper.key.questions.length,
    runsAgree: combined.runsAgree,
    submissionId: paper.submissionId,
    taScore: paperScore(paper.key, paper.ta.verdicts),
    usedTiebreak: combined.usedTiebreak,
  };
}

export interface RegressionSummary {
  /** Plan §6 phase 0 bars: ≥90% exact, ≥98% within one point, no 2+ point miss left green. */
  bars: { exact: boolean; noSilentBigMiss: boolean; withinOne: boolean };
  bigMisses: PaperComparison[];
  colors: Record<CombinedGrade["color"], number>;
  compared: number;
  exact: number;
  greenWrong: number;
  liveAgreement: { agree: number; compared: number };
  questions: { compared: number; different: number };
  runsAgree: number;
  tiebreaks: number;
  withinOne: number;
}

export function summarize(results: readonly PaperComparison[]): RegressionSummary {
  const graded = results.filter((result) => result.aiScore !== null);
  const scoreGap = (result: PaperComparison) => Math.abs((result.aiScore ?? 0) - result.taScore);
  const bigMisses = graded.filter((result) => scoreGap(result) >= 2);
  const exact = graded.filter((result) => result.differences.length === 0).length;
  const withinOne = graded.filter((result) => scoreGap(result) <= 1).length;
  const colors = { green: 0, red: 0, yellow: 0 };
  for (const result of results) colors[result.color] += 1;
  const live = results.filter((result) => result.liveAgrees !== null);
  return {
    bars: {
      exact: graded.length > 0 && exact / graded.length >= 0.9,
      noSilentBigMiss: bigMisses.every((result) => result.color !== "green"),
      withinOne: graded.length > 0 && withinOne / graded.length >= 0.98,
    },
    bigMisses,
    colors,
    compared: graded.length,
    exact,
    greenWrong: results.filter((result) => result.color === "green" && result.differences.length > 0).length,
    liveAgreement: { agree: live.filter((result) => result.liveAgrees).length, compared: live.length },
    questions: {
      compared: graded.reduce((sum, result) => sum + result.questionCount, 0),
      different: graded.reduce((sum, result) => sum + result.differences.length, 0),
    },
    runsAgree: results.filter((result) => result.runsAgree).length,
    tiebreaks: results.filter((result) => result.usedTiebreak).length,
    withinOne,
  };
}
