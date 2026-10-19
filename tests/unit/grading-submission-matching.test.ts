import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classMatchesOption,
  matchGradingSubmission,
  matchSession,
  matchStudent,
  normalizeStudentName,
  parseClassOption,
  sessionWindow,
  type SessionCandidate,
  type StudentCandidate,
} from "@/features/grading-submissions/matching";

const students: StudentCandidate[] = [
  { birthYear: 2014, fullName: "Nguyễn Minh Anh", publicCode: "TV-2026-00001", source: "birth_year", studentId: "s-anh-1" },
  { birthYear: 2014, fullName: "Nguyễn  Minh Anh", publicCode: "TV-2026-00002", source: "birth_year", studentId: "s-anh-2" },
  { birthYear: 2014, fullName: "Trần Đức Bình", publicCode: "TV-2026-00003", source: "birth_year", studentId: "s-binh" },
];

function session(overrides: Partial<SessionCandidate>): SessionCandidate {
  return {
    attendanceStatus: null,
    classCode: "7CLC1",
    classLevel: "CLC",
    classSessionId: "sess-clc1",
    endTime: "19:30:00",
    onRoster: true,
    sessionDate: "2026-10-18",
    startTime: "18:00:00",
    ...overrides,
  };
}

/** Vietnam wall-clock time on 18/10/2026. */
function vn(time: string): Date {
  return new Date(`2026-10-18T${time}:00+07:00`);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeStudentName", () => {
  it("drops accents, folds đ, lower-cases and collapses spaces", () => {
    expect(normalizeStudentName("  TRẦN   Đức  Bình ")).toBe("tran duc binh");
    expect(normalizeStudentName("Nguyễn Minh Anh")).toBe(normalizeStudentName("nguyen minh anh"));
  });
});

describe("matchStudent", () => {
  it("trusts the ERP code from the dropdown", () => {
    const candidates = [...students, { birthYear: 2014, fullName: "Lê Văn Cường", publicCode: "TV-2026-00009", source: "code" as const, studentId: "s-cuong" }];
    expect(matchStudent({ birthYear: 2014, fullName: "Lê Văn Cường", studentCode: "TV-2026-00009" }, candidates)).toEqual({
      issues: [],
      method: "student_code",
      studentId: "s-cuong",
    });
  });

  it("flags a birth year that differs from the profile but keeps the code match", () => {
    const candidates = [{ birthYear: 2013, fullName: "Lê Văn Cường", publicCode: "TV-2026-00009", source: "code" as const, studentId: "s-cuong" }];
    expect(matchStudent({ birthYear: 2014, fullName: "Lê Văn Cường", studentCode: "TV-2026-00009" }, candidates)).toMatchObject({
      issues: ["birth_year_mismatch"],
      studentId: "s-cuong",
    });
  });

  it("falls back to the name when the code is unknown", () => {
    expect(matchStudent({ birthYear: 2014, fullName: "tran duc binh", studentCode: "TV-2026-99999" }, students)).toEqual({
      issues: ["student_code_unknown"],
      method: "name_birth_year",
      studentId: "s-binh",
    });
  });

  it("never guesses between namesakes or across birth years", () => {
    expect(matchStudent({ birthYear: 2014, fullName: "Nguyễn Minh Anh", studentCode: null }, students)).toEqual({
      issues: ["student_ambiguous"],
      method: null,
      studentId: null,
    });
    expect(matchStudent({ birthYear: 2013, fullName: "Trần Đức Bình", studentCode: null }, students)).toMatchObject({
      issues: ["student_not_found"],
      studentId: null,
    });
  });
});

describe("parseClassOption / classMatchesOption", () => {
  it("reads the old form options", () => {
    expect(parseClassOption("A - Nâng cao - Thầy Vinh")).toEqual({ level: "A", suffix: null });
    expect(parseClassOption("B - Cơ bản - Thầy Vinh")).toEqual({ level: "B", suffix: null });
    expect(parseClassOption("CLC2 - Từ cơ bản đến nâng cao - Thầy Vinh")).toEqual({ level: "CLC", suffix: "2" });
    expect(parseClassOption("Con không rõ")).toBeNull();
    expect(parseClassOption("Khác")).toBeNull();
    expect(parseClassOption("Anh văn")).toBeNull();
    expect(parseClassOption(null)).toBeNull();
  });

  it("compares level and CLC number with the class code", () => {
    expect(classMatchesOption({ classCode: "7CLC1", classLevel: "CLC" }, { level: "CLC", suffix: "1" })).toBe(true);
    expect(classMatchesOption({ classCode: "7CLC2", classLevel: "CLC" }, { level: "CLC", suffix: "1" })).toBe(false);
    expect(classMatchesOption({ classCode: "5CLC", classLevel: "CLC" }, { level: "CLC", suffix: "1" })).toBe(true);
    expect(classMatchesOption({ classCode: "7B", classLevel: "B" }, { level: "A", suffix: null })).toBe(false);
  });
});

describe("sessionWindow", () => {
  it("runs from 15 minutes before the start to 3 hours after the end, in Vietnam time on any server zone", () => {
    vi.stubEnv("TZ", "UTC");
    const window = sessionWindow(session({}));
    expect(new Date(window.startMs).toISOString()).toBe("2026-10-18T10:45:00.000Z");
    expect(new Date(window.endMs).toISOString()).toBe("2026-10-18T15:30:00.000Z");
  });
});

describe("matchSession", () => {
  const clc1 = session({});
  const clc2 = session({ classCode: "7CLC2", classSessionId: "sess-clc2" });
  const afternoon = session({ classCode: "7B", classLevel: "B", classSessionId: "sess-b", endTime: "16:30:00", startTime: "15:00:00" });

  it("takes the session the student picked on the form", () => {
    expect(matchSession({ claimedClassSessionId: "sess-b", classOption: null, submittedAt: vn("16:20") }, [afternoon, clc1])).toEqual({
      classSessionId: "sess-b",
      issues: [],
      method: "claimed_session",
    });
  });

  it("keeps the picked session when submitted late, with a flag", () => {
    expect(matchSession({ claimedClassSessionId: "sess-b", classOption: null, submittedAt: vn("22:00") }, [afternoon])).toEqual({
      classSessionId: "sess-b",
      issues: ["outside_window"],
      method: "claimed_session",
    });
  });

  it("ignores a picked session the student is not in and falls back to the time window", () => {
    expect(matchSession({ claimedClassSessionId: "sess-other", classOption: null, submittedAt: vn("19:40") }, [afternoon, clc1])).toEqual({
      classSessionId: "sess-clc1",
      issues: ["claimed_session_mismatch"],
      method: "time_window",
    });
  });

  it("matches the only session whose window holds the submission time", () => {
    expect(matchSession({ claimedClassSessionId: null, classOption: null, submittedAt: vn("16:40") }, [afternoon, clc1])).toMatchObject({
      classSessionId: "sess-b",
      method: "time_window",
    });
    expect(matchSession({ claimedClassSessionId: null, classOption: null, submittedAt: vn("19:40") }, [afternoon, clc1])).toMatchObject({
      classSessionId: "sess-clc1",
      method: "time_window",
    });
    // 17:50 is within 3 hours after 7B and within 15 minutes before 7CLC1: a person decides.
    expect(matchSession({ claimedClassSessionId: null, classOption: null, submittedAt: vn("17:50") }, [afternoon, clc1])).toMatchObject({
      classSessionId: null,
      issues: ["multiple_sessions"],
    });
  });

  it("sends a submission outside every window, or on a day without sessions, to review", () => {
    expect(matchSession({ claimedClassSessionId: null, classOption: null, submittedAt: vn("23:30") }, [afternoon, clc1])).toEqual({
      classSessionId: null,
      issues: ["outside_window"],
      method: null,
    });
    expect(matchSession({ claimedClassSessionId: null, classOption: null, submittedAt: vn("19:00") }, [])).toEqual({
      classSessionId: null,
      issues: ["no_session_today"],
      method: null,
    });
  });

  it("breaks a tie by attendance, then by the class option", () => {
    const attendedClc2 = { ...clc2, attendanceStatus: "present" };
    expect(matchSession({ claimedClassSessionId: null, classOption: "CLC1 - Từ cơ bản", submittedAt: vn("19:35") }, [clc1, attendedClc2])).toMatchObject({
      classSessionId: "sess-clc2",
      method: "attendance",
    });
    expect(matchSession({ claimedClassSessionId: null, classOption: "CLC2 - Từ cơ bản", submittedAt: vn("19:35") }, [clc1, clc2])).toMatchObject({
      classSessionId: "sess-clc2",
      method: "class_option",
    });
    expect(matchSession({ claimedClassSessionId: null, classOption: "Con không rõ", submittedAt: vn("19:35") }, [clc1, clc2])).toEqual({
      classSessionId: null,
      issues: ["multiple_sessions"],
      method: null,
    });
  });
});

describe("matchGradingSubmission", () => {
  it("is matched only when both the student and the session are certain", () => {
    const input = { birthYear: 2014, claimedClassSessionId: null, classOption: null, fullName: "Trần Đức Bình", studentCode: null, submittedAt: vn("19:40") };
    expect(matchGradingSubmission(input, students, [session({})])).toEqual({
      classSessionId: "sess-clc1",
      issues: [],
      matchStatus: "matched",
      sessionMethod: "time_window",
      studentId: "s-binh",
      studentMethod: "name_birth_year",
    });
    expect(matchGradingSubmission(input, students, [])).toMatchObject({
      classSessionId: null,
      issues: ["no_session_today"],
      matchStatus: "needs_review",
      studentId: "s-binh",
    });
    expect(matchGradingSubmission({ ...input, fullName: "Nguyễn Minh Anh" }, students, [session({})])).toMatchObject({
      issues: ["student_ambiguous"],
      matchStatus: "needs_review",
      studentId: null,
    });
  });
});
