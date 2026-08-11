import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCoachingRecordsDashboardResult } from "@/features/coaching/data";

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
