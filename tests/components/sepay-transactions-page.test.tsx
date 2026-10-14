import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SepayTransactionsPage from "@/app/(app)/finance/sepay/page";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

const data = vi.hoisted(() => ({
  getSepayReconciliationCandidatesResult: vi.fn(),
  getSepayTransactionsResult: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));
const suggestionsData = vi.hoisted(() => ({ getSepayAllocationSuggestionsResult: vi.fn() }));

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  // The browser's query string; the review workspace reads status/tx from it.
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/features/finance/data", () => data);
vi.mock("@/lib/permissions/database-permissions", () => permissions);
vi.mock("@/features/finance/allocation-suggestions-data", () => suggestionsData);

afterEach(() => {
  cleanup();
  nav.search = "";
  vi.clearAllMocks();
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
    transferContent: "CK HOC PHI",
    transferType: "in",
    ...overrides,
  };
}

const unmatched = tx({ bankTransactionId: "FT-101", id: "c1000000-0000-4000-8000-000000000101" });
const mismatch = tx({ amountVnd: 1_900_000, bankTransactionId: "FT-102", id: "c1000000-0000-4000-8000-000000000102", matchStatus: "amount_mismatch" });
const matched = tx({
  bankTransactionId: "FT-201",
  id: "c1000000-0000-4000-8000-000000000201",
  matchStatus: "auto_matched",
  matchedPaymentRequestCode: "YC-001",
});

function grant(codes: string[]) {
  permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sepay.view", ...codes] });
}

function loadPage(transactions: SepayTransactionReadModel[], overrides: { page?: number; reviewCount?: number; total?: number } = {}) {
  data.getSepayTransactionsResult.mockResolvedValue({
    data: {
      page: overrides.page ?? 1,
      pageSize: 50,
      reviewCount: overrides.reviewCount ?? transactions.length,
      total: overrides.total ?? transactions.length,
      transactions,
    },
    ok: true,
  });
}

describe("SePay transaction history route states", () => {
  it("preserves the existing sepay.view permission-denied state", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: [],
    });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Không có quyền xem Giao dịch SePay")).toBeInTheDocument();
    expect(data.getSepayTransactionsResult).not.toHaveBeenCalled();
  });

  it("preserves the existing read failure state after sepay.view passes", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: ["sepay.view"],
    });
    data.getSepayTransactionsResult.mockResolvedValue({ ok: false });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Không tải được giao dịch SePay")).toBeInTheDocument();
  });

  // Value: protects=/finance/sepay with no params still opens the full transaction list (not the review queue) and keeps a ?queue=review link;
  // fails_when=the default tab flips to Cần xử lý, the page stops passing queue "" to the loader, or the review queue link loses its URL;
  // why_new=workspace tests render the screen with queueFilter set by hand; nothing drove the route's default params; seam=none;
  // no_claim=loader SQL and real permissions (data and permission modules mocked)
  it("keeps the full list as the default tab with read-only controls for sepay.view alone", async () => {
    grant([]);
    loadPage([matched, unmatched], { reviewCount: 7 });

    const { container } = render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(data.getSepayTransactionsResult).toHaveBeenCalledWith("", 1, "");
    expect(screen.getByRole("table", { name: "Danh sách giao dịch SePay mới nhất" })).toBeInTheDocument();
    expect(screen.getAllByText("FT-201").length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/finance/sepay?queue=review"]')).not.toBeNull();
    expect(screen.queryByRole("list", { name: "Hàng đợi giao dịch cần xử lý" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phân bổ học phí" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đảo phân bổ/ })).not.toBeInTheDocument();
    expect(data.getSepayReconciliationCandidatesResult).not.toHaveBeenCalled();
    expect(suggestionsData.getSepayAllocationSuggestionsResult).not.toHaveBeenCalled();
  });

  // Value: protects=?queue=review&status=&tx= from the address bar reach the review workspace; invalid status/tx fall back to all rows and the first row;
  // fails_when=the workspace stops reading status/tx from the address bar, uses them without parsing, or ?queue=review stops opening the queue;
  // why_new=workspace tests pass parsed props directly; the route's parse-and-thread step had no test; seam=useSearchParams mocked with the same query string the route receives (review round 2: the URL is the single source for status/tx);
  // no_claim=replaceState after hydration (covered in sepay-review-workspace.test.tsx); loader mocked
  it("opens the review queue from ?queue=review with the status chip and selection from the URL", async () => {
    grant([]);
    loadPage([unmatched, mismatch]);

    nav.search = `queue=review&status=amount_mismatch&tx=${mismatch.id}`;
    render(await SepayTransactionsPage({ searchParams: Promise.resolve({ queue: "review", status: "amount_mismatch", tx: mismatch.id }) }));

    expect(data.getSepayTransactionsResult).toHaveBeenCalledWith("", 1, "review");
    const chips = screen.getByRole("group", { name: "Lọc theo trạng thái khớp" });
    expect(within(chips).getByRole("button", { name: /^Sai số tiền\s*1$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("list", { name: "Hàng đợi giao dịch cần xử lý" })).getAllByRole("listitem")).toHaveLength(1);
    expect(within(screen.getByRole("region", { name: /Giao dịch đang chọn/ })).getByText("FT-102")).toBeInTheDocument();
    cleanup();

    nav.search = "queue=review&status=auto_matched&tx=%3Cscript%3E";
    render(await SepayTransactionsPage({ searchParams: Promise.resolve({ queue: "review", status: "auto_matched", tx: "<script>" }) }));

    expect(within(screen.getByRole("group", { name: "Lọc theo trạng thái khớp" })).getByRole("button", { name: /^Tất cả\s*2$/ }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("region", { name: /Giao dịch đang chọn/ })).getByText("FT-101")).toBeInTheDocument();
  });

  // Value: protects=permission codes decide which loaders run and which write controls render (sepay.allocate: allocate+reconcile; payments.manage: reversal);
  // fails_when=the page stops feeding getSepayScreenAccess flags into loaders/screen, e.g. sepay.allocate loses Phân bổ or gains Đảo phân bổ;
  // why_new=sepay-review-url-state.test.ts proves the helper only, not the page wiring; seam=none; no_claim=server-side re-checks in the actions (mocked loaders)
  it("maps allocation and payment permissions to loaders and controls", async () => {
    grant(["sepay.allocate"]);
    loadPage([unmatched, mismatch]);
    data.getSepayReconciliationCandidatesResult.mockResolvedValue({ data: [], ok: true });
    suggestionsData.getSepayAllocationSuggestionsResult.mockResolvedValue({ data: [], ok: true });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({ queue: "review" }) }));

    expect(suggestionsData.getSepayAllocationSuggestionsResult).toHaveBeenCalledTimes(1);
    expect(data.getSepayReconciliationCandidatesResult).toHaveBeenCalledWith([unmatched, mismatch]);
    const detail = screen.getByRole("region", { name: /Giao dịch đang chọn/ });
    expect(within(detail).getByRole("button", { name: "Phân bổ học phí" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Đối soát" })).toBeInTheDocument();
    cleanup();

    loadPage([matched], { reviewCount: 0 });
    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryAllByRole("button", { name: /Đảo phân bổ/ })).toHaveLength(0);
    cleanup();

    grant(["payments.manage"]);
    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole("button", { name: "Đảo phân bổ giao dịch FT-201" }).length).toBeGreaterThan(0);
  });
});

describe("SePay review queue regressions", () => {
  // Value: protects=an empty page of a non-empty review queue never claims every transfer is matched;
  // fails_when=the workspace treats an empty page (stale ?page= after the queue shrank, offset == total) as an empty queue;
  // why_new=workspace empty-state test only covers total 0; seam=none; no_claim=PostgREST returning [] at offset == total (loader mocked)
  it("does not say all transfers are matched when only this page is empty", async () => {
    grant([]);
    loadPage([], { page: 2, reviewCount: 50, total: 50 });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({ page: "2", queue: "review" }) }));

    expect(data.getSepayTransactionsResult).toHaveBeenCalledWith("", 2, "review");
    expect(screen.queryByText("Tất cả giao dịch đã khớp")).not.toBeInTheDocument();
  });
});
