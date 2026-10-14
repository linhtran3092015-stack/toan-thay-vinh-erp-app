// Value: protects=the /dev/sepay preview is inert: allocation, suggestion confirm, reconciliation (search, match, resolve), reversal, allocation details and history sync all run the preview's stubs and never the real server actions (the preview runs on localhost where .env.local may point at production);
// fails_when=a SePay component stops accepting an injected action and falls back to allocateSepayTuitionAction, searchAllocationStudentsAction, getAllocationDetailsAction, match/resolve/searchSepay…Action, reverseSepayAllocationAction or the history sync actions, or the preview stops passing previewSepayActions;
// why_new=step 7 part 2 adds a preview of a screen whose every control writes money effects;
// seam=all four actions modules are mocked so any real call is observable; AppShell is replaced by its children (the shell is not under test); window.confirm is stubbed to accept; no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production (public-coaching-route-access covers the layout gate)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { previewSepayActions, SepayPreview } from "@/app/dev/sepay/sepay-preview";
import {
  allocateSepayTuitionAction,
  getAllocationDetailsAction,
  searchAllocationStudentsAction,
} from "@/features/finance/manual-allocation-actions";
import { reverseSepayAllocationAction } from "@/features/finance/sepay-allocation-reversal-actions";
import { previewSepayHistorySyncAction, syncSepayHistoryAction } from "@/features/finance/sepay-history-sync-actions";
import {
  matchSepayHistoricalTransactionAction,
  resolveSepayHistoricalTransactionAction,
  searchSepayReconciliationCandidatesAction,
} from "@/features/finance/sepay-reconciliation-actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/dev/sepay", useRouter: () => router, useSearchParams: () => null }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/finance/manual-allocation-actions", () => ({
  allocateSepayTuitionAction: vi.fn(),
  getAllocationDetailsAction: vi.fn(),
  searchAllocationStudentsAction: vi.fn(),
}));
vi.mock("@/features/finance/sepay-reconciliation-actions", () => ({
  matchSepayHistoricalTransactionAction: vi.fn(),
  resolveSepayHistoricalTransactionAction: vi.fn(),
  searchSepayReconciliationCandidatesAction: vi.fn(),
}));
vi.mock("@/features/finance/sepay-allocation-reversal-actions", () => ({ reverseSepayAllocationAction: vi.fn() }));
vi.mock("@/features/finance/sepay-history-sync-actions", () => ({ previewSepayHistorySyncAction: vi.fn(), syncSepayHistoryAction: vi.fn() }));

const STUB = "Bản xem trước không ghi dữ liệu.";

beforeEach(() => {
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** Spies keep the stub behaviour and prove each previewed control actually ran its stub. */
function spyOnStubs() {
  return Object.fromEntries(
    (Object.keys(previewSepayActions) as (keyof typeof previewSepayActions)[]).map((key) => [key, vi.spyOn(previewSepayActions, key)]),
  ) as Record<keyof typeof previewSepayActions, ReturnType<typeof vi.fn>>;
}

function expectNoRealActions() {
  for (const action of [
    allocateSepayTuitionAction,
    getAllocationDetailsAction,
    searchAllocationStudentsAction,
    matchSepayHistoricalTransactionAction,
    resolveSepayHistoricalTransactionAction,
    searchSepayReconciliationCandidatesAction,
    reverseSepayAllocationAction,
    previewSepayHistorySyncAction,
    syncSepayHistoryAction,
  ]) {
    expect(action).not.toHaveBeenCalled();
  }
}

function detailPane() {
  return screen.getByRole("region", { name: /Giao dịch đang chọn/ });
}

describe("/dev/sepay preview", () => {
  it("allocates, confirms a suggestion and reconciles from the review queue with stubs only", async () => {
    const stubs = spyOnStubs();
    render(<SepayPreview role="owner" state="normal" tab="review" />);

    // Suggestion confirm in the detail pane.
    const suggestion = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    fireEvent.click(within(suggestion).getByRole("button", { name: "Xác nhận" }));
    fireEvent.click(within(suggestion).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" }));
    await waitFor(() => expect(within(suggestion).getByRole("alert")).toHaveTextContent(STUB));

    // Manual allocation dialog: search, choose the request, review, confirm.
    fireEvent.click(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" }));
    const allocation = screen.getByRole("dialog", { name: "Phân bổ học phí thủ công" });
    fireEvent.change(within(allocation).getByLabelText(/Tìm học sinh \(tên/), { target: { value: "Quang" } });
    fireEvent.click(within(allocation).getByRole("button", { name: "Tìm học sinh" }));
    fireEvent.click(await within(allocation).findByRole("button", { name: "Chọn TTV-00088" }));
    fireEvent.change(within(allocation).getByRole("combobox"), { target: { value: "a2000000-0000-4000-8000-000000000219" } });
    fireEvent.change(within(allocation).getByLabelText("Lý do phân bổ"), { target: { value: "Đối chiếu phụ huynh" } });
    fireEvent.click(within(allocation).getByRole("button", { name: "Kiểm tra phân bổ" }));
    fireEvent.click(within(allocation).getByRole("button", { name: "Xác nhận phân bổ" }));
    await waitFor(() => expect(within(allocation).getByRole("alert")).toHaveTextContent(STUB));
    fireEvent.click(within(allocation).getByRole("button", { name: "Đóng" }));

    // Reconciliation dialog: search, match, then resolve.
    fireEvent.click(within(detailPane()).getByRole("button", { name: "Đối soát" }));
    const reconcile = screen.getByRole("dialog", { name: "Đối soát giao dịch SePay" });
    fireEvent.change(within(reconcile).getByLabelText("Tìm yêu cầu thanh toán"), { target: { value: "YC-2610" } });
    fireEvent.click(within(reconcile).getByRole("button", { name: "Tìm" }));
    await waitFor(() => expect(within(reconcile).getByText("Không tìm thấy yêu cầu thanh toán nào phù hợp với từ khóa.")).toBeInTheDocument());
    fireEvent.change(within(reconcile).getByLabelText(/Lý do \/ ghi chú bắt buộc/), { target: { value: "Đã kiểm tra sao kê" } });
    fireEvent.change(within(reconcile).getByLabelText("Yêu cầu thanh toán phù hợp"), { target: { value: "a2000000-0000-4000-8000-000000000219" } });
    fireEvent.click(within(reconcile).getByRole("button", { name: "Khớp và ghi nhận học phí" }));
    await waitFor(() => expect(within(reconcile).getByRole("alert")).toHaveTextContent(STUB));
    // The match transition must settle before the next action is enabled.
    await waitFor(() => expect(within(reconcile).getByRole("button", { name: "Đã hạch toán trước đây" })).toBeEnabled());
    fireEvent.click(within(reconcile).getByRole("button", { name: "Đã hạch toán trước đây" }));
    await waitFor(() => expect(stubs.resolveHistorical).toHaveBeenCalledTimes(1));

    expect(stubs.allocate).toHaveBeenCalledTimes(2);
    expect(stubs.searchAllocationStudents).toHaveBeenCalledWith("Quang");
    expect(stubs.searchReconciliationCandidates).toHaveBeenCalledTimes(1);
    expect(stubs.matchHistorical).toHaveBeenCalledTimes(1);
    expectNoRealActions();
  });

  it("reverses, reads allocation details, bulk-confirms suggestions and syncs history on the all tab with stubs only", async () => {
    const stubs = spyOnStubs();
    render(<SepayPreview role="owner" state="normal" tab="all" />);

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận 1 dòng tin cậy cao" }));
    await waitFor(() => expect(screen.getByText(/Đã phân bổ 0 giao dịch, 1 giao dịch lỗi/)).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Xem phân bổ" })[0]);
    const details = screen.getByRole("dialog", { name: "Chi tiết phân bổ học phí" });
    expect(await within(details).findByText(/Phạm Thu Hà · TTV-00144/)).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "Đóng" }));

    fireEvent.click(screen.getAllByRole("button", { name: /Đảo phân bổ giao dịch FT26285120/ })[0]);
    const reversal = screen.getByRole("dialog", { name: "Đảo phân bổ giao dịch FT26285120" });
    fireEvent.change(within(reversal).getByLabelText("Lý do đảo phân bổ"), { target: { value: "Chọn nhầm học sinh" } });
    fireEvent.click(within(reversal).getByRole("button", { name: "Xác nhận đảo" }));
    await waitFor(() => expect(within(reversal).getByText(STUB)).toBeInTheDocument());
    fireEvent.click(within(reversal).getByRole("button", { name: "Giữ nguyên" }));

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Xác nhận nhập lịch sử" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập lịch sử" }));
    await waitFor(() => expect(stubs.syncHistory).toHaveBeenCalledTimes(1));

    expect(stubs.allocate).toHaveBeenCalledTimes(1);
    expect(stubs.getAllocationDetails).toHaveBeenCalled();
    expect(stubs.reverseAllocation).toHaveBeenCalledTimes(1);
    expect(stubs.previewHistorySync).toHaveBeenCalledTimes(1);
    expectNoRealActions();
  });

  // Value: protects=the all tab's row-level Đối soát (shared history dialog) is inert in the preview: search, match and resolve run stubs only;
  // fails_when=SepayTransactionHistory stops forwarding `actions` to its shared SepayReconciliationDialog;
  // why_new=review round 1 (item 13): only the review tab's reconciliation was exercised; seam=as above; no_claim=as above
  it("reconciles a row from the all tab with stubs only", async () => {
    const stubs = spyOnStubs();
    render(<SepayPreview role="owner" state="normal" tab="all" />);

    const row = screen.getByRole("table", { name: "Danh sách giao dịch SePay mới nhất" }).querySelectorAll("tr");
    const target = [...row].find((tr) => tr.textContent?.includes("FT26285001")) as HTMLElement;
    fireEvent.click(within(target).getByRole("button", { name: "Đối soát" }));
    const reconcile = screen.getByRole("dialog", { name: "Đối soát giao dịch SePay" });
    fireEvent.change(within(reconcile).getByLabelText("Tìm yêu cầu thanh toán"), { target: { value: "Quang" } });
    fireEvent.click(within(reconcile).getByRole("button", { name: "Tìm" }));
    await waitFor(() => expect(stubs.searchReconciliationCandidates).toHaveBeenCalledTimes(1));
    fireEvent.change(within(reconcile).getByLabelText(/Lý do \/ ghi chú bắt buộc/), { target: { value: "Đã kiểm tra sao kê" } });
    fireEvent.change(within(reconcile).getByLabelText("Yêu cầu thanh toán phù hợp"), { target: { value: "a2000000-0000-4000-8000-000000000219" } });
    fireEvent.click(within(reconcile).getByRole("button", { name: "Khớp và ghi nhận học phí" }));
    await waitFor(() => expect(within(reconcile).getByRole("alert")).toHaveTextContent(STUB));
    await waitFor(() => expect(within(reconcile).getByRole("button", { name: "Bỏ qua" })).toBeEnabled());
    fireEvent.click(within(reconcile).getByRole("button", { name: "Bỏ qua" }));
    await waitFor(() => expect(stubs.resolveHistorical).toHaveBeenCalledTimes(1));

    expect(stubs.matchHistorical).toHaveBeenCalledWith(expect.objectContaining({ paymentRequestId: "a2000000-0000-4000-8000-000000000219" }));
    expect(stubs.resolveHistorical).toHaveBeenCalledWith(expect.objectContaining({ resolution: "ignored" }));
    expectNoRealActions();
  });

  it("renders the accountant, empty and error variants without reaching a server action", () => {
    const { unmount } = render(<SepayPreview role="accountant" state="normal" tab="review" />);
    expect(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đảo phân bổ/ })).not.toBeInTheDocument();
    unmount();

    const empty = render(<SepayPreview role="owner" state="empty" tab="review" />);
    expect(screen.getByRole("heading", { name: "Tất cả giao dịch đã khớp" })).toBeInTheDocument();
    empty.unmount();

    render(<SepayPreview role="owner" state="errors" tab="all" />);
    expect(screen.getByText("Không tải được gợi ý khớp giao dịch")).toBeInTheDocument();
    expect(screen.getByText("Không tải được cấu hình đồng bộ SePay")).toBeInTheDocument();
    expectNoRealActions();
  });
});
