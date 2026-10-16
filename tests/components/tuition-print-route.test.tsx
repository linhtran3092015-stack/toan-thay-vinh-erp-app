// Value: protects=the bulk print tab /finance/tuition-periods/print (design 15b): the tuition_periods.export gate with its copy, the uuid filter (lower-cased, de-duplicated, nothing queried without a valid id), superseded notices never printed (found through adjustment rows too) but swapped for the chain's current replacement when it is not already in the batch (read once, de-duplicated) or, when it cannot be read, counted once per chain under its own reload banner (never folded into the unknown ids), unknown ids counted, notices sorted by grade then name, the QR only on current payable notices with a valid locked contract (never on no-payment, superseded or malformed ones), the transfer code verbatim and breaking at its spaces first, a screen-only toolbar with one default-size primary print button that waits for the QR images, does not print when one failed, timed out after 8 s or loaded without pixels (it warns and the next click prints anyway), prints within the click when they are ready, and never prints after unmounting, and no nested <main>, and a failed superseded read failing the page instead of printing;
// fails_when=the gate or its copy changes, junk ids reach the query, a superseded original prints (with or without its QR), a notice reissued after the period page loaded drops its student from the batch, a replacement prints twice, an unreadable replacement reads as an unknown id or one chain counts twice, the order is by id or name only, a no-payment or malformed notice gets a QR, the transfer code is altered, the toolbar prints, a second primary appears, printing starts before the QR images settle, prints past a failed or timed-out one without a second click, or prints after the button unmounted, the warning vanishes without its live region being in the DOM first, the button keeps its "Vẫn in" label (or stops re-checking the images) after printing anyway, the back link of an empty batch drops the period of the superseded notices that were read, a malformed sheet prints the staff diagnosis for parents (or loses it on screen), or a read error prints notices anyway;
// why_new=step 13 rewrote the bulk print route on loadFeeNotices + FeeNoticeA5;
// seam=permissions and the Supabase server client mocked at their module boundaries (a table-backed PostgREST stand-in), the real loader, model and screen; no_claim=does not prove PostgREST accepts these selects, that RLS returns these rows, or how a browser paginates the A5 print CSS
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TuitionBulkPrintPage from "@/app/(app)/finance/tuition-periods/print/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [ANH, BINH, BINH_NEW, CHI, DUNG] = [id(1), id(2), id(3), id(4), id(5)];
const UNKNOWN = id(99);
const anhCode = "NGUYEN MINH ANH 2011 0912345678 PAY-261015-1A2B3C4D5E6F";
const binhCode = "TRAN BINH 2012 0987654321 PAY-261020-ABCDEF123456";

const template = { announcement: "Kính gửi quý phụ huynh.", center_display_name: "Trung tâm Toán Thầy Vinh", footer: "Liên hệ 0988 123 456", title: "PHIẾU HỌC PHÍ" };
const contract = (amount: number, transfer: string, publicCode: string) => ({
  account_display_name: "TOAN THAY VINH",
  account_number: "0399886886",
  amount_vnd: amount,
  bank_code: "MB",
  public_code: publicCode,
  transfer_code: transfer,
});
const itemRow = (itemId: string, name: string, grade: number, overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  opening_balance_sessions: 0,
  payable_amount_vnd: 0,
  payable_sessions: 0,
  payment_contract_snapshot: {},
  period_id: PERIOD,
  receipt_template_snapshot: template,
  reissued_from_item_id: null,
  scheduled_chargeable_sessions: 3,
  source_snapshot: { name: "Đến trực tiếp trung tâm" },
  status: "pending_payment",
  student_snapshot: { class_name: "Toán 9A", current_grade: grade, full_name: name, public_code: `TTV-${grade}` },
  ...overrides,
});
const sessionLine = (itemId: string, n: number, rate: number) => ({
  class_session_id: `cs-${n}`,
  id: `${itemId}-line-${n}`,
  item_id: itemId,
  line_kind: "session",
  payable_session_count: 1,
  session_date: `2026-10-0${n}`,
  unit_price_vnd: rate,
});

function seed() {
  db.state.tables = {
    tuition_collection_item_adjustments: [{ id: "adj-1", original_item_id: BINH, replacement_item_id: BINH_NEW }],
    tuition_collection_item_lines: [sessionLine(ANH, 1, 200_000), sessionLine(ANH, 2, 200_000), sessionLine(ANH, 3, 250_000)],
    tuition_collection_items: [
      itemRow(ANH, "Nguyễn Minh Anh", 9, { payable_amount_vnd: 650_000, payable_sessions: 3, payment_contract_snapshot: contract(650_000, anhCode, "PAY-261015-1A2B3C4D5E6F") }),
      // Superseded original: still carries its (now cancelled) contract.
      itemRow(BINH, "Trần Bình", 8, { payable_amount_vnd: 600_000, payable_sessions: 3, payment_contract_snapshot: contract(600_000, "TRAN BINH OLD", "PAY-OLD") }),
      itemRow(BINH_NEW, "Trần Bình", 8, {
        payable_amount_vnd: 400_000,
        payable_sessions: 3,
        payment_contract_snapshot: contract(400_000, binhCode, "PAY-261020-ABCDEF123456"),
        reissued_from_item_id: BINH,
      }),
      itemRow(CHI, "Lê Chi", 7, { opening_balance_sessions: 10, scheduled_chargeable_sessions: 8, status: "no_payment" }),
      itemRow(DUNG, "Phạm Dũng", 9, { payable_amount_vnd: 500_000, payable_sessions: 2, payment_contract_snapshot: { amount_vnd: 500_000, transfer_code: "PHAM DUNG PAY-X" } }),
    ],
    tuition_collection_periods: [{ due_on: "2026-10-15", id: PERIOD, name: "Học phí tháng 10/2026" }],
  };
}

const route = (itemIds?: string | string[]) => TuitionBulkPrintPage({ searchParams: Promise.resolve(itemIds === undefined ? {} : { itemIds }) });
const primaries = (container: HTMLElement) => container.querySelectorAll('a[class~="bg-action-primary"], button[class~="bg-action-primary"]');

beforeEach(() => {
  seed();
  db.state.calls = [];
  db.state.failTable = null;
  permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "tuition_periods.export"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // jsdom has no HTMLImageElement#decode; tests that print install one.
  delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
});

const QR_WARNING = "Một số mã QR chưa tải được; kiểm tra trước khi in.";
const UNRESOLVED = (n: number) => `${n} phiếu đã được thay thế nhưng chưa đọc được bản hiện hành; tải lại trang kỳ thu rồi in lại.`;
/** Lets every pending promise callback run (a macrotask turn), not just one microtask. */
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

const itemQueries = () =>
  db.state.calls.filter((call) => call.table === "tuition_collection_items" && call.ops.some(([op, column]) => op === "in" && column === "id"));

describe("/finance/tuition-periods/print", () => {
  it("requires tuition_periods.export and reads nothing without it", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view"] });
    render(await route(ANH));
    expect(screen.getByRole("heading", { name: "Không có quyền in Phiếu học phí" })).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu quyền tuition_periods.export.")).toBeInTheDocument();
    expect(db.state.calls).toHaveLength(0);
  });

  it("queries nothing and says so when no valid id is given", async () => {
    render(await route(`nope,${"-".repeat(36)}`));
    expect(screen.getByRole("heading", { name: "Chưa chọn phiếu nào để in." })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Phiếu học phí cần in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^In \d+ phiếu$/ })).not.toBeInTheDocument();
    // No notice was read, so no period is known: the back link goes to the list.
    expect(screen.getByRole("link", { name: "Quay lại kỳ thu" })).toHaveAttribute("href", "/finance/tuition-periods");
    expect(db.state.calls).toHaveLength(0);
  });

  it("prints current notices sorted by grade then name, skipping superseded originals and counting unknown ids", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const { container } = render(await route([`${BINH},${ANH.toUpperCase()},junk,${CHI}`, `${DUNG},${BINH_NEW},${UNKNOWN},${ANH}`]));

    const itemQuery = db.state.calls.find((call) => call.table === "tuition_collection_items" && call.ops.some(([op, column]) => op === "in" && column === "id"));
    expect(itemQuery?.ops.find(([op]) => op === "in")).toEqual(["in", "id", [BINH, ANH, CHI, DUNG, BINH_NEW, UNKNOWN]]);

    const section = screen.getByRole("region", { name: "Phiếu học phí cần in" });
    const sheets = within(section).getAllByRole("article");
    expect(sheets.map((sheet) => sheet.getAttribute("aria-label"))).toEqual([
      "Phiếu học phí của Lê Chi",
      "Phiếu học phí của Trần Bình",
      "Phiếu học phí của Nguyễn Minh Anh",
      "Phiếu học phí của Phạm Dũng",
    ]);
    sheets.forEach((sheet) => expect(sheet).toHaveClass("fee-notice-a5"));
    expect(screen.getByText("Bỏ qua 1 phiếu đã được thay thế (in bản thay thế hiện hành).")).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy 1 phiếu.")).toBeInTheDocument();
    expect(screen.queryByText("TRAN BINH OLD")).not.toBeInTheDocument();

    const [chi, binh, anh, dung] = sheets;
    expect(within(chi).getByText("KHÔNG CẦN THANH TOÁN")).toBeInTheDocument();
    expect(chi).toHaveTextContent("8 buổi kỳ này · số dư đầu kỳ 10 buổi · còn lại sau kỳ 2 buổi");
    expect(within(chi).queryByRole("img")).not.toBeInTheDocument();

    expect(within(binh).getByText("BẢN THAY THẾ HIỆN HÀNH")).toBeInTheDocument();
    expect(within(binh).getByText("3 buổi · số tiền đã điều chỉnh")).toBeInTheDocument();
    expect(within(binh).getByText(binhCode)).toBeInTheDocument();

    const qr = within(anh).getByRole("img", { name: "Mã QR thanh toán tái phí" });
    expect(new URL(qr.getAttribute("src") ?? "").searchParams.get("des")).toBe(anhCode);
    expect(within(anh).getByText(anhCode)).toHaveClass("[overflow-wrap:anywhere]");
    expect(within(anh).getByText(/^2 buổi × 200\.000\s₫ · 1 buổi × 250\.000\s₫$/)).toBeInTheDocument();
    expect(within(anh).getByText("15/10/2026")).toBeInTheDocument();
    expect(within(anh).getByText("Mã yêu cầu PAY-261015-1A2B3C4D5E6F")).toBeInTheDocument();

    expect(within(dung).queryByRole("img")).not.toBeInTheDocument();
    // Paper tells parents to contact the center; the staff diagnosis stays on screen only.
    expect(within(dung).getByText("Thiếu thông tin chuyển khoản trên phiếu này. Vui lòng liên hệ trung tâm để được hướng dẫn thanh toán.").closest(".print\\:hidden")).toBeNull();
    expect(within(dung).getByText("Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.").closest(".print\\:hidden")).not.toBeNull();
    expect(within(section).getAllByRole("img")).toHaveLength(2);

    expect(container.querySelector("main")).toBeNull();
    expect(primaries(container)).toHaveLength(1);
    const printButton = screen.getByRole("button", { name: "In 4 phiếu" });
    expect(primaries(container)[0]).toBe(printButton);
    expect(printButton.closest(".print\\:hidden")).not.toBeNull();
    expect(printButton).toHaveClass("h-10");
    expect(screen.getByRole("link", { name: "Quay lại kỳ thu" })).toHaveAttribute("href", `/finance/tuition-periods/${PERIOD}`);
    // Both replacements are in the batch already: no second read.
    expect(itemQueries()).toHaveLength(1);

    // The QR images are still loading in jsdom: printing waits for both to decode.
    const decoded: Array<() => void> = [];
    const decode = vi.fn(() => new Promise<void>((resolve) => { decoded.push(resolve); }));
    HTMLImageElement.prototype.decode = decode;
    fireEvent.click(printButton);
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
    expect(print).not.toHaveBeenCalled();
    expect(printButton).toBeDisabled();
    decoded[0]();
    await flush();
    expect(print).not.toHaveBeenCalled();
    expect(printButton).toBeDisabled();
    decoded[1]();
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(printButton).toBeEnabled();
    expect(screen.queryByText(/Một số mã QR chưa tải được/)).not.toBeInTheDocument();
  });

  it("does not print when a QR image fails: it warns under the button, the next click prints anyway, then it checks the images again", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const decode = vi.fn(() => Promise.reject(new Error("EncodingError")));
    HTMLImageElement.prototype.decode = decode;
    const { container } = render(await route(ANH));
    const button = screen.getByRole("button", { name: "In 1 phiếu" });
    // The live region is in the DOM, empty, before any warning exists, so the warning is announced when it appears.
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeInTheDocument();
    expect(live).toBeEmptyDOMElement();
    expect(screen.queryByText(QR_WARNING)).not.toBeInTheDocument();

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(QR_WARNING)).toBeInTheDocument());
    await flush();
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByText(QR_WARNING)).toBe(live);
    expect(screen.getByText(QR_WARNING).closest(".print\\:hidden")).not.toBeNull();
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleName("Vẫn in 1 phiếu");
    expect(decode).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);
    // Back to the normal label with the warning gone...
    expect(button).toHaveAccessibleName("In 1 phiếu");
    expect(screen.queryByText(QR_WARNING)).not.toBeInTheDocument();
    expect(live).toBeEmptyDOMElement();

    // ...and the next click looks at the images again: still broken, so nothing prints.
    fireEvent.click(button);
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(QR_WARNING)).toBeInTheDocument());
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
    expect(button).toHaveAccessibleName("Vẫn in 1 phiếu");
  });

  it("does not print when the QR images are still loading after 8 s; the next click prints anyway", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    HTMLImageElement.prototype.decode = vi.fn(() => new Promise<void>(() => undefined));
    render(await route(ANH));
    vi.useFakeTimers();
    const button = screen.getByRole("button", { name: "In 1 phiếu" });
    fireEvent.click(button);
    expect(button).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_999);
    });
    expect(print).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(screen.queryByText(QR_WARNING)).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(print).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
    expect(screen.getByText(QR_WARNING)).toBeInTheDocument();
    expect(button).toHaveAccessibleName("Vẫn in 1 phiếu");

    fireEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("prints within the click when the QR images are already loaded, and warns instead when one loaded without pixels", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const naturalWidth = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(240);
    render(await route(ANH));
    const button = screen.getByRole("button", { name: "In 1 phiếu" });
    fireEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);
    cleanup();

    // A finished image with no pixels (a broken QR): no print, a warning, then print anyway.
    print.mockClear();
    naturalWidth.mockReturnValue(0);
    render(await route(ANH));
    const again = screen.getByRole("button", { name: "In 1 phiếu" });
    fireEvent.click(again);
    await flush();
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByText(QR_WARNING)).toBeInTheDocument();
    expect(again).toHaveAccessibleName("Vẫn in 1 phiếu");

    fireEvent.click(again);
    expect(print).toHaveBeenCalledTimes(1);
    // Printed anyway: the label and warning reset...
    expect(again).toHaveAccessibleName("In 1 phiếu");
    expect(screen.queryByText(QR_WARNING)).not.toBeInTheDocument();

    // ...and the next click checks the images again: still no pixels, so it warns instead of printing.
    fireEvent.click(again);
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByText(QR_WARNING)).toBeInTheDocument();
    expect(again).toHaveAccessibleName("Vẫn in 1 phiếu");
  });

  it("never prints once the button unmounted while waiting for the QR images", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const decoded: Array<() => void> = [];
    const decode = vi.fn(() => new Promise<void>((resolve) => { decoded.push(resolve); }));
    HTMLImageElement.prototype.decode = decode;
    const { unmount } = render(await route(ANH));
    fireEvent.click(screen.getByRole("button", { name: "In 1 phiếu" }));
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(1));

    unmount();
    decoded.forEach((resolve) => resolve());
    await flush();
    expect(print).not.toHaveBeenCalled();
  });

  it("prints the current replacement of a notice reissued after the period page loaded", async () => {
    // A second reissue: BINH → BINH_NEW → BINH_V3, and the tab still asks for BINH and BINH_NEW.
    const BINH_V3 = id(6);
    db.state.tables.tuition_collection_items.push(
      itemRow(BINH_V3, "Trần Bình", 8, {
        payable_amount_vnd: 300_000,
        payable_sessions: 3,
        payment_contract_snapshot: contract(300_000, "TRAN BINH 2012 0987654321 PAY-261025-FEDCBA654321", "PAY-261025-FEDCBA654321"),
        reissued_from_item_id: BINH_NEW,
      }),
    );
    render(await route(`${BINH},${BINH_NEW},${ANH}`));

    expect(screen.getAllByRole("article").map((sheet) => sheet.getAttribute("aria-label"))).toEqual(["Phiếu học phí của Trần Bình", "Phiếu học phí của Nguyễn Minh Anh"]);
    expect(screen.getByText("TRAN BINH 2012 0987654321 PAY-261025-FEDCBA654321")).toBeInTheDocument();
    expect(screen.queryByText(/TRAN BINH OLD|PAY-261020-ABCDEF123456/)).not.toBeInTheDocument();
    expect(screen.getByText("Đã thay 1 phiếu cũ bằng bản thay thế hiện hành.")).toBeInTheDocument();
    expect(screen.getByText("Bỏ qua 1 phiếu đã được thay thế (in bản thay thế hiện hành).")).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In 2 phiếu" })).toBeInTheDocument();
    // The shared current replacement is read once.
    expect(itemQueries().map((call) => call.ops.find(([op]) => op === "in"))).toEqual([
      ["in", "id", [BINH, BINH_NEW, ANH]],
      ["in", "id", [BINH_V3]],
    ]);
  });

  it("finds a superseded original through either link: replacement row or adjustment row", async () => {
    // Replacement row only: the original is swapped for its replacement.
    db.state.tables.tuition_collection_item_adjustments = [];
    render(await route(`${BINH},${ANH}`));
    expect(screen.getAllByRole("article").map((sheet) => sheet.getAttribute("aria-label"))).toEqual(["Phiếu học phí của Trần Bình", "Phiếu học phí của Nguyễn Minh Anh"]);
    expect(screen.getByText(binhCode)).toBeInTheDocument();
    expect(screen.queryByText("TRAN BINH OLD")).not.toBeInTheDocument();
    expect(screen.getByText("Đã thay 1 phiếu cũ bằng bản thay thế hiện hành.")).toBeInTheDocument();
    cleanup();

    // Adjustment row only, and the replacement is not readable: the original
    // still never prints and says its replacement could not be read.
    seed();
    db.state.tables.tuition_collection_items = db.state.tables.tuition_collection_items.filter((row) => row.id !== BINH_NEW);
    render(await route(`${BINH},${ANH}`));
    expect(screen.getAllByRole("article").map((sheet) => sheet.getAttribute("aria-label"))).toEqual(["Phiếu học phí của Nguyễn Minh Anh"]);
    expect(screen.queryByText("TRAN BINH OLD")).not.toBeInTheDocument();
    expect(screen.getByText(UNRESOLVED(1))).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Bỏ qua|^Đã thay/)).not.toBeInTheDocument();
  });

  it("counts a superseded chain whose current replacement cannot be read once, apart from the unknown ids", async () => {
    // BINH → BINH_NEW → BINH_V3, and BINH_V3 is not readable: both requested originals belong to one chain.
    const BINH_V3 = id(6);
    db.state.tables.tuition_collection_item_adjustments.push({ id: "adj-2", original_item_id: BINH_NEW, replacement_item_id: BINH_V3 });
    render(await route(`${BINH},${BINH_NEW},${ANH},${UNKNOWN}`));
    expect(screen.getAllByRole("article").map((sheet) => sheet.getAttribute("aria-label"))).toEqual(["Phiếu học phí của Nguyễn Minh Anh"]);
    expect(screen.queryByText(/TRAN BINH OLD|PAY-261020-ABCDEF123456/)).not.toBeInTheDocument();
    expect(screen.getByText(UNRESOLVED(1))).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy 1 phiếu.")).toBeInTheDocument();
    expect(screen.queryByText(/^Bỏ qua|^Đã thay/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In 1 phiếu" })).toBeInTheDocument();
    cleanup();

    // The unreadable replacement was requested too: the chain is not counted again as unknown.
    seed();
    db.state.tables.tuition_collection_items = db.state.tables.tuition_collection_items.filter((row) => row.id !== BINH_NEW);
    render(await route(`${BINH},${BINH_NEW},${ANH}`));
    expect(screen.getAllByRole("article").map((sheet) => sheet.getAttribute("aria-label"))).toEqual(["Phiếu học phí của Nguyễn Minh Anh"]);
    expect(screen.getByText(UNRESOLVED(1))).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy/)).not.toBeInTheDocument();
  });

  it("fails the page instead of printing when superseded originals cannot be checked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.state.failTable = "tuition_collection_item_adjustments";
    render(await route(`${ANH},${BINH}`));
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được Phiếu học phí");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith("FEE_NOTICE_READ_FAILED", "tuition_collection_item_adjustments", "boom");
  });

  it("prints the session total when the lines cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.state.failTable = "tuition_collection_item_lines";
    render(await route(ANH));
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Nguyễn Minh Anh" });
    expect(within(sheet).getByText("3 buổi")).toBeInTheDocument();
    expect(within(sheet).getByRole("img", { name: "Mã QR thanh toán tái phí" })).toBeInTheDocument();
  });

  it("says nothing is left when every id was superseded without a readable replacement or unknown", async () => {
    db.state.tables.tuition_collection_items = db.state.tables.tuition_collection_items.filter((row) => row.id !== BINH_NEW);
    render(await route(`${BINH},${UNKNOWN}`));
    expect(screen.getByRole("heading", { name: "Không còn phiếu nào để in." })).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy 1 phiếu.")).toBeInTheDocument();
    expect(screen.getByText(UNRESOLVED(1))).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    // The superseded notice was read, so its period is known and the back link keeps it.
    expect(screen.getByRole("link", { name: "Quay lại kỳ thu" })).toHaveAttribute("href", `/finance/tuition-periods/${PERIOD}`);
  });

  it("goes back to the periods list when none of the requested notices could be read", async () => {
    render(await route(UNKNOWN));
    expect(screen.getByRole("heading", { name: "Không còn phiếu nào để in." })).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy 1 phiếu.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại kỳ thu" })).toHaveAttribute("href", "/finance/tuition-periods");
  });

  it("fails the page instead of printing when the replacements cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // First pass reads normally; the second pass (BINH's replacement) fails.
    vi.mocked(createSupabaseServerClient)
      .mockResolvedValueOnce({ from: db.from } as never)
      .mockResolvedValueOnce({ from: (table: string) => ((db.state.failTable = table), db.from(table)) } as never);
    render(await route(`${BINH},${ANH}`));
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được Phiếu học phí");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith("FEE_NOTICE_READ_FAILED", "tuition_collection_items", "boom");
  });
});
