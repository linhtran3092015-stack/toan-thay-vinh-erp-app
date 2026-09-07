import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { previewSepayHistorySyncAction, syncSepayHistoryAction } from "@/features/finance/sepay-history-sync-actions";

const mocks = vi.hoisted(() => ({ permissions: vi.fn(), server: vi.fn(), service: vi.fn(), fetchPage: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: mocks.permissions }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseServiceRoleClient: mocks.service }));
vi.mock("@/features/finance/sepay-api-v2", () => ({ fetchSepayApiV2TransactionsPage: mocks.fetchPage, toSepayApiV2BatchTransaction: vi.fn() }));

const account = { id: "91000000-0000-4000-8000-000000000001", purpose: "renewal", bank_code: "VCB", account_number: "1001", account_display_name: "Renewal", effective_from: "2026-01-01", effective_to: null, sepay_bank_account_id: "92000000-0000-4000-8000-000000000001", status: "active" };
const input = { accountVersionIds: [account.id], dateFrom: "2026-08-01", dateTo: "2026-08-31" };

function serverWith(rows: unknown[], user: object | null = { id: "owner" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: rows, error: null }) }) }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T00:00:00Z"));
  mocks.permissions.mockResolvedValue({ ok: true, permissions: ["sepay.sync_history.manage"] });
  mocks.server.mockResolvedValue(serverWith([account]));
  mocks.fetchPage.mockResolvedValue({ ok: true, data: [], total: 3, page: 1, hasMore: false });
});
afterEach(() => vi.useRealTimers());

describe("SePay sync server authorization and preview", () => {
  it("denies non-owner permissions before opening clients or SePay", async () => {
    mocks.permissions.mockResolvedValue({ ok: true, permissions: ["sepay.allocate"] });
    expect(await previewSepayHistorySyncAction(input)).toEqual(expect.objectContaining({ ok: false }));
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.service).not.toHaveBeenCalled();
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it.each([{ ...input, dateTo: "2026-09-07" }, { ...input, dateTo: "2026-09-01" }, { ...input, accountVersionIds: [] }])("rejects unsafe input before authorization %#", async (invalid) => {
    expect(await previewSepayHistorySyncAction(invalid)).toEqual(expect.objectContaining({ ok: false }));
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it("rejects expired authentication before fetching history", async () => {
    mocks.server.mockResolvedValue(serverWith([account], null));
    expect(await previewSepayHistorySyncAction(input)).toEqual(expect.objectContaining({ ok: false }));
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it.each([{ ...account, sepay_bank_account_id: null }, { ...account, status: "retired" }, { ...account, effective_from: "2026-08-15" }])("rejects unavailable account configuration %#", async (row) => {
    mocks.server.mockResolvedValue(serverWith([row]));
    expect(await previewSepayHistorySyncAction(input)).toEqual(expect.objectContaining({ ok: false }));
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
  it("previews bounded history without creating a service client", async () => {
    expect(await previewSepayHistorySyncAction(input)).toEqual(expect.objectContaining({ ok: true, accounts: [{ accountVersionId: account.id, label: "Tái phí · VCB · 1001", totalAvailable: 3 }] }));
    expect(mocks.fetchPage).toHaveBeenCalledWith({ bankAccountId: account.sepay_bank_account_id, dateFrom: "2026-08-01 00:00:00", dateTo: "2026-08-31 23:59:59", page: 1, perPage: 100 });
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("rejects a preview over the transaction cap", async () => {
    mocks.fetchPage.mockResolvedValue({ ok: true, data: [], total: 1001, page: 1, hasMore: true });
    expect(await previewSepayHistorySyncAction(input)).toEqual(expect.objectContaining({ ok: false, message: expect.stringContaining("1.000") }));
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("surfaces upstream rejection without creating a sync run", async () => {
    mocks.fetchPage.mockResolvedValue({ ok: false, error: "unauthorized" });
    expect(await previewSepayHistorySyncAction(input)).toEqual(expect.objectContaining({ ok: false, message: expect.stringContaining("API token") }));
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("requires a session UUID before obtaining service privileges", async () => {
    expect(await syncSepayHistoryAction(input)).toEqual(expect.objectContaining({ ok: false }));
    expect(mocks.service).not.toHaveBeenCalled();
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });
});
