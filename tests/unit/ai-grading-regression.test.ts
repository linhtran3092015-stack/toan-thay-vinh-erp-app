// Value: protects=the AI grading regression report: a paper only counts as matching when every question has the TA's right/wrong ("missing" and "wrong" both score 0), scores use the owner's rounding, blank paper-test forms stay out, and the plan's phase 0 bars (≥90% exact, ≥98% within one point, no 2+ point miss left green) are judged on graded papers only;
// fails_when=a wrong question is counted as a match, a green 2-point miss passes the bar, a failed regrade inflates the rates, or blank forms are graded;
// why_new=regression set built from approved papers (plan §7); seam=pure compare module fed with combineRuns output; no_claim=the Batch API calls and the production export (scripts/ai-grading-regression/main.ts)
import { describe, expect, it } from "vitest";

import { combineRuns, type ParsedGrade, type StoredKey } from "@/features/ai-grading/grading";
import type { Verdict } from "@/features/ai-grading/scoring";

import { comparePaper, excludeReason, summarize, type RegressionPaper } from "../../scripts/ai-grading-regression/compare";

const KEY: StoredKey = {
  questions: [
    { final_answer: "40", label: "1", max_points: 2.5 },
    { final_answer: "4", label: "2", max_points: 2.5 },
    { final_answer: "12", label: "3", max_points: 5 },
  ],
};

function paper(ta: Record<string, Verdict>, extra: Partial<RegressionPaper> = {}): RegressionPaper {
  return {
    answerText: "1. 40\n2. 4\n3. 12",
    grade: 3,
    key: KEY,
    keyVersion: 1,
    live: { color: "green", flags: [], verdicts: ta },
    sessionDate: "2026-10-21",
    submissionId: "11111111-1111-4111-8111-111111111111",
    ta: { paperScore: null, verdicts: ta },
    testTitle: null,
    ...extra,
  };
}

function run(verdicts: Record<string, Verdict>, confidence: "high" | "low" = "high"): ParsedGrade {
  return {
    confidence,
    flags: [],
    ok: true,
    questions: Object.entries(verdicts).map(([label, verdict]) => ({
      error_location: "",
      extracted_final_answer: verdict === "correct" ? "ok" : "41",
      label,
      note_for_parent: "",
      reason_for_teacher: `câu ${label}`,
      verdict,
    })),
    verdicts,
  };
}

const allRight = { "1": "correct", "2": "correct", "3": "correct" } as const;

describe("AI grading regression compare", () => {
  it("matches when right/wrong agree, treating missing and wrong as the same 0 points", () => {
    const ta = { "1": "correct", "2": "incorrect", "3": "missing" } as const;
    const ai = { "1": "correct", "2": "missing", "3": "incorrect" } as const;
    const result = comparePaper(paper(ta), combineRuns(KEY, [run(ai), run(ai)]));
    expect(result).toMatchObject({ aiScore: 3, color: "green", differences: [], liveAgrees: true, runsAgree: true, taScore: 3 });
  });

  it("lists each question the regrade gets wrong, with what the AI read and why", () => {
    const ta = { "1": "correct", "2": "correct", "3": "correct" } as const;
    const ai = { "1": "correct", "2": "correct", "3": "incorrect" } as const;
    const result = comparePaper(paper(ta), combineRuns(KEY, [run(ai), run(ai)]));
    expect(result.differences).toEqual([{ ai: "incorrect", extracted: "41", label: "3", reason: "câu 3", ta: "correct" }]);
    expect([result.aiScore, result.taScore]).toEqual([5, 10]);
  });

  it("leaves blank forms out (done on paper, ticked by hand)", () => {
    expect(excludeReason(paper(allRight, { answerText: "  " }))).toBe("blank");
    expect(excludeReason(paper(allRight, { live: { color: "yellow", flags: ["empty"], verdicts: null } }))).toBe("blank");
    expect(excludeReason(paper(allRight))).toBeNull();
  });

  it("judges the phase 0 bars on graded papers and catches a green 2-point miss", () => {
    const good = comparePaper(paper(allRight), combineRuns(KEY, [run(allRight), run(allRight)]));
    const greenMiss = comparePaper(
      paper(allRight, { submissionId: "22222222-2222-4222-8222-222222222222" }),
      combineRuns(KEY, [run({ "1": "correct", "2": "correct", "3": "incorrect" }), run({ "1": "correct", "2": "correct", "3": "incorrect" })]),
    );
    const failed = comparePaper(paper(allRight), combineRuns(KEY, [{ error: "stop_max_tokens", ok: false }, { error: "invalid_json", ok: false }]));
    const summary = summarize([good, greenMiss, failed]);
    expect(failed.color).toBe("red");
    expect(summary).toMatchObject({
      bars: { exact: false, noSilentBigMiss: false, withinOne: false },
      colors: { green: 2, red: 1, yellow: 0 },
      compared: 2,
      exact: 1,
      greenWrong: 1,
      questions: { compared: 6, different: 1 },
      withinOne: 1,
    });
    expect(summary.bigMisses.map((item) => item.submissionId)).toEqual(["22222222-2222-4222-8222-222222222222"]);
  });
});
