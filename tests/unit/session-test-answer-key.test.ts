// Value: protects=the TypeScript twin of the SQL answer-key rules (phase 2): points in quarter steps summed exactly (2,25 + 2,75 + 5 = 10), "2,5"/"2.5" parsing, the confirm problems in the database's order (no question, missing points, missing final answer, total not 10) with how far from 10, draft field errors (empty/duplicate labels case-insensitive, invalid points, limits), the normalisation the database applies (trim, one alternative/step per line, empty lines dropped), stored ↔ editor round trips and the card's status stage;
// fails_when=floating-point sums block a valid key, a comma decimal is rejected, a key that the database refuses looks confirmable (or the reverse), duplicate labels differing only in case pass, normalisation differs from SQL so an unchanged key looks changed, or an empty draft without photos shows "chờ chốt";
// why_new=new answer-key editor and status line;
// seam=none; no_claim=does not prove the SQL functions agree (supabase/tests/session-tests-answer-keys.test.sql covers them)
import { describe, expect, it } from "vitest";

import {
  answerKeyConfirmProblems,
  answerKeyFromDrafts,
  answerKeyFromStored,
  answerKeysEqual,
  answerKeyToStored,
  answerKeyTotal,
  emptyQuestionDraft,
  formatPoints,
  isValidPoints,
  nextQuestionLabel,
  parsePoints,
  questionDraftErrors,
  questionDraftFromQuestion,
  storedAnswerKeySchema,
  type AnswerKey,
  type AnswerKeyQuestion,
} from "@/features/session-tests/answer-key";
import { sessionTestStage } from "@/features/session-tests/status";
import type { SessionTestDetail } from "@/features/session-tests/types";

function question(label: string, maxPoints: number | null, finalAnswer = "x", overrides: Partial<AnswerKeyQuestion> = {}): AnswerKeyQuestion {
  return { acceptedEquivalents: [], finalAnswer, label, maxPoints, promptText: "", solutionSteps: [], ...overrides };
}

describe("points", () => {
  it("adds quarter points exactly", () => {
    const key: AnswerKey = { questions: [question("1", 2.25), question("2", 2.75), question("3", 5)] };
    expect(answerKeyTotal(key)).toBe(10);
    expect(answerKeyConfirmProblems(key)).toEqual([]);
  });

  it("parses comma or dot decimals and rejects anything else", () => {
    expect(parsePoints("2,5")).toBe(2.5);
    expect(parsePoints(" 2.25 ")).toBe(2.25);
    expect(parsePoints("")).toBeNull();
    expect(parsePoints("hai")).toBeNaN();
    expect(parsePoints("-1")).toBeNaN();
  });

  it("accepts 0,25 to 10 in quarter steps only", () => {
    expect([0.25, 0.5, 2, 9.75, 10].every(isValidPoints)).toBe(true);
    expect([0, 0.3, 10.25, Number.NaN].some(isValidPoints)).toBe(false);
  });

  it("formats with a Vietnamese decimal comma", () => {
    expect(formatPoints(2.5)).toBe("2,5");
    expect(formatPoints(10)).toBe("10");
  });
});

describe("answerKeyConfirmProblems", () => {
  it("refuses an empty key", () => {
    expect(answerKeyConfirmProblems({ questions: [] })).toEqual(["Đáp án chưa có câu nào."]);
  });

  it("names the questions missing points or a final answer", () => {
    const problems = answerKeyConfirmProblems({ questions: [question("13", null), question("14", 2, " "), question("15", 8)] });
    expect(problems).toEqual(["Câu 13 chưa có điểm.", "Câu 14 chưa có đáp án cuối."]);
  });

  it("says how far the total is from 10", () => {
    expect(answerKeyConfirmProblems({ questions: [question("1", 4.5), question("2", 4.5)] })).toEqual([
      "Tổng điểm đang là 9, còn thiếu 1 điểm để đủ 10.",
    ]);
    expect(answerKeyConfirmProblems({ questions: [question("1", 6), question("2", 4.5)] })).toEqual([
      "Tổng điểm đang là 10,5, thừa 0,5 điểm so với 10.",
    ]);
  });
});

describe("editor drafts", () => {
  it("flags empty and duplicate labels, ignoring case and spaces", () => {
    const errors = questionDraftErrors([
      emptyQuestionDraft("a", "13a"),
      emptyQuestionDraft("b", " 13A "),
      emptyQuestionDraft("c", ""),
    ]);
    expect(errors[0].label).toBeUndefined();
    expect(errors[1].label).toBe("Số câu bị trùng với câu khác.");
    expect(errors[2].label).toBe("Nhập số câu.");
  });

  it("flags invalid points but lets empty points through for a draft", () => {
    const errors = questionDraftErrors([emptyQuestionDraft("a", "1", "0,3"), emptyQuestionDraft("b", "2", "")]);
    expect(errors[0].maxPoints).toBe("Từ 0,25 đến 10, theo bước 0,25.");
    expect(errors[1].maxPoints).toBeUndefined();
  });

  it("flags too many accepted alternatives", () => {
    const draft = { ...emptyQuestionDraft("a", "1"), acceptedEquivalents: Array.from({ length: 21 }, (_, index) => `v${index}`).join("\n") };
    expect(questionDraftErrors([draft])[0].acceptedEquivalents).toBe("Tối đa 20 cách viết.");
  });

  it("normalises like the database: trimmed text, one alternative or step per line", () => {
    const key = answerKeyFromDrafts([
      {
        acceptedEquivalents: " 1/2 \n\n 0,5 ",
        finalAnswer: "  7 cm ",
        id: "a",
        label: " 16 ",
        maxPoints: "2",
        promptText: "  Tính BM ",
        solutionSteps: "BM = 14 : 2\r\n\r\n= 7 (cm)",
      },
    ]);
    expect(key).toEqual({
      questions: [
        {
          acceptedEquivalents: ["1/2", "0,5"],
          finalAnswer: "7 cm",
          label: "16",
          maxPoints: 2,
          promptText: "Tính BM",
          solutionSteps: ["BM = 14 : 2", "= 7 (cm)"],
        },
      ],
    });
  });

  it("round-trips a question through the editor unchanged", () => {
    const original: AnswerKey = {
      questions: [question("13", 2.5, "54", { acceptedEquivalents: ["x = 54"], promptText: "Tìm x", solutionSteps: ["x = 6 . 9", "x = 54"] })],
    };
    const drafts = original.questions.map((entry, index) => questionDraftFromQuestion(entry, `q-${index}`));
    expect(drafts[0].maxPoints).toBe("2,5");
    expect(answerKeysEqual(answerKeyFromDrafts(drafts), original)).toBe(true);
  });

  it("suggests the next numeric label", () => {
    expect(nextQuestionLabel([emptyQuestionDraft("a", "13")])).toBe("14");
    expect(nextQuestionLabel([emptyQuestionDraft("a", "Bài 1"), emptyQuestionDraft("b", "b")])).toBe("3");
    expect(nextQuestionLabel([])).toBe("1");
  });
});

describe("stored shape", () => {
  it("reads the database jsonb with defaults and writes it back in snake_case", () => {
    const stored = storedAnswerKeySchema.parse({ questions: [{ final_answer: "8", label: "14", max_points: 2 }] });
    const key = answerKeyFromStored(stored);
    expect(key.questions[0]).toEqual(question("14", 2, "8"));
    expect(answerKeyToStored(key)).toEqual({
      questions: [{ accepted_equivalents: [], final_answer: "8", label: "14", max_points: 2, prompt_text: "", solution_steps: [] }],
    });
  });
});

describe("sessionTestStage", () => {
  const base: SessionTestDetail = {
    answerKey: { questions: [] },
    answerKeyVersion: 0,
    assets: [],
    classSessionId: "s",
    confirmedAt: null,
    confirmedByName: null,
    extraction: null,
    id: "t",
    markingGuide: null,
    source: null,
    status: "draft",
    title: null,
    updatedAt: "2026-10-20T00:00:00Z",
  };

  it("maps tests to chưa có / chờ chốt / đã chốt", () => {
    expect(sessionTestStage(null)).toBe("none");
    expect(sessionTestStage(base)).toBe("none");
    expect(sessionTestStage({ ...base, answerKey: { questions: [question("1", null)] }, status: "key_review" })).toBe("pending");
    expect(
      sessionTestStage({ ...base, assets: [{ height: 1, id: "a", mimeType: "image/jpeg", pageNo: 1, sha256: "a", storagePath: "p", url: null, width: 1 }] }),
    ).toBe("pending");
    expect(sessionTestStage({ ...base, answerKeyVersion: 1, status: "key_confirmed" })).toBe("confirmed");
  });
});

describe("teacher's methods in the key", () => {
  const key: AnswerKey = { questions: [{ acceptedEquivalents: [], finalAnswer: "60", label: "2", maxPoints: 10, promptText: "", solutionSteps: [] }] };

  it("round-trips methods and leaves them out when blank, like the database", () => {
    const stored = answerKeyToStored({ ...key, methods: "  Dạng Tổng – Hiệu  " });
    expect(stored.methods).toBe("Dạng Tổng – Hiệu");
    expect(answerKeyFromStored(storedAnswerKeySchema.parse(stored)).methods).toBe("Dạng Tổng – Hiệu");
    expect("methods" in answerKeyToStored({ ...key, methods: "   " })).toBe(false);
    expect(answerKeyFromStored(storedAnswerKeySchema.parse({ questions: [] }))).toEqual({ questions: [] });
  });

  it("treats a change of methods as a change of the key", () => {
    expect(answerKeysEqual({ ...key, methods: "A" }, { ...key, methods: "A" })).toBe(true);
    expect(answerKeysEqual({ ...key, methods: "A" }, { ...key, methods: "B" })).toBe(false);
    expect(answerKeysEqual(key, { ...key, methods: "" })).toBe(true);
  });
});

