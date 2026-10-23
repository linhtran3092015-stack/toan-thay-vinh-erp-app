import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabasePermissions: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  server: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: mocks.getDatabasePermissions,
  getDatabasePermissions: mocks.getDatabasePermissions,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  decideTimeEntryAdjustmentAction,
  requestTimeEntryAdjustmentAction,
} from "@/features/timekeeping/timekeeping-adjustment-actions";

const requestId = "d1111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mocks.getDatabasePermissions.mockResolvedValue({
    ok: true,
    permissions: ["timekeeping.approve_adjustment", "timekeeping.check"],
  });
  mocks.server.mockResolvedValue({ rpc: mocks.rpc });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("decideTimeEntryAdjustmentAction", () => {
  // Value: protects=each code decide_time_entry_adjustment raises reaches the approver as its own Vietnamese message;
  // fails_when=a map key drifts from the RPC code (the keys for not-found, self-approval, permission and already-decided all did) and the generic error shows;
  // why_new=every component test mocks this action, so no test read its error map; seam=none;
  // no_claim=does not prove the RPC raises these codes (pgTAP does); Supabase client and permissions are mocked
  it("maps every refusal decide_time_entry_adjustment raises", async () => {
    const refusals: Array<[string, string]> = [
      ["23514: TIME_ENTRY_ADJUSTMENT_REQUEST_ALREADY_DECIDED", "Yêu cầu này đã được xử lý trước đó (có thể chủ trung tâm đã điều chỉnh trực tiếp lượt chấm công)."],
      ["P0002: TIME_ENTRY_ADJUSTMENT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu điều chỉnh."],
      ["42501: TIME_ENTRY_ADJUSTMENT_SELF_APPROVAL_FORBIDDEN", "Bạn không thể tự duyệt yêu cầu điều chỉnh của mình."],
      [
        "23514: TIME_ENTRY_LOCKED_BY_PAYROLL",
        "Lượt chấm công thuộc kỳ lương đã khoá (đang duyệt hoặc đã duyệt). Hãy mở lại kỳ lương về nháp trước khi duyệt; kỳ đã chi trả thì không mở lại được, hãy bù trừ ở kỳ sau.",
      ],
      ["XX000: something unexpected", "Không thể xử lý yêu cầu điều chỉnh. Dữ liệu chưa được cập nhật."],
    ];

    for (const [databaseMessage, shown] of refusals) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: databaseMessage } });
      expect(
        await decideTimeEntryAdjustmentAction({ decision: "approved", decisionReason: "", requestId }),
      ).toMatchObject({ message: shown, status: "error" });
    }

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("requestTimeEntryAdjustmentAction", () => {
  // Value: protects=a staff member who asks again after the owner adjusted the entry learns why it is refused;
  // fails_when=the key for TIME_ENTRY_ALREADY_HAS_APPROVED_ADJUSTMENT drifts again and the generic error shows;
  // why_new=no test read this map; seam=none; no_claim=does not prove the RPC raises it (it does, unchanged since 20260729090000)
  it("explains a request on an entry that already has an approved adjustment", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "23505: TIME_ENTRY_ALREADY_HAS_APPROVED_ADJUSTMENT" },
    });

    const result = await requestTimeEntryAdjustmentAction({
      requestReason: "Em về lúc 18h",
      requestedCheckInAt: "2026-09-07T08:00:00+07:00",
      requestedCheckInMode: "offline",
      requestedCheckOutAt: "2026-09-07T18:00:00+07:00",
      requestedCheckOutMode: "offline",
      timeEntryId: requestId,
    });

    expect(result).toMatchObject({
      message: "Lượt chấm công này đã được điều chỉnh và duyệt. Liên hệ chủ trung tâm nếu cần sửa thêm.",
      status: "error",
    });
  });
});
