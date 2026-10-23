// Value: protects=what a TA sees before approving an AI-graded paper: the score preview matches the SQL rules (correct points only, round .5 up, +1 only below 10, rank of the final score), the bonus line wording, the draft comment's 4 parts in order with each wrong question's right answer, phrases rotating per student but stable for the same one, and the 1,200-character cap;
// fails_when=the bonus is added before rounding or pushes past 10, a paper at 10 still says "cộng 1", the rank uses the paper score, a wrong question loses its right answer, a unit reminder on a right question is lost, the AI note is kept after the TA flips that question, phrases change on every render, or a long comment exceeds the database limit;
// why_new=phase 3b review panel and bulk approval share these helpers; seam=none (pure); no_claim=the SQL approve_grading_submission (pgTAP)
import { describe, expect, it } from "vitest";

import { bonusLine, COMMENT_MAX_CHARS, composeComment, DEFAULT_COMMENT_PHRASES, phraseIndex } from "@/features/ai-grading/comment";
import { draftComment, initialVerdicts, previewReview } from "@/features/ai-grading/review-draft";
import type { AnswerKey } from "@/features/session-tests/answer-key";

const BANDS = [
  { label: "Tiến bộ ít", minScore: 0 },
  { label: "Tiến bộ vừa", minScore: 5 },
  { label: "Tiến bộ", minScore: 8 },
  { label: "Tiến bộ nhiều", minScore: 9 },
  { label: "Rất tiến bộ", minScore: 10 },
];

const KEY: AnswerKey = {
  questions: [
    { acceptedEquivalents: [], finalAnswer: "x = 54", label: "13", maxPoints: 2.5, promptText: "", solutionSteps: [] },
    { acceptedEquivalents: [], finalAnswer: "x = 8", label: "14", maxPoints: 2.5, promptText: "", solutionSteps: [] },
    { acceptedEquivalents: [], finalAnswer: "7 cm", label: "16", maxPoints: 5, promptText: "", solutionSteps: [] },
  ],
};

const AI = [
  { errorLocation: "dòng 1: lấy 36 - 18", extractedFinalAnswer: "18", label: "13", noteForParent: "Con lấy 36 trừ 18 thay vì cộng; đáp án đúng là x = 54", verdict: "incorrect" as const },
  { errorLocation: "", extractedFinalAnswer: "8", label: "14", noteForParent: "", verdict: "correct" as const },
  { errorLocation: "", extractedFinalAnswer: "7cm", label: "16", noteForParent: "", verdict: "correct" as const },
];

describe("previewReview", () => {
  it("rounds the paper score before the bonus and ranks the final score", () => {
    const oneWrong = { "13": "incorrect", "14": "correct", "16": "correct" } as const;
    expect(previewReview({ bands: BANDS, key: KEY, praise: false, verdicts: oneWrong })).toEqual({
      bonusApplied: false,
      finalScore: 8,
      paperScore: 8,
      rankLabel: "Tiến bộ",
      rawScore: 7.5,
    });
    expect(previewReview({ bands: BANDS, key: KEY, praise: true, verdicts: oneWrong })).toMatchObject({ bonusApplied: true, finalScore: 9, rankLabel: "Tiến bộ nhiều" });
    const allRight = { "13": "correct", "14": "correct", "16": "correct" } as const;
    expect(previewReview({ bands: BANDS, key: KEY, praise: true, verdicts: allRight })).toMatchObject({ bonusApplied: false, finalScore: 10, paperScore: 10 });
  });

  it("starts from saved verdicts, then the AI's, then missing", () => {
    expect(initialVerdicts(KEY, AI)).toEqual({ "13": "incorrect", "14": "correct", "16": "correct" });
    expect(initialVerdicts(KEY, AI, { "13": "correct", "14": "correct", "16": "missing" })).toEqual({ "13": "correct", "14": "correct", "16": "missing" });
    expect(initialVerdicts(KEY, [])).toEqual({ "13": "missing", "14": "missing", "16": "missing" });
  });
});

describe("draft comment", () => {
  it("puts the bonus line first and keeps the 4 parts in order", () => {
    const text = draftComment({ aiQuestions: AI, key: KEY, praise: true, seed: "student-1:session-1", verdicts: initialVerdicts(KEY, AI) });
    const lines = text.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Hôm nay con được cộng 1 điểm vì tích cực tương tác (điểm bài làm 8, sau khi cộng là 9).");
    expect(lines[1]).toBe("Con làm đúng 2/3 câu. Câu 13: Con lấy 36 trừ 18 thay vì cộng; đáp án đúng là x = 54.");
    expect(DEFAULT_COMMENT_PHRASES.y2_wrong).toContain(lines[2]);
    expect(DEFAULT_COMMENT_PHRASES.y3_praised).toContain(lines[3]);
    expect(DEFAULT_COMMENT_PHRASES.y4).toContain(lines[4]);
  });

  it("drops the AI note when the TA changes that question and states the right answer instead", () => {
    const verdicts = { "13": "incorrect", "14": "missing", "16": "incorrect" } as const;
    const text = draftComment({ aiQuestions: AI, key: KEY, praise: false, seed: "s", verdicts });
    expect(text).toContain("Con làm đúng 0/3 câu.");
    expect(text).toContain("Câu 13: Con lấy 36 trừ 18 thay vì cộng; đáp án đúng là x = 54.");
    expect(text).toContain("Câu 14: con chưa làm, đáp án đúng là x = 8.");
    expect(text).toContain("Câu 16: con ghi \"7cm\", đáp án đúng là 7 cm.");
    expect(DEFAULT_COMMENT_PHRASES.y3_quiet).toContain(text.split("\n")[2]);
  });

  it("keeps the AI's unit reminder on a right question, after the wrong ones, and drops it if the TA flips that question", () => {
    const unit = AI.map((question) =>
      question.label === "16" ? { ...question, extractedFinalAnswer: "7 cm²", noteForParent: "Con tính đúng 7 nhưng đơn vị là cm, không phải cm²" } : question,
    );
    const kept = draftComment({ aiQuestions: unit, key: KEY, praise: false, seed: "s", verdicts: initialVerdicts(KEY, unit) });
    expect(kept.split("\n")[0]).toBe(
      "Con làm đúng 2/3 câu. Câu 13: Con lấy 36 trừ 18 thay vì cộng; đáp án đúng là x = 54. Câu 16: Con tính đúng 7 nhưng đơn vị là cm, không phải cm².",
    );
    const allRight = draftComment({ aiQuestions: unit, key: KEY, praise: false, seed: "s", verdicts: { "13": "correct", "14": "correct", "16": "correct" } });
    expect(allRight.split("\n")[0]).toMatch(/ Câu 16: Con tính đúng 7 nhưng đơn vị là cm, không phải cm²\.$/);
    const flipped = draftComment({ aiQuestions: unit, key: KEY, praise: false, seed: "s", verdicts: { "13": "incorrect", "14": "correct", "16": "incorrect" } });
    expect(flipped.split("\n")[0]).toContain('Câu 16: con ghi "7 cm²", đáp án đúng là 7 cm.');
  });

  it("praises a full paper and never mentions the bonus twice", () => {
    const text = composeComment({ paperScore: 10, praised: true, questionCount: 3, seed: "x", wrong: [] });
    expect(text.split("\n")[0]).toBe("Hôm nay con rất tích cực tương tác.");
    expect(text.split("\n")[1]).toBe(DEFAULT_COMMENT_PHRASES.y1_correct[0]);
    expect(text).not.toContain("cộng 1");
    expect(bonusLine(7, false)).toBeNull();
  });

  it("rotates phrases per student but keeps them stable for the same student", () => {
    const seeds = Array.from({ length: 30 }, (_, index) => `student-${index}:session`);
    const picks = new Set(seeds.map((seed) => phraseIndex(`${seed}:y4`, 3)));
    expect(picks.size).toBe(3);
    expect(phraseIndex("same:y4", 3)).toBe(phraseIndex("same:y4", 3));
  });

  it("falls back to the seed phrases for an empty slot and caps the length", () => {
    const phrases = { ...DEFAULT_COMMENT_PHRASES, y4: ["   "] };
    expect(DEFAULT_COMMENT_PHRASES.y4).toContain(composeComment({ paperScore: 5, phrases, praised: false, questionCount: 1, seed: "a", wrong: [] }).split("\n")[3]);
    const long = composeComment({
      paperScore: 0,
      praised: false,
      questionCount: 40,
      seed: "a",
      wrong: Array.from({ length: 40 }, (_, index) => ({
        correctAnswer: "x".repeat(40),
        errorLocation: "",
        label: String(index + 1),
        noteForParent: "",
        studentAnswer: "y".repeat(40),
        verdict: "incorrect" as const,
      })),
    });
    expect(long.length).toBe(COMMENT_MAX_CHARS);
    expect(long.endsWith("…")).toBe(true);
  });
});
