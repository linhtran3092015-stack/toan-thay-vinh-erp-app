// Value: protects=the /finance/tuition-periods/templates route (design 15b, D11): the settings.receipts.manage gate with its copy and no read before it, versions read newest first by published_at (the lock's order) with the publisher embedded through tuition_receipt_template_versions_published_by_fkey, the publisher fallbacks ("Hệ thống" when published_by is null, "người khác (không xem được tên)" when RLS hides the profile), the usage line built from periods (locked on the current version by name, max 3 + "và n kỳ khác", drafts without a version) and read only with tuition_periods.view, a failed period read hiding just that line, and a failed version read showing an error state instead of an empty editor;
// fails_when=the gate or its copy changes, the embed or ordering changes, a hidden publisher reads as the system, periods are read (or claimed empty) for a user who cannot read them, a period failure breaks the page, or a version failure offers to publish v1 over existing versions;
// why_new=step 13 rewrote the templates route (minified one-liner, untested) and added receipt-template-data.ts;
// seam=permissions and the Supabase server client mocked at their module boundaries (a table-backed PostgREST stand-in), the real loader, helpers and editor; the actions module mocked; no_claim=does not prove PostgREST accepts the embed hint or what RLS returns in production
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TuitionTemplatesPage from "@/app/(app)/finance/tuition-periods/templates/page";

const db = vi.hoisted(() => {
  const state = {
    calls: [] as Array<{ orders: unknown[][]; select: string | null; table: string }>,
    failTables: new Set<string>(),
    tables: {} as Record<string, unknown[]>,
  };
  /** Chainable PostgREST stand-in: records the select and orders, returns the table's rows as given. */
  const from = (table: string) => {
    const call = { orders: [] as unknown[][], select: null as string | null, table };
    state.calls.push(call);
    const builder: Record<string, unknown> = {
      order: (column: string, options: unknown) => (call.orders.push([column, options]), builder),
      select: (columns: string) => ((call.select = columns), builder),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(
          state.failTables.has(table) ? { data: null, error: { code: "42501", message: "permission denied" } } : { data: state.tables[table] ?? [], error: null },
        ).then(resolve, reject),
    };
    return builder;
  };
  return { from, state };
});
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ from: db.from })) }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: permissions.getCachedDatabasePermissions }));
vi.mock("@/features/tuition/actions", () => ({ publishTuitionTemplateAction: vi.fn() }));

const VERSIONS = "tuition_receipt_template_versions";
const PERIODS = "tuition_collection_periods";

const content = {
  announcement: "Kính gửi quý phụ huynh.",
  center_display_name: "Trung tâm Toán Thầy Vinh",
  footer: "Thắc mắc liên hệ 0988 123 456 (cô Hằng)",
  show_qr: true,
  title: "PHIẾU HỌC PHÍ",
};
const versionRows = [
  { content, id: "v3", published_at: "2026-09-25T03:12:00Z", published_by: "u-hang", publisher: { display_name: "Nguyễn Thu Hằng" }, reason: "Đổi chân trang sang số cô Hằng", version_number: 3 },
  { content, id: "v2", published_at: "2026-08-28T02:05:00Z", published_by: "u-other", publisher: null, reason: "Thêm đoạn thông báo", version_number: 2 },
  {
    content: { center_display_name: "Trung tâm Toán Thầy Vinh", footer: "Phụ huynh vui lòng kiểm tra thông tin học phí trước khi thanh toán.", show_qr: true, title: "HỌC PHÍ {PERIOD_NAME}" },
    id: "v1",
    published_at: "2026-07-30T01:00:00Z",
    published_by: null,
    publisher: null,
    reason: "Default Wave A template",
    version_number: 1,
  },
];
const periodRows = [
  { id: "p-11", name: "Học phí tháng 11/2026", receipt_template_version_id: null, status: "draft" },
  { id: "p-10", name: "Học phí tháng 10/2026", receipt_template_version_id: "v3", status: "locked" },
  { id: "p-09", name: "Học phí tháng 09/2026", receipt_template_version_id: "v3", status: "locked" },
  { id: "p-08", name: "Học phí tháng 08/2026", receipt_template_version_id: "v3", status: "locked" },
  { id: "p-07", name: "Học phí tháng 07/2026", receipt_template_version_id: "v3", status: "locked" },
  { id: "p-06", name: "Học phí tháng 06/2026", receipt_template_version_id: "v2", status: "locked" },
];

function grant(...codes: string[]) {
  permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: codes });
}

async function route() {
  return render(await TuitionTemplatesPage());
}

function primaries(container: HTMLElement) {
  return container.querySelectorAll('a[class~="bg-action-primary"], button[class~="bg-action-primary"]');
}

beforeEach(() => {
  db.state.calls.length = 0;
  db.state.failTables.clear();
  db.state.tables = { [PERIODS]: periodRows, [VERSIONS]: versionRows };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("/finance/tuition-periods/templates", () => {
  it.each([
    ["without settings.receipts.manage", { ok: true, permissions: ["tuition_periods.view"] }],
    ["when permissions cannot be read", { ok: false }],
  ])("refuses %s before reading anything", async (_label, result) => {
    permissions.getCachedDatabasePermissions.mockResolvedValue(result);
    await route();

    expect(screen.getByRole("heading", { level: 1, name: "Không có quyền quản lý mẫu" })).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu quyền settings.receipts.manage.")).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(db.state.calls).toEqual([]);
  });

  it("reads versions newest first with the publisher embed and periods for the usage line", async () => {
    grant("settings.receipts.manage", "tuition_periods.view");
    const { container } = await route();

    const versions = db.state.calls.find((call) => call.table === VERSIONS);
    expect(versions?.select).toBe(
      "id, version_number, content, published_at, published_by, reason, publisher:profiles!tuition_receipt_template_versions_published_by_fkey(display_name)",
    );
    expect(versions?.orders).toEqual([
      ["published_at", { ascending: false }],
      ["version_number", { ascending: false }],
    ]);
    expect(db.state.calls.find((call) => call.table === PERIODS)?.select).toBe("id, name, status, receipt_template_version_id");

    expect(screen.getByRole("heading", { level: 1, name: "Mẫu Phiếu học phí" })).toBeInTheDocument();
    expect(screen.getByText("v3 đang dùng")).toBeInTheDocument();
    expect(screen.getByText("TUITION_NOTICE_DEFAULT · xuất bản 25/09/2026 10:12 bởi Nguyễn Thu Hằng")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kỳ đã khóa dùng v3: Học phí tháng 10/2026, Học phí tháng 09/2026, Học phí tháng 08/2026 và 1 kỳ khác · 1 kỳ nháp sẽ dùng phiên bản mới nhất khi khóa",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/KT-\d/)).not.toBeInTheDocument();

    const rows = within(screen.getByRole("region", { name: "Lịch sử phiên bản" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "v3Đổi chân trang sang số cô HằngĐang dùng25/09/2026 · Nguyễn Thu Hằng",
      "v2Thêm đoạn thông báo28/08/2026 · người khác (không xem được tên)",
      "v1Default Wave A template30/07/2026 · Hệ thống",
    ]);

    expect(screen.getByLabelText("Tiêu đề phiếu")).toHaveValue("PHIẾU HỌC PHÍ");
    expect(primaries(container)).toHaveLength(1);
    expect(primaries(container)[0]).toBe(screen.getByRole("button", { name: "Xuất bản phiên bản v4" }));
  });

  it("does not read periods, nor claim none use the version, without tuition_periods.view", async () => {
    grant("settings.receipts.manage");
    await route();

    expect(db.state.calls.map((call) => call.table)).toEqual([VERSIONS]);
    expect(screen.getByText("v3 đang dùng")).toBeInTheDocument();
    expect(screen.queryByText(/Kỳ đã khóa dùng|kỳ nháp|Chưa có kỳ thu nào/)).not.toBeInTheDocument();
  });

  it("hides only the usage line when the period read fails, logging the code and message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.state.failTables.add(PERIODS);
    grant("settings.receipts.manage", "tuition_periods.view");
    await route();

    expect(screen.getByText("v3 đang dùng")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Nội dung mẫu Phiếu học phí" })).toBeInTheDocument();
    expect(screen.queryByText(/Kỳ đã khóa dùng|kỳ nháp|Chưa có kỳ thu nào/)).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith("TUITION_TEMPLATE_READ_FAILED", "periods", "42501", "permission denied");
  });

  it("shows an error state, not an empty editor, when the versions cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.state.failTables.add(VERSIONS);
    grant("settings.receipts.manage", "tuition_periods.view");
    const { container } = await route();

    expect(screen.getByRole("heading", { level: 1, name: "Mẫu Phiếu học phí" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được mẫu Phiếu học phí");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xuất bản phiên bản/ })).not.toBeInTheDocument();
    expect(primaries(container)).toHaveLength(0);
  });

  it("offers the first version when none is published", async () => {
    db.state.tables[VERSIONS] = [];
    grant("settings.receipts.manage", "tuition_periods.view");
    await route();

    expect(screen.getByText("Chưa có phiên bản")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất bản phiên bản v1" })).toBeDisabled();
    expect(screen.queryByText(/kỳ nháp sẽ dùng/)).not.toBeInTheDocument();
  });
});
