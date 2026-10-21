import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCoachingManagementOptionsResult, getCoachingRecordsDashboardResult } from "@/features/coaching/data";

const dependencies = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc: dependencies.rpc })),
}));

describe("Coaching status transport", () => {
  beforeEach(() => {
    dependencies.rpc.mockReset();
  });

  it("preserves an unsupported stored status instead of fabricating open", async () => {
    dependencies.rpc.mockResolvedValue({
      data: [{
        assistant_owner_display_name: "Cô Mai",
        assistant_owner_id: "staff-1",
        campaign_name: "Theo dõi tháng 8",
        coaching_record_id: "coaching-1",
        current_status: "constructor",
        latest_event_at: null,
        latest_outcome: null,
        opened_at: "2026-08-01T08:00:00Z",
        priority: "medium",
        reason: "Theo dõi tiến độ",
        review_at: null,
        student_full_name: "Nguyễn An",
        student_id: "student-1",
        student_public_code: "HV-001",
      }],
      error: null,
    });

    const result = await getCoachingRecordsDashboardResult();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new Error("Expected Coaching dashboard data");
    }

    expect(result.data[0]?.currentStatus).toBe("constructor");
  });
});

describe("Coaching management options", () => {
  beforeEach(() => {
    dependencies.rpc.mockReset();
  });

  // Value: protects=the coaching dialog lists every student, paging the RPC past 500 rows with p_limit 10000, by given name;
  // fails_when=p_limit drops back to 500 (range 500..999 then reads nothing), the loader stops after a full page, or keeps the RPC's family-name order;
  // why_new=no test loaded the management options; the 10000 ceiling is checked only on the SQL side (student-care.sql);
  // seam=none; no_claim=mocked RPC pages; does not prove PostgREST applies range() to the set-returning RPC or that its order is total
  it("pages the student options RPC under the 10000 ceiling and lists students by given name", async () => {
    const option = (id: string, fullName: string) => ({
      lifecycle_status: "active",
      student_full_name: fullName,
      student_id: id,
      student_public_code: `TTV-${id}`,
    });
    // The RPC returns full_name order (family name first); PostgREST serves it 500 rows a page.
    const pages = [
      [...Array.from({ length: 499 }, (_, index) => option(`minh-${index}`, "Nguyễn Văn Minh")), option("binh", "Vũ Đức Bình")],
      [option("an", "Vũ Thị An"), option("yen", "Vương Văn Yến")],
    ];
    const range = vi.fn(async (from: number) => ({ data: pages[from / 500] ?? [], error: null }));
    dependencies.rpc.mockImplementation((name: string) =>
      name === "get_coaching_student_options"
        ? { range }
        : Promise.resolve({ data: [{ display_name: "Cô Mai", profile_id: "staff-1", role_code: "owner" }], error: null }),
    );

    const result = await getCoachingManagementOptionsResult();

    expect(range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(dependencies.rpc.mock.calls.filter(([name]) => name === "get_coaching_student_options")).toEqual([
      ["get_coaching_student_options", { p_limit: 10000 }],
      ["get_coaching_student_options", { p_limit: 10000 }],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.students.map((student) => student.fullName)).toEqual([
      "Vũ Thị An",
      "Vũ Đức Bình",
      ...Array.from({ length: 499 }, () => "Nguyễn Văn Minh"),
      "Vương Văn Yến",
    ]);
    expect(result.data.students[0]).toEqual({ fullName: "Vũ Thị An", id: "an", lifecycleStatus: "active", publicCode: "TTV-an" });
    expect(result.data.assignees).toEqual([{ displayName: "Cô Mai", id: "staff-1", roleCode: "owner" }]);
  });
});
