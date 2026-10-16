// Value: protects=the single Phiếu học phí page (design 15b): the tuition_periods.view gate, a screen-only staff header (back link, "Phiếu học phí · name", edition badge in words, secondary "In phiếu" that waits for the QR image, source / request code / notice kind), the A5 sheet with the locked VietQR and the transfer code verbatim, no QR on a superseded original (with a link to the current replacement and no cancelled request code on the sheet) or a no-payment notice, the no-payment balance sentence vs the reissue-to-0 sentence, the replacement marker, the reissue form only with tuition_periods.adjust and no replacement, a reissue result that survives the revalidated render, not-found for another period, a malformed or an unknown id, and an error state when the read fails;
// fails_when=the gate changes, the header or form prints, a superseded or no-payment notice shows a QR, the replacement link points elsewhere, the reissue form shows without adjust or on a replaced notice, the success banner vanishes once the notice reads as replaced, a reissue to 0 claims the balance covered the period, a notice opens under the wrong period, an incomplete-contract sheet prints the staff diagnosis for parents or loses it on screen, a malformed id reaches the database, an unknown id renders, a read failure renders a notice, or the page gains a primary or a nested <main>;
// why_new=step 13 rewrote the notice route on loadFeeNotices + FeeNoticeA5;
// seam=permissions, the Supabase server client (table-backed PostgREST stand-in) and the "use server" actions mocked at their module boundaries; no_claim=does not prove PostgREST accepts these selects, that RLS returns these rows, or the reissue RPC
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FeeNoticePage from "@/app/(app)/finance/tuition-periods/[periodId]/items/[itemId]/notice/page";
import { reissueTuitionItemAction } from "@/features/tuition/actions";
import { FeeNoticeA5 } from "@/features/tuition/fee-notice-a5";
import { buildSampleFeeNoticeModel } from "@/features/tuition/fee-notice-model";

const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = {
    calls: [] as Array<{ ops: unknown[][]; table: string }>,
    failTable: null as string | null,
    tables: {} as Record<string, Row[]>,
  };
  /** Chainable PostgREST stand-in: filters the table's rows by this request's own calls. */
  const from = (table: string) => {
    const call = { ops: [] as unknown[][], table };
    state.calls.push(call);
    const filters: Array<(row: Row) => boolean> = [];
    let window: [number, number] | null = null;
    const builder: Record<string, unknown> = {
      eq: (column: string, value: unknown) => (call.ops.push(["eq", column, value]), filters.push((row) => row[column] === value), builder),
      in: (column: string, values: unknown[]) => (call.ops.push(["in", column, values]), filters.push((row) => values.includes(row[column])), builder),
      not: (column: string, operator: string, value: unknown) => (
        call.ops.push(["not", column, operator, value]), filters.push((row) => row[column] !== null && row[column] !== undefined), builder
      ),
      order: () => builder,
      range: (start: number, end: number) => ((window = [start, end]), builder),
      select: (columns: string) => (call.ops.push(["select", columns]), builder),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        if (state.failTable === table) return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve, reject);
        const rows = (state.tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        return Promise.resolve({ data: window ? rows.slice(window[0], window[1] + 1) : rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };
  return { from, state };
});
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ from: db.from })) }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: permissions.getCachedDatabasePermissions }));
vi.mock("@/features/tuition/actions", () => ({ reissueTuitionItemAction: vi.fn() }));

const PERIOD = "11111111-1111-4111-8111-111111111111";
const OTHER_PERIOD = "22222222-2222-4222-8222-222222222222";
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [ANH, BINH, BINH_NEW, CHI, DUNG, DUNG_ZERO] = [id(1), id(2), id(3), id(4), id(5), id(6)];
const anhCode = "NGUYEN MINH ANH 2011 0912345678 PAY-261015-1A2B3C4D5E6F";

const template = { announcement: "Kính gửi quý phụ huynh.", center_display_name: "Trung tâm Toán Thầy Vinh", footer: "Liên hệ 0988 123 456", title: "HỌC PHÍ {PERIOD_NAME}" };
const contract = (amount: number, transfer: string, publicCode: string) => ({
  account_display_name: "TOAN THAY VINH",
  account_number: "0399886886",
  amount_vnd: amount,
  bank_code: "MB",
  public_code: publicCode,
  transfer_code: transfer,
});
const itemRow = (itemId: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  opening_balance_sessions: -1,
  payable_amount_vnd: 0,
  payable_sessions: 0,
  payment_contract_snapshot: {},
  period_id: PERIOD,
  receipt_template_snapshot: template,
  reissued_from_item_id: null,
  scheduled_chargeable_sessions: 2,
  source_snapshot: { code: "DIRECT", name: "Đến trực tiếp trung tâm" },
  status: "pending_payment",
  student_snapshot: { class_name: "Toán 9A tối 2-4-6", current_grade: 9, full_name: name, public_code: "TTV-00123" },
  ...overrides,
});

function seed() {
  db.state.tables = {
    tuition_collection_item_adjustments: [{ id: "adj-1", original_item_id: BINH, replacement_item_id: BINH_NEW }],
    tuition_collection_item_lines: [
      { class_session_id: "cs-1", id: "l1", item_id: ANH, line_kind: "session", payable_session_count: 1, session_date: "2026-10-01", unit_price_vnd: 200_000 },
      { class_session_id: "cs-2", id: "l2", item_id: ANH, line_kind: "session", payable_session_count: 1, session_date: "2026-10-03", unit_price_vnd: 200_000 },
      { class_session_id: null, id: "l3", item_id: ANH, line_kind: "opening_debit", payable_session_count: 1, session_date: null, unit_price_vnd: 200_000 },
    ],
    tuition_collection_items: [
      itemRow(ANH, "Nguyễn Minh Anh", { payable_amount_vnd: 600_000, payable_sessions: 3, payment_contract_snapshot: contract(600_000, anhCode, "PAY-261015-1A2B3C4D5E6F") }),
      itemRow(BINH, "Trần Bình", { payable_amount_vnd: 600_000, payable_sessions: 3, payment_contract_snapshot: contract(600_000, "TRAN BINH OLD", "PAY-OLD") }),
      itemRow(BINH_NEW, "Trần Bình", {
        payable_amount_vnd: 400_000,
        payable_sessions: 3,
        payment_contract_snapshot: contract(400_000, "TRAN BINH 2012 0987654321 PAY-261020-ABCDEF123456", "PAY-261020-ABCDEF123456"),
        reissued_from_item_id: BINH,
      }),
      itemRow(CHI, "Lê Chi", { opening_balance_sessions: 10, scheduled_chargeable_sessions: 8, status: "no_payment" }),
      // Reissued to 0: the replacement keeps the original's balance figures but owes nothing.
      itemRow(DUNG, "Phạm Dũng", { payable_amount_vnd: 400_000, payable_sessions: 2, payment_contract_snapshot: contract(400_000, "PHAM DUNG OLD", "PAY-DUNG-OLD") }),
      itemRow(DUNG_ZERO, "Phạm Dũng", { reissued_from_item_id: DUNG, status: "no_payment" }),
    ],
    tuition_collection_periods: [{ due_on: "2026-10-15", id: PERIOD, name: "Học phí tháng 10/2026" }],
  };
}

const grant = (...codes: string[]) => permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", ...codes] });
const route = (itemId: string, periodId = PERIOD) => FeeNoticePage({ params: Promise.resolve({ itemId, periodId }) });
const primaries = (container: HTMLElement) => container.querySelectorAll('a[class~="bg-action-primary"], button[class~="bg-action-primary"]');

beforeEach(() => {
  seed();
  db.state.calls = [];
  db.state.failTable = null;
  grant();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(reissueTuitionItemAction).mockReset();
  // jsdom has no HTMLImageElement#decode; tests that print install one.
  delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
});

describe("/finance/tuition-periods/[periodId]/items/[itemId]/notice", () => {
  it("requires tuition_periods.view", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.export"] });
    render(await route(ANH));
    expect(screen.getByRole("heading", { name: "Không có quyền xem Phiếu học phí" })).toBeInTheDocument();
    expect(db.state.calls).toHaveLength(0);
  });

  it("shows the staff header and the payable A5 sheet with the locked QR; the reissue form needs tuition_periods.adjust", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    grant("tuition_periods.adjust");
    const { container } = render(await route(ANH));

    const heading = screen.getByRole("heading", { level: 1, name: "Phiếu học phí · Nguyễn Minh Anh" });
    const header = heading.closest(".print\\:hidden");
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText("Bản gốc")).toBeInTheDocument();
    expect(within(header as HTMLElement).getByRole("link", { name: "Quay lại kỳ thu" })).toHaveAttribute("href", `/finance/tuition-periods/${PERIOD}`);
    const meta = (header as HTMLElement).querySelector("dl") as HTMLElement;
    expect(meta).toHaveTextContent("Nguồn học viênĐến trực tiếp trung tâm");
    expect(meta).toHaveTextContent("Mã yêu cầuPAY-261015-1A2B3C4D5E6F");
    expect(meta).toHaveTextContent("Loại phiếuCó mã QR thanh toán");

    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Nguyễn Minh Anh" });
    expect(sheet).toHaveClass("fee-notice-a5");
    expect(within(sheet).getByRole("heading", { name: "HỌC PHÍ Học phí tháng 10/2026" })).toBeInTheDocument();
    expect(within(sheet).getByText("Nguyễn Minh Anh · TTV-00123")).toBeInTheDocument();
    expect(within(sheet).getByText(/^2 buổi × 200\.000\s₫ · 1 buổi nợ đầu kỳ × 200\.000\s₫$/)).toBeInTheDocument();
    expect(within(sheet).getByText("−1 buổi (nợ)")).toBeInTheDocument();
    expect(within(sheet).getByText("15/10/2026")).toBeInTheDocument();
    const qr = within(sheet).getByRole("img", { name: "Mã QR thanh toán tái phí" });
    expect(new URL(qr.getAttribute("src") ?? "").searchParams.get("des")).toBe(anhCode);
    expect(within(sheet).getByText(anhCode)).toBeInTheDocument();
    expect(within(sheet).getByText("Liên hệ 0988 123 456")).toBeInTheDocument();
    expect(sheet.closest(".print\\:hidden")).toBeNull();

    const form = screen.getByRole("form", { name: "Điều chỉnh / phát hành lại" });
    expect(form.closest(".print\\:hidden")).not.toBeNull();
    expect(screen.getByLabelText("Số tiền mới (₫)")).toHaveValue(600_000);

    expect(container.querySelector("main")).toBeNull();
    expect(primaries(container)).toHaveLength(0);
    // The QR is still loading in jsdom: printing waits for it to decode.
    HTMLImageElement.prototype.decode = vi.fn(() => Promise.resolve());
    const printButton = screen.getByRole("button", { name: "In phiếu" });
    expect(printButton).toHaveClass("h-10");
    fireEvent.click(printButton);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Một số mã QR chưa tải được/)).not.toBeInTheDocument();

    cleanup();
    grant();
    render(await route(ANH));
    expect(screen.queryByRole("form", { name: "Điều chỉnh / phát hành lại" })).not.toBeInTheDocument();
  });

  it("never shows a QR on a superseded original and links the current replacement instead of offering a reissue", async () => {
    grant("tuition_periods.adjust");
    render(await route(BINH));
    expect(screen.getByText("Bản gốc · đã có 1 bản thay thế")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở bản thay thế hiện hành" })).toHaveAttribute(
      "href",
      `/finance/tuition-periods/${PERIOD}/items/${BINH_NEW}/notice`,
    );
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Trần Bình" });
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("TRAN BINH OLD")).not.toBeInTheDocument();
    expect(within(sheet).getByText(/^Phiếu này đã được thay thế\. Vui lòng thanh toán theo bản thay thế hiện hành/)).toBeInTheDocument();
    // The cancelled request's code stays in the staff header, never on the parent's sheet.
    expect(within(sheet).queryByText(/Mã yêu cầu/)).not.toBeInTheDocument();
    expect(screen.getByText("Mã yêu cầu").nextElementSibling).toHaveTextContent("PAY-OLD");
    expect(screen.getByText("Loại phiếu").nextElementSibling).toHaveTextContent("Đã được thay thế");
    expect(screen.queryByRole("form", { name: "Điều chỉnh / phát hành lại" })).not.toBeInTheDocument();
  });

  it("keeps a reissue's success banner once the revalidated page shows the notice as replaced", async () => {
    grant("tuition_periods.adjust");
    vi.mocked(reissueTuitionItemAction).mockResolvedValue({ message: "Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc.", status: "success" });
    const { rerender } = render(await route(ANH));
    const form = screen.getByRole("form", { name: "Điều chỉnh / phát hành lại" });
    fireEvent.change(within(form).getByLabelText("Số tiền mới (₫)"), { target: { value: "400000" } });
    fireEvent.change(within(form).getByLabelText("Lý do điều chỉnh"), { target: { value: "Giảm 1 buổi" } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc."));
    expect(reissueTuitionItemAction).toHaveBeenCalledWith(ANH, 400_000, "Giảm 1 buổi");

    // What the RPC wrote, then the revalidated render of the same page.
    const ANH_NEW = id(7);
    db.state.tables.tuition_collection_items.push(
      itemRow(ANH_NEW, "Nguyễn Minh Anh", { payable_amount_vnd: 400_000, payable_sessions: 3, payment_contract_snapshot: contract(400_000, "NGUYEN MINH ANH NEW", "PAY-NEW"), reissued_from_item_id: ANH }),
    );
    db.state.tables.tuition_collection_item_adjustments.push({ id: "adj-2", original_item_id: ANH, replacement_item_id: ANH_NEW });
    rerender(await route(ANH));

    expect(screen.getByText("Bản gốc · đã có 1 bản thay thế")).toBeInTheDocument();
    const banner = screen.getAllByRole("status").find((element) => element.textContent?.includes("Đã tạo phiếu thay thế"));
    expect(banner).toBeDefined();
    expect(within(banner as HTMLElement).getByRole("link", { name: "Mở bản thay thế hiện hành" })).toHaveAttribute(
      "href",
      `/finance/tuition-periods/${PERIOD}/items/${ANH_NEW}/notice`,
    );
    expect(screen.queryByLabelText("Số tiền mới (₫)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo phiếu thay thế" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Điều chỉnh / phát hành lại" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Phiếu học phí của Nguyễn Minh Anh" })).queryByRole("img")).not.toBeInTheDocument();
  });

  it("marks the current replacement and still lets an adjuster reissue it", async () => {
    grant("tuition_periods.adjust");
    render(await route(BINH_NEW));
    expect(screen.getByText("Bản thay thế hiện hành")).toBeInTheDocument();
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Trần Bình" });
    expect(within(sheet).getByText("BẢN THAY THẾ HIỆN HÀNH")).toBeInTheDocument();
    expect(within(sheet).getByText("3 buổi · số tiền đã điều chỉnh")).toBeInTheDocument();
    expect(within(sheet).getByRole("img", { name: "Mã QR thanh toán tái phí" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Điều chỉnh / phát hành lại" })).toBeInTheDocument();
  });

  it("explains a no-payment notice by the opening balance, without a QR", async () => {
    render(await route(CHI));
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Lê Chi" });
    expect(within(sheet).getByText("KHÔNG CẦN THANH TOÁN")).toBeInTheDocument();
    expect(sheet).toHaveTextContent("8 buổi kỳ này · số dư đầu kỳ 10 buổi · còn lại sau kỳ 2 buổi");
    expect(within(sheet).getByText("Phiếu không có mã QR vì số dư buổi đã đủ cho kỳ này.")).toBeInTheDocument();
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Hạn thanh toán:", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("Loại phiếu").nextElementSibling).toHaveTextContent("Không cần thanh toán");
    expect(screen.getByText("Mã yêu cầu").nextElementSibling).toHaveTextContent("—");
  });

  it("tells parents to contact the center when the payment contract is incomplete, keeping the staff diagnosis on screen only", async () => {
    const INCOMPLETE = id(8);
    db.state.tables.tuition_collection_items.push(
      itemRow(INCOMPLETE, "Trịnh Bảo Châu", { payable_amount_vnd: 500_000, payable_sessions: 2, payment_contract_snapshot: { amount_vnd: 500_000, transfer_code: "TRINH BAO CHAU PAY-X" } }),
    );
    render(await route(INCOMPLETE));
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Trịnh Bảo Châu" });
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    // What reaches paper: an instruction a parent can act on.
    const parentLine = within(sheet).getByText("Thiếu thông tin chuyển khoản trên phiếu này. Vui lòng liên hệ trung tâm để được hướng dẫn thanh toán.");
    expect(parentLine.closest(".print\\:hidden")).toBeNull();
    // Staff still see why, but it never prints.
    const staffLine = within(sheet).getByText("Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.");
    expect(staffLine.closest(".print\\:hidden")).not.toBeNull();
    expect(screen.getByText("Loại phiếu").nextElementSibling).toHaveTextContent("Thiếu thông tin chuyển khoản");
  });

  it("words a current replacement reissued to 0 as an adjustment, not a balance effect", async () => {
    render(await route(DUNG_ZERO));
    expect(screen.getByText("Bản thay thế hiện hành")).toBeInTheDocument();
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Phạm Dũng" });
    expect(within(sheet).getByText("KHÔNG CẦN THANH TOÁN")).toBeInTheDocument();
    expect(within(sheet).getByText("Phiếu thay thế không cần thanh toán.")).toBeInTheDocument();
    expect(sheet).not.toHaveTextContent(/buổi kỳ này|còn lại sau kỳ|số dư buổi đã đủ/);
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(within(sheet).queryByText(/PHAM DUNG OLD|Mã yêu cầu/)).not.toBeInTheDocument();
  });

  it("is not found under another period or for a malformed id", async () => {
    const notFound = { digest: expect.stringMatching(/;404$/) };
    await expect(route(ANH, OTHER_PERIOD)).rejects.toMatchObject(notFound);
    db.state.calls = [];
    await expect(route("not-a-uuid")).rejects.toMatchObject(notFound);
    expect(db.state.calls).toHaveLength(0);
  });

  it("is not found for a well-formed id that matches no readable notice", async () => {
    await expect(route(id(404))).rejects.toMatchObject({ digest: expect.stringMatching(/;404$/) });
    expect(db.state.calls.some((call) => call.table === "tuition_collection_items")).toBe(true);
  });

  it("shows an error instead of a notice when the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.state.failTable = "tuition_collection_periods";
    render(await route(ANH));
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được Phiếu học phí");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});

describe("FeeNoticeA5", () => {
  it("titles the sheet at the requested level and keeps the amount table and QR box whole in print", () => {
    const { container } = render(<FeeNoticeA5 headingLevel={3} model={buildSampleFeeNoticeModel({})} />);
    expect(screen.getByRole("heading", { level: 3, name: "HỌC PHÍ Học phí tháng 11/2026" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    const kept = container.querySelectorAll("[data-print-keep]");
    expect([...kept].map((element) => element.tagName)).toEqual(["TABLE", "DIV"]);
    expect(kept[1]).toContainElement(screen.getByRole("img", { name: "Mã QR thanh toán tái phí" }));
  });
});
