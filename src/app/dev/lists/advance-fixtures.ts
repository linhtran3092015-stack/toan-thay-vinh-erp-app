import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";

/**
 * Salary advance fixtures for /dev/lists?view=advances. Server order
 * (requested_at desc), Vietnam clock `sessionPreviewToday` (16/10/2026). Every
 * status appears, plus an unsupported raw status, a deducted row with its
 * payroll period, rejections with a reason (at review and after review), long
 * reasons and names, a null employee code, a request from a previous year,
 * and own pending rows for the owner and the accountant.
 */

export const advancePreviewPeople = {
  accountant: { code: "NS-003", id: "a1000000-0000-4000-8000-000000000003", name: "Lê Thu Hằng" },
  owner: { code: "NS-001", id: "a1000000-0000-4000-8000-000000000001", name: "Nguyễn Văn Vinh" },
  ta: { code: "NS-021", id: "a1000000-0000-4000-8000-000000000021", name: "Trần Thu Hà" },
} as const;

const staff = {
  bao: { code: null, id: "a1000000-0000-4000-8000-000000000030", name: "Phạm Quốc Bảo" },
  duc: { code: "NS-014", id: "a1000000-0000-4000-8000-000000000014", name: "Vũ Minh Đức" },
  khoi: { code: "NS-012", id: "a1000000-0000-4000-8000-000000000012", name: "Hoàng Minh Khôi" },
  linh: { code: "NS-018", id: "a1000000-0000-4000-8000-000000000018", name: "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh" },
  ngoc: { code: "NS-011", id: "a1000000-0000-4000-8000-000000000011", name: "Lê Bích Ngọc" },
  thao: { code: "NS-009", id: "a1000000-0000-4000-8000-000000000009", name: "Đặng Phương Thảo" },
  tung: { code: "NS-007", id: "a1000000-0000-4000-8000-000000000007", name: "Trần Thanh Tùng" },
  ...advancePreviewPeople,
} as const;

type StaffKey = keyof typeof staff;

const REVIEWER = advancePreviewPeople.accountant.name;
const APPROVER = advancePreviewPeople.owner.name;

/** Payroll periods the deducted rows were calculated in (anchors on /payroll). */
const PERIOD_SEPTEMBER = "b2000000-0000-4000-8000-000000202609";
const PERIOD_AUGUST = "b2000000-0000-4000-8000-000000202608";
const PERIOD_JANUARY = "b2000000-0000-4000-8000-000000202601";

interface AdvanceRow {
  amount: number;
  approvalNote?: string;
  approvedAt?: string;
  deductedAt?: string;
  month: string;
  note: string;
  periodId?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  requestedAt: string;
  reviewNote?: string;
  reviewedAt?: string;
  staff: StaffKey;
  status: string;
}

const rows: AdvanceRow[] = [
  { amount: 3_000_000, month: "2026-10", note: "Đóng học phí cho con đầu tháng", requestedAt: "2026-10-16T02:40:00Z", staff: "tung", status: "requested" },
  // The owner's own request: neither review nor approval may be the owner's.
  { amount: 5_000_000, month: "2026-10", note: "Ứng trước tiền thuê mặt bằng cơ sở 2", requestedAt: "2026-10-15T09:10:00Z", staff: "owner", status: "requested" },
  { amount: 2_000_000, month: "2026-10", note: "Chi phí y tế", requestedAt: "2026-10-11T03:00:00Z", staff: "ngoc", status: "requested" },
  { amount: 1_500_000, month: "2026-11", note: "Sửa laptop để dạy lớp trực tuyến", requestedAt: "2026-10-10T12:00:00Z", staff: "ta", status: "requested" },
  // The accountant's own request: only another reviewer may take it.
  { amount: 2_500_000, month: "2026-10", note: "Đóng tiền nhà tháng 10", requestedAt: "2026-10-10T01:00:00Z", staff: "accountant", status: "requested" },
  { amount: 2_000_000, month: "2026-10", note: "Việc gia đình", requestedAt: "2026-10-09T02:00:00Z", reviewNote: "Đủ chứng từ, chuyển chủ duyệt", reviewedAt: "2026-10-10T03:15:00Z", staff: "thao", status: "review" },
  { amount: 1_000_000, month: "2026-10", note: "Mua sách tham khảo cho lớp 9", requestedAt: "2026-10-08T04:30:00Z", reviewedAt: "2026-10-09T08:00:00Z", staff: "ta", status: "review" },
  {
    amount: 4_000_000,
    month: "2026-10",
    note: "Tạm ứng để thanh toán chi phí in tài liệu ôn thi học kỳ I cho ba lớp 9 (đã có báo giá kèm theo, cần chuyển khoản trước ngày 20/10 để nhà in giữ lịch in)",
    requestedAt: "2026-10-07T07:20:00Z",
    reviewNote: "Đã đối chiếu báo giá nhà in.",
    reviewedAt: "2026-10-08T02:00:00Z",
    staff: "bao",
    status: "review",
  },
  { amount: 1_000_000, approvedAt: "2026-10-05T09:00:00Z", month: "2026-10", note: "Tiền viện phí cho mẹ", requestedAt: "2026-10-04T01:00:00Z", reviewedAt: "2026-10-04T08:00:00Z", staff: "tung", status: "approved" },
  { amount: 4_000_000, approvalNote: "Đồng ý, trừ lương kỳ 10.", approvedAt: "2026-10-03T08:00:00Z", month: "2026-10", note: "Sửa xe", requestedAt: "2026-10-01T02:00:00Z", reviewedAt: "2026-10-02T03:00:00Z", staff: "duc", status: "approved" },
  { amount: 800_000, approvedAt: "2026-10-02T10:00:00Z", month: "2026-10", note: "Đóng học phí cao học", requestedAt: "2026-09-30T23:30:00Z", reviewedAt: "2026-10-01T04:00:00Z", staff: "ta", status: "approved" },
  { amount: 1_200_000, approvedAt: "2026-10-01T09:30:00Z", month: "2026-11", note: "Chi phí đi lại tháng 11", requestedAt: "2026-09-29T03:00:00Z", reviewedAt: "2026-09-30T02:00:00Z", staff: "linh", status: "approved" },
  // Rejected at review (no reviewed_* fields).
  { amount: 6_000_000, month: "2026-10", note: "Mua điện thoại mới", rejectedAt: "2026-10-02T04:00:00Z", rejectedBy: REVIEWER, rejectionReason: "Số tiền lớn hơn mức có thể trừ trong một kỳ, đề nghị chia làm hai lần.", requestedAt: "2026-09-28T02:00:00Z", staff: "khoi", status: "rejected" },
  // Rejected by the owner after review (reviewed_* kept).
  { amount: 3_000_000, month: "2026-10", note: "Ứng thêm cho chuyến công tác", rejectedAt: "2026-09-29T08:00:00Z", rejectedBy: APPROVER, rejectionReason: "Đã có khoản tạm ứng khác trong kỳ này.", requestedAt: "2026-09-26T03:00:00Z", reviewedAt: "2026-09-27T02:00:00Z", staff: "ta", status: "rejected" },
  // A raw status this client does not know.
  { amount: 500_000, month: "2026-09", note: "Tạm ứng thử nghiệm của hệ thống cũ", requestedAt: "2026-09-20T02:00:00Z", staff: "thao", status: "cancelled_by_migration" },
  { amount: 2_000_000, approvedAt: "2026-09-07T03:00:00Z", deductedAt: "2026-10-05T03:00:00Z", month: "2026-09", note: "Tiền đặt cọc phòng trọ", periodId: PERIOD_SEPTEMBER, requestedAt: "2026-09-05T02:00:00Z", reviewedAt: "2026-09-06T02:00:00Z", staff: "tung", status: "deducted" },
  { amount: 1_000_000, approvedAt: "2026-09-04T03:00:00Z", deductedAt: "2026-10-05T03:00:00Z", month: "2026-09", note: "Mua vé xe về quê", periodId: PERIOD_SEPTEMBER, requestedAt: "2026-09-02T09:00:00Z", reviewedAt: "2026-09-03T02:00:00Z", staff: "ta", status: "deducted" },
  { amount: 1_500_000, approvedAt: "2026-09-02T03:00:00Z", month: "2026-09", note: "Chi phí khám răng", requestedAt: "2026-09-01T02:00:00Z", reviewedAt: "2026-09-01T09:00:00Z", staff: "ngoc", status: "approved" },
  { amount: 2_500_000, approvedAt: "2026-08-12T03:00:00Z", deductedAt: "2026-09-05T02:30:00Z", month: "2026-08", note: "Sửa máy lạnh phòng trọ", periodId: PERIOD_AUGUST, requestedAt: "2026-08-10T02:00:00Z", reviewedAt: "2026-08-11T02:00:00Z", staff: "ngoc", status: "deducted" },
  { amount: 3_000_000, approvedAt: "2026-08-07T03:00:00Z", deductedAt: "2026-09-05T02:30:00Z", month: "2026-08", note: "Đóng tiền học thêm cho con", periodId: PERIOD_AUGUST, requestedAt: "2026-08-05T02:00:00Z", reviewedAt: "2026-08-06T02:00:00Z", staff: "thao", status: "deducted" },
  { amount: 1_000_000, approvedAt: "2026-08-04T03:00:00Z", deductedAt: "2026-09-05T02:30:00Z", month: "2026-08", note: "Mua giày bảo hộ", periodId: PERIOD_AUGUST, requestedAt: "2026-08-03T02:00:00Z", reviewedAt: "2026-08-03T09:00:00Z", staff: "khoi", status: "deducted" },
  { amount: 700_000, month: "2026-08", note: "Mua dụng cụ dạy học", rejectedAt: "2026-08-02T04:00:00Z", rejectedBy: REVIEWER, rejectionReason: "Khoản này thuộc chi phí trung tâm, đề nghị làm phiếu chi thay vì tạm ứng.", requestedAt: "2026-08-01T02:00:00Z", staff: "linh", status: "rejected" },
  { amount: 2_000_000, approvedAt: "2026-07-03T03:00:00Z", deductedAt: "2026-08-05T02:00:00Z", month: "2026-07", note: "Tiền khám sức khỏe định kỳ", periodId: "b2000000-0000-4000-8000-000000202607", requestedAt: "2026-07-01T02:00:00Z", reviewedAt: "2026-07-02T02:00:00Z", staff: "duc", status: "deducted" },
  // Sent the year before: short dates carry the year ("20/12/2025").
  { amount: 2_000_000, approvedAt: "2025-12-22T03:00:00Z", deductedAt: "2026-02-05T02:00:00Z", month: "2026-01", note: "Về quê ăn Tết", periodId: PERIOD_JANUARY, requestedAt: "2025-12-20T02:00:00Z", reviewedAt: "2025-12-21T02:00:00Z", staff: "duc", status: "deducted" },
];

export const advancePreviewEntries: SalaryAdvanceDashboardEntry[] = rows.map((row, index) => {
  const person = staff[row.staff];
  const reviewed = Boolean(row.reviewedAt);
  const approved = Boolean(row.approvedAt);

  return {
    amountVnd: row.amount,
    approvalNote: row.approvalNote ?? null,
    approvedAt: row.approvedAt ?? null,
    approvedByDisplayName: approved ? APPROVER : null,
    deductedAt: row.deductedAt ?? null,
    deductionPayrollPeriodId: row.periodId ?? null,
    deductionPeriodMonth: `${row.month}-01`,
    id: `c3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    rejectedAt: row.rejectedAt ?? null,
    rejectedByDisplayName: row.rejectedBy ?? null,
    rejectionReason: row.rejectionReason ?? null,
    requestNote: row.note,
    requestedAt: row.requestedAt,
    reviewNote: row.reviewNote ?? null,
    reviewedAt: row.reviewedAt ?? null,
    reviewedByDisplayName: reviewed ? REVIEWER : null,
    staffDisplayName: person.name,
    staffEmployeeCode: person.code,
    staffId: person.id,
    status: row.status,
  };
});
