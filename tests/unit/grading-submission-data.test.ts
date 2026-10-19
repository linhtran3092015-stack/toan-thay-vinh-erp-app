// Value: protects="Đã bỏ qua" rows carry who/when/why from the RPC, and a row ignored without an audit row still loads;
// fails_when=the ignored list drops the reason or actor, treats a missing audit row as an error, or accepts rows of the wrong shape;
// why_new=new read model for list_ignored_grading_submissions;
// seam=supabase rpc mocked; no_claim=does not prove the SQL (pgTAP does)
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ rpc })) }));

import { getIgnoredGradingSubmissions } from "@/features/grading-submissions/data";

const SUBMISSION_ID = "3c000000-0000-4000-8000-000000000071";
const STUDENT_ID = "3c000000-0000-4000-8000-000000000041";

function row(overrides: Record<string, unknown> = {}) {
  return {
    answer_text: "asdfgh",
    answer_truncated: false,
    claimed_birth_year: 2014,
    claimed_class_option: null,
    claimed_class_option_other: null,
    claimed_class_session_id: null,
    claimed_full_name: "Ai Đó",
    claimed_session_label: null,
    claimed_student_code: null,
    ignore_reason: "Gõ linh tinh",
    ignored_at: "2026-10-18T13:10:00+00:00",
    ignored_by: "3c000000-0000-4000-8000-000000000002",
    ignored_by_name: "Trợ Giảng Thử",
    match_issues: ["student_not_found"],
    received_at: "2026-10-18T12:50:04+00:00",
    student_full_name: null,
    student_id: null,
    student_public_code: null,
    submission_id: SUBMISSION_ID,
    submitted_at: "2026-10-18T12:50:00+00:00",
    ...overrides,
  };
}

beforeEach(() => {
  rpc.mockReset();
});

describe("getIgnoredGradingSubmissions", () => {
  it("maps who ignored the submission, when and why", async () => {
    rpc.mockResolvedValue({
      data: [
        row({ student_full_name: "Học Sinh Thử", student_id: STUDENT_ID, student_public_code: "TV-2026-00001" }),
        row({ ignore_reason: null, ignored_at: null, ignored_by: null, ignored_by_name: null, submission_id: "3c000000-0000-4000-8000-000000000072" }),
      ],
      error: null,
    });

    const result = await getIgnoredGradingSubmissions(50);

    expect(rpc).toHaveBeenCalledWith("list_ignored_grading_submissions", { p_limit: 50 });
    expect(result).toMatchObject({
      data: [
        {
          claimedFullName: "Ai Đó",
          id: SUBMISSION_ID,
          ignored: { at: "2026-10-18T13:10:00+00:00", byName: "Trợ Giảng Thử", reason: "Gõ linh tinh" },
          issues: ["student_not_found"],
          student: { fullName: "Học Sinh Thử", id: STUDENT_ID, publicCode: "TV-2026-00001" },
        },
        { ignored: null, student: null },
      ],
      ok: true,
    });
  });

  it("reports an RPC error or rows of the wrong shape", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "AI_GRADING_VIEW_PERMISSION_DENIED" } });
    expect(await getIgnoredGradingSubmissions()).toEqual({ error: "Không tải được bài đã bỏ qua.", ok: false });

    rpc.mockResolvedValueOnce({ data: [row({ ignored_at: 42 })], error: null });
    expect(await getIgnoredGradingSubmissions()).toEqual({ error: "Dữ liệu bài nộp không hợp lệ.", ok: false });
  });
});
