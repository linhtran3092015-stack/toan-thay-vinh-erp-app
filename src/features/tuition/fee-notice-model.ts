/**
 * Phiếu học phí (design 15b, right column "Bố cục in · A5"): the pure read
 * model behind FeeNoticeA5, shared by the single notice page, bulk printing
 * and the template preview.
 *
 * Everything printed comes from the item's locked snapshots (student, source,
 * template, payment contract) and the original item's lines. Only the period
 * name and due date are read live: they are not snapshotted, and no RPC
 * changes them once the period exists.
 *
 * The QR rule lives here so every screen applies it the same way: a QR only
 * when the item is not superseded, has a transfer code, a payable amount > 0
 * and a locked contract that buildLockedVietQrPaymentDetails accepts. A
 * malformed historic contract is never repaired from current settings.
 */
import { buildLockedVietQrPaymentDetails } from "@/features/finance/vietqr";
import { formatNumber, formatVnd } from "@/lib/format";

export const FEE_NOTICE_DEFAULT_TITLE = "HỌC PHÍ {PERIOD_NAME}";
export const FEE_NOTICE_DEFAULT_CENTER_NAME = "Trung tâm Toán Thầy Vinh";
export const FEE_NOTICE_DEFAULT_FOOTER =
  "Phiếu được tạo từ snapshot đã khóa. Thay đổi đơn giá về sau không làm thay đổi phiếu này.";
const FALLBACK_PERIOD_NAME = "Kỳ thu học phí";

/**
 * Stand-in QR for sample notices (template preview, /dev): a local data URI,
 * so a preview never calls the VietQR service or shows a payable code.
 */
export const FEE_NOTICE_PLACEHOLDER_QR = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'>" +
    "<rect width='150' height='150' fill='white'/>" +
    "<g fill='none' stroke='black' stroke-width='8'><rect x='10' y='10' width='36' height='36'/><rect x='104' y='10' width='36' height='36'/><rect x='10' y='104' width='36' height='36'/></g>" +
    "<g fill='black'><rect x='22' y='22' width='12' height='12'/><rect x='116' y='22' width='12' height='12'/><rect x='22' y='116' width='12' height='12'/></g>" +
    "<text x='75' y='80' font-family='sans-serif' font-size='13' font-weight='700' text-anchor='middle'>QR mẫu</text>" +
    "</svg>",
)}`;

/** `tuition_receipt_template_versions.content` = `receipt_template_snapshot`: the keys the notice prints. */
export interface FeeNoticeTemplateContent {
  announcement?: string | null;
  center_display_name?: string | null;
  footer?: string | null;
  title?: string | null;
}

/** `tuition_collection_items` columns the notice reads (snapshots are jsonb). */
export interface FeeNoticeItemRow {
  id: string;
  opening_balance_sessions: number | string | null;
  payable_amount_vnd: number | string;
  payable_sessions: number | string | null;
  payment_contract_snapshot: unknown;
  period_id: string;
  receipt_template_snapshot: unknown;
  reissued_from_item_id: string | null;
  scheduled_chargeable_sessions: number | string | null;
  source_snapshot: unknown;
  status: string;
  student_snapshot: unknown;
}

/** `tuition_collection_item_lines` columns the charge breakdown reads. */
export interface FeeNoticeLineRow {
  class_session_id: string | null;
  item_id: string;
  line_kind: string;
  payable_session_count: number | string;
  session_date: string | null;
  unit_price_vnd: number | string;
}

export interface FeeNoticePeriodRow {
  due_on: string | null;
  id: string;
  name: string;
}

export interface FeeNoticeChargePart {
  kind: "session" | "opening_debit";
  sessions: number;
  unitPriceVnd: number;
}

export type FeeNoticeCharge =
  /** Original item: payable session lines grouped by rate in date order, then the opening debit. */
  | { kind: "lines"; parts: FeeNoticeChargePart[] }
  /** Replacement: it has no lines, and the original's breakdown no longer sums to its amount. */
  | { kind: "adjusted"; payableSessions: number }
  /** Lines not readable: the session total only. */
  | { kind: "total"; payableSessions: number };

export type FeeNoticePayment =
  | {
      kind: "qr";
      accountHolder: string;
      accountNumber: string;
      amountVnd: number;
      bankCode: string;
      imageUrl: string;
      /** Printed verbatim (40–70 characters since the identity format). */
      transferCode: string;
    }
  /** Locked with no payment: the opening balance covered every session. */
  | { kind: "no_payment"; reason: "balance"; openingBalanceSessions: number; remainingSessions: number; scheduledSessions: number }
  /** A replacement reissued to 0: an adjustment, not a balance effect. */
  | { kind: "no_payment"; reason: "adjusted" }
  /** Replaced by a reissue: its request was cancelled, never print its QR. */
  | { kind: "superseded" }
  /** Payable but the locked contract is incomplete. */
  | { kind: "unavailable" };

export interface FeeNoticeEdition {
  /** This item replaces another one (`reissued_from_item_id` is set). */
  replacement: boolean;
  /** Items that replace this one directly (reissue or adjustment rows). */
  replacementCount: number;
  superseded: boolean;
  /** The chain's current item when superseded; null when not superseded or not found. */
  currentItemId: string | null;
}

export interface FeeNoticeModel {
  itemId: string;
  periodId: string;
  periodName: string | null;
  /** ISO date (`due_on`), null when the period has none. */
  dueOn: string | null;
  centerName: string;
  /** Template title with `{PERIOD_NAME}` replaced. */
  title: string;
  announcement: string | null;
  footer: string;
  /** `payment_contract_snapshot.public_code` ("Mã yêu cầu"); null without a payment. */
  requestCode: string | null;
  student: { className: string | null; fullName: string; grade: number; publicCode: string | null };
  sourceName: string | null;
  openingBalanceSessions: number;
  scheduledSessions: number;
  payableSessions: number;
  payableAmountVnd: number;
  charge: FeeNoticeCharge;
  edition: FeeNoticeEdition;
  payment: FeeNoticePayment;
}

export interface FeeNoticeModelInput {
  item: FeeNoticeItemRow;
  /** All lines read for the batch (other items' lines are ignored); null = not readable. */
  lines: readonly FeeNoticeLineRow[] | null;
  period: FeeNoticePeriodRow | null;
  /** From resolveFeeNoticeEditions; absent = no replacement known. */
  edition?: { currentItemId: string | null; replacementCount: number };
}

type JsonRecord = Record<string, unknown>;

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readText(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (typeof value !== "string") return null;
  return value.trim() ? value : null;
}

function readInteger(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Template title with every `{PERIOD_NAME}` replaced; blank → "HỌC PHÍ {PERIOD_NAME}".
 * The name is inserted by a replacer function so `$&`, `$$` or `$1` in a
 * period name stay literal instead of being read as replacement patterns.
 */
export function resolveFeeNoticeTitle(title: string | null | undefined, periodName: string | null): string {
  const template = title?.trim() ? title.trim() : FEE_NOTICE_DEFAULT_TITLE;
  const name = periodName ?? FALLBACK_PERIOD_NAME;
  return template.replaceAll("{PERIOD_NAME}", () => name);
}

/** Template text the notice prints, with the defaults the lock-era notice used for blanks. */
export function resolveFeeNoticeTemplate(content: FeeNoticeTemplateContent | null | undefined, periodName: string | null) {
  const record = readRecord(content);
  return {
    announcement: readText(record, "announcement")?.trim() ?? null,
    centerName: readText(record, "center_display_name")?.trim() ?? FEE_NOTICE_DEFAULT_CENTER_NAME,
    footer: readText(record, "footer")?.trim() ?? FEE_NOTICE_DEFAULT_FOOTER,
    title: resolveFeeNoticeTitle(readText(record, "title"), periodName),
  };
}

/**
 * Payable session lines grouped by rate in date order (`session_date`, then
 * `class_session_id`, the lock's own order), then the opening-debit lines.
 * Lines credited by the opening balance (payable count 0) are left out.
 */
export function groupFeeNoticeLines(itemId: string, lines: readonly FeeNoticeLineRow[]): FeeNoticeChargePart[] {
  const own = lines.filter((line) => line.item_id === itemId);
  const sessions = own
    .filter((line) => line.line_kind === "session" && readInteger(line.payable_session_count) > 0)
    .sort(
      (a, b) =>
        (a.session_date ?? "").localeCompare(b.session_date ?? "") ||
        (a.class_session_id ?? "").localeCompare(b.class_session_id ?? ""),
    );
  const byRate = new Map<number, number>();
  for (const line of sessions) {
    const rate = readInteger(line.unit_price_vnd);
    byRate.set(rate, (byRate.get(rate) ?? 0) + readInteger(line.payable_session_count));
  }
  const parts: FeeNoticeChargePart[] = [...byRate].map(([unitPriceVnd, count]) => ({ kind: "session", sessions: count, unitPriceVnd }));
  for (const line of own) {
    const count = readInteger(line.payable_session_count);
    if (line.line_kind === "opening_debit" && count > 0) {
      parts.push({ kind: "opening_debit", sessions: count, unitPriceVnd: readInteger(line.unit_price_vnd) });
    }
  }
  return parts;
}

/**
 * "12 buổi × 200.000 ₫ · 8 buổi × 250.000 ₫ · 1 buổi nợ đầu kỳ × 200.000 ₫".
 * A replacement prints "N buổi · số tiền đã điều chỉnh", or only "Số tiền đã
 * điều chỉnh" when it carries no sessions (never "0 buổi" beside an amount).
 */
export function formatFeeNoticeCharge(charge: FeeNoticeCharge): string {
  if (charge.kind === "adjusted") {
    return charge.payableSessions > 0 ? `${formatNumber(charge.payableSessions)} buổi · số tiền đã điều chỉnh` : "Số tiền đã điều chỉnh";
  }
  if (charge.kind === "total") return `${formatNumber(charge.payableSessions)} buổi`;
  return charge.parts
    .map((part) =>
      part.kind === "opening_debit"
        ? `${formatNumber(part.sessions)} buổi nợ đầu kỳ × ${formatVnd(part.unitPriceVnd)}`
        : `${formatNumber(part.sessions)} buổi × ${formatVnd(part.unitPriceVnd)}`,
    )
    .join(" · ");
}

/** Opening balance in sessions: "−1 buổi (nợ)", "15 buổi", "0 buổi". */
export function formatFeeNoticeBalance(sessions: number): string {
  return sessions < 0 ? `−${formatNumber(-sessions)} buổi (nợ)` : `${formatNumber(sessions)} buổi`;
}

export interface FeeNoticeReplacementLink {
  originalItemId: string;
  replacementItemId: string;
}

/**
 * Per item: how many items replace it directly and, when it is superseded,
 * the chain's current item. Links come from both `reissued_from_item_id` and
 * `tuition_collection_item_adjustments`; either one alone marks an item
 * superseded. Chains (a replacement reissued again) are followed with a cycle
 * guard.
 */
export function resolveFeeNoticeEditions(
  itemIds: readonly string[],
  links: readonly FeeNoticeReplacementLink[],
): Map<string, { currentItemId: string | null; replacementCount: number }> {
  const children = new Map<string, Set<string>>();
  for (const link of links) {
    const set = children.get(link.originalItemId) ?? new Set<string>();
    set.add(link.replacementItemId);
    children.set(link.originalItemId, set);
  }

  const editions = new Map<string, { currentItemId: string | null; replacementCount: number }>();
  for (const id of itemIds) {
    const direct = children.get(id);
    if (!direct || direct.size === 0) {
      editions.set(id, { currentItemId: null, replacementCount: 0 });
      continue;
    }
    let current = id;
    const seen = new Set([id]);
    for (;;) {
      const next = [...(children.get(current) ?? [])].sort().find((candidate) => !seen.has(candidate));
      if (!next) break;
      seen.add(next);
      current = next;
    }
    editions.set(id, { currentItemId: current === id ? null : current, replacementCount: direct.size });
  }
  return editions;
}

function resolvePayment(
  item: FeeNoticeItemRow,
  superseded: boolean,
  balance: { openingBalanceSessions: number; scheduledSessions: number },
): FeeNoticePayment {
  if (superseded) return { kind: "superseded" };
  if (item.status === "no_payment") {
    return item.reissued_from_item_id
      ? { kind: "no_payment", reason: "adjusted" }
      : {
          kind: "no_payment",
          openingBalanceSessions: balance.openingBalanceSessions,
          reason: "balance",
          remainingSessions: balance.openingBalanceSessions - balance.scheduledSessions,
          scheduledSessions: balance.scheduledSessions,
        };
  }

  const contract = readRecord(item.payment_contract_snapshot);
  const transferCode = typeof contract.transfer_code === "string" ? contract.transfer_code : "";
  const payableVnd = readInteger(item.payable_amount_vnd);
  // The QR charges the contract amount: print it only when the contract and the
  // printed total agree and the notice still asks for payment.
  if (!transferCode.trim() || !(payableVnd > 0) || item.status !== "pending_payment" || Number(contract.amount_vnd) !== payableVnd) {
    return { kind: "unavailable" };
  }
  try {
    const details = buildLockedVietQrPaymentDetails({
      accountDisplayName: typeof contract.account_display_name === "string" ? contract.account_display_name : "",
      accountNumber: typeof contract.account_number === "string" ? contract.account_number : "",
      amountVnd: Number(contract.amount_vnd),
      bankCode: typeof contract.bank_code === "string" ? contract.bank_code : "",
      transferCode,
    });
    return {
      accountHolder: details.accountHolder ?? "",
      accountNumber: details.accountNumber,
      amountVnd: Number(contract.amount_vnd),
      bankCode: details.bankCode,
      imageUrl: details.imageUrl,
      kind: "qr",
      transferCode,
    };
  } catch {
    // A malformed historic contract is intentionally not replaced from current settings.
    return { kind: "unavailable" };
  }
}

/** One printable notice from a locked item, its lines, its period and its replacements. */
export function buildFeeNoticeModel({ edition, item, lines, period }: FeeNoticeModelInput): FeeNoticeModel {
  const student = readRecord(item.student_snapshot);
  const source = readRecord(item.source_snapshot);
  const contract = readRecord(item.payment_contract_snapshot);
  const periodName = period?.name ?? null;
  const template = resolveFeeNoticeTemplate(item.receipt_template_snapshot as FeeNoticeTemplateContent | null, periodName);
  const replacementCount = edition?.replacementCount ?? 0;
  const superseded = replacementCount > 0;
  const openingBalanceSessions = readInteger(item.opening_balance_sessions);
  const scheduledSessions = readInteger(item.scheduled_chargeable_sessions);
  const payableSessions = readInteger(item.payable_sessions);
  const parts = lines ? groupFeeNoticeLines(item.id, lines) : [];

  const charge: FeeNoticeCharge = item.reissued_from_item_id
    ? { kind: "adjusted", payableSessions }
    : parts.length > 0
      ? { kind: "lines", parts }
      : { kind: "total", payableSessions };

  return {
    announcement: template.announcement,
    centerName: template.centerName,
    charge,
    dueOn: period?.due_on ?? null,
    edition: {
      currentItemId: superseded ? (edition?.currentItemId ?? null) : null,
      replacement: item.reissued_from_item_id !== null,
      replacementCount,
      superseded,
    },
    footer: template.footer,
    itemId: item.id,
    openingBalanceSessions,
    payableAmountVnd: readInteger(item.payable_amount_vnd),
    payableSessions,
    payment: resolvePayment(item, superseded, { openingBalanceSessions, scheduledSessions }),
    periodId: item.period_id,
    periodName,
    requestCode: readText(contract, "public_code"),
    scheduledSessions,
    sourceName: readText(source, "name") ?? readText(source, "code"),
    student: {
      className: readText(student, "class_name"),
      fullName: readText(student, "full_name") ?? "Học sinh",
      grade: readInteger(student.current_grade),
      publicCode: readText(student, "public_code"),
    },
    title: template.title,
  };
}

/**
 * Staff label for the kind of notice ("Loại phiếu"), from what the sheet
 * prints. It is not a payment status: the loader never reads the payment
 * request, so a paid notice still reads "Có mã QR thanh toán".
 */
export function getFeeNoticeKindLabel(model: FeeNoticeModel): string {
  switch (model.payment.kind) {
    case "superseded":
      return "Đã được thay thế";
    case "no_payment":
      return "Không cần thanh toán";
    case "qr":
      return "Có mã QR thanh toán";
    default:
      return "Thiếu thông tin chuyển khoản";
  }
}

/** Edition badge on the notice page: tone + words, never colour alone. */
export function getFeeNoticeEditionBadge(edition: FeeNoticeEdition): { label: string; tone: "neutral" | "warning" } {
  if (edition.superseded) {
    return {
      label: `${edition.replacement ? "Bản thay thế cũ" : "Bản gốc"} · đã có ${edition.replacementCount} bản thay thế`,
      tone: "neutral",
    };
  }
  return edition.replacement ? { label: "Bản thay thế hiện hành", tone: "warning" } : { label: "Bản gốc", tone: "neutral" };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFeeNoticeItemId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** `?itemIds=a,b` (or repeated keys): valid uuids only, lower-cased, de-duplicated, in order. */
export function parseFeeNoticeItemIds(value: string | readonly string[] | null | undefined): string[] {
  const raw = (typeof value === "string" ? [value] : (value ?? [])).flatMap((entry) => entry.split(","));
  return [...new Set(raw.map((entry) => entry.trim().toLowerCase()).filter(isFeeNoticeItemId))];
}

/** Bulk print order: grade (unknown grade last), then full name (vi). */
export function sortFeeNoticesForPrint(notices: readonly FeeNoticeModel[]): FeeNoticeModel[] {
  const gradeKey = (grade: number) => (grade > 0 ? grade : Number.POSITIVE_INFINITY);
  return [...notices].sort(
    (a, b) => gradeKey(a.student.grade) - gradeKey(b.student.grade) || a.student.fullName.localeCompare(b.student.fullName, "vi"),
  );
}

/**
 * A payable sample notice for the template preview: the given template
 * content (blank fields fall back like a real notice) on a fixed sample
 * student with two rates and one opening-debit session, and a placeholder QR.
 * The account and transfer code are visibly fake.
 */
export function buildSampleFeeNoticeModel(templateContent: FeeNoticeTemplateContent): FeeNoticeModel {
  const itemId = "00000000-0000-4000-8000-000000000001";
  const transferCode = "NGUYEN MINH ANH 2011 0900000000 PAY-261101-0000SAMPLE00";
  const lines: FeeNoticeLineRow[] = [
    ...Array.from({ length: 12 }, (_, index) => ({
      class_session_id: `sample-a-${String(index).padStart(2, "0")}`,
      item_id: itemId,
      line_kind: "session",
      payable_session_count: 1,
      session_date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      unit_price_vnd: 200_000,
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      class_session_id: `sample-b-${String(index).padStart(2, "0")}`,
      item_id: itemId,
      line_kind: "session",
      payable_session_count: 1,
      session_date: `2026-11-${String(index + 15).padStart(2, "0")}`,
      unit_price_vnd: 250_000,
    })),
    { class_session_id: null, item_id: itemId, line_kind: "opening_debit", payable_session_count: 1, session_date: null, unit_price_vnd: 200_000 },
  ];
  const model = buildFeeNoticeModel({
    item: {
      id: itemId,
      opening_balance_sessions: -1,
      payable_amount_vnd: 4_600_000,
      payable_sessions: 21,
      payment_contract_snapshot: {
        account_display_name: "TEN TAI KHOAN MAU",
        account_number: "0000000000",
        amount_vnd: 4_600_000,
        bank_code: "MB",
        public_code: "PAY-261101-0000SAMPLE00",
        transfer_code: transferCode,
      },
      period_id: "sample-period",
      receipt_template_snapshot: templateContent,
      reissued_from_item_id: null,
      scheduled_chargeable_sessions: 20,
      source_snapshot: { name: "Đến trực tiếp trung tâm" },
      status: "pending_payment",
      student_snapshot: { class_name: "Toán 9A tối 2-4-6", current_grade: 9, full_name: "Nguyễn Minh Anh", public_code: "TTV-00123" },
    },
    lines,
    period: { due_on: "2026-11-15", id: "sample-period", name: "Học phí tháng 11/2026" },
  });
  return model.payment.kind === "qr" ? { ...model, payment: { ...model.payment, imageUrl: FEE_NOTICE_PLACEHOLDER_QR } } : model;
}
