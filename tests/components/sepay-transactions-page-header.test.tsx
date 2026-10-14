// Value: protects=the /finance/sepay header names only the receiving account in force today for each purpose (from the existing sync-permission account read), skips expired and future versions, and stays silent for viewers without that read; the route also surfaces a failed suggestions read to allocators;
// fails_when=the page shows every active version (expired or not yet effective), picks the wrong row per purpose, runs the account read for viewers without sepay.sync_history.manage, or swallows suggestions {ok:false};
// why_new=coverage audit: the header context was only tested with props passed by hand; the route's date filter and permission gate were untested;
// seam=Supabase server client mocked as a chainable thenable over fixed rows; Date faked to 2026-10-14 (Asia/Ho_Chi_Minh); loaders mocked; no_claim=the SQL filter on status=active and RLS on sepay_receiving_account_versions
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SepayTransactionsPage from "@/app/(app)/finance/sepay/page";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

const data = vi.hoisted(() => ({
  getSepayReconciliationCandidatesResult: vi.fn(),
  getSepayTransactionsResult: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));
const suggestionsData = vi.hoisted(() => ({ getSepayAllocationSuggestionsResult: vi.fn() }));
const supabase = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn(), from: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => null }));
vi.mock("@/features/finance/data", () => data);
vi.mock("@/lib/permissions/database-permissions", () => permissions);
vi.mock("@/features/finance/allocation-suggestions-data", () => suggestionsData);
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: supabase.createSupabaseServerClient }));

/** Chainable query builder resolving to fixed rows, whatever filters are applied. */
function query(result: { data: unknown[]; error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

// Ordered like the page's query: purpose, then effective_from newest first.
const accountRows = [
  { account_number: "5555", bank_code: "MB", effective_from: "2026-11-01", effective_to: null, id: "v-new-future", purpose: "new_enrollment", sepay_bank_account_id: "1" },
  { account_number: "0399886887", bank_code: "MB", effective_from: "2026-07-01", effective_to: null, id: "v-new-current", purpose: "new_enrollment", sepay_bank_account_id: "2" },
  { account_number: "2222", bank_code: "VCB", effective_from: "2025-01-01", effective_to: "2026-06-30", id: "v-new-expired", purpose: "new_enrollment", sepay_bank_account_id: "3" },
  { account_number: "0399886886", bank_code: "MB", effective_from: "2026-01-01", effective_to: "2026-10-14", id: "v-renew-last-day", purpose: "renewal", sepay_bank_account_id: "4" },
  { account_number: "3333", bank_code: "ACB", effective_from: "2025-01-01", effective_to: "2025-12-31", id: "v-renew-expired", purpose: "renewal", sepay_bank_account_id: "5" },
];

const transaction: SepayTransactionReadModel = {
  accountNumber: "0399886886",
  accountPurpose: "renewal",
  amountVnd: 2_400_000,
  bankBrand: "MB Bank",
  bankTransactionId: "FT-101",
  createdAt: "2026-10-12T01:14:40Z",
  id: "c1000000-0000-4000-8000-000000000101",
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
};

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-14T05:00:00Z"), toFake: ["Date"] });
  supabase.from.mockImplementation((table: string) => query({
    data: table === "sepay_receiving_account_versions" ? accountRows : [],
    error: null,
  }));
  supabase.createSupabaseServerClient.mockResolvedValue({ from: supabase.from });
  data.getSepayTransactionsResult.mockResolvedValue({
    data: { page: 1, pageSize: 50, reviewCount: 1, total: 1, transactions: [transaction] },
    ok: true,
  });
  data.getSepayReconciliationCandidatesResult.mockResolvedValue({ data: [], ok: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function headerLine(container: HTMLElement): string {
  return container.querySelector("header p")?.textContent ?? "";
}

describe("SePay page header context", () => {
  it("names the receiving account in force today for each purpose", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sepay.view", "sepay.sync_history.manage"] });

    const { container } = render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(supabase.from).toHaveBeenCalledWith("sepay_receiving_account_versions");
    expect(headerLine(container)).toBe("TK nhận Tuyển mới MB 0399886887 · TK nhận Tái phí MB 0399886886 · Giao dịch mới nhất 08:14 12/10/2026");
    for (const hidden of ["5555", "2222", "3333"]) expect(headerLine(container)).not.toContain(hidden);
  });

  // Value: protects=the review tab skips the sync-runs read and the history sync panel but keeps the receiving accounts for its header;
  // fails_when=queue=review still queries sepay_sync_runs or renders the sync panel, or loses the header account;
  // why_new=review round 1 (item 10); seam=mocked client records table names; no_claim=query cost
  it("reads only the receiving accounts on the review tab", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sepay.view", "sepay.sync_history.manage"] });

    const review = render(await SepayTransactionsPage({ searchParams: Promise.resolve({ queue: "review" }) }));
    expect(supabase.from.mock.calls.map(([table]) => table)).toEqual(["sepay_receiving_account_versions"]);
    expect(headerLine(review.container)).toBe("TK nhận Tuyển mới MB 0399886887 · TK nhận Tái phí MB 0399886886");
    expect(screen.queryByRole("heading", { name: "Đồng bộ lịch sử SePay" })).not.toBeInTheDocument();
    review.unmount();
    supabase.from.mockClear();

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));
    expect(supabase.from.mock.calls.map(([table]) => table)).toEqual(["sepay_receiving_account_versions", "sepay_sync_runs"]);
    expect(screen.getByRole("heading", { name: "Đồng bộ lịch sử SePay" })).toBeInTheDocument();
  });

  it("skips the account read and names no account without history-sync permission", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sepay.view"] });

    const { container } = render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(supabase.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(headerLine(container)).toBe("Giao dịch mới nhất 08:14 12/10/2026");
  });

  it("surfaces a failed suggestions read to allocators on both tabs", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sepay.view", "sepay.allocate"] });
    suggestionsData.getSepayAllocationSuggestionsResult.mockResolvedValue({ error: "Không tải được gợi ý khớp giao dịch.", ok: false });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Không tải được gợi ý khớp giao dịch" })).toBeInTheDocument();
    cleanup();

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({ queue: "review" }) }));
    // Review round 2: the review-tab error sits above the queue (all breakpoints), not in the lg-only detail pane.
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được gợi ý khớp giao dịch.");
    expect(screen.getByRole("region", { name: /Giao dịch đang chọn/ }).querySelector('[role="alert"]')).toBeNull();
  });
});
