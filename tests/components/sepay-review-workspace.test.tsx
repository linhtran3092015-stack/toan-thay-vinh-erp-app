// Value: protects=the /finance/sepay redesign (design 07 frame 7c): Cần xử lý / Tất cả giao dịch tabs on the existing queue URLs, the review queue list with URL-kept selection and status chips, the detail pane reusing the existing allocation/reconciliation/suggestion flows, the success empty state, permission-gated actions with a written reason, and the below-lg fallback where queue cards carry the existing dialog triggers;
// fails_when=the tabs stop pointing at /finance/sepay and ?queue=review, selection or the status chip is not written to the address bar, the detail pane re-implements or drops the existing triggers, the per-transaction suggestion brings back the bulk primary, sepay.view alone shows write controls, chips show counts for a partial queue, or the mobile card loses its triggers;
// why_new=step 7 part 2 replaces the single SePay list with a queue + detail workspace;
// seam=server actions modules are mocked so the real flows can open without a network; CSS breakpoints are asserted through classes because jsdom has no layout; no_claim=does not prove the 440px column or 375px overflow visually (checked in the /dev/sepay preview) nor the loader's queue filter
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AllocationSuggestion } from "@/features/finance/allocation-suggestions-data";
import { SepayTransactionsScreen, type SepayTransactionsScreenProps } from "@/features/finance/components/sepay-transactions-screen";
import { searchAllocationStudentsAction } from "@/features/finance/manual-allocation-actions";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: nav.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
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

afterEach(() => {
  cleanup();
  nav.search = "";
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

function tx(overrides: Partial<SepayTransactionReadModel> & Pick<SepayTransactionReadModel, "bankTransactionId" | "id">): SepayTransactionReadModel {
  return {
    accountNumber: "0399886886",
    accountPurpose: "renewal",
    amountVnd: 2_400_000,
    bankBrand: "MB Bank",
    createdAt: "2026-10-12T01:14:40Z",
    ingestionSource: "webhook",
    matchStatus: "unmatched",
    matchedAt: null,
    matchedPaymentRequestCode: null,
    matchedStudentFullName: null,
    referenceNumber: null,
    sepayV2Id: null,
    transactionAt: "2026-10-12T01:14:37Z",
    transferContent: "",
    transferType: "in",
    ...overrides,
  };
}

const queue = [
  tx({ bankTransactionId: "FT-001", id: "c1000000-0000-4000-8000-000000000001", transferContent: "LY VAN SON CK HOC PHI THANG 10 QUANG" }),
  tx({ amountVnd: 1_900_000, bankTransactionId: "FT-002", id: "c1000000-0000-4000-8000-000000000002", matchStatus: "amount_mismatch", transferContent: "TTV00117 T10" }),
  tx({ amountVnd: 500_000, bankTransactionId: "FT-003", id: "c1000000-0000-4000-8000-000000000003", matchStatus: "account_purpose_mismatch", transferContent: "NGUYEN THI THU chuyen tien" }),
];

const suggestion: AllocationSuggestion = {
  accountPurpose: "renewal",
  amountVnd: 2_400_000,
  candidateCount: 1,
  candidates: [{
    birthYear: 2011,
    candidateRank: 1,
    confidence: "high",
    currentGrade: 9,
    guardianName: "Lý Văn Sơn",
    guardianPhone: "0912345678",
    matchReasons: ["student_name"],
    pendingRequestId: null,
    studentCode: "TTV-00088",
    studentId: "a1000000-0000-4000-8000-000000000088",
    studentName: "Lý Nhật Quang",
    suggestedSessions: 12,
    unitPriceVnd: 200_000,
  }],
  transactionAt: queue[0].transactionAt,
  transactionId: queue[0].id,
  transferContent: queue[0].transferContent,
};

function baseProps(overrides: Partial<SepayTransactionsScreenProps> = {}): SepayTransactionsScreenProps {
  return {
    accountPurposeFilter: "",
    canAllocate: true,
    canReconcile: true,
    canReverse: false,
    candidates: [],
    page: 1,
    pageSize: 50,
    queueFilter: "review",
    reconciliationError: false,
    reviewCount: queue.length,
    suggestions: { data: [suggestion], ok: true },
    total: queue.length,
    transactions: queue,
    ...overrides,
  };
}

function renderScreen(overrides: Partial<SepayTransactionsScreenProps> = {}) {
  return render(<SepayTransactionsScreen {...baseProps(overrides)} />);
}

function queueItems() {
  return within(screen.getByRole("list", { name: "Hàng đợi giao dịch cần xử lý" })).getAllByRole("listitem");
}

function detailPane() {
  return screen.getByRole("region", { name: /Giao dịch đang chọn/ });
}

describe("SePay review workspace", () => {
  it("keeps the tabs on the existing queue URLs without a separate history button", () => {
    renderScreen({ accountPurposeFilter: "renewal" });

    const tabs = screen.getByRole("tablist", { name: "Hàng đợi đối soát SePay" });
    const review = within(tabs).getByRole("tab", { name: /Cần xử lý/ });
    expect(review).toHaveAttribute("aria-selected", "true");
    expect(review).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal&queue=review");
    expect(review).toHaveTextContent("3 việc tồn");
    expect(within(tabs).getByRole("tab", { name: "Tất cả giao dịch" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal");
    // Review round 1: "Lịch sử đã khớp" pointed at the full list, not a matched-only one; the tab covers it.
    expect(screen.queryByRole("link", { name: "Lịch sử đã khớp" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tái phí" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal&queue=review");
  });

  it("selects the first transfer and shows the existing allocation, reconciliation and suggestion flows for it", () => {
    renderScreen();

    const items = queueItems();
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByRole("button", { name: /Xem giao dịch FT-001/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(items[1]).getByText("Sai số tiền – cần đối soát")).toBeInTheDocument();
    expect(within(items[1]).getByText("TTV00117 T10")).toHaveClass("font-mono");

    const detail = detailPane();
    expect(within(detail).getByText("LY VAN SON CK HOC PHI THANG 10 QUANG")).toBeInTheDocument();
    expect(within(detail).getByText("FT-001")).toBeInTheDocument();
    expect(within(detail).getByText("2.400.000 ₫")).toBeInTheDocument();
    expect(within(detail).queryByText("+2.400.000 ₫")).not.toBeInTheDocument();

    const suggestions = within(detail).getByRole("region", { name: "Gợi ý khớp" });
    expect(within(suggestions).getByText(/Lý Nhật Quang/)).toBeInTheDocument();
    expect(within(suggestions).getByRole("button", { name: "Xác nhận" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dòng tin cậy cao/ })).not.toBeInTheDocument();

    expect(within(detail).getByRole("button", { name: "Đối soát" })).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("button", { name: "Phân bổ học phí" }));
    expect(screen.getByRole("dialog", { name: "Phân bổ học phí thủ công" })).toBeInTheDocument();
  });

  it("selects another transfer and keeps the choice in the address bar without dropping other parameters", () => {
    window.history.replaceState(null, "", "/finance/sepay?queue=review&accountPurpose=renewal");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderScreen({ accountPurposeFilter: "renewal" });

    fireEvent.click(within(queueItems()[1]).getByRole("button", { name: /Xem giao dịch FT-002/ }));

    expect(within(queueItems()[1]).getByRole("button", { name: /Xem giao dịch FT-002/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(queueItems()[0]).getByRole("button", { name: /Xem giao dịch FT-001/ })).toHaveAttribute("aria-pressed", "false");
    expect(within(detailPane()).getByText("FT-002")).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", `/finance/sepay?queue=review&accountPurpose=renewal&tx=${queue[1].id}`);
  });

  it("opens on the transfer named in ?tx= and falls back to the first when it is gone", () => {
    nav.search = `queue=review&tx=${queue[2].id}`;
    const { unmount } = renderScreen();
    expect(within(detailPane()).getByText("FT-003")).toBeInTheDocument();
    unmount();

    nav.search = "queue=review&tx=c1000000-0000-4000-8000-00000000dead";
    renderScreen();
    expect(within(detailPane()).getByText("FT-001")).toBeInTheDocument();
  });

  it("filters the loaded queue by match status with real counts", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderScreen();

    const chips = screen.getByRole("group", { name: "Lọc theo trạng thái khớp" });
    expect(within(chips).getByRole("button", { name: /^Tất cả\s*3$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getByRole("button", { name: /^Trùng nhận diện\s*0$/ })).toBeDisabled();

    fireEvent.click(within(chips).getByRole("button", { name: /^Sai số tiền\s*1$/ }));

    expect(queueItems()).toHaveLength(1);
    expect(within(detailPane()).getByText("FT-002")).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/?status=amount_mismatch");
  });

  it("hides status chips when only part of the queue is loaded", () => {
    nav.search = "queue=review&status=amount_mismatch";
    renderScreen({ reviewCount: 120, total: 120 });

    expect(screen.queryByRole("group", { name: "Lọc theo trạng thái khớp" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "120 giao dịch cần xử lý · trang này 3" })).toBeInTheDocument();
    expect(queueItems()).toHaveLength(3);
  });

  it("shows the success empty state with a way back to the full history", () => {
    renderScreen({ accountPurposeFilter: "renewal", reviewCount: 0, suggestions: { data: [], ok: true }, total: 0, transactions: [] });

    expect(screen.getByRole("heading", { name: "Tất cả giao dịch đã khớp" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem tất cả giao dịch" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal");
    expect(screen.queryByRole("list", { name: "Hàng đợi giao dịch cần xử lý" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps sepay.view alone read-only and says why", () => {
    renderScreen({ canAllocate: false, canReconcile: false, suggestions: null });

    expect(screen.queryByRole("button", { name: "Phân bổ học phí" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Gợi ý khớp" })).not.toBeInTheDocument();
    // One reason per queue card (below lg) and one in the detail pane (lg+).
    expect(screen.getAllByText(/Bạn chỉ xem được giao dịch\. Phân bổ hoặc đối soát cần quyền phân bổ giao dịch SePay hoặc quản lý thanh toán\./)).toHaveLength(4);
  });

  it("offers allocation and reconciliation to sepay.allocate / payments.manage holders", () => {
    renderScreen({ canAllocate: true, canReconcile: true });

    expect(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" })).toBeInTheDocument();
    expect(within(detailPane()).getByRole("button", { name: "Đối soát" })).toBeInTheDocument();
    expect(screen.queryByText(/Bạn chỉ xem được giao dịch/)).not.toBeInTheDocument();
  });

  it("locks reconciliation with a written reason when candidates failed to load", () => {
    renderScreen({ canAllocate: false, canReconcile: false, reconciliationError: true, suggestions: null });

    expect(screen.getByRole("alert")).toHaveTextContent(/Không tải được danh sách yêu cầu thanh toán/);
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    // The full message is the single screen-level alert; the pane only points at it.
    expect(screen.getAllByText(/Không tải được danh sách yêu cầu thanh toán/)).toHaveLength(1);
    expect(within(detailPane()).getByText("Đối soát đang tạm khóa: xem thông báo ở đầu trang.")).toBeInTheDocument();
  });

  it("falls back below lg to queue cards carrying the existing dialog triggers", () => {
    const { container } = renderScreen();

    expect(container.querySelector(".lg\\:grid-cols-\\[440px_minmax\\(0\\,1fr\\)\\]")).not.toBeNull();
    expect(detailPane()).toHaveClass("hidden", "lg:grid");
    expect(container.querySelector(".min-w-\\[1340px\\]")).toBeNull();

    const third = queueItems()[2];
    expect(within(third).getByRole("button", { name: /Xem giao dịch FT-003/ })).toHaveClass("hidden", "lg:block");
    const mobileTrigger = within(third).getByRole("button", { name: "Đối soát" });
    expect(mobileTrigger.closest(".lg\\:hidden")).toHaveClass("[&_button]:min-h-11");

    fireEvent.click(mobileTrigger);
    expect(within(screen.getByRole("dialog")).getByText("FT-003")).toBeInTheDocument();
  });

  it("routes the detail pane's allocation search through injected actions instead of the real one", async () => {
    const searchAllocationStudents = vi.fn().mockResolvedValue({ data: [], ok: true });
    renderScreen({ actions: { searchAllocationStudents } });

    fireEvent.click(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" }));
    fireEvent.change(screen.getByLabelText(/Tìm học sinh \(tên/), { target: { value: "Quang" } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm học sinh" }));

    expect(await screen.findByText(/Không tìm thấy học sinh/)).toBeInTheDocument();
    expect(searchAllocationStudents).toHaveBeenCalledWith("Quang");
    expect(searchAllocationStudentsAction).not.toHaveBeenCalled();
  });
});

describe("SePay review workspace gaps", () => {
  // Value: protects=a failed suggestions read is visible to allocators on both tabs (ErrorState on Tất cả giao dịch, alert in the detail pane) and stays hidden from viewers who never load suggestions;
  // fails_when=the screen swallows suggestions {ok:false}, the detail pane drops suggestionsError, or a non-allocator sees an error for a read that never ran;
  // why_new=coverage audit: only the success path of suggestions was asserted; seam=suggestions passed as the loader result; no_claim=the RPC error mapping in allocation-suggestions-data
  it("shows a failed suggestions read on the all tab and once above the review queue for allocators only", () => {
    const failed = { error: "Dữ liệu gợi ý không đúng định dạng.", ok: false as const };
    const { unmount } = renderScreen({ queueFilter: "", suggestions: failed });
    expect(screen.getByRole("heading", { name: "Không tải được gợi ý khớp giao dịch" })).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu gợi ý không đúng định dạng.")).toBeInTheDocument();
    unmount();

    const review = renderScreen({ suggestions: failed });
    // Review round 2: shown once at workspace level (every breakpoint), not inside the lg-only detail pane.
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Không tải được gợi ý khớp giao dịch. Dữ liệu gợi ý không đúng định dạng.");
    expect(detailPane().contains(alerts[0])).toBe(false);
    expect(alerts[0].closest(".lg\\:hidden")).toBeNull();
    expect(within(detailPane()).queryByRole("region", { name: "Gợi ý khớp" })).not.toBeInTheDocument();
    review.unmount();

    renderScreen({ canAllocate: false, canReconcile: true, suggestions: null });
    expect(within(detailPane()).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Không tải được gợi ý/)).not.toBeInTheDocument();
  });

  // Value: protects=paging inside Cần xử lý stays in the review queue and keeps the account-purpose filter;
  // fails_when=SepayPagination is called without queue "review" or drops accountPurpose, sending the accountant to the full list or another account;
  // why_new=coverage audit: pagination was only exercised on the full list; seam=none; no_claim=loader offsets
  it("keeps queue=review and accountPurpose on the queue's pagination links", () => {
    renderScreen({ accountPurposeFilter: "renewal", page: 2, reviewCount: 120, total: 120 });

    const pager = screen.getByRole("navigation", { name: "Phân trang giao dịch SePay" });
    expect(within(pager).getByRole("link", { name: "Trang trước" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal&queue=review");
    expect(within(pager).getByRole("link", { name: "Trang sau" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal&queue=review&page=3");
    expect(within(pager).getByText("Trang 2/3")).toBeInTheDocument();
    // Review round 2: 44px touch targets below sm.
    expect(within(pager).getByRole("link", { name: "Trang sau" })).toHaveClass("min-h-11", "sm:min-h-0");
  });

  // Value: protects=review status chips are 44px touch targets on phones and 32px from sm up;
  // fails_when=the chip group loses its touch-size classes; why_new=review round 2; seam=classes stand in for layout; no_claim=rendered size
  it("gives the status chips phone-sized touch targets", () => {
    renderScreen();
    expect(screen.getByRole("group", { name: "Lọc theo trạng thái khớp" })).toHaveClass("[&>button]:min-h-11", "sm:[&>button]:min-h-8");
  });

  // Value: protects=an empty page of a non-empty queue (stale ?page=) says so neutrally, links back to page 1 of the same queue and keeps paging, instead of the success state;
  // fails_when=the workspace shows "Tất cả giao dịch đã khớp" whenever the page is empty, or the way back drops queue/accountPurpose;
  // why_new=coverage audit regression (sepay-transactions-page.test.tsx covers the route); seam=none; no_claim=why the loader returned an empty page
  it("shows a neutral stale-page message with a way back to page 1 when only this page is empty", () => {
    renderScreen({ accountPurposeFilter: "renewal", page: 3, reviewCount: 60, suggestions: { data: [], ok: true }, total: 60, transactions: [] });

    expect(screen.queryByText("Tất cả giao dịch đã khớp")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trang này không còn giao dịch." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang 1 của hàng đợi" })).toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal&queue=review");
    expect(within(screen.getByRole("navigation", { name: "Phân trang giao dịch SePay" })).getByRole("link", { name: "Trang trước" }))
      .toHaveAttribute("href", "/finance/sepay?accountPurpose=renewal&queue=review&page=2");
  });

  // Value: protects=a ?status= chip whose status has no rows shows the empty-status line and never a detail pane for a transfer of another status;
  // fails_when=selection falls back to the unfiltered queue (showing an unmatched transfer under "Trùng nhận diện") or the empty line disappears;
  // why_new=coverage audit: the zero-row chip was only asserted as disabled; seam=none; no_claim=how such a URL is produced (shared link after the queue changed)
  it("shows the empty-status line and no detail pane when the status chip has no rows", () => {
    nav.search = `queue=review&status=identity_conflict&tx=${queue[0].id}`;
    renderScreen();

    const chips = screen.getByRole("group", { name: "Lọc theo trạng thái khớp" });
    expect(within(chips).getByRole("button", { name: /^Trùng nhận diện\s*0$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("list", { name: "Hàng đợi giao dịch cần xử lý" })).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("Không còn giao dịch ở trạng thái này.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Giao dịch đang chọn/ })).not.toBeInTheDocument();
    expect(screen.queryByText("FT-001")).not.toBeInTheDocument();
  });
});

describe("SePay review round 1", () => {
  // Value: protects=the account-purpose filter's active chip is a soft chip with moss text (never a second filled primary, never dark text on moss) and every chip is a 44px touch target on phones;
  // fails_when=the active chip goes back to bg-action-primary, loses the important text colour that beats the global `a { color: inherit }`, or drops min-h-11;
  // why_new=review round 1 found dark-on-moss in the browser; seam=classes stand in for computed colour (jsdom has no CSS); no_claim=the rendered colour itself
  it("renders the active purpose filter as a soft chip with an important text colour", () => {
    renderScreen({ accountPurposeFilter: "renewal" });

    const active = screen.getByRole("link", { name: "Tái phí" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveClass("border-action-primary", "bg-action-primary-soft", "text-action-primary!", "min-h-11", "sm:h-9");
    expect(active).not.toHaveClass("bg-action-primary");
    const inactive = screen.getByRole("link", { name: "Tuyển mới" });
    expect(inactive).toHaveClass("text-text-muted!", "hover:text-text-strong!", "min-h-11");
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  // Value: protects=the status chip and selection follow the address bar while the workspace stays mounted (Next keeps it mounted when only search params change), and a new purpose/page starts over;
  // fails_when=the chip or selection are seeded once and survive a purpose link, the Cần xử lý tab link or "Về trang 1";
  // why_new=review round 1; seam=useSearchParams mocked through a mutable query string; no_claim=Next's own router sync of replaceState
  it("resets the status chip and selection when the URL or the data set changes", () => {
    nav.search = "queue=review&status=amount_mismatch";
    const { rerender } = renderScreen();
    expect(queueItems()).toHaveLength(1);

    nav.search = "queue=review";
    rerender(<SepayTransactionsScreen {...baseProps()} />);
    expect(queueItems()).toHaveLength(3);
    expect(within(screen.getByRole("group", { name: "Lọc theo trạng thái khớp" })).getByRole("button", { name: /^Tất cả\s*3$/ }))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(queueItems()[2]).getByRole("button", { name: /Xem giao dịch FT-003/ }));
    expect(within(detailPane()).getByText("FT-003")).toBeInTheDocument();

    nav.search = `queue=review&tx=${queue[1].id}`;
    rerender(<SepayTransactionsScreen {...baseProps()} />);
    expect(within(detailPane()).getByText("FT-002")).toBeInTheDocument();

    // New purpose: the screen keys the workspace, so local state starts over from the server props.
    fireEvent.click(within(queueItems()[2]).getByRole("button", { name: /Xem giao dịch FT-003/ }));
    nav.search = "accountPurpose=renewal&queue=review";
    rerender(<SepayTransactionsScreen {...baseProps({ accountPurposeFilter: "renewal" })} />);
    expect(within(detailPane()).getByText("FT-001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tái phí" })).toHaveAttribute("aria-current", "page");
  });

  // Value: protects=confirming the detail pane's suggestion leaves a visible result line, and when the refreshed queue no longer holds that transfer the workspace says so and shows the next one instead of switching silently;
  // fails_when=the confirmed row disappears into an empty panel, or a refresh that drops the selected transfer changes the detail pane without a notice (or jumps back to the first row);
  // why_new=review round 1; seam=allocate injected; refresh simulated by re-rendering with the transfer removed; no_claim=router.refresh timing
  it("keeps a confirmed suggestion as a result line and announces the next transfer after the refresh", async () => {
    const allocate = vi.fn().mockResolvedValue({ data: null, ok: true });
    const { rerender } = renderScreen({ actions: { allocate } });

    const suggestionPanel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    fireEvent.click(within(suggestionPanel).getByRole("button", { name: "Xác nhận" }));
    fireEvent.click(within(suggestionPanel).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" }));
    expect(await within(suggestionPanel).findByRole("status")).toHaveTextContent("Đã phân bổ 2.400.000 ₫ cho Lý Nhật Quang.");
    expect(allocate).toHaveBeenCalledTimes(1);
    expect(nav.refresh).toHaveBeenCalled();

    rerender(<SepayTransactionsScreen {...baseProps({ actions: { allocate }, reviewCount: 2, total: 2, transactions: queue.slice(1) })} />);
    expect(screen.getByText("Giao dịch đang xem đã rời hàng đợi (đã được xử lý hoặc chuyển trang); đang hiển thị giao dịch kế tiếp.")).toBeInTheDocument();
    expect(within(detailPane()).getByText("FT-002")).toBeInTheDocument();

    fireEvent.click(within(queueItems()[1]).getByRole("button", { name: /Xem giao dịch FT-003/ }));
    expect(screen.queryByText(/đã rời hàng đợi/)).not.toBeInTheDocument();
  });

  // Value: protects=after a refresh drops the selected row, the next row at the same position is selected, the address bar follows it (from an effect), and the notice is lg-only (phones never had "a selected transfer");
  // fails_when=the selection jumps to the first row, the URL keeps the departed tx, or phones get the "đang hiển thị giao dịch kế tiếp" notice;
  // why_new=review round 2; seam=useSearchParams mocked; replaceState spied; jsdom has no CSS so the lg-only notice is asserted by class; no_claim=Next's router sync of replaceState
  it("announces the next transfer at the same position when a middle row leaves and moves the URL with it", () => {
    window.history.replaceState(null, "", `/finance/sepay?queue=review&tx=${queue[1].id}`);
    nav.search = `queue=review&tx=${queue[1].id}`;
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { rerender } = renderScreen();
    expect(replaceState).not.toHaveBeenCalled();

    rerender(<SepayTransactionsScreen {...baseProps({ reviewCount: 2, total: 2, transactions: [queue[0], queue[2]] })} />);
    expect(within(detailPane()).getByText("FT-003")).toBeInTheDocument();
    const notice = screen.getByText(/đã rời hàng đợi/);
    expect(notice).toHaveClass("hidden", "lg:block");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", `/finance/sepay?queue=review&tx=${queue[2].id}`);

    // The router echoing our own URL back must not clear the notice.
    nav.search = `queue=review&tx=${queue[2].id}`;
    rerender(<SepayTransactionsScreen {...baseProps({ reviewCount: 2, total: 2, transactions: [queue[0], queue[2]] })} />);
    expect(screen.getByText(/đã rời hàng đợi/)).toBeInTheDocument();
  });

  // Value: protects=when the handled row was the last one under the active status chip, the workspace shows the empty-status line, clears the selection and drops tx from the URL without claiming a "next" transfer;
  // fails_when=the departed notice appears with nothing to show, a detail pane lingers, or the URL keeps the departed tx;
  // why_new=review round 3; seam=useSearchParams mocked; replaceState spied; no_claim=Next's router sync of replaceState
  it("clears the selection without a notice when the last row under the status chip leaves", () => {
    window.history.replaceState(null, "", "/finance/sepay?queue=review&status=amount_mismatch");
    nav.search = "queue=review&status=amount_mismatch";
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { rerender } = renderScreen();
    expect(within(detailPane()).getByText("FT-002")).toBeInTheDocument();

    rerender(<SepayTransactionsScreen {...baseProps({ reviewCount: 2, total: 2, transactions: [queue[0], queue[2]] })} />);

    expect(screen.getByText("Không còn giao dịch ở trạng thái này.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Giao dịch đang chọn/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/đã rời hàng đợi/)).not.toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/finance/sepay?queue=review&status=amount_mismatch");
    expect(window.location.search).not.toContain("tx=");
  });

  // Value: protects=an allocator whose payment-request list failed to load still sees why Đối soát is missing on a reconcilable transfer (card and detail pane), so no action row is empty without a reason;
  // fails_when=the Đối soát slot is silently empty when canReconcile is false only because candidates failed (e.g. identity_conflict with a SePay API id, where Phân bổ is not offered either);
  // why_new=review round 3; seam=none; no_claim=the candidate loader failure itself
  it("explains the locked reconciliation where the trigger would be when candidates failed to load", () => {
    const conflict = tx({ bankTransactionId: "FT-010", id: "c1000000-0000-4000-8000-000000000010", matchStatus: "identity_conflict", sepayV2Id: "95000000-0000-4000-8000-000000000010" });
    renderScreen({ canAllocate: true, canReconcile: false, reconciliationError: true, reviewCount: 1, suggestions: { data: [], ok: true }, total: 1, transactions: [conflict] });

    const card = queueItems()[0];
    expect(within(card).queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Phân bổ học phí" })).not.toBeInTheDocument();
    expect(within(card).getByText("Đối soát đang tạm khóa: xem thông báo ở đầu trang.")).toBeInTheDocument();
    expect(within(detailPane()).getByText("Đối soát đang tạm khóa: xem thông báo ở đầu trang.")).toBeInTheDocument();
    expect(screen.getAllByText(/Không tải được danh sách yêu cầu thanh toán/)).toHaveLength(1);
  });

  // Value: protects=an identity_conflict transfer without a SePay API id says why it cannot be reconciled here and what to do next, instead of "Không cần thao tác";
  // fails_when=the review workspace shows "Không cần thao tác" or a dead Đối soát trigger for it, or hides the reason;
  // why_new=review round 1; seam=none; no_claim=the owner-only resolution rule in the RPC
  it("explains identity conflicts that cannot be reconciled from the queue", () => {
    const conflict = tx({ bankTransactionId: "FT-009", id: "c1000000-0000-4000-8000-000000000009", matchStatus: "identity_conflict" });
    const withApiId = tx({ bankTransactionId: "FT-010", id: "c1000000-0000-4000-8000-000000000010", matchStatus: "identity_conflict", sepayV2Id: "95000000-0000-4000-8000-000000000010" });
    renderScreen({ reviewCount: 2, suggestions: { data: [], ok: true }, total: 2, transactions: [conflict, withApiId] });

    const [first, second] = queueItems();
    // Review round 2: plain wording; the next step depends on history-sync permission.
    expect(within(first).getByText("Giao dịch này trùng với một giao dịch khác nên chưa đối soát được ở đây. Báo quản trị để đồng bộ lịch sử SePay.")).toBeInTheDocument();
    expect(within(first).queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(within(detailPane()).getByText(/trùng với một giao dịch khác/)).toBeInTheDocument();
    expect(screen.queryByText("Không cần thao tác")).not.toBeInTheDocument();
    expect(screen.queryByText(/Đồng bộ lịch sử ở tab Tất cả giao dịch/)).not.toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "Đối soát" })).toBeInTheDocument();
  });

  it("points history-sync holders at the sync instead of an administrator", () => {
    const conflict = tx({ bankTransactionId: "FT-009", id: "c1000000-0000-4000-8000-000000000009", matchStatus: "identity_conflict" });
    renderScreen({ canSyncHistory: true, reviewCount: 1, suggestions: { data: [], ok: true }, total: 1, transactions: [conflict] });

    expect(within(queueItems()[0]).getByText("Giao dịch này trùng với một giao dịch khác nên chưa đối soát được ở đây. Đồng bộ lịch sử ở tab Tất cả giao dịch.")).toBeInTheDocument();
    expect(screen.queryByText(/Báo quản trị/)).not.toBeInTheDocument();
  });

  // Value: protects=phone users can see and confirm a card's suggestion (the detail pane is hidden below lg);
  // fails_when=the phone card has no suggestion line, the disclosure does not open the existing suggestion flow, or its confirm skips the injected action;
  // why_new=review round 1 mobile parity; seam=allocate injected; no_claim=layout at 375px (checked in /dev/sepay)
  it("lets phone cards open and confirm their suggestion", async () => {
    const allocate = vi.fn().mockResolvedValue({ data: null, ok: true });
    renderScreen({ actions: { allocate } });

    const card = queueItems()[0];
    const toggle = within(card).getByRole("button", { name: /Có gợi ý: Lý Nhật Quang · Tin cậy cao/ });
    expect(toggle.closest(".lg\\:hidden")).not.toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(queueItems()[1]).queryByRole("button", { name: /Có gợi ý/ })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    const cardSuggestion = within(card).getByRole("region", { name: "Gợi ý khớp" });
    fireEvent.click(within(cardSuggestion).getByRole("button", { name: "Xác nhận" }));
    expect(allocate).not.toHaveBeenCalled();
    fireEvent.click(within(cardSuggestion).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" }));
    expect(await within(cardSuggestion).findByRole("status")).toHaveTextContent("Đã phân bổ 2.400.000 ₫ cho Lý Nhật Quang.");
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it("does not offer card suggestions to viewers who cannot allocate", () => {
    renderScreen({ canAllocate: false, canReconcile: true });
    expect(screen.queryByRole("button", { name: /Có gợi ý/ })).not.toBeInTheDocument();
  });

  // Value: protects=the Phân bổ / Đối soát dialogs render once per workspace, outside the breakpoint-hidden card and detail containers, so crossing lg never hides an open money dialog or allows a second one;
  // fails_when=a trigger renders its own dialog inside an lg:hidden card or the hidden detail pane;
  // why_new=review round 1; seam=jsdom has no CSS, so containment stands in for visibility; no_claim=focus return after the trigger is hidden
  it("renders one shared dialog outside the breakpoint-hidden containers", () => {
    renderScreen();

    fireEvent.click(within(queueItems()[2]).getByRole("button", { name: "Đối soát" }));
    let dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(within(dialogs[0]).getByText("FT-003")).toBeInTheDocument();
    expect(dialogs[0].closest(".lg\\:hidden")).toBeNull();
    expect(dialogs[0].closest("li")).toBeNull();
    fireEvent.click(within(dialogs[0]).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(within(queueItems()[1]).getByRole("button", { name: "Phân bổ học phí" }));
    dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName("Phân bổ học phí thủ công");
    expect(dialogs[0].closest(".lg\\:hidden")).toBeNull();
    expect(detailPane().contains(dialogs[0])).toBe(false);
  });

  // Value: protects=an empty queue for one receiving account while others still wait reads neutral and links to the unfiltered queue, not the green "all matched" state;
  // fails_when=a purpose-filtered empty queue claims every transfer is matched while reviewCount > 0, or the link keeps the filter;
  // why_new=review round 1; seam=none; no_claim=reviewCount accuracy (loader)
  it("says only this receiving account is clear when other accounts still wait", () => {
    renderScreen({ accountPurposeFilter: "new_enrollment", reviewCount: 4, suggestions: { data: [], ok: true }, total: 0, transactions: [] });

    expect(screen.queryByText("Tất cả giao dịch đã khớp")).not.toBeInTheDocument();
    const empty = screen.getByRole("heading", { name: "Tài khoản nhận này không còn giao dịch cần xử lý" }).parentElement as HTMLElement;
    expect(empty.firstElementChild).toHaveClass("bg-action-primary-soft");
    expect(empty.firstElementChild).not.toHaveClass("bg-success-bg");
    expect(screen.getByRole("link", { name: "Xem hàng đợi của mọi tài khoản" })).toHaveAttribute("href", "/finance/sepay?queue=review");
  });
});

describe("SePay review adversarial fixes", () => {
  const nextSuggestion: AllocationSuggestion = {
    ...suggestion,
    amountVnd: 1_900_000,
    candidates: [{ ...suggestion.candidates[0], studentCode: "TTV-00117", studentId: "a1000000-0000-4000-8000-000000000117", studentName: "Bùi Quang Minh" }],
    transactionAt: queue[1].transactionAt,
    transactionId: queue[1].id,
    transferContent: queue[1].transferContent,
  };

  // Value: protects=a detail-pane suggestion never writes on one click: "Xác nhận" only opens a confirmation naming amount, student and sessions, "Ghi nhận cho …" writes, "Hủy" backs out;
  // fails_when=the first click calls the allocation action, the confirmation omits what will be written, or Hủy still writes;
  // why_new=adversarial review: one click bound money to a transfer; seam=allocate injected; no_claim=server-side checks in the allocation RPC
  it("requires the second confirmation step before allocating", async () => {
    const allocate = vi.fn().mockResolvedValue({ data: null, ok: true });
    renderScreen({ actions: { allocate } });
    const panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });

    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    expect(allocate).not.toHaveBeenCalled();
    expect(within(panel).getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    expect(within(panel).getByText(/Ghi nhận 2\.400\.000 ₫ cho Lý Nhật Quang \(TTV-00088\), cộng 12 buổi\./)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Hủy" }));
    expect(within(panel).queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();
    expect(allocate).not.toHaveBeenCalled();

    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" }));
    await within(panel).findByRole("status");
    expect(allocate).toHaveBeenCalledTimes(1);
    expect(allocate.mock.calls[0][0]).toMatchObject({ transactionId: queue[0].id });
  });

  // Value: protects=after a confirmed allocation the auto-selected next transfer cannot be allocated from the same spot: its confirm stays locked (with a reason) until the user presses "Xem giao dịch này";
  // fails_when=repeated clicks where "Xác nhận"/"Ghi nhận" were allocate the next transfer, or the gate never opens after acknowledging;
  // why_new=adversarial review (money bound to the wrong transaction); seam=allocate injected; refresh simulated by re-rendering; no_claim=router.refresh timing
  it("keeps the next transfer's confirm locked after auto-advance until the user looks at it", async () => {
    const allocate = vi.fn().mockResolvedValue({ data: null, ok: true });
    const { rerender } = renderScreen({ actions: { allocate }, suggestions: { data: [suggestion, nextSuggestion], ok: true } });
    let panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" }));
    await within(panel).findByRole("status");

    rerender(<SepayTransactionsScreen {...baseProps({ actions: { allocate }, reviewCount: 2, suggestions: { data: [nextSuggestion], ok: true }, total: 2, transactions: queue.slice(1) })} />);
    expect(within(detailPane()).getByText("FT-002")).toBeInTheDocument();
    panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    const sameSpot = within(panel).getByRole("button", { name: "Xác nhận" });
    expect(sameSpot).toBeDisabled();
    fireEvent.click(sameSpot);
    fireEvent.click(sameSpot);
    expect(within(panel).queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();
    expect(within(panel).getByText("Xác nhận đang khóa cho đến khi bạn bấm “Xem giao dịch này”.")).toBeInTheDocument();
    expect(within(detailPane()).queryByRole("button", { name: "Phân bổ học phí" })).not.toBeInTheDocument();
    expect(allocate).toHaveBeenCalledTimes(1);

    fireEvent.click(within(detailPane()).getByRole("button", { name: "Xem giao dịch này" }));
    panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    expect(within(panel).getByRole("button", { name: "Xác nhận" })).toBeEnabled();
    expect(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" })).toBeInTheDocument();
    expect(screen.queryByText(/đã rời hàng đợi/)).not.toBeInTheDocument();
  });

  // Value: protects=while a suggestion allocation is in flight the queue selection and status chips are held (with a written reason), so the pending row's result is never lost by switching transfers;
  // fails_when=another card can be selected or a chip changed mid-write, or the hold has no reason text;
  // why_new=adversarial review; seam=allocate injected as a deferred promise; no_claim=network timing
  it("holds the queue selection while a suggestion allocation is pending", async () => {
    let resolve: (value: { data: null; ok: true }) => void = () => {};
    const allocate = vi.fn(() => new Promise<{ data: null; ok: true }>((done) => { resolve = done; }));
    renderScreen({ actions: { allocate } });
    const panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" }));

    expect(await screen.findByText("Đang ghi nhận phân bổ; chờ xong rồi chọn giao dịch khác.")).toBeInTheDocument();
    const other = within(queueItems()[1]).getByRole("button", { name: /Xem giao dịch FT-002/ });
    expect(other).toBeDisabled();
    fireEvent.click(other);
    expect(within(detailPane()).getByText("FT-001")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Lọc theo trạng thái khớp" })).getByRole("button", { name: /^Sai số tiền\s*1$/ })).toBeDisabled();

    resolve({ data: null, ok: true });
    expect(await within(panel).findByRole("status")).toHaveTextContent("Đã phân bổ 2.400.000 ₫ cho Lý Nhật Quang.");
    expect(within(queueItems()[1]).getByRole("button", { name: /Xem giao dịch FT-002/ })).toBeEnabled();
  });

  // Value: protects=closing a money dialog whose transfer has left the queue never moves focus onto the next transfer's trigger (the detail pane is keyed by transaction id);
  // fails_when=the detail pane is reused across transfers so the dialog returns focus to a trigger now bound to the next transfer;
  // why_new=adversarial review; seam=jsdom focus; no_claim=screen-reader announcement order
  it("does not return dialog focus to the next transfer's controls", () => {
    const { rerender } = renderScreen();
    fireEvent.click(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" }));
    expect(screen.getByRole("dialog", { name: "Phân bổ học phí thủ công" })).toBeInTheDocument();

    rerender(<SepayTransactionsScreen {...baseProps({ reviewCount: 2, total: 2, transactions: queue.slice(1) })} />);
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Đóng" }).at(-1) as HTMLElement);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(detailPane().contains(document.activeElement)).toBe(false);
    expect(queueItems().some((item) => item.contains(document.activeElement))).toBe(false);
  });

  // Value: protects=a failed review count is unknown, not zero: no "0" badge on Cần xử lý and a purpose-filtered empty queue stays neutral;
  // fails_when=the screen shows 0 or treats the unknown count as "nothing waiting" (green state) on a filtered queue;
  // why_new=adversarial review; seam=reviewCount null passed as the loader returns it; no_claim=the count query
  it("treats an unknown review count as unknown", () => {
    renderScreen({ accountPurposeFilter: "renewal", reviewCount: null, suggestions: { data: [], ok: true }, total: 0, transactions: [] });

    const reviewTab = screen.getByRole("tab", { name: /Cần xử lý/ });
    expect(reviewTab).toHaveTextContent(/^Cần xử lý$/);
    expect(screen.queryByText("Tất cả giao dịch đã khớp")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tài khoản nhận này không còn giao dịch cần xử lý" })).toBeInTheDocument();
    expect(screen.getByText(/Chưa đếm được hàng đợi của các tài khoản nhận khác/)).toBeInTheDocument();
  });
});

describe("SePay review: shown transfer changes without a user action", () => {
  const twoCandidates: AllocationSuggestion = {
    ...suggestion,
    candidateCount: 2,
    candidates: [
      suggestion.candidates[0],
      { ...suggestion.candidates[0], candidateRank: 2, confidence: "medium", studentCode: "TTV-00241", studentId: "a1000000-0000-4000-8000-000000000241", studentName: "Lý Gia Hân" },
    ],
  };
  const secondSuggestion: AllocationSuggestion = {
    ...suggestion,
    amountVnd: 1_900_000,
    candidates: [{ ...suggestion.candidates[0], studentCode: "TTV-00117", studentId: "a1000000-0000-4000-8000-000000000117", studentName: "Bùi Quang Minh" }],
    transactionAt: queue[1].transactionAt,
    transactionId: queue[1].id,
  };

  function expectLockedDetail(id: string) {
    const detail = detailPane();
    expect(within(detail).getByText(id)).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Xem giao dịch này" })).toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Phân bổ học phí" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
  }

  // Value: protects=a refresh that puts a newer transfer on top (no tx in the URL) never swaps the detail pane's write controls onto it silently: the pane locks until "Xem giao dịch này", with the neutral wording;
  // fails_when=the pane shows the new row with live Phân bổ/Đối soát/suggestion confirm, or uses the "đã rời hàng đợi" wording for a row that did not leave;
  // why_new=focused review of the adversarial fixes; seam=refresh simulated by re-rendering; allocate injected; no_claim=router.refresh timing
  it("locks the pane when a newer transfer becomes row 0 after a refresh", () => {
    const allocate = vi.fn().mockResolvedValue({ data: null, ok: true });
    const newer = tx({ bankTransactionId: "FT-NEW", id: "c1000000-0000-4000-8000-0000000000aa", transactionAt: "2026-10-12T05:00:00Z", transferContent: "MOI CHUYEN" });
    const newerSuggestion: AllocationSuggestion = { ...suggestion, transactionId: newer.id };
    const { rerender } = renderScreen({ actions: { allocate } });
    expect(within(detailPane()).getByText("FT-001")).toBeInTheDocument();

    rerender(<SepayTransactionsScreen {...baseProps({ actions: { allocate }, reviewCount: 4, suggestions: { data: [newerSuggestion], ok: true }, total: 4, transactions: [newer, ...queue] })} />);

    expectLockedDetail("FT-NEW");
    expect(screen.getByText("Giao dịch đang xem đã thay đổi sau khi tải lại; bấm “Xem giao dịch này” để tiếp tục.")).toBeInTheDocument();
    expect(screen.queryByText(/đã rời hàng đợi/)).not.toBeInTheDocument();
    const confirm = within(within(detailPane()).getByRole("region", { name: "Gợi ý khớp" })).getByRole("button", { name: "Xác nhận" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(screen.queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();
    expect(allocate).not.toHaveBeenCalled();

    fireEvent.click(within(detailPane()).getByRole("button", { name: "Xem giao dịch này" }));
    expect(within(detailPane()).getByRole("button", { name: "Phân bổ học phí" })).toBeInTheDocument();
    expect(screen.queryByText(/đã thay đổi sau khi tải lại/)).not.toBeInTheDocument();
  });

  // Value: protects=under an active status chip, a shown row that moves to another status (still on the page) locks the pane on the next row instead of silently switching;
  // fails_when=the pane swaps to the next filtered row with live controls, or claims the row left the queue;
  // why_new=focused review of the adversarial fixes; seam=refresh simulated by re-rendering; no_claim=which statuses the RPCs can move a row to
  it("locks the pane when the shown row moves out of the active status chip", () => {
    const second = tx({ bankTransactionId: "FT-004", id: "c1000000-0000-4000-8000-000000000004", transferContent: "CK THU HAI" });
    const rows = [queue[0], second, queue[1]];
    nav.search = "queue=review&status=unmatched";
    const { rerender } = renderScreen({ reviewCount: 3, total: 3, transactions: rows });
    expect(within(detailPane()).getByText("FT-001")).toBeInTheDocument();

    const moved = { ...queue[0], matchStatus: "amount_mismatch" as const };
    rerender(<SepayTransactionsScreen {...baseProps({ reviewCount: 3, total: 3, transactions: [moved, second, queue[1]] })} />);

    expectLockedDetail("FT-004");
    expect(screen.getByText(/đã thay đổi sau khi tải lại/)).toBeInTheDocument();
    expect(screen.queryByText(/đã rời hàng đợi/)).not.toBeInTheDocument();
  });

  // Value: protects=the detail pane is keyed by transaction: switching transfers by hand gives fresh suggestion state, so an open "Ghi nhận cho …" confirmation never survives a switch and back;
  // fails_when=the pane (and its suggestion rows) is reused across transfers, carrying the confirmation over;
  // why_new=focused review: the key had no test; seam=none; no_claim=focus handling
  it("remounts the detail pane on a user-chosen switch", () => {
    renderScreen({ suggestions: { data: [suggestion, secondSuggestion], ok: true } });
    let panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    expect(within(panel).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" })).toBeInTheDocument();

    fireEvent.click(within(queueItems()[1]).getByRole("button", { name: /Xem giao dịch FT-002/ }));
    panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    expect(within(panel).queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Xác nhận" })).toBeEnabled();

    fireEvent.click(within(queueItems()[0]).getByRole("button", { name: /Xem giao dịch FT-001/ }));
    panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });
    expect(within(panel).queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Xác nhận" })).toBeEnabled();
  });

  // Value: protects=editing the student or the sessions after opening "Ghi nhận cho …" closes the confirmation, so it never writes values the user did not see;
  // fails_when=the confirmation stays open (with stale student/sessions text) after an edit;
  // why_new=focused review; seam=none; no_claim=server-side validation of sessions
  it("closes the confirmation when the student or sessions change", () => {
    const allocate = vi.fn();
    renderScreen({ actions: { allocate }, suggestions: { data: [twoCandidates], ok: true } });
    const panel = within(detailPane()).getByRole("region", { name: "Gợi ý khớp" });

    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    expect(within(panel).getByRole("button", { name: "Ghi nhận cho Lý Nhật Quang" })).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Số buổi cộng"), { target: { value: "8" } });
    expect(within(panel).queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Xác nhận" }));
    expect(within(panel).getByText(/cộng 8 buổi/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByRole("combobox", { name: "Chọn học sinh" }), { target: { value: "a1000000-0000-4000-8000-000000000241" } });
    expect(within(panel).queryByRole("button", { name: /Ghi nhận cho/ })).not.toBeInTheDocument();
    expect(allocate).not.toHaveBeenCalled();
  });
});

describe("SePay all-transactions tab", () => {
  it("keeps the existing history, suggestions and sync panel and states the receiving accounts and latest transfer", () => {
    renderScreen({
      queueFilter: "",
      receivingAccounts: [{ accountNumber: "0399886886", bankCode: "MB", purpose: "renewal" }],
      syncPanel: <section aria-label="Đồng bộ lịch sử SePay (mẫu)" />,
    });

    expect(screen.getByRole("tab", { name: "Tất cả giao dịch" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("table", { name: "Danh sách giao dịch SePay mới nhất" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận 1 dòng tin cậy cao" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Đồng bộ lịch sử SePay (mẫu)" })).toBeInTheDocument();
    expect(screen.getByText("TK nhận Tái phí MB 0399886886 · Giao dịch mới nhất 08:14 12/10/2026")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lịch sử đã khớp" })).not.toBeInTheDocument();
  });

  it("falls back to the plain description when nothing about the account is known", () => {
    renderScreen({ page: 2, queueFilter: "" });
    expect(screen.getByText("Lịch sử giao dịch ngân hàng được SePay ghi nhận.")).toBeInTheDocument();
  });
});
