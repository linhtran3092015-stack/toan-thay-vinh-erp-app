// Value: protects=the Phiếu học phí read model (design 15b): per-rate breakdown in the lock's date order with the opening debit apart, opening balance wording, template title/defaults, the QR rule (not superseded, transfer code, payable > 0, valid locked contract) with the transfer code verbatim, no-payment wording for balance vs reissue-to-0, replacement detection through reissued_from_item_id and adjustment rows (chains followed), print id parsing and print order, and a network-free sample for the template preview;
// fails_when=credited lines are billed, rates are grouped out of date order or merged with the opening debit, a negative balance loses "(nợ)", a session-less replacement prints "0 buổi", {PERIOD_NAME} survives or a "$&" in a period name is expanded, the staff kind label claims a payment status, a superseded/malformed/zero notice gets a QR, the transfer code is trimmed or reformatted, a reissue-to-0 claims the balance covered the period, an adjustment-only replacement is missed, non-uuid ids reach the query, unknown grades sort first, or the sample points at vietqr.app;
// why_new=fee-notice-model.ts is new and pure (step 13);
// seam=none; no_claim=does not prove the loader's queries or RLS (route tests cover the wiring)
import { describe, expect, it } from "vitest";

import {
  buildFeeNoticeModel,
  buildSampleFeeNoticeModel,
  FEE_NOTICE_DEFAULT_CENTER_NAME,
  FEE_NOTICE_DEFAULT_FOOTER,
  FEE_NOTICE_PLACEHOLDER_QR,
  formatFeeNoticeBalance,
  formatFeeNoticeCharge,
  getFeeNoticeEditionBadge,
  getFeeNoticeKindLabel,
  groupFeeNoticeLines,
  parseFeeNoticeItemIds,
  resolveFeeNoticeEditions,
  resolveFeeNoticeTitle,
  sortFeeNoticesForPrint,
  type FeeNoticeItemRow,
  type FeeNoticeLineRow,
} from "@/features/tuition/fee-notice-model";

/** Intl puts a no-break space before ₫; compare the words. */
const plain = (value: string) => value.replace(/\u00a0/g, " ");

const TRANSFER = "NGUYEN MINH ANH 2011 0912345678 PAY-261015-1A2B3C4D5E6F";

const item = (overrides: Partial<FeeNoticeItemRow> = {}): FeeNoticeItemRow => ({
  id: "item-1",
  opening_balance_sessions: -1,
  payable_amount_vnd: 4_600_000,
  payable_sessions: 21,
  payment_contract_snapshot: {
    account_display_name: "TOAN THAY VINH",
    account_number: "0399886886",
    amount_vnd: 4_600_000,
    bank_code: "MB",
    public_code: "PAY-261015-1A2B3C4D5E6F",
    transfer_code: TRANSFER,
  },
  period_id: "period-1",
  receipt_template_snapshot: { announcement: "Kính gửi quý phụ huynh.", center_display_name: "Toán Thầy Vinh", footer: "Liên hệ 0988 123 456", title: "PHIẾU HỌC PHÍ {PERIOD_NAME}" },
  reissued_from_item_id: null,
  scheduled_chargeable_sessions: 20,
  source_snapshot: { code: "DIRECT", name: "Đến trực tiếp trung tâm" },
  status: "pending_payment",
  student_snapshot: { class_name: "Toán 9A", current_grade: 9, full_name: "Nguyễn Minh Anh", public_code: "TTV-00123" },
  ...overrides,
});

const line = (overrides: Partial<FeeNoticeLineRow>): FeeNoticeLineRow => ({
  class_session_id: "cs-1",
  item_id: "item-1",
  line_kind: "session",
  payable_session_count: 1,
  session_date: "2026-10-01",
  unit_price_vnd: 200_000,
  ...overrides,
});

const period = { due_on: "2026-10-15", id: "period-1", name: "Tháng 10/2026" };

describe("groupFeeNoticeLines / formatFeeNoticeCharge", () => {
  it("groups payable session lines by rate in date then session order, skips credited lines and keeps the opening debit apart", () => {
    const lines = [
      line({ class_session_id: "cs-b", session_date: "2026-10-02", unit_price_vnd: 250_000 }),
      line({ class_session_id: "cs-a", session_date: "2026-10-02", unit_price_vnd: 200_000 }),
      line({ class_session_id: "cs-0", payable_session_count: 0, session_date: "2026-09-30", unit_price_vnd: 300_000 }),
      line({ class_session_id: "cs-c", session_date: "2026-10-03", unit_price_vnd: 250_000 }),
      line({ class_session_id: null, line_kind: "opening_debit", payable_session_count: 2, session_date: null, unit_price_vnd: 200_000 }),
      line({ item_id: "other", unit_price_vnd: 999_000 }),
    ];
    const parts = groupFeeNoticeLines("item-1", lines);
    expect(parts).toEqual([
      { kind: "session", sessions: 1, unitPriceVnd: 200_000 },
      { kind: "session", sessions: 2, unitPriceVnd: 250_000 },
      { kind: "opening_debit", sessions: 2, unitPriceVnd: 200_000 },
    ]);
    expect(plain(formatFeeNoticeCharge({ kind: "lines", parts }))).toBe("1 buổi × 200.000 ₫ · 2 buổi × 250.000 ₫ · 2 buổi nợ đầu kỳ × 200.000 ₫");
    expect(formatFeeNoticeCharge({ kind: "adjusted", payableSessions: 8 })).toBe("8 buổi · số tiền đã điều chỉnh");
    expect(formatFeeNoticeCharge({ kind: "adjusted", payableSessions: 0 })).toBe("Số tiền đã điều chỉnh");
    expect(formatFeeNoticeCharge({ kind: "total", payableSessions: 8 })).toBe("8 buổi");
  });

  it("words the opening balance in sessions", () => {
    expect(formatFeeNoticeBalance(-1)).toBe("−1 buổi (nợ)");
    expect(formatFeeNoticeBalance(15)).toBe("15 buổi");
    expect(formatFeeNoticeBalance(0)).toBe("0 buổi");
  });
});

describe("resolveFeeNoticeTitle", () => {
  it("replaces every {PERIOD_NAME} and falls back for a blank title or unknown period", () => {
    expect(resolveFeeNoticeTitle("{PERIOD_NAME} · {PERIOD_NAME}", "Tháng 10")).toBe("Tháng 10 · Tháng 10");
    expect(resolveFeeNoticeTitle("  ", "Tháng 10")).toBe("HỌC PHÍ Tháng 10");
    expect(resolveFeeNoticeTitle(null, null)).toBe("HỌC PHÍ Kỳ thu học phí");
  });

  it("inserts the period name literally, even with replacement patterns in it", () => {
    expect(resolveFeeNoticeTitle("HỌC PHÍ {PERIOD_NAME} · {PERIOD_NAME}", "Kỳ $& $$ $1 $`")).toBe("HỌC PHÍ Kỳ $& $$ $1 $` · Kỳ $& $$ $1 $`");
    expect(resolveFeeNoticeTitle(null, "$'")).toBe("HỌC PHÍ $'");
  });
});

describe("buildFeeNoticeModel", () => {
  it("builds a payable notice with a locked VietQR and the transfer code verbatim", () => {
    const model = buildFeeNoticeModel({
      item: item(),
      lines: [line({ class_session_id: "a" }), line({ class_session_id: "b", unit_price_vnd: 250_000 })],
      period,
    });
    expect(model).toMatchObject({
      announcement: "Kính gửi quý phụ huynh.",
      centerName: "Toán Thầy Vinh",
      dueOn: "2026-10-15",
      footer: "Liên hệ 0988 123 456",
      openingBalanceSessions: -1,
      payableAmountVnd: 4_600_000,
      periodName: "Tháng 10/2026",
      requestCode: "PAY-261015-1A2B3C4D5E6F",
      sourceName: "Đến trực tiếp trung tâm",
      student: { className: "Toán 9A", fullName: "Nguyễn Minh Anh", grade: 9, publicCode: "TTV-00123" },
      title: "PHIẾU HỌC PHÍ Tháng 10/2026",
    });
    expect(model.charge).toEqual({
      kind: "lines",
      parts: [
        { kind: "session", sessions: 1, unitPriceVnd: 200_000 },
        { kind: "session", sessions: 1, unitPriceVnd: 250_000 },
      ],
    });
    expect(model.payment).toMatchObject({ accountHolder: "TOAN THAY VINH", accountNumber: "0399886886", amountVnd: 4_600_000, bankCode: "MB", kind: "qr", transferCode: TRANSFER });
    if (model.payment.kind !== "qr") throw new Error("expected a QR");
    const url = new URL(model.payment.imageUrl);
    expect(url.origin + url.pathname).toBe("https://vietqr.app/img");
    expect(url.searchParams.get("des")).toBe(TRANSFER);
    expect(url.searchParams.get("amount")).toBe("4600000");
    expect(getFeeNoticeKindLabel(model)).toBe("Có mã QR thanh toán");
    expect(getFeeNoticeEditionBadge(model.edition)).toEqual({ label: "Bản gốc", tone: "neutral" });
  });

  it("uses the lock-era defaults for a blank template and prints the session total when lines are unreadable", () => {
    const model = buildFeeNoticeModel({ item: item({ receipt_template_snapshot: { footer: " ", title: "" } }), lines: null, period: null });
    expect(model.title).toBe("HỌC PHÍ Kỳ thu học phí");
    expect(model.centerName).toBe(FEE_NOTICE_DEFAULT_CENTER_NAME);
    expect(model.footer).toBe(FEE_NOTICE_DEFAULT_FOOTER);
    expect(model.announcement).toBeNull();
    expect(model.dueOn).toBeNull();
    expect(model.charge).toEqual({ kind: "total", payableSessions: 21 });
  });

  it("never shows a QR for a superseded original, a malformed contract or a zero amount", () => {
    const superseded = buildFeeNoticeModel({ edition: { currentItemId: "item-2", replacementCount: 1 }, item: item(), lines: [], period });
    expect(superseded.payment).toEqual({ kind: "superseded" });
    expect(superseded.edition).toEqual({ currentItemId: "item-2", replacement: false, replacementCount: 1, superseded: true });
    expect(getFeeNoticeEditionBadge(superseded.edition)).toEqual({ label: "Bản gốc · đã có 1 bản thay thế", tone: "neutral" });
    expect(getFeeNoticeKindLabel(superseded)).toBe("Đã được thay thế");

    const malformed = buildFeeNoticeModel({ item: item({ payment_contract_snapshot: { amount_vnd: 4_600_000, transfer_code: TRANSFER } }), lines: [], period });
    expect(malformed.payment).toEqual({ kind: "unavailable" });
    expect(getFeeNoticeKindLabel(malformed)).toBe("Thiếu thông tin chuyển khoản");

    const noCode = buildFeeNoticeModel({ item: item({ payment_contract_snapshot: {} }), lines: [], period });
    expect(noCode.payment).toEqual({ kind: "unavailable" });

    const zero = buildFeeNoticeModel({ item: item({ payable_amount_vnd: 0 }), lines: [], period });
    expect(zero.payment).toEqual({ kind: "unavailable" });
  });

  it("never prints a QR whose contract amount differs from the printed total, or for a status that is not asking for payment", () => {
    // The QR charges the contract amount; a sheet must not show one total and charge another.
    const mismatch = buildFeeNoticeModel({ item: item({ payable_amount_vnd: 4_200_000 }), lines: [], period });
    expect(mismatch.payableAmountVnd).toBe(4_200_000);
    expect(mismatch.payment).toEqual({ kind: "unavailable" });

    // "reissued" is allowed by the table check though no code writes it: treat it as not payable.
    const reissued = buildFeeNoticeModel({ item: item({ status: "reissued" }), lines: [], period });
    expect(reissued.payment).toEqual({ kind: "unavailable" });

    expect(buildFeeNoticeModel({ item: item(), lines: [], period }).payment.kind).toBe("qr");
  });

  it("explains a no-payment notice by the balance, and a reissue to 0 as an adjustment", () => {
    const balance = buildFeeNoticeModel({
      item: item({ opening_balance_sessions: 15, payable_amount_vnd: 0, payable_sessions: 0, payment_contract_snapshot: {}, scheduled_chargeable_sessions: 12, status: "no_payment" }),
      lines: [],
      period,
    });
    expect(balance.payment).toEqual({ kind: "no_payment", openingBalanceSessions: 15, reason: "balance", remainingSessions: 3, scheduledSessions: 12 });
    expect(balance.requestCode).toBeNull();
    expect(getFeeNoticeKindLabel(balance)).toBe("Không cần thanh toán");

    const reissued = buildFeeNoticeModel({
      item: item({ id: "item-2", payable_amount_vnd: 0, payable_sessions: 0, payment_contract_snapshot: {}, reissued_from_item_id: "item-1", status: "no_payment" }),
      lines: [],
      period,
    });
    expect(reissued.payment).toEqual({ kind: "no_payment", reason: "adjusted" });
    expect(reissued.charge).toEqual({ kind: "adjusted", payableSessions: 0 });
    expect(getFeeNoticeEditionBadge(reissued.edition)).toEqual({ label: "Bản thay thế hiện hành", tone: "warning" });
  });

  it("prints only \"Số tiền đã điều chỉnh\" for a payable replacement without sessions", () => {
    const model = buildFeeNoticeModel({ item: item({ id: "item-2", payable_amount_vnd: 300_000, payable_sessions: 0, reissued_from_item_id: "item-1" }), lines: null, period });
    expect(model.charge).toEqual({ kind: "adjusted", payableSessions: 0 });
    expect(formatFeeNoticeCharge(model.charge)).toBe("Số tiền đã điều chỉnh");
    expect(formatFeeNoticeCharge(model.charge)).not.toMatch(/buổi/);
  });

  it("labels a replacement that was itself replaced as an older replacement", () => {
    const model = buildFeeNoticeModel({ edition: { currentItemId: "item-3", replacementCount: 1 }, item: item({ id: "item-2", reissued_from_item_id: "item-1" }), lines: null, period });
    expect(getFeeNoticeEditionBadge(model.edition)).toEqual({ label: "Bản thay thế cũ · đã có 1 bản thay thế", tone: "neutral" });
    expect(model.payment).toEqual({ kind: "superseded" });
  });
});

describe("resolveFeeNoticeEditions", () => {
  it("counts direct replacements from either source and follows chains to the current item", () => {
    const editions = resolveFeeNoticeEditions(
      ["a", "b", "c", "x"],
      [
        { originalItemId: "a", replacementItemId: "b" },
        { originalItemId: "a", replacementItemId: "b" },
        { originalItemId: "b", replacementItemId: "c" },
        { originalItemId: "x", replacementItemId: "y" },
        { originalItemId: "y", replacementItemId: "x" },
      ],
    );
    expect(editions.get("a")).toEqual({ currentItemId: "c", replacementCount: 1 });
    expect(editions.get("b")).toEqual({ currentItemId: "c", replacementCount: 1 });
    expect(editions.get("c")).toEqual({ currentItemId: null, replacementCount: 0 });
    expect(editions.get("x")).toEqual({ currentItemId: "y", replacementCount: 1 });
  });
});

describe("print helpers", () => {
  it("keeps valid uuids only, lower-cased and de-duplicated, from one or repeated params", () => {
    const a = "0F8FAD5B-D9CB-469F-A165-70867728950E";
    const b = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    expect(parseFeeNoticeItemIds(`${a},${a.toLowerCase()},nope,${"-".repeat(36)}`)).toEqual([a.toLowerCase()]);
    expect(parseFeeNoticeItemIds([a, `${b}, ${b}`])).toEqual([a.toLowerCase(), b]);
    expect(parseFeeNoticeItemIds(undefined)).toEqual([]);
  });

  it("sorts by grade, unknown grade last, then by Vietnamese name", () => {
    const notice = (id: string, fullName: string, grade: number) =>
      buildFeeNoticeModel({ item: item({ id, student_snapshot: { current_grade: grade, full_name: fullName } }), lines: [], period });
    const sorted = sortFeeNoticesForPrint([notice("1", "Đức", 9), notice("2", "Bình", 0), notice("3", "Dung", 9), notice("4", "An", 10), notice("5", "Ân", 8)]);
    expect(sorted.map((model) => model.student.fullName)).toEqual(["Ân", "Dung", "Đức", "An", "Bình"]);
  });
});

describe("buildSampleFeeNoticeModel", () => {
  it("renders the live template values on a fixed payable sample with a local placeholder QR", () => {
    const model = buildSampleFeeNoticeModel({ announcement: "Thông báo", center_display_name: "TTV", footer: "Chân trang", title: "PHIẾU {PERIOD_NAME}" });
    expect(model).toMatchObject({ announcement: "Thông báo", centerName: "TTV", footer: "Chân trang", payableAmountVnd: 4_600_000, title: "PHIẾU Học phí tháng 11/2026" });
    expect(plain(formatFeeNoticeCharge(model.charge))).toBe("12 buổi × 200.000 ₫ · 8 buổi × 250.000 ₫ · 1 buổi nợ đầu kỳ × 200.000 ₫");
    expect(model.payment.kind).toBe("qr");
    if (model.payment.kind !== "qr") throw new Error("expected a QR");
    expect(model.payment.imageUrl).toBe(FEE_NOTICE_PLACEHOLDER_QR);
    expect(model.payment.imageUrl.startsWith("data:image/svg+xml,")).toBe(true);

    expect(buildSampleFeeNoticeModel({}).title).toBe("HỌC PHÍ Học phí tháng 11/2026");
  });
});
