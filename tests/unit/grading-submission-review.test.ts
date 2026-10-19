// Value: protects="Ghép lại tự động" reuses the webhook matcher on today's data and the picker shows the right students/sessions first;
// fails_when=code/birth-year candidates are built differently from get_grading_student_candidates, an unenrolled namesake is matched by name, a found student without a session is dropped, or the summary miscounts;
// why_new=new pure module behind the rematch action and the match picker;
// seam=none; no_claim=does not prove the database re-checks each decision (pgTAP does)
import { describe, expect, it } from "vitest";

import type { SessionCandidate } from "@/features/grading-submissions/matching";
import {
  filterMatchCandidates,
  isWithinSubmissionWindow,
  planGradingRematch,
  rematchSummaryMessage,
  sortMatchCandidates,
  suggestSessionId,
  summarizeRematch,
  toMatchCandidates,
  type MatchCandidateStudent,
  type RematchSubmission,
} from "@/features/grading-submissions/review";

const DAY = "2026-10-18";

function session(overrides: Partial<SessionCandidate> = {}): SessionCandidate {
  return {
    attendanceStatus: null,
    classCode: "7CLC1",
    classLevel: "CLC",
    classSessionId: "s-evening",
    endTime: "19:30:00",
    onRoster: true,
    sessionDate: DAY,
    startTime: "18:00:00",
    ...overrides,
  };
}

function student(overrides: Partial<MatchCandidateStudent> = {}): MatchCandidateStudent {
  return {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Phạm Gia Huy",
    id: "st-huy",
    lifecycleStatus: "active",
    nickname: null,
    publicCode: "TV-2026-00014",
    sessions: [session()],
    ...overrides,
  };
}

const submission: RematchSubmission = {
  claimedBirthYear: 2014,
  claimedClassOption: null,
  claimedClassSessionId: null,
  claimedFullName: "Pham Gia  Huy",
  claimedStudentCode: null,
  id: "sub-1",
  submittedAt: "2026-10-18T12:25:00Z", // 19:25 in Vietnam
};

describe("planGradingRematch", () => {
  it("matches a student created after the submission by name and birth year, then by time window", () => {
    const { decision, result } = planGradingRematch(submission, [student()]);
    expect(result.matchStatus).toBe("matched");
    expect(decision).toEqual({
      class_session_id: "s-evening",
      match_issues: [],
      session_match_method: "time_window",
      student_id: "st-huy",
      student_match_method: "name_birth_year",
      submission_id: "sub-1",
    });
  });

  it("never matches by name a namesake without an active enrollment that day", () => {
    const { decision } = planGradingRematch(submission, [student({ enrolledOnDay: false })]);
    expect(decision).toMatchObject({ class_session_id: null, match_issues: ["student_not_found"], student_id: null, student_match_method: null });
  });

  it("keeps namesakes for review", () => {
    const { decision } = planGradingRematch(submission, [student(), student({ id: "st-huy-2", publicCode: "TV-2026-00015" })]);
    expect(decision).toMatchObject({ match_issues: ["student_ambiguous"], student_id: null });
  });

  it("finds the claimed code in any status and with any case, and flags a different birth year", () => {
    const { decision } = planGradingRematch({ ...submission, claimedBirthYear: 2013, claimedStudentCode: " tv-2026-00014 " }, [
      student({ enrolledOnDay: false, lifecycleStatus: "withdrawn" }),
    ]);
    expect(decision).toMatchObject({
      match_issues: ["birth_year_mismatch"],
      session_match_method: "time_window",
      student_id: "st-huy",
      student_match_method: "student_code",
    });
  });

  it("keeps a found student without a session for review with the new issue", () => {
    const { decision, result } = planGradingRematch(submission, [student({ sessions: [] })]);
    expect(result.matchStatus).toBe("needs_review");
    expect(decision).toMatchObject({ class_session_id: null, match_issues: ["no_session_today"], student_id: "st-huy", student_match_method: "name_birth_year" });
  });

  it("uses only the matched student's sessions, with the claimed session first", () => {
    const { decision } = planGradingRematch({ ...submission, claimedClassSessionId: "s-afternoon" }, [
      student({ sessions: [session(), session({ classCode: "7B", classLevel: "B", classSessionId: "s-afternoon", endTime: "14:30:00", startTime: "13:00:00" })] }),
      student({ birthYear: 2013, fullName: "Lê Thị Dung", id: "st-dung", sessions: [session({ classSessionId: "s-other" })] }),
    ]);
    expect(decision).toMatchObject({ class_session_id: "s-afternoon", match_issues: ["outside_window"], session_match_method: "claimed_session" });
  });
});

describe("toMatchCandidates", () => {
  it("maps the RPC rows to the matcher's session shape", () => {
    const [mapped] = toMatchCandidates([
      {
        birth_year: 2014,
        enrolled_on_day: true,
        full_name: "Phạm Gia Huy",
        lifecycle_status: "active",
        nickname: null,
        public_code: "TV-2026-00014",
        sessions: [
          {
            attendance_status: "additional_study",
            class_code: "7B",
            class_level: "B",
            class_session_id: "00000000-0000-4000-8000-000000000001",
            end_time: "16:30:00",
            on_roster: false,
            session_date: DAY,
            start_time: "15:00:00",
          },
        ],
        student_id: "00000000-0000-4000-8000-000000000002",
      },
    ]);
    expect(mapped.sessions).toEqual([
      session({ attendanceStatus: "additional_study", classCode: "7B", classLevel: "B", classSessionId: "00000000-0000-4000-8000-000000000001", endTime: "16:30:00", onRoster: false, startTime: "15:00:00" }),
    ]);
  });
});

describe("rematch summary", () => {
  it("counts outcomes and says what is left to do by hand", () => {
    const summary = summarizeRematch(["matched", "matched", "unchanged", "updated", "skipped", "invalid", "bogus"], 8, 1);
    expect(summary).toEqual({ failed: 1, invalid: 1, matched: 2, skipped: 1, total: 8, unchanged: 1, updated: 1 });
    expect(rematchSummaryMessage(summary)).toBe(
      "Đã ghép thêm 2 bài. 5 bài vẫn cần chọn tay. 1 bài có thông tin mới (học sinh hoặc cảnh báo). 1 bài chưa kiểm tra được, thử lại sau.",
    );
  });

  it("has a message for an empty queue and for no progress", () => {
    expect(rematchSummaryMessage(summarizeRematch([], 0, 0))).toBe("Không có bài nào đang chờ ghép.");
    expect(rematchSummaryMessage(summarizeRematch(["unchanged"], 1, 0))).toBe("Chưa ghép thêm được bài nào. 1 bài vẫn cần chọn tay.");
  });
});

describe("match picker helpers", () => {
  const students = [
    student({ fullName: "Trần Đức Anh", id: "a", publicCode: "TV-2026-00001", sessions: [] }),
    student({ birthYear: 2013, fullName: "Lê Thị Bình", id: "b", publicCode: "TV-2026-00002" }),
    student({ fullName: "Nguyễn Văn Bảo", id: "c", nickname: "Tũn", publicCode: "TV-2026-00098" }),
    student({ fullName: "Đỗ Minh Anh", id: "d", publicCode: "TV-2026-00004" }),
  ];

  it("filters by every typed word, without accents, on name, nickname or code", () => {
    expect(filterMatchCandidates(students, "duc  anh").map((item) => item.id)).toEqual(["a"]);
    expect(filterMatchCandidates(students, "anh tran").map((item) => item.id)).toEqual(["a"]);
    expect(filterMatchCandidates(students, "anh").map((item) => item.id)).toEqual(["a", "d"]);
    expect(filterMatchCandidates(students, "tun").map((item) => item.id)).toEqual(["c"]);
    expect(filterMatchCandidates(students, "00098").map((item) => item.id)).toEqual(["c"]);
    expect(filterMatchCandidates(students, "  ")).toHaveLength(4);
  });

  it("sorts the claimed birth year first, then students with a session that day, then by given name", () => {
    expect(sortMatchCandidates(students, 2014).map((item) => item.id)).toEqual(["d", "c", "a", "b"]);
  });

  it("preselects the only session, else the only one in the time window, else the claimed one", () => {
    const evening = session();
    const afternoon = session({ classSessionId: "s-afternoon", endTime: "14:30:00", startTime: "13:00:00" });
    expect(suggestSessionId([afternoon], submission.submittedAt, null)).toBe("s-afternoon");
    expect(suggestSessionId([afternoon, evening], submission.submittedAt, null)).toBe("s-evening");
    expect(suggestSessionId([afternoon, evening], "2026-10-18T01:00:00Z", "s-afternoon")).toBe("s-afternoon");
    expect(suggestSessionId([afternoon, evening], "2026-10-18T01:00:00Z", null)).toBeNull();
  });

  it("uses the matcher's window: 15 minutes before start to 3 hours after end, Vietnam time", () => {
    expect(isWithinSubmissionWindow(session(), "2026-10-18T10:45:00Z")).toBe(true); // 17:45
    expect(isWithinSubmissionWindow(session(), "2026-10-18T10:44:00Z")).toBe(false);
    expect(isWithinSubmissionWindow(session(), "2026-10-18T15:30:00Z")).toBe(true); // 22:30
    expect(isWithinSubmissionWindow(session(), "2026-10-18T15:31:00Z")).toBe(false);
  });
});
