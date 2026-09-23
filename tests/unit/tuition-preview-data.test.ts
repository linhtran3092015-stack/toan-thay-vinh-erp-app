import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTuitionPeriodPreview } from "@/features/tuition/data";

const { rpc, range, order } = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
const row = (index: number) => ({ student_id: `student-${index}`, class_session_id: `session-${index}`, session_date: "2026-08-22", session_kind: "regular", unit_price_vnd: null, opening_balance_sessions: 0, blocker_code: "MISSING_EFFECTIVE_TUITION_RATE" });

beforeEach(() => {
  vi.clearAllMocks();
  const query = { order, range };
  rpc.mockReturnValue(query);
  order.mockReturnValue(query);
});

describe("tuition preview completeness", () => {
  it("reads past the API page limit and retains all blocked sessions", async () => {
    range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => row(i)), error: null })
      .mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => row(i + 500)), error: null })
      .mockResolvedValueOnce({ data: [row(1000)], error: null });
    const rows = await getTuitionPeriodPreview("period");
    expect(rows).toHaveLength(1001);
    expect(range).toHaveBeenNthCalledWith(3, 1000, 1499);
    expect(order).toHaveBeenCalledWith("student_id");
    expect(order).toHaveBeenCalledWith("class_session_id");
  });

  it("does not present a later page failure as a valid empty or partial preview", async () => {
    range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => row(i)), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(getTuitionPeriodPreview("period")).rejects.toThrow("TUITION_PREVIEW_UNAVAILABLE");
  });
});
