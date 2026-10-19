// Value: protects=only ai_grading.view holders reach the review RPCs, bad input never reaches the database, RPC codes become Vietnamese messages, "Ghép lại tự động" sends the matcher's decisions in one batch, and "Khôi phục" sends an optional trimmed note;
// fails_when=a permission check is dropped, a short reason or bad id hits the RPC, a session/page is not revalidated, a failed candidate load aborts the whole rerun, decisions skip the matcher, or a restore sends a blank note or misses the "not ignored" message;
// why_new=new server actions for the "Bài nộp chưa ghép" write side;
// seam=supabase rpc + permissions mocked; no_claim=does not prove the SQL guards (pgTAP does)
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  getDatabasePermissions: vi.fn(),
  getUnmatchedGradingSubmissions: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: harness.revalidatePath }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: harness.getDatabasePermissions }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ rpc: harness.rpc })) }));
vi.mock("@/features/grading-submissions/data", () => ({ getUnmatchedGradingSubmissions: harness.getUnmatchedGradingSubmissions }));

import {
  ignoreGradingSubmissionAction,
  loadGradingMatchCandidatesAction,
  matchGradingSubmissionAction,
  rematchGradingSubmissionsAction,
  restoreGradingSubmissionAction,
} from "@/features/grading-submissions/actions";
import type { UnmatchedGradingSubmission } from "@/features/grading-submissions/data";

const SUBMISSION_ID = "3c000000-0000-4000-8000-000000000071";
const SUBMISSION_ID_2 = "3c000000-0000-4000-8000-000000000072";
const STUDENT_ID = "3c000000-0000-4000-8000-000000000041";
const SESSION_ID = "3c000000-0000-4000-8000-000000000031";

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    birth_year: 2014,
    enrolled_on_day: true,
    full_name: "Phạm Gia Huy",
    lifecycle_status: "active",
    nickname: null,
    public_code: "TV-2026-00014",
    sessions: [
      {
        attendance_status: null,
        class_code: "7CLC1",
        class_level: "CLC",
        class_session_id: SESSION_ID,
        end_time: "19:30:00",
        on_roster: true,
        session_date: "2026-10-18",
        start_time: "18:00:00",
      },
    ],
    student_id: STUDENT_ID,
    ...overrides,
  };
}

function unmatched(overrides: Partial<UnmatchedGradingSubmission> = {}): UnmatchedGradingSubmission {
  return {
    answerText: "13. 18",
    answerTruncated: false,
    claimedBirthYear: 2014,
    claimedClassOption: null,
    claimedClassOptionOther: null,
    claimedClassSessionId: null,
    claimedFullName: "Phạm Gia Huy",
    claimedSessionLabel: null,
    claimedStudentCode: null,
    id: SUBMISSION_ID,
    issues: ["student_not_found"],
    receivedAt: "2026-10-18T12:25:05Z",
    student: null,
    submittedAt: "2026-10-18T12:25:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  for (const mock of Object.values(harness)) mock.mockReset();
  harness.getDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["ai_grading.view"] });
});

describe("permission gate", () => {
  it.each([
    ["match", () => matchGradingSubmissionAction({ classSessionId: SESSION_ID, studentId: STUDENT_ID, submissionId: SUBMISSION_ID })],
    ["ignore", () => ignoreGradingSubmissionAction({ reason: "Gõ linh tinh", submissionId: SUBMISSION_ID })],
    ["load candidates", () => loadGradingMatchCandidatesAction({ submissionId: SUBMISSION_ID })],
    ["rematch", () => rematchGradingSubmissionsAction()],
    ["restore", () => restoreGradingSubmissionAction({ submissionId: SUBMISSION_ID })],
  ])("%s stops without ai_grading.view", async (_name, run) => {
    harness.getDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["attendance.mark"] });
    const result = await run();
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.message).toContain("không có quyền");
    expect(harness.rpc).not.toHaveBeenCalled();
    expect(harness.getUnmatchedGradingSubmissions).not.toHaveBeenCalled();
  });

  it("stops when the permission lookup fails", async () => {
    harness.getDatabasePermissions.mockResolvedValue({ ok: false });
    expect(await ignoreGradingSubmissionAction({ reason: "Gõ linh tinh", submissionId: SUBMISSION_ID })).toEqual({
      message: "Không thể xác minh quyền. Vui lòng thử lại.",
      ok: false,
    });
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});

describe("matchGradingSubmissionAction", () => {
  it("rejects a missing session without calling the database", async () => {
    const result = await matchGradingSubmissionAction({ classSessionId: "", studentId: STUDENT_ID, submissionId: SUBMISSION_ID });
    expect(result.ok).toBe(false);
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("matches, revalidates the queue and the session, and reports a later attempt", async () => {
    harness.rpc.mockResolvedValue({ data: [{ attempt_no: 2, counts_for_score: true, match_status: "matched", submission_id: SUBMISSION_ID }], error: null });
    const result = await matchGradingSubmissionAction({ classSessionId: SESSION_ID, reason: "  Hỏi trợ giảng  ", studentId: STUDENT_ID, submissionId: SUBMISSION_ID });
    expect(harness.rpc).toHaveBeenCalledWith("match_grading_submission", {
      p_class_session_id: SESSION_ID,
      p_reason: "Hỏi trợ giảng",
      p_student_id: STUDENT_ID,
      p_submission_id: SUBMISSION_ID,
    });
    expect(result).toEqual({ message: "Đã ghép bài vào buổi học. Đây là lần nộp 2, lần này được tính.", ok: true });
    expect(harness.revalidatePath).toHaveBeenCalledWith("/grading-submissions");
    expect(harness.revalidatePath).toHaveBeenCalledWith(`/sessions/${SESSION_ID}`);
  });

  it("omits an empty note", async () => {
    harness.rpc.mockResolvedValue({ data: [{ attempt_no: 1, counts_for_score: true, match_status: "matched", submission_id: SUBMISSION_ID }], error: null });
    await matchGradingSubmissionAction({ classSessionId: SESSION_ID, reason: "   ", studentId: STUDENT_ID, submissionId: SUBMISSION_ID });
    expect(harness.rpc.mock.calls[0][1]).toMatchObject({ p_reason: undefined });
  });

  it.each([
    ["GRADING_SESSION_NOT_ELIGIBLE", "Học sinh không có trong buổi này"],
    ["GRADING_SUBMISSION_NOT_PENDING", "Bài này đã được ghép hoặc bỏ qua"],
    ["something else", "Không thể thực hiện thao tác"],
  ])("maps %s", async (code, expected) => {
    harness.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const result = await matchGradingSubmissionAction({ classSessionId: SESSION_ID, studentId: STUDENT_ID, submissionId: SUBMISSION_ID });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(expected);
    expect(harness.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("ignoreGradingSubmissionAction", () => {
  it("needs a reason of at least 2 characters", async () => {
    expect(await ignoreGradingSubmissionAction({ reason: " x ", submissionId: SUBMISSION_ID })).toEqual({
      message: "Vui lòng nhập lý do bỏ qua (2–500 ký tự).",
      ok: false,
    });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("ignores with the trimmed reason", async () => {
    harness.rpc.mockResolvedValue({ data: [{ match_status: "ignored", submission_id: SUBMISSION_ID }], error: null });
    expect(await ignoreGradingSubmissionAction({ reason: " Gõ linh tinh ", submissionId: SUBMISSION_ID })).toEqual({
      message: "Đã bỏ qua bài (bài rác).",
      ok: true,
    });
    expect(harness.rpc).toHaveBeenCalledWith("ignore_grading_submission", { p_reason: "Gõ linh tinh", p_submission_id: SUBMISSION_ID });
    expect(harness.revalidatePath).toHaveBeenCalledWith("/grading-submissions");
  });
});

describe("restoreGradingSubmissionAction", () => {
  it("rejects a bad id or a note over 500 characters without calling the database", async () => {
    expect(await restoreGradingSubmissionAction({ submissionId: "sub-1" })).toMatchObject({ ok: false });
    expect(await restoreGradingSubmissionAction({ reason: "x".repeat(501), submissionId: SUBMISSION_ID })).toEqual({
      message: "Ghi chú tối đa 500 ký tự.",
      ok: false,
    });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("restores with the trimmed note and revalidates the page", async () => {
    harness.rpc.mockResolvedValue({ data: [{ match_status: "needs_review", submission_id: SUBMISSION_ID }], error: null });
    expect(await restoreGradingSubmissionAction({ reason: "  Bỏ qua nhầm  ", submissionId: SUBMISSION_ID })).toEqual({
      message: "Đã khôi phục bài về danh sách chờ ghép.",
      ok: true,
    });
    expect(harness.rpc).toHaveBeenCalledWith("restore_grading_submission", { p_reason: "Bỏ qua nhầm", p_submission_id: SUBMISSION_ID });
    expect(harness.revalidatePath).toHaveBeenCalledWith("/grading-submissions");
  });

  it.each([[undefined], [null], ["   "]])("sends no note for %j", async (reason) => {
    harness.rpc.mockResolvedValue({ data: [{ match_status: "needs_review", submission_id: SUBMISSION_ID }], error: null });
    await restoreGradingSubmissionAction({ reason, submissionId: SUBMISSION_ID });
    expect(harness.rpc).toHaveBeenCalledWith("restore_grading_submission", { p_reason: undefined, p_submission_id: SUBMISSION_ID });
  });

  it.each([
    ["GRADING_SUBMISSION_NOT_IGNORED", "Bài này không còn ở danh sách đã bỏ qua"],
    ["GRADING_SUBMISSION_NOT_FOUND", "Không tìm thấy bài nộp"],
    ["AI_GRADING_VIEW_PERMISSION_DENIED", "không có quyền"],
  ])("maps %s", async (code, expected) => {
    harness.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const result = await restoreGradingSubmissionAction({ submissionId: SUBMISSION_ID });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(expected);
    expect(harness.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("loadGradingMatchCandidatesAction", () => {
  it("rejects a one-character search", async () => {
    expect(await loadGradingMatchCandidatesAction({ query: " H ", submissionId: SUBMISSION_ID })).toEqual({
      message: "Nhập ít nhất 2 ký tự để tìm học sinh.",
      ok: false,
    });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("loads the birth-year list by default and a short list when searching", async () => {
    harness.rpc.mockResolvedValue({ data: [candidateRow()], error: null });
    const result = await loadGradingMatchCandidatesAction({ submissionId: SUBMISSION_ID });
    expect(harness.rpc).toHaveBeenLastCalledWith("list_grading_match_candidates", { p_limit: 300, p_query: undefined, p_submission_id: SUBMISSION_ID });
    expect(result).toMatchObject({ ok: true, students: [{ fullName: "Phạm Gia Huy", id: STUDENT_ID, sessions: [{ classSessionId: SESSION_ID }] }] });

    await loadGradingMatchCandidatesAction({ query: " Huy ", submissionId: SUBMISSION_ID });
    expect(harness.rpc).toHaveBeenLastCalledWith("list_grading_match_candidates", { p_limit: 30, p_query: "Huy", p_submission_id: SUBMISSION_ID });
  });

  it("refuses rows of the wrong shape", async () => {
    harness.rpc.mockResolvedValue({ data: [{ student_id: "nope" }], error: null });
    expect(await loadGradingMatchCandidatesAction({ submissionId: SUBMISSION_ID })).toEqual({ message: "Dữ liệu học sinh không hợp lệ.", ok: false });
  });
});

describe("rematchGradingSubmissionsAction", () => {
  it("says so when nothing is waiting, without calling the database", async () => {
    harness.getUnmatchedGradingSubmissions.mockResolvedValue({ data: [], ok: true });
    expect(await rematchGradingSubmissionsAction()).toMatchObject({ message: "Không có bài nào đang chờ ghép.", ok: true });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("runs the matcher on each submission and writes all decisions in one batch", async () => {
    harness.getUnmatchedGradingSubmissions.mockResolvedValue({
      data: [unmatched(), unmatched({ claimedFullName: "Người lạ", id: SUBMISSION_ID_2 })],
      ok: true,
    });
    harness.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "list_grading_match_candidates") return { data: [candidateRow()], error: null };
      if (name === "rematch_grading_submissions") {
        const decisions = args.p_decisions as { submission_id: string; class_session_id: string | null }[];
        return {
          data: decisions.map((decision) => ({
            counts_for_score: decision.class_session_id !== null,
            match_status: decision.class_session_id ? "matched" : "needs_review",
            outcome: decision.class_session_id ? "matched" : "unchanged",
            submission_id: decision.submission_id,
          })),
          error: null,
        };
      }
      throw new Error(`unexpected rpc ${name}`);
    });

    const result = await rematchGradingSubmissionsAction();

    const batch = harness.rpc.mock.calls.find(([name]) => name === "rematch_grading_submissions");
    expect(batch?.[1].p_decisions).toEqual(
      expect.arrayContaining([
        {
          class_session_id: SESSION_ID,
          match_issues: [],
          session_match_method: "time_window",
          student_id: STUDENT_ID,
          student_match_method: "name_birth_year",
          submission_id: SUBMISSION_ID,
        },
        {
          class_session_id: null,
          match_issues: ["student_not_found"],
          session_match_method: null,
          student_id: null,
          student_match_method: null,
          submission_id: SUBMISSION_ID_2,
        },
      ]),
    );
    expect(result).toMatchObject({ message: "Đã ghép thêm 1 bài. 1 bài vẫn cần chọn tay.", ok: true, summary: { matched: 1, total: 2 } });
    expect(harness.revalidatePath).toHaveBeenCalledWith("/grading-submissions");
    expect(harness.revalidatePath).toHaveBeenCalledWith(`/sessions/${SESSION_ID}`);
  });

  it("counts a submission whose candidates fail to load and carries on with the rest", async () => {
    harness.getUnmatchedGradingSubmissions.mockResolvedValue({ data: [unmatched(), unmatched({ id: SUBMISSION_ID_2 })], ok: true });
    harness.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "list_grading_match_candidates") {
        return args.p_submission_id === SUBMISSION_ID_2 ? { data: null, error: { message: "boom" } } : { data: [candidateRow()], error: null };
      }
      return { data: [{ counts_for_score: true, match_status: "matched", outcome: "matched", submission_id: SUBMISSION_ID }], error: null };
    });

    const result = await rematchGradingSubmissionsAction();

    expect(result).toMatchObject({ ok: true, summary: { failed: 1, matched: 1, total: 2 } });
    const batch = harness.rpc.mock.calls.find(([name]) => name === "rematch_grading_submissions");
    expect(batch?.[1].p_decisions).toHaveLength(1);
  });

  it("reports the batch error", async () => {
    harness.getUnmatchedGradingSubmissions.mockResolvedValue({ data: [unmatched()], ok: true });
    harness.rpc.mockImplementation(async (name: string) =>
      name === "list_grading_match_candidates" ? { data: [candidateRow()], error: null } : { data: null, error: { message: "AI_GRADING_VIEW_PERMISSION_DENIED" } },
    );
    const result = await rematchGradingSubmissionsAction();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("không có quyền");
    expect(harness.revalidatePath).not.toHaveBeenCalled();
  });
});
