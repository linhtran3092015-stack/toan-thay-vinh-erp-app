import type { SalesCommissionAccrualDashboardEntry } from "@/features/commissions/read-models";

/** The sale the own-scope preview (no commissions.manage) stands for. */
export const commissionPreviewOwnSaleId = "sale-1";

const sales = [
  [commissionPreviewOwnSaleId, "Lê Thu Trang", "NS-014"],
  ["sale-2", "Phạm Quốc Huy", "NS-021"],
  // No employee code yet: the Sale cell shows the name alone.
  ["sale-3", "Đỗ Minh Châu", null],
] as const;

// Seed lead-source codes (crm_lead_sources) plus one group the app does not support.
const sources = [
  ["mma_fanpage", "MMA Fanpage", "mma"],
  ["mma_zalo", "MMA Zalo OA", "mma"],
  ["mma_website", "MMA Website", "mma"],
  ["sandbox_partner", "Sandbox đối tác", "sandbox"],
  ["other_event", "Hội thảo phụ huynh", "other"],
] as const;

const students = [
  ["TTV-00100", "Nguyễn Minh Anh"],
  ["TTV-00107", "Trần Gia Bảo"],
  ["TTV-00114", "Lê Hoàng Nam"],
  ["TTV-00121", "Phạm Thu Hà"],
  ["TTV-00128", "Vũ Đức Huy"],
  ["TTV-00135", "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh"],
  ["TTV-00142", "Bùi Quang Minh"],
  ["TTV-00149", "Hoàng Ngọc Mai"],
] as const;

// [recognized on (Vietnam date), recognized at (UTC), revenue, sale, source, student, status]
// Server order: recognized_on desc, recognized_at desc. Aug–Oct 2026, 28 rows (two pages).
const accrualRows: Array<[string, string, number, number, number, number, string?]> = [
  ["2026-10-15", "2026-10-15T07:40:00Z", 2_400_000, 0, 0, 0],
  ["2026-10-15", "2026-10-15T02:10:00Z", 1_800_000, 1, 3, 1],
  ["2026-10-14", "2026-10-14T09:05:00Z", 3_600_000, 2, 1, 2],
  ["2026-10-12", "2026-10-12T03:30:00Z", 2_400_000, 0, 2, 3],
  // A status the app does not know yet: "Trạng thái chưa hỗ trợ: approved".
  ["2026-10-10", "2026-10-10T08:15:00Z", 1_200_000, 1, 0, 4, "approved"],
  ["2026-10-09", "2026-10-09T04:00:00Z", 2_400_000, 0, 1, 5],
  ["2026-10-07", "2026-10-07T10:20:00Z", 1_800_000, 2, 3, 6],
  // A group the app does not support: "Nguồn chưa hỗ trợ: other".
  ["2026-10-05", "2026-10-05T01:45:00Z", 600_000, 0, 4, 7],
  ["2026-10-03", "2026-10-03T06:10:00Z", 2_400_000, 1, 2, 0],
  // 00:20 on 1 Oct in Vietnam: an October row although the UTC date is 30 Sep.
  ["2026-10-01", "2026-09-30T17:20:00Z", 3_600_000, 0, 0, 1],
  ["2026-09-28", "2026-09-28T08:00:00Z", 2_400_000, 2, 1, 2],
  ["2026-09-26", "2026-09-26T02:30:00Z", 1_800_000, 1, 3, 3],
  ["2026-09-24", "2026-09-24T09:45:00Z", 2_400_000, 0, 2, 4],
  ["2026-09-22", "2026-09-22T03:00:00Z", 1_200_000, 1, 0, 5],
  ["2026-09-19", "2026-09-19T07:30:00Z", 3_600_000, 0, 1, 6],
  ["2026-09-16", "2026-09-16T05:10:00Z", 2_400_000, 2, 3, 7],
  ["2026-09-12", "2026-09-12T02:40:00Z", 1_800_000, 0, 2, 0],
  ["2026-09-09", "2026-09-09T08:25:00Z", 2_400_000, 1, 0, 1],
  ["2026-09-05", "2026-09-05T04:50:00Z", 1_200_000, 2, 1, 2],
  ["2026-09-02", "2026-09-02T01:15:00Z", 2_400_000, 0, 3, 3],
  ["2026-08-29", "2026-08-29T09:00:00Z", 1_800_000, 1, 2, 4],
  ["2026-08-25", "2026-08-25T03:20:00Z", 2_400_000, 0, 0, 5],
  ["2026-08-21", "2026-08-21T07:05:00Z", 3_600_000, 2, 1, 6],
  ["2026-08-18", "2026-08-18T02:00:00Z", 1_200_000, 1, 3, 7],
  ["2026-08-14", "2026-08-14T08:35:00Z", 2_400_000, 0, 2, 0],
  ["2026-08-10", "2026-08-10T04:15:00Z", 1_800_000, 2, 0, 1],
  ["2026-08-06", "2026-08-06T06:40:00Z", 2_400_000, 1, 1, 2],
  // The oldest loaded row: in the capped state August starts before it, so August may be cut.
  ["2026-08-03", "2026-08-03T03:10:00Z", 1_200_000, 0, 3, 3],
];

export const commissionEntries: SalesCommissionAccrualDashboardEntry[] = accrualRows.map(
  ([recognizedOn, recognizedAt, revenue, saleIndex, sourceIndex, studentIndex, status], index) => {
    const [saleOwnerId, saleOwnerDisplayName, saleOwnerEmployeeCode] = sales[saleIndex];
    const [leadSourceCode, leadSourceName, leadSourceGroup] = sources[sourceIndex];
    const [studentPublicCode, studentFullName] = students[studentIndex];

    return {
      id: `accrual-${index}`,
      leadSourceCode,
      leadSourceGroup,
      leadSourceName,
      recognizedAt,
      recognizedOn,
      recognizedRevenueVnd: revenue,
      saleOwnerDisplayName,
      saleOwnerEmployeeCode,
      saleOwnerId,
      sourceCashflowRecordId: `cashflow-${index}`,
      status: status ?? "provisional",
      studentFullName,
      studentId: `student-${studentIndex}`,
      studentPublicCode,
    };
  },
);

/** Without commissions.manage the RPC returns only the viewer's own rows. */
export const ownCommissionEntries = commissionEntries.filter(
  (entry) => entry.saleOwnerId === commissionPreviewOwnSaleId,
);
