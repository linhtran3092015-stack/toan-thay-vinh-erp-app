import type {
  FinanceOrderFiltersState,
  FinanceOrderReadModel,
  FinanceOrderSettlementReadModel,
  FinanceOrdersDashboardReadModel,
} from "@/features/finance/read-models";
import { toVietnamDate } from "@/lib/datetime";

import { sessionPreviewToday } from "./session-fixtures";

/**
 * Finance order fixtures for /dev/lists?view=finance-orders. One order = one
 * tuition receipt matched to a SePay transfer (a split transfer gives two
 * orders with the same bank id). Clock: `sessionPreviewToday` (16/10/2026,
 * noon in Vietnam), so the default month is 10/2026 (24 orders: more than one
 * page) and 09/2026 holds 4 more. Covers MMA, SB, SB F1, a named non-partner
 * source and an unresolved source; Tuyển mới, Tái phí and an unknown purpose;
 * configured and unconfigured costs; checked rows (with `checkedAt`) and
 * unchecked ones; all three settlement periods; a guardian without phone, a
 * student without guardian or class, an order without Sale; and two Vietnam-day
 * boundaries (UTC 10/10 17:30 = 11/10 in Vietnam → Đợt 2; UTC 30/09 18:00 =
 * 01/10 in Vietnam → month 10). Costs and periods follow the SQL rules
 * (`get_finance_order_operating_cost`, `get_finance_order_settlement_period`).
 */

/** Noon of `sessionPreviewToday` in Vietnam: the clock `parseFinanceOrdersFilters` gets in the preview. */
export const financeOrderPreviewNow = new Date(`${sessionPreviewToday}T05:00:00.000Z`);

/** The accountant who ticked the checked rows (`checked_by` is only a profile id; no name is read). */
const REVIEWER_ID = "a1000000-0000-4000-8000-000000000003";

type SourceKey = "mma" | "sb" | "sb_f1" | "walk_in" | "unknown";
type OrderType = FinanceOrderReadModel["orderType"];

const sourceFields: Record<
  SourceKey,
  Pick<FinanceOrderReadModel, "leadSourceCode" | "leadSourceName" | "sourceCode" | "sourceLabel">
> = {
  mma: { leadSourceCode: "mma_facebook", leadSourceName: "Facebook MMA", sourceCode: "mma", sourceLabel: "MMA" },
  sb: { leadSourceCode: "sandbox_partner", leadSourceName: "Đối tác Sandbox", sourceCode: "sb", sourceLabel: "SB" },
  sb_f1: { leadSourceCode: "sb_f1", leadSourceName: "CTV F1", sourceCode: "sb_f1", sourceLabel: "SB F1" },
  unknown: { leadSourceCode: null, leadSourceName: null, sourceCode: null, sourceLabel: null },
  walk_in: { leadSourceCode: "walk_in", leadSourceName: "Đến trực tiếp trung tâm", sourceCode: null, sourceLabel: null },
};

const classes = {
  "10nc": { classCode: "L-10NC26", className: "Toán 10 nâng cao tối 2-6" },
  "7bo": { classCode: "L-7BO26", className: "Toán 7B online tối 3-5" },
  "8b": { classCode: "L-8B26", className: "Toán 8B chiều 3-5-7" },
  "9a": { classCode: "L-9A26", className: "Toán 9A tối 2-4-6" },
  none: { classCode: null, className: null },
} as const;

interface StudentFixture {
  ascii: string;
  class: keyof typeof classes;
  code: string;
  guardian: string | null;
  name: string;
  phone: string | null;
}

const students = {
  an: { ascii: "Nguyen Minh An", class: "9a", code: "HV0012", guardian: "Nguyễn Thị Mai", name: "Nguyễn Minh An", phone: "0901234567" },
  anh: { ascii: "Pham Minh Anh", class: "7bo", code: "HV0053", guardian: "Phạm Văn Long", name: "Phạm Minh Anh", phone: "0934567890" },
  bao: { ascii: "Tran Gia Bao", class: "8b", code: "HV0031", guardian: "Trần Văn Hùng", name: "Trần Gia Bảo", phone: "0912345678" },
  chi: { ascii: "Le Khanh Chi", class: "10nc", code: "HV0045", guardian: "Lê Thị Hoa", name: "Lê Khánh Chi", phone: "0987654321" },
  duy: { ascii: "Pham Duc Duy", class: "7bo", code: "HV0052", guardian: "Phạm Văn Long", name: "Phạm Đức Duy", phone: "0934567890" },
  ha: { ascii: "Vo Ngoc Ha", class: "9a", code: "HV0067", guardian: "Võ Thị Lan", name: "Võ Ngọc Hà", phone: null },
  khoa: { ascii: "Dang Minh Khoa", class: "none", code: "HV0071", guardian: null, name: "Đặng Minh Khoa", phone: null },
  linh: { ascii: "Ton Nu Khanh Linh", class: "8b", code: "HV0080", guardian: "Tôn Thất Bình", name: "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh", phone: "0909876543" },
  minh: { ascii: "Bui Quang Minh", class: "10nc", code: "HV0093", guardian: "Bùi Thị Ngọc", name: "Bùi Quang Minh", phone: "0976543210" },
  nhi: { ascii: "Hoang Yen Nhi", class: "7bo", code: "HV0104", guardian: "Hoàng Văn Tâm", name: "Hoàng Yến Nhi", phone: "0965432109" },
  phuc: { ascii: "Do Hoang Phuc", class: "9a", code: "HV0118", guardian: "Đỗ Thị Thu", name: "Đỗ Hoàng Phúc", phone: "0954321098" },
  quan: { ascii: "Ngo Minh Quan", class: "8b", code: "HV0125", guardian: "Ngô Thị Hạnh", name: "Ngô Minh Quân", phone: "0943210987" },
  tam: { ascii: "Ly Thanh Tam", class: "10nc", code: "HV0139", guardian: "Lý Văn Đức", name: "Lý Thanh Tâm", phone: "0932109876" },
  uyen: { ascii: "Mai Phuong Uyen", class: "9a", code: "HV0146", guardian: "Mai Thị Thanh", name: "Mai Phương Uyên", phone: "0921098765" },
  vy: { ascii: "Trinh Tuong Vy", class: "7bo", code: "HV0150", guardian: "Trịnh Văn Nam", name: "Trịnh Tường Vy", phone: "0910987654" },
} satisfies Record<string, StudentFixture>;

type StudentKey = keyof typeof students;

const sales = {
  chau: { id: "b1000000-0000-4000-8000-000000000002", name: "Lê Minh Châu" },
  hai: { id: "b1000000-0000-4000-8000-000000000001", name: "Trần Hải" },
  tuan: { id: "b1000000-0000-4000-8000-000000000003", name: "Nguyễn Anh Tuấn" },
} as const;

interface OrderRow {
  /** Bank time, UTC ISO. */
  at: string;
  bank: string;
  checkedAt?: string;
  /** Cashflow reference: a request code on auto match, `ALLOC-…` on manual allocation, a split code otherwise. */
  ref: string;
  sale: keyof typeof sales | null;
  source: SourceKey;
  student: StudentKey;
  /** Transfer content when it is not "TTVC {ref} {ascii name}". */
  transfer?: string;
  tuition: number;
  type: OrderType;
}

/** Newest first, like the RPC (`transaction_at desc`). Comments give the Vietnam time. */
const rows: OrderRow[] = [
  // 16/10 10:42
  { at: "2026-10-16T03:42:00.000Z", bank: "FT26289104211", ref: "PAY-261016-0042", sale: "hai", source: "sb", student: "an", tuition: 2_800_000, type: "renewal" },
  // 16/10 09:15
  { at: "2026-10-16T02:15:00.000Z", bank: "FT26289091577", ref: "PAY-261015-0039", sale: "chau", source: "mma", student: "bao", tuition: 2_100_000, type: "renewal" },
  // 15/10 20:05
  { at: "2026-10-15T13:05:00.000Z", bank: "FT26288200533", ref: "PAY-261015-0037", sale: "hai", source: "sb", student: "chi", tuition: 3_600_000, type: "new_enrollment" },
  // 15/10 16:30: one transfer for two siblings, split into two orders with the same bank id.
  { at: "2026-10-15T09:30:00.000Z", bank: "FT26288163001", ref: "SPLIT-261015-01", sale: "tuan", source: "sb", student: "duy", transfer: "TTVC Pham Duc Duy Pham Minh Anh", tuition: 1_400_000, type: "renewal" },
  { at: "2026-10-15T09:30:00.000Z", bank: "FT26288163001", checkedAt: "2026-10-16T01:20:00.000Z", ref: "SPLIT-261015-02", sale: "tuan", source: "sb", student: "anh", transfer: "TTVC Pham Duc Duy Pham Minh Anh", tuition: 1_400_000, type: "renewal" },
  // 14/10 19:48: SB F1 has no configured policy.
  { at: "2026-10-14T12:48:00.000Z", bank: "FT26287194802", ref: "PAY-261013-0031", sale: "hai", source: "sb_f1", student: "ha", tuition: 2_800_000, type: "renewal" },
  // 14/10 08:10: MMA Tuyển mới has no configured policy either.
  { at: "2026-10-14T01:10:00.000Z", bank: "FT26287081044", ref: "PAY-261013-0029", sale: "chau", source: "mma", student: "linh", tuition: 3_600_000, type: "new_enrollment" },
  // 13/10 21:22: a walk-in, no Sale (no CRM conversion).
  { at: "2026-10-13T14:22:00.000Z", bank: "FT26286212290", ref: "ALLOC-7f3c9e20-1b4d-4c55-9a51-3f0e6c2b8d41", sale: null, source: "walk_in", student: "khoa", transfer: "chuyen tien hoc phi con Khoa", tuition: 3_200_000, type: "new_enrollment" },
  // 13/10 11:05
  { at: "2026-10-13T04:05:00.000Z", bank: "FT26286110518", checkedAt: "2026-10-14T02:00:00.000Z", ref: "PAY-261012-0024", sale: "hai", source: "sb", student: "minh", tuition: 4_200_000, type: "renewal" },
  // 12/10 18:40: the receiving account's purpose is unknown.
  { at: "2026-10-12T11:40:00.000Z", bank: "FT26285184066", ref: "PAY-261012-0022", sale: "tuan", source: "sb", student: "nhi", tuition: 2_800_000, type: "unknown" },
  // 11/10 00:30 in Vietnam (still 10/10 in UTC): Đợt 2.
  { at: "2026-10-10T17:30:00.000Z", bank: "FT26284003012", checkedAt: "2026-10-12T03:10:00.000Z", ref: "PAY-261010-0019", sale: "chau", source: "mma", student: "phuc", tuition: 2_100_000, type: "renewal" },
  // 10/10 15:20
  { at: "2026-10-10T08:20:00.000Z", bank: "FT26283152077", checkedAt: "2026-10-11T02:30:00.000Z", ref: "PAY-261009-0017", sale: "hai", source: "sb", student: "quan", tuition: 3_600_000, type: "new_enrollment" },
  // 09/10 20:00
  { at: "2026-10-09T13:00:00.000Z", bank: "FT26282200019", checkedAt: "2026-10-10T01:45:00.000Z", ref: "PAY-261009-0015", sale: "chau", source: "mma", student: "tam", tuition: 2_800_000, type: "renewal" },
  // 09/10 10:12
  { at: "2026-10-09T03:12:00.000Z", bank: "FT26282101233", ref: "PAY-261008-0013", sale: "hai", source: "sb", student: "uyen", tuition: 2_800_000, type: "renewal" },
  // 08/10 19:35: no source resolved.
  { at: "2026-10-08T12:35:00.000Z", bank: "FT26281193540", ref: "PAY-261008-0012", sale: null, source: "unknown", student: "vy", tuition: 2_800_000, type: "renewal" },
  // 07/10 14:00
  { at: "2026-10-07T07:00:00.000Z", bank: "FT26280140005", checkedAt: "2026-10-08T02:15:00.000Z", ref: "PAY-261006-0010", sale: "tuan", source: "sb", student: "an", tuition: 1_400_000, type: "renewal" },
  // 06/10 21:10
  { at: "2026-10-06T14:10:00.000Z", bank: "FT26279211017", checkedAt: "2026-10-07T01:30:00.000Z", ref: "PAY-261006-0009", sale: "chau", source: "mma", student: "bao", tuition: 2_100_000, type: "renewal" },
  // 05/10 09:45
  { at: "2026-10-05T02:45:00.000Z", bank: "FT26278094522", checkedAt: "2026-10-06T03:05:00.000Z", ref: "PAY-261004-0007", sale: "hai", source: "sb", student: "chi", tuition: 3_600_000, type: "new_enrollment" },
  // 04/10 18:25: checked although the cost is unconfigured (the tick says nothing about the policy).
  { at: "2026-10-04T11:25:00.000Z", bank: "FT26277182540", checkedAt: "2026-10-05T02:40:00.000Z", ref: "PAY-261004-0006", sale: "hai", source: "sb_f1", student: "duy", tuition: 3_600_000, type: "new_enrollment" },
  // 03/10 08:30
  { at: "2026-10-03T01:30:00.000Z", bank: "FT26276083011", ref: "PAY-261002-0004", sale: "chau", source: "mma", student: "ha", tuition: 2_800_000, type: "renewal" },
  // 02/10 20:50
  { at: "2026-10-02T13:50:00.000Z", bank: "FT26275205033", checkedAt: "2026-10-03T02:00:00.000Z", ref: "PAY-261002-0003", sale: "tuan", source: "sb", student: "linh", tuition: 2_800_000, type: "renewal" },
  // 02/10 10:00
  { at: "2026-10-02T03:00:00.000Z", bank: "FT26275100044", ref: "PAY-261001-0002", sale: "chau", source: "mma", student: "minh", tuition: 3_200_000, type: "new_enrollment" },
  // 01/10 19:15
  { at: "2026-10-01T12:15:00.000Z", bank: "FT26274191566", checkedAt: "2026-10-02T01:50:00.000Z", ref: "PAY-260930-0048", sale: "hai", source: "sb", student: "nhi", tuition: 2_800_000, type: "renewal" },
  // 01/10 01:00 in Vietnam (still 30/09 in UTC): month 10, Đợt 1.
  { at: "2026-09-30T18:00:00.000Z", bank: "FT26273010077", ref: "PAY-260930-0047", sale: "tuan", source: "sb", student: "phuc", tuition: 2_100_000, type: "renewal" },
  // September: one order per period, so Đợt 3 has data (October stops at the preview clock, 16/10).
  // 28/09 19:00
  { at: "2026-09-28T12:00:00.000Z", bank: "FT26271190020", checkedAt: "2026-09-29T02:00:00.000Z", ref: "PAY-260927-0041", sale: "hai", source: "sb", student: "quan", tuition: 2_800_000, type: "renewal" },
  // 22/09 10:00
  { at: "2026-09-22T03:00:00.000Z", bank: "FT26265100031", checkedAt: "2026-09-23T03:20:00.000Z", ref: "PAY-260921-0036", sale: "chau", source: "mma", student: "tam", tuition: 2_100_000, type: "renewal" },
  // 15/09 20:30
  { at: "2026-09-15T13:30:00.000Z", bank: "FT26258203045", checkedAt: "2026-09-16T02:10:00.000Z", ref: "PAY-260915-0028", sale: "hai", source: "sb", student: "uyen", tuition: 3_600_000, type: "new_enrollment" },
  // 05/09 09:00
  { at: "2026-09-05T02:00:00.000Z", bank: "FT26248090058", ref: "PAY-260904-0011", sale: "tuan", source: "sb_f1", student: "vy", tuition: 2_800_000, type: "renewal" },
];

/** `get_finance_order_operating_cost`: NULL (never 0) where no policy exists; integer division rounds down. */
function operatingCost(
  type: OrderType,
  source: SourceKey,
  tuition: number,
): Pick<FinanceOrderReadModel, "mechanismCode" | "operatingCostStatus" | "operatingCostVnd"> {
  const unconfigured = { mechanismCode: "unconfigured", operatingCostStatus: "unconfigured", operatingCostVnd: null } as const;
  if (tuition <= 0 || source === "sb_f1") return unconfigured;
  if (type === "renewal" && source === "sb") {
    return { mechanismCode: "renewal_sb_20_percent", operatingCostStatus: "configured", operatingCostVnd: Math.trunc((tuition * 20) / 100) };
  }
  if (type === "renewal" && source === "mma") {
    return { mechanismCode: "renewal_mma_zero", operatingCostStatus: "configured", operatingCostVnd: 0 };
  }
  if (type === "new_enrollment" && source === "sb") {
    return {
      mechanismCode: "new_enrollment_sb_fixed_plus_25_percent",
      operatingCostStatus: "configured",
      operatingCostVnd: 700_000 + Math.trunc((tuition * 25) / 100),
    };
  }
  return unconfigured;
}

/** `get_finance_order_settlement_period`: the Vietnam bank day. */
export function getFinanceOrderPreviewPeriod(at: string): 1 | 2 | 3 {
  const day = Number(toVietnamDate(at).slice(8, 10));
  return day <= 10 ? 1 : day <= 20 ? 2 : 3;
}

const id = (prefix: string, index: number) => `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

export const financeOrderPreviewOrders: readonly FinanceOrderReadModel[] = rows.map((row, index) => {
  const student = students[row.student];
  const sale = row.sale ? sales[row.sale] : null;

  return {
    bankTransactionId: row.bank,
    checkedAt: row.checkedAt ?? null,
    checkedBy: row.checkedAt ? REVIEWER_ID : null,
    ...classes[student.class],
    guardianFullName: student.guardian,
    guardianPhone: student.phone,
    isChecked: Boolean(row.checkedAt),
    ...sourceFields[row.source],
    ...operatingCost(row.type, row.source, row.tuition),
    orderType: row.type,
    referenceCode: row.ref,
    saleOwnerFullName: sale?.name ?? null,
    saleOwnerId: sale?.id ?? null,
    sepayTransactionId: id("d4000000", index),
    settlementPeriod: getFinanceOrderPreviewPeriod(row.at),
    sourceCashflowRecordId: id("c3000000", index),
    studentFullName: student.name,
    studentId: id("e5000000", Object.keys(students).indexOf(row.student)),
    studentPublicCode: student.code,
    transactionAt: row.at,
    transferContent: row.transfer ?? `TTVC ${row.ref} ${student.ascii}`,
    tuitionAmountVnd: row.tuition,
  };
});

function aggregate(orders: readonly FinanceOrderReadModel[]) {
  const checkedCount = orders.filter((order) => order.isChecked).length;
  return {
    checkedCount,
    operatingCostVnd: orders.reduce((sum, order) => sum + (order.operatingCostVnd ?? 0), 0),
    tuitionAmountVnd: orders.reduce((sum, order) => sum + order.tuitionAmountVnd, 0),
    uncheckedCount: orders.length - checkedCount,
    unconfiguredCount: orders.filter((order) => order.operatingCostStatus === "unconfigured").length,
  };
}

/**
 * Pure stand-in for `get_finance_orders_dashboard(p_month, p_order_type,
 * p_source, p_period)` (migration 20261014100000): the Vietnam month of the
 * bank time, then type / source / period; `summary` over the filtered rows;
 * `settlement` over the filtered **SB** rows, one entry per period that has
 * rows; `settlementEligible` false for an MMA or SB F1 source filter; orders
 * `transaction_at desc, source_cashflow_record_id desc`.
 */
export function runFinanceOrdersPreviewRpc(
  orders: readonly FinanceOrderReadModel[],
  filters: FinanceOrderFiltersState,
): FinanceOrdersDashboardReadModel {
  const filtered = orders
    .filter((order) => toVietnamDate(order.transactionAt).slice(0, 7) === filters.month)
    .filter((order) => !filters.orderType || order.orderType === filters.orderType)
    .filter((order) => !filters.source || order.sourceCode === filters.source)
    .filter((order) => !filters.period || order.settlementPeriod === Number(filters.period))
    .sort(
      (a, b) =>
        b.transactionAt.localeCompare(a.transactionAt) || b.sourceCashflowRecordId.localeCompare(a.sourceCashflowRecordId),
    );

  const settlement: FinanceOrderSettlementReadModel[] = [];
  for (const period of [1, 2, 3] as const) {
    const sb = filtered.filter((order) => order.sourceCode === "sb" && order.settlementPeriod === period);
    if (sb.length === 0) continue;
    settlement.push({
      ...aggregate(sb),
      newEnrollmentCount: sb.filter((order) => order.orderType === "new_enrollment").length,
      period,
      renewalCount: sb.filter((order) => order.orderType === "renewal").length,
    });
  }

  return {
    month: `${filters.month}-01`,
    orders: filtered,
    settlement,
    settlementEligible: filters.source !== "mma" && filters.source !== "sb_f1",
    summary: { ...aggregate(filtered), orderCount: filtered.length },
  };
}
