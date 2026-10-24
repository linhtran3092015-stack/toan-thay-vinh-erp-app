import { describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/permissions/database-permissions", () => ({
  getDatabasePermissions: vi.fn(async () => ({
    ok: true,
    permissions: ["payroll.manage"],
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { addPayrollManualLineAction } from "@/features/payroll/actions/payroll-actions";

describe("Payroll Manual Line Action Error Mappings", () => {
  const payload = {
    amountVnd: 500000,
    lineType: "manual_reward" as const,
    note: "Thưởng dự án",
    payrollStatementId: "fa70d806-18e0-4b04-af6e-b045156a13fa",
  };

  it("maps PAYROLL_MANUAL_LINE_REQUIRES_CURRENT_OPEN_DRAFT to a clear, actionable message", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "23514: PAYROLL_MANUAL_LINE_REQUIRES_CURRENT_OPEN_DRAFT" },
    });

    const result = await addPayrollManualLineAction(payload);
    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Chỉ có thể điều chỉnh trên bản tính lương nháp hiện tại. Hãy tải lại trang và kiểm tra trước khi thực hiện.",
    );
  });

  it("maps PAYROLL_MANUAL_LINE_SELF_CHANGE_FORBIDDEN to a clear self-change message", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "42501: PAYROLL_MANUAL_LINE_SELF_CHANGE_FORBIDDEN" },
    });

    const result = await addPayrollManualLineAction(payload);
    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Không thể tự thêm điều chỉnh cho bảng lương của chính mình.",
    );
  });

  it("maps other known payroll manual line database errors correctly", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "22023: PAYROLL_MANUAL_LINE_AMOUNT_INVALID" },
    });
    const resAmount = await addPayrollManualLineAction(payload);
    expect(resAmount.status).toBe("error");
    expect(resAmount.message).toBe("Số tiền điều chỉnh không hợp lệ.");

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "22023: PAYROLL_MANUAL_LINE_NOTE_INVALID" },
    });
    const resNote = await addPayrollManualLineAction(payload);
    expect(resNote.status).toBe("error");
    expect(resNote.message).toBe("Nội dung điều chỉnh không hợp lệ.");

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "P0002: PAYROLL_STATEMENT_NOT_FOUND" },
    });
    const resNotFound = await addPayrollManualLineAction(payload);
    expect(resNotFound.status).toBe("error");
    expect(resNotFound.message).toBe("Không tìm thấy bảng lương nhân sự.");
  });

  it("returns success status when RPC succeeds", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { id: "new-line-id" },
      error: null,
    });

    const result = await addPayrollManualLineAction(payload);
    expect(result.status).toBe("success");
    expect(result.message).toBe("Đã thêm khoản điều chỉnh lương.");
  });
});
