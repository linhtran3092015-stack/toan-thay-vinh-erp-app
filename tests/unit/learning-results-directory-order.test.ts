import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLearningResultsDirectory } from "@/features/learning-results/data";

const dependencies = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    rpc: vi.fn(async () => ({ data: dependencies.rows, error: null })),
  })),
}));

const SESSION_NEW = "5e55a0aa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const SESSION_OLD = "5e55a0aa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

function resultRow(index: number, sessionId: string, sessionDate: string, studentName: string) {
  const id = `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`;
  return {
    class_code: "T9A",
    class_grade: 9,
    class_id: "c1a55aaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    class_level: "A",
    class_name: "Toán 9A",
    class_session_id: sessionId,
    current_grade: 9,
    graded_at: null,
    locked_at: null,
    notebook_score: null,
    notebook_status: "pending",
    result_comment: null,
    result_id: id,
    session_date: sessionDate,
    session_status: "completed",
    student_code: `TTV-${index}`,
    student_id: id,
    student_name: studentName,
    test_score: null,
  };
}

// Value: protects=each session's students read in roll order (given name) while sessions stay newest first;
// fails_when=the loader keeps the RPC's family-name order inside a session or reorders the sessions;
// seam=supabase rpc; no_claim=does not cover the client filters or pagination
describe("getLearningResultsDirectory order", () => {
  beforeEach(() => {
    dependencies.rows = [];
  });

  it("keeps sessions newest first and sorts each session's students by given name", async () => {
    // The RPC sorts by date, start time, then full_name (family name first).
    dependencies.rows = [
      resultRow(1, SESSION_NEW, "2026-10-20", "Bùi Văn Yên"),
      resultRow(2, SESSION_NEW, "2026-10-20", "Lê Thị Bình"),
      resultRow(3, SESSION_NEW, "2026-10-20", "Trần Minh An"),
      resultRow(4, SESSION_OLD, "2026-10-18", "Đỗ Văn Cường"),
      resultRow(5, SESSION_OLD, "2026-10-18", "Nguyễn Thị Anh"),
    ];

    const result = await getLearningResultsDirectory();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((row) => [row.sessionDate, row.studentName])).toEqual([
      ["2026-10-20", "Trần Minh An"],
      ["2026-10-20", "Lê Thị Bình"],
      ["2026-10-20", "Bùi Văn Yên"],
      ["2026-10-18", "Nguyễn Thị Anh"],
      ["2026-10-18", "Đỗ Văn Cường"],
    ]);
  });
});
