import { describe, expect, it } from "vitest";

import { GRADING_ANSWER_MAX_CHARS, parseGradingSubmissionPayload } from "@/features/grading-submissions/payload";

const valid = {
  answerText: "13. x=18\n14. 8",
  birthYear: 2014,
  classOption: null,
  classOptionOther: null,
  classSessionId: "3a000000-0000-4000-8000-000000000031",
  externalId: "0b8f6c1e-5d2a-4c1b-9a3e-7f2d1c0b9a8e",
  fullName: "  Nguyễn Minh Anh ",
  studentCode: "tv-2026-00012",
  submittedAt: "2026-10-18T19:25:03+07:00",
  version: 1,
};

describe("grading submission payload", () => {
  it("parses the form body, trims the name and upper-cases the ERP code", () => {
    const result = parseGradingSubmissionPayload(JSON.stringify(valid));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.fullName).toBe("Nguyễn Minh Anh");
    expect(result.data.payload.studentCode).toBe("TV-2026-00012");
    expect(result.data.answerText).toBe("13. x=18\n14. 8");
    expect(result.data.answerTruncated).toBe(false);
  });

  it("accepts the old-style fallback: no code, no session, birth year as text, the 'Khác' text", () => {
    const result = parseGradingSubmissionPayload(
      JSON.stringify({ ...valid, birthYear: "2013", classOption: "Khác", classOptionOther: " Lớp cô Hương ", classSessionId: null, studentCode: "" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload).toMatchObject({ birthYear: 2013, classOption: "Khác", classOptionOther: "Lớp cô Hương", classSessionId: null, studentCode: null });
  });

  it("cuts an over-long answer at 20,000 characters and flags it", () => {
    const result = parseGradingSubmissionPayload(JSON.stringify({ ...valid, answerText: "x".repeat(GRADING_ANSWER_MAX_CHARS + 5) }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.answerText).toHaveLength(GRADING_ANSWER_MAX_CHARS);
    expect(result.data.answerTruncated).toBe(true);
    expect(result.data.rawPayload.answerLength).toBe(GRADING_ANSWER_MAX_CHARS + 5);
  });

  it("cuts by code point so an emoji at the limit is never split, and drops NUL characters", () => {
    const answer = `${"x".repeat(GRADING_ANSWER_MAX_CHARS - 1)}😀😀`;
    const result = parseGradingSubmissionPayload(JSON.stringify({ ...valid, answerText: answer, fullName: "An\u0000h" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.data.answerText)).toHaveLength(GRADING_ANSWER_MAX_CHARS);
    expect(result.data.answerText.endsWith("😀")).toBe(true);
    expect(result.data.answerTruncated).toBe(true);
    expect(result.data.payload.fullName).toBe("Anh");
  });

  it("keeps only key names of unknown fields in raw_payload, never their values or the answer", () => {
    const result = parseGradingSubmissionPayload(JSON.stringify({ ...valid, sdtBoMe: "0912344828" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = JSON.stringify(result.data.rawPayload);
    expect(result.data.rawPayload.unknownKeys).toEqual(["sdtBoMe"]);
    expect(stored).not.toContain("0912344828");
    expect(stored).not.toContain("x=18");
  });

  it.each([
    ["bad JSON", "{"],
    ["a short external id", JSON.stringify({ ...valid, externalId: "abc" })],
    ["a malformed student code", JSON.stringify({ ...valid, studentCode: "12345" })],
    ["an over-long student code", JSON.stringify({ ...valid, studentCode: `TV-2015-${"1".repeat(31)}` })],
    ["an empty name", JSON.stringify({ ...valid, fullName: "   " })],
    ["an impossible birth year", JSON.stringify({ ...valid, birthYear: 1890 })],
    ["a time without zone", JSON.stringify({ ...valid, submittedAt: "2026-10-18 19:25:03" })],
    ["another payload version", JSON.stringify({ ...valid, version: 2 })],
    ["a session id that is not a uuid", JSON.stringify({ ...valid, classSessionId: "7CLC1" })],
  ])("rejects %s", (_label, body) => {
    expect(parseGradingSubmissionPayload(body).ok).toBe(false);
  });
});
