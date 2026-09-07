import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SepayHistorySyncPanel } from "@/features/finance/components/sepay-history-sync-panel";
import {
  previewSepayHistorySyncAction,
  syncSepayHistoryAction,
} from "@/features/finance/sepay-history-sync-actions";

vi.mock("@/features/finance/sepay-history-sync-actions", () => ({
  previewSepayHistorySyncAction: vi.fn(),
  syncSepayHistoryAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("SePay history sync panel", () => {
  it("retains the retry session on transport loss and excludes terminal stale sessions", async () => {
    const accountId = "91000000-0000-4000-8000-000000000001";
    const sessionId = "93000000-0000-4000-8000-000000000001";
    vi.mocked(previewSepayHistorySyncAction)
      .mockRejectedValueOnce(new Error("transport"))
      .mockResolvedValue({ ok: true, accounts: [], continuationRequired: false, message: "Sẵn sàng" });
    vi.mocked(syncSepayHistoryAction)
      .mockRejectedValueOnce(new Error("transport"))
      .mockResolvedValueOnce({ ok: false, message: "Phiên đã dừng", retryable: false })
      .mockResolvedValue({ ok: true, accounts: [], continuationRequired: false, message: "Hoàn tất" });
    render(<SepayHistorySyncPanel
      accounts={[{ id: accountId, purpose: "renewal", accountNumber: "1001", bankCode: "VCB", effectiveFrom: "2026-01-01", effectiveTo: null, sepayBankAccountId: "92000000-0000-4000-8000-000000000001" }]}
      defaultDateFrom="2026-08-01" defaultDateTo="2026-08-31"
      recentRuns={[{ accountVersionId: accountId, dateFrom: "2026-08-01", dateTo: "2026-08-31", duplicateCount: 0, errorCode: null, id: sessionId, manualReviewCount: 0, pagesProcessed: 0, recordedCount: 0, startedAt: "2026-09-01T00:00:00Z", status: "running", syncSessionId: sessionId, totalSeen: 0 }]}
    />);
    const previewButton = screen.getByRole("button", { name: "Xem trước" });
    const confirmButton = screen.getByRole("button", { name: "Xác nhận nhập lịch sử" });
    fireEvent.click(previewButton);
    expect(await screen.findByText(/Không thể kết nối để xem trước/)).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
    await waitFor(() => expect(previewButton).toBeEnabled());
    fireEvent.click(previewButton);
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);
    expect(await screen.findByText(/Kết nối bị gián đoạn/)).toBeInTheDocument();
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);
    expect(await screen.findByText("Phiên đã dừng")).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
    await waitFor(() => expect(previewButton).toBeEnabled());
    fireEvent.click(previewButton);
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);
    expect(await screen.findByText("Hoàn tất")).toBeInTheDocument();
    const calls = vi.mocked(syncSepayHistoryAction).mock.calls;
    expect(calls[0]?.[0]).toEqual(expect.objectContaining({ syncSessionId: sessionId }));
    expect(calls[1]?.[0]).toEqual(expect.objectContaining({ syncSessionId: sessionId }));
    expect((calls[2]?.[0] as { syncSessionId: string }).syncSessionId).not.toBe(sessionId);
  });
  it("previews and confirms both configured account purposes without claiming settlement", async () => {
    vi.mocked(previewSepayHistorySyncAction).mockResolvedValue({
      accounts: [
        { accountVersionId: "91000000-0000-4000-8000-000000000001", label: "Tuyển mới · VCB · 1001", totalAvailable: 3 },
        { accountVersionId: "91000000-0000-4000-8000-000000000002", label: "Tái phí · VCB · 1002", totalAvailable: 4 },
      ],
      continuationRequired: false,
      message: "SePay có 7 giao dịch trong khoảng đã chọn.",
      ok: true,
    });
    vi.mocked(syncSepayHistoryAction).mockResolvedValueOnce({
      accounts: [],
      continuationRequired: true,
      message: "Đã lưu trang 1.",
      ok: true,
    }).mockResolvedValueOnce({
      accounts: [],
      continuationRequired: false,
      message: "Đã nhập lịch sử SePay ở chế độ chỉ ghi nhận.",
      ok: true,
    });

    render(<SepayHistorySyncPanel
      accounts={[
        { accountNumber: "1001", bankCode: "VCB", effectiveFrom: "2026-01-01", effectiveTo: null, id: "91000000-0000-4000-8000-000000000001", purpose: "new_enrollment", sepayBankAccountId: "92000000-0000-4000-8000-000000000001" },
        { accountNumber: "1002", bankCode: "VCB", effectiveFrom: "2026-01-01", effectiveTo: null, id: "91000000-0000-4000-8000-000000000002", purpose: "renewal", sepayBankAccountId: "92000000-0000-4000-8000-000000000002" },
      ]}
      defaultDateFrom="2026-08-01"
      defaultDateTo="2026-08-31"
    />);

    expect(screen.getByText(/không tự ghi học phí và không tạo đơn hàng/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await waitFor(() => expect(previewSepayHistorySyncAction).toHaveBeenCalledWith({
      accountVersionIds: [
        "91000000-0000-4000-8000-000000000001",
        "91000000-0000-4000-8000-000000000002",
      ],
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
    }));
    expect(await screen.findByText("SePay có 7 giao dịch trong khoảng đã chọn.")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Xác nhận nhập lịch sử" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);
    await waitFor(() => expect(syncSepayHistoryAction).toHaveBeenCalledTimes(2));
    const firstSyncInput = vi.mocked(syncSepayHistoryAction).mock.calls[0]?.[0];
    const secondSyncInput = vi.mocked(syncSepayHistoryAction).mock.calls[1]?.[0];
    expect(firstSyncInput).toEqual(expect.objectContaining({
      accountVersionIds: [
        "91000000-0000-4000-8000-000000000001",
        "91000000-0000-4000-8000-000000000002",
      ],
      syncSessionId: expect.any(String),
    }));
    expect(secondSyncInput).toEqual(expect.objectContaining({
      syncSessionId: (firstSyncInput as { syncSessionId: string }).syncSessionId,
    }));
    expect(await screen.findByText("Đã nhập lịch sử SePay ở chế độ chỉ ghi nhận.")).toBeInTheDocument();
  });

  it("disables an account until its SePay API identity is configured", () => {
    render(<SepayHistorySyncPanel
      accounts={[
        { accountNumber: "1002", bankCode: "VCB", effectiveFrom: "2026-01-01", effectiveTo: null, id: "91000000-0000-4000-8000-000000000002", purpose: "renewal", sepayBankAccountId: null },
      ]}
      defaultDateFrom="2026-08-01"
      defaultDateTo="2026-08-31"
    />);

    expect(screen.getByText(/Chưa có ID SePay API/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xem trước" })).toBeDisabled();
  });

  it("resumes a running persisted session after the page is reopened", async () => {
    const accountId = "91000000-0000-4000-8000-000000000001";
    const persistedSessionId = "93000000-0000-4000-8000-000000000001";
    vi.mocked(previewSepayHistorySyncAction).mockResolvedValue({
      accounts: [{ accountVersionId: accountId, label: "Tuyển mới · VCB · 1001", totalAvailable: 101 }],
      continuationRequired: false,
      message: "SePay có 101 giao dịch trong khoảng đã chọn.",
      ok: true,
    });
    vi.mocked(syncSepayHistoryAction).mockResolvedValue({
      accounts: [],
      continuationRequired: false,
      message: "Đã tiếp tục và hoàn tất.",
      ok: true,
    });

    render(<SepayHistorySyncPanel
      accounts={[
        { accountNumber: "1001", bankCode: "VCB", effectiveFrom: "2026-01-01", effectiveTo: null, id: accountId, purpose: "new_enrollment", sepayBankAccountId: "92000000-0000-4000-8000-000000000001" },
      ]}
      defaultDateFrom="2026-08-01"
      defaultDateTo="2026-08-31"
      recentRuns={[{
        accountVersionId: accountId,
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        duplicateCount: 0,
        errorCode: null,
        id: "94000000-0000-4000-8000-000000000001",
        manualReviewCount: 0,
        pagesProcessed: 1,
        recordedCount: 100,
        startedAt: "2026-09-01T01:00:00.000Z",
        status: "running",
        syncSessionId: persistedSessionId,
        totalSeen: 100,
      }]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
    expect(await screen.findByText("SePay có 101 giao dịch trong khoảng đã chọn.")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Xác nhận nhập lịch sử" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(syncSepayHistoryAction).toHaveBeenCalledWith(expect.objectContaining({
      syncSessionId: persistedSessionId,
    })));
  });
});
