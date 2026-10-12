import { beforeEach, describe, expect, it, vi } from "vitest";

import { getStudentDirectory } from "@/features/students/data";

const dependencies = vi.hoisted(() => ({
  from: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: dependencies.from })),
}));

function studentRow(id: string, lifecycleStatus: string) {
  return {
    birth_year: 2011,
    current_grade: 9,
    full_name: `Học sinh ${id}`,
    id,
    learning_level: "A",
    lifecycle_status: lifecycleStatus,
    nickname: null,
    public_code: `TTV-${id}`,
    registered_mode: "offline",
  };
}

// Value: protects=a student ended through end_student_enrollment (lifecycle_status 'withdrawn') no longer
// takes down the whole /students directory; fails_when=the loader's status allowlist drops "withdrawn" again;
// why_new=no loader test covered the allowlist; seam=supabase client; no_claim=does not cover getStudentDetail
describe("getStudentDirectory lifecycle statuses", () => {
  beforeEach(() => {
    dependencies.from.mockReset();
    dependencies.from.mockImplementation((table: string) => {
      if (table !== "students") {
        throw new Error(`unexpected table ${table}`);
      }

      const query = {
        order: vi.fn(),
        range: vi.fn(async () => ({ data: dependencies.rows, error: null })),
        select: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.order.mockReturnValue(query);
      return query;
    });
  });

  it("lists a withdrawn student alongside active ones", async () => {
    dependencies.rows = [studentRow("1", "active"), studentRow("2", "withdrawn")];

    const result = await getStudentDirectory({ includeClasses: false, includeGuardians: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.students.map((student) => [student.id, student.lifecycleStatus])).toEqual([
      ["1", "active"],
      ["2", "withdrawn"],
    ]);
  });

  it("still rejects a status the app does not know", async () => {
    dependencies.rows = [studentRow("1", "graduated_unknown")];

    const result = await getStudentDirectory({ includeClasses: false, includeGuardians: false });

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_student_data" } });
  });
});
