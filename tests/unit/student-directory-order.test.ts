import { beforeEach, describe, expect, it, vi } from "vitest";

import { getStudentDirectory } from "@/features/students/data";

const dependencies = vi.hoisted(() => ({
  from: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: dependencies.from })),
}));

function studentRow(id: string, fullName: string, grade: number) {
  return {
    birth_year: 2011,
    current_grade: grade,
    full_name: fullName,
    id,
    learning_level: "A",
    lifecycle_status: "active",
    nickname: null,
    public_code: `TTV-${id}`,
    registered_mode: "offline",
  };
}

// Value: protects=the owner's rule that /students lists grade 12 down to grade 2, then by given name;
// fails_when=the loader goes back to the database's full_name order (family name first);
// seam=supabase client; no_claim=does not cover the class/session rosters
describe("getStudentDirectory order", () => {
  beforeEach(() => {
    dependencies.from.mockReset();
    dependencies.from.mockImplementation(() => {
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

  it("lists higher grades first, then students by given name", async () => {
    // The database hands rows back in full_name order, i.e. by family name.
    dependencies.rows = [
      studentRow("1", "Bùi Văn Yên", 9),
      studentRow("2", "Đỗ Thị An", 2),
      studentRow("3", "Lê Minh Bình", 12),
      studentRow("4", "Nguyễn Văn An", 9),
      studentRow("5", "Trần Thị Anh", 12),
    ];

    const result = await getStudentDirectory({ includeClasses: false, includeGuardians: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.students.map((student) => [student.currentGrade, student.fullName])).toEqual([
      [12, "Trần Thị Anh"],
      [12, "Lê Minh Bình"],
      [9, "Nguyễn Văn An"],
      [9, "Bùi Văn Yên"],
      [2, "Đỗ Thị An"],
    ]);
  });
});
