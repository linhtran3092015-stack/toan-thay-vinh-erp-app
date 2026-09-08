import { describe, expect, it } from "vitest";

import {
  adminAdjustTimeEntrySchema,
  adminCreateTimeEntrySchema,
} from "@/features/timekeeping/timekeeping-admin-schemas";

describe("adminAdjustTimeEntrySchema", () => {
  it("validates valid adjustment input", () => {
    const result = adminAdjustTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T08:00:00+07:00",
      checkOutAt: "2026-09-07T17:00:00+07:00",
      reason: "Quên bấm chấm công ra, quản lý xác nhận làm đủ giờ",
      timeEntryId: "c1111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(true);
  });

  it("fails when checkOutAt is before checkInAt", () => {
    const result = adminAdjustTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T17:00:00+07:00",
      checkOutAt: "2026-09-07T08:00:00+07:00",
      reason: "Giờ ra trước giờ vào",
      timeEntryId: "c1111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.checkOutAt).toContain(
        "Thời điểm ra phải sau hoặc bằng thời điểm vào.",
      );
    }
  });

  it("fails when reason is empty or only whitespace", () => {
    const result = adminAdjustTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T08:00:00+07:00",
      checkOutAt: "2026-09-07T17:00:00+07:00",
      reason: "   ",
      timeEntryId: "c1111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toContain(
        "Lý do điều chỉnh không được để trống.",
      );
    }
  });

  it("fails when timeEntryId is not a valid UUID", () => {
    const result = adminAdjustTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T08:00:00+07:00",
      checkOutAt: "2026-09-07T17:00:00+07:00",
      reason: "Hợp lệ",
      timeEntryId: "invalid-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.timeEntryId).toContain(
        "ID lượt chấm công không hợp lệ.",
      );
    }
  });
});

describe("adminCreateTimeEntrySchema", () => {
  it("validates valid manual entry creation", () => {
    const result = adminCreateTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T08:00:00+07:00",
      checkOutAt: "2026-09-07T17:00:00+07:00",
      mode: "offline",
      notes: "Công bù trực hỗ trợ",
      staffId: "a1111111-1111-4111-8111-111111111111",
      workDate: "2026-09-07",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("offline");
      expect(result.data.notes).toBe("Công bù trực hỗ trợ");
    }
  });

  it("defaults mode to offline and notes to standard message when omitted", () => {
    const result = adminCreateTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T08:00:00+07:00",
      checkOutAt: "2026-09-07T17:00:00+07:00",
      staffId: "a1111111-1111-4111-8111-111111111111",
      workDate: "2026-09-07",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("offline");
      expect(result.data.notes).toBe("Chủ trung tâm bổ sung công bù");
    }
  });

  it("fails on invalid workDate format", () => {
    const result = adminCreateTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T08:00:00+07:00",
      checkOutAt: "2026-09-07T17:00:00+07:00",
      staffId: "a1111111-1111-4111-8111-111111111111",
      workDate: "07/09/2026",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.workDate).toContain(
        "Ngày làm việc phải có định dạng YYYY-MM-DD.",
      );
    }
  });

  it("fails when checkOutAt is before checkInAt", () => {
    const result = adminCreateTimeEntrySchema.safeParse({
      checkInAt: "2026-09-07T17:00:00+07:00",
      checkOutAt: "2026-09-07T08:00:00+07:00",
      staffId: "a1111111-1111-4111-8111-111111111111",
      workDate: "2026-09-07",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.checkOutAt).toContain(
        "Thời điểm ra phải sau hoặc bằng thời điểm vào.",
      );
    }
  });
});
