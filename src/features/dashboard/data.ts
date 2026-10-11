import "server-only";

import { z } from "zod";

import { getSalaryAdvancesDashboardResult } from "@/features/advances/data";
import { getCoachingRecordsDashboardResult } from "@/features/coaching/data";
import type {
  AdmissionsFunnelSummary,
  AttentionItem,
  DashboardAdvanceSummary,
  DashboardCoachingSummary,
  DashboardFinanceSummary,
  DashboardGradingCreditSummary,
  DashboardPayrollSummary,
  DashboardSectionState,
  ExecutiveKpisSummary,
  MonthlyRevenueTrendItem,
  OperationalHighlightsSummary,
  PayrollExecutiveSummary,
  ReceivablesAgingDistribution,
  RevenueCompositionItem,
  RoleAwareDashboardReadModel,
  StudentStatusDistribution,
  TopGradeOrClassItem,
} from "@/features/dashboard/read-models";
import { getFinanceOverviewResult } from "@/features/finance/data";
import { getGradingCreditsDashboardResult } from "@/features/grading-credits/data";
import { getPayrollDashboardResult } from "@/features/payroll/data";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function hiddenSection<T>(): DashboardSectionState<T> {
  return { status: "hidden" };
}

function errorSection<T>(): DashboardSectionState<T> {
  return { status: "error" };
}

function readySection<T>(data: T): DashboardSectionState<T> {
  return {
    data,
    status: "ready",
  };
}

function hasPermission(
  permissions: readonly PermissionCode[],
  permission: PermissionCode,
): boolean {
  return permissions.includes(permission);
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function percentOf(part: number, whole: number): number {
  return Number(((part / Math.max(1, whole)) * 100).toFixed(1));
}

// Legacy loaders for test compatibility
async function loadFinanceSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardFinanceSummary>> {
  if (!hasPermission(permissions, "finance.view")) {
    return hiddenSection();
  }

  const result = await getFinanceOverviewResult();
  if (!result.ok) {
    return errorSection();
  }

  const { disbursementVnd, receiptVnd, refundVnd } = result.data.cashflowSummary;

  return readySection({
    disbursementVnd,
    netCashflowVnd: receiptVnd - disbursementVnd - refundVnd,
    paymentRequestCount: result.data.totalPaymentRequestsCount,
    receiptVnd,
    refundVnd,
  });
}

async function loadPayrollSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardPayrollSummary>> {
  if (!hasPermission(permissions, "payroll.view")) {
    return hiddenSection();
  }

  const result = await getPayrollDashboardResult();
  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;
  const latestPeriodMonth = entries.reduce<string | null>(
    (latest, entry) =>
      latest === null || entry.periodMonth > latest ? entry.periodMonth : latest,
    null,
  );

  return readySection({
    approvedStatementCount: entries.filter((e) => e.periodStatus === "approved").length,
    draftStatementCount: entries.filter((e) => e.periodStatus === "draft").length,
    latestPeriodMonth,
    reviewStatementCount: entries.filter((e) => e.periodStatus === "review").length,
    statementCount: entries.length,
  });
}

async function loadAdvanceSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardAdvanceSummary>> {
  if (!hasPermission(permissions, "advances.view")) {
    return hiddenSection();
  }

  const result = await getSalaryAdvancesDashboardResult();
  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;
  return readySection({
    approvedUndeductedCount: entries.filter((e) => e.status === "approved").length,
    deductedCount: entries.filter((e) => e.status === "deducted").length,
    pendingReviewCount: entries.filter((e) => e.status === "requested" || e.status === "review").length,
    rejectedCount: entries.filter((e) => e.status === "rejected").length,
    requestCount: entries.length,
    totalRequestedVnd: entries.reduce((total, e) => total + e.amountVnd, 0),
  });
}

async function loadGradingCreditSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardGradingCreditSummary>> {
  if (!hasPermission(permissions, "grading_credits.view")) {
    return hiddenSection();
  }

  const result = await getGradingCreditsDashboardResult();
  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;
  const latestCreditedAt = entries.reduce<string | null>(
    (latest, e) => (latest === null || e.creditedAt > latest ? e.creditedAt : latest),
    null,
  );

  return readySection({
    entryCount: entries.length,
    latestCreditedAt,
    totalCreditUnits: entries.reduce((total, e) => total + e.creditUnits, 0),
  });
}

async function loadCoachingSummary(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<DashboardCoachingSummary>> {
  if (!hasPermission(permissions, "coaching.view")) {
    return hiddenSection();
  }

  const result = await getCoachingRecordsDashboardResult();
  if (!result.ok) {
    return errorSection();
  }

  const entries = result.data;
  return readySection({
    closedCount: entries.filter((e) => e.currentStatus === "closed").length,
    highPriorityCount: entries.filter(
      (e) => e.priority === "high" && (e.currentStatus === "open" || e.currentStatus === "in_progress"),
    ).length,
    inProgressCount: entries.filter((e) => e.currentStatus === "in_progress").length,
    openCount: entries.filter((e) => e.currentStatus === "open").length,
    recordCount: entries.length,
  });
}

// Executive sections: one SQL round trip (get_dashboard_executive_overview).
// The database decides visibility per permission and returns null for a
// section the caller may not see.
const vnd = z.coerce.number();
const count = z.coerce.number().int().nonnegative();

const executiveOverviewSchema = z.object({
  admissions_funnel: z.object({
    converted: count,
    pending_confirmation_or_later: count,
    top_sources: z.array(z.object({ count, name: z.string() })),
    total: count,
    trial_booked_or_later: count,
    trial_completed_or_later: count,
  }).nullable(),
  attention: z.object({
    advances_pending: count.nullable(),
    coaching_urgent: count.nullable(),
    import_conflicted: count.nullable(),
    payments_overdue: count.nullable(),
    payroll_review: count.nullable(),
    timekeeping_adjustments_pending: count.nullable(),
  }),
  kpis: z.object({
    cashflow: z.object({
      disbursement_vnd: vnd,
      prev_disbursement_vnd: vnd,
      prev_refund_vnd: vnd,
      prev_revenue_vnd: vnd,
      receivables_vnd: vnd,
      refund_vnd: vnd,
      revenue_vnd: vnd,
    }).nullable(),
    students: z.object({
      active_count: count,
      created_before_month_count: count,
      total_count: count,
    }).nullable(),
  }).nullable(),
  month: z.string(),
  operational_highlights: z.object({
    active_classes: count.nullable(),
    active_staff: count.nullable(),
    closed_coaching: count.nullable(),
    completed_sessions: count.nullable(),
    grading_credit_units: z.coerce.number().nonnegative().nullable(),
  }),
  payroll_summary: z.object({
    approved_count: count,
    by_position: z.array(z.object({
      amount_vnd: vnd,
      employee_count: count,
      position_code: z.string(),
    })),
    draft_count: count,
    latest_period_month: z.string().nullable(),
    prev_total_payroll_vnd: vnd,
    review_count: count,
    statement_count: count,
    total_payroll_vnd: vnd,
  }).nullable(),
  receivables_aging: z.object({
    collected_vnd: vnd,
    from_31_to_60_vnd: vnd,
    over_60_vnd: vnd,
    total_vnd: vnd,
    under_30_vnd: vnd,
  }).nullable(),
  revenue_composition: z.array(z.object({ amount_vnd: vnd, category: z.string() })).nullable(),
  revenue_trend: z.array(z.object({
    cost_vnd: vnd,
    month: z.string(),
    refund_vnd: vnd,
    revenue_vnd: vnd,
  })).nullable(),
  student_status: z.object({
    active: count,
    completed: count,
    reserved: count,
    total: count,
    waiting: count,
  }).nullable(),
  top_classes: z.array(z.object({
    code: z.string(),
    id: z.string(),
    name: z.string(),
    student_count: count,
  })).nullable(),
});

type ExecutiveOverview = z.infer<typeof executiveOverviewSchema>;

type ExecutiveSections = Pick<
  RoleAwareDashboardReadModel,
  | "admissionsFunnel"
  | "attention"
  | "kpis"
  | "operationalHighlights"
  | "payrollSummary"
  | "receivablesAging"
  | "revenueComposition"
  | "revenueTrend"
  | "studentStatus"
  | "topClasses"
>;

function executiveSectionsWithStatus(status: "error" | "hidden"): ExecutiveSections {
  const section = status === "error" ? errorSection : hiddenSection;
  return {
    admissionsFunnel: section(),
    attention: section(),
    kpis: section(),
    operationalHighlights: section(),
    payrollSummary: section(),
    receivablesAging: section(),
    revenueComposition: section(),
    revenueTrend: section(),
    studentStatus: section(),
    topClasses: section(),
  };
}

function mapKpis(kpis: ExecutiveOverview["kpis"]): DashboardSectionState<ExecutiveKpisSummary> {
  if (!kpis) return hiddenSection();
  const cashflow = kpis.cashflow;
  const students = kpis.students;
  const net = cashflow ? cashflow.revenue_vnd - cashflow.disbursement_vnd - cashflow.refund_vnd : 0;
  const prevNet = cashflow
    ? cashflow.prev_revenue_vnd - cashflow.prev_disbursement_vnd - cashflow.prev_refund_vnd
    : 0;
  return readySection({
    disbursementChangePercent: cashflow
      ? calculatePercentChange(cashflow.disbursement_vnd, cashflow.prev_disbursement_vnd)
      : null,
    disbursementVnd: cashflow?.disbursement_vnd ?? 0,
    netCashflowChangePercent: cashflow ? calculatePercentChange(net, prevNet) : null,
    netCashflowVnd: net,
    receivablesVnd: cashflow?.receivables_vnd ?? 0,
    revenueChangePercent: cashflow
      ? calculatePercentChange(cashflow.revenue_vnd, cashflow.prev_revenue_vnd)
      : null,
    revenueVnd: cashflow?.revenue_vnd ?? 0,
    totalStudents: students
      ? (students.active_count > 0 ? students.active_count : students.total_count)
      : 0,
    totalStudentsChangePercent: students && students.created_before_month_count > 0
      ? calculatePercentChange(students.total_count, students.created_before_month_count)
      : null,
  });
}

function mapAttention(attention: ExecutiveOverview["attention"]): DashboardSectionState<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const push = (count: number | null, item: Omit<AttentionItem, "count" | "title"> & { title: (n: number) => string }) => {
    if (count === null || count <= 0) return;
    items.push({ ...item, count, title: item.title(count) });
  };

  push(attention.payroll_review, {
    description: "Bảng lương các kỳ đã hoàn thành tính toán, cần kiểm tra và phê duyệt.",
    href: "/payroll",
    id: "payroll-review",
    module: "Bảng lương",
    severity: "danger",
    title: (n) => `${n} kỳ bảng lương đang chờ duyệt`,
  });
  push(attention.advances_pending, {
    description: "Nhân viên gửi yêu cầu tạm ứng lương trong tháng, chờ xét duyệt.",
    href: "/advances",
    id: "advances-pending",
    module: "Tạm ứng",
    severity: "warning",
    title: (n) => `${n} yêu cầu tạm ứng lương cần phê duyệt`,
  });
  push(attention.timekeeping_adjustments_pending, {
    description: "Đơn xin giải trình hoặc điều chỉnh giờ vào/ra của nhân sự.",
    href: "/payroll",
    id: "timekeeping-adj",
    module: "Chấm công",
    severity: "warning",
    title: (n) => `${n} yêu cầu điều chỉnh bảng công chờ duyệt`,
  });
  push(attention.payments_overdue, {
    description: "Yêu cầu thanh toán đã tạo quá 14 ngày nhưng chưa thu được tiền.",
    href: "/finance",
    id: "payments-overdue",
    module: "Tài chính",
    severity: "danger",
    title: (n) => `${n} khoản học phí quá hạn cần đôn đốc`,
  });
  push(attention.coaching_urgent, {
    description: "Học sinh có vấn đề học tập hoặc chuyên cần mức độ cao cần theo sát.",
    href: "/coaching",
    id: "coaching-urgent",
    module: "Coaching",
    severity: "warning",
    title: (n) => `${n} học sinh có phiếu Coaching ưu tiên cao`,
  });
  push(attention.import_conflicted, {
    description: "Tệp tải lên dữ liệu đối soát bảng lương phát sinh xung đột.",
    href: "/payroll",
    id: "import-conflicted",
    module: "Dữ liệu",
    severity: "info",
    title: (n) => `${n} đợt import bảng lương có xung đột cần giải quyết`,
  });

  return readySection(items);
}

function mapRevenueTrend(
  trend: ExecutiveOverview["revenue_trend"],
): DashboardSectionState<MonthlyRevenueTrendItem[]> {
  if (!trend) return hiddenSection();
  return readySection(trend.map((item) => ({
    costVnd: item.cost_vnd,
    month: item.month,
    monthLabel: `T${Number(item.month.slice(5, 7))}`,
    netVnd: item.revenue_vnd - item.cost_vnd - item.refund_vnd,
    revenueVnd: item.revenue_vnd,
  })));
}

// Must match finance_cashflow_records.category CHECK constraint.
const revenueCategoryLabels: Record<string, string> = {
  bonus_grant: "Buổi tặng",
  other: "Khác",
  refund: "Hoàn tiền",
  tuition_fee: "Học phí",
};

function mapRevenueComposition(
  composition: ExecutiveOverview["revenue_composition"],
): DashboardSectionState<RevenueCompositionItem[]> {
  if (!composition) return hiddenSection();
  const total = composition.reduce((sum, item) => sum + item.amount_vnd, 0);
  const items: RevenueCompositionItem[] = composition.map((item) => ({
    amountVnd: item.amount_vnd,
    category: item.category,
    label: revenueCategoryLabels[item.category] ?? item.category,
    sharePercent: total > 0 ? Number(((item.amount_vnd / total) * 100).toFixed(1)) : 0,
  }));
  if (items.length === 0) {
    items.push({ amountVnd: 0, category: "tuition_fee", label: "Học phí", sharePercent: 100 });
  }
  return readySection(items);
}

function mapTopClasses(
  classes: ExecutiveOverview["top_classes"],
): DashboardSectionState<TopGradeOrClassItem[]> {
  if (!classes) return hiddenSection();
  // Revenue per class is not tracked yet (session charges carry no unit
  // price), so the ranking is by active enrollment only.
  return readySection(classes.map((item, index) => ({
    code: item.code,
    id: item.id,
    name: item.name,
    rank: index + 1,
    revenueVnd: null,
    studentCount: item.student_count,
  })));
}

function mapAdmissionsFunnel(
  funnel: ExecutiveOverview["admissions_funnel"],
): DashboardSectionState<AdmissionsFunnelSummary> {
  if (!funnel) return hiddenSection();
  const base = funnel.total;
  return readySection({
    conversionRatePercent: percentOf(funnel.converted, base),
    steps: [
      { count: funnel.total, key: "leads", label: "Tổng tiềm năng", percentage: 100 },
      { count: funnel.trial_booked_or_later, key: "contacted", label: "Đã đặt lịch học thử", percentage: percentOf(funnel.trial_booked_or_later, base) },
      { count: funnel.trial_completed_or_later, key: "consulted", label: "Đã học thử", percentage: percentOf(funnel.trial_completed_or_later, base) },
      { count: funnel.pending_confirmation_or_later, key: "registered", label: "Chờ xác nhận nhập học", percentage: percentOf(funnel.pending_confirmation_or_later, base) },
      { count: funnel.converted, key: "enrolled", label: "Đã nhập học", percentage: percentOf(funnel.converted, base) },
    ],
    topSources: funnel.top_sources.map((source) => ({ count: source.count, name: source.name })),
    totalLeads: funnel.total,
  });
}

function mapStudentStatus(
  status: ExecutiveOverview["student_status"],
): DashboardSectionState<StudentStatusDistribution> {
  if (!status) return hiddenSection();
  const total = status.total;
  return readySection({
    activeCount: status.active,
    completedCount: status.completed,
    items: [
      { color: "#16794C", count: status.active, key: "active", label: "Đang theo học", percentage: percentOf(status.active, total) },
      { color: "#C06A1B", count: status.reserved, key: "reserved", label: "Bảo lưu / Tạm nghỉ", percentage: percentOf(status.reserved, total) },
      { color: "#667085", count: status.completed, key: "completed", label: "Đã hoàn thành / Nghỉ", percentage: percentOf(status.completed, total) },
      { color: "#315FCC", count: status.waiting, key: "waiting", label: "Chờ xếp lớp / Quan tâm", percentage: percentOf(status.waiting, total) },
    ],
    reservedCount: status.reserved,
    totalCount: total,
    waitingCount: status.waiting,
  });
}

function mapReceivablesAging(
  aging: ExecutiveOverview["receivables_aging"],
): DashboardSectionState<ReceivablesAgingDistribution> {
  if (!aging) return hiddenSection();
  const total = aging.total_vnd;
  return readySection({
    collectedVnd: aging.collected_vnd,
    from31To60DaysVnd: aging.from_31_to_60_vnd,
    items: [
      { amountVnd: aging.under_30_vnd, color: "#315FCC", key: "under_30", label: "Trong hạn / Dưới 30 ngày", percentage: percentOf(aging.under_30_vnd, total) },
      { amountVnd: aging.from_31_to_60_vnd, color: "#C06A1B", key: "31_to_60", label: "Quá hạn 31–60 ngày", percentage: percentOf(aging.from_31_to_60_vnd, total) },
      { amountVnd: aging.over_60_vnd, color: "#C33752", key: "over_60", label: "Quá hạn trên 60 ngày", percentage: percentOf(aging.over_60_vnd, total) },
    ],
    over60DaysVnd: aging.over_60_vnd,
    totalReceivablesVnd: total,
    under30DaysVnd: aging.under_30_vnd,
  });
}

// Must match staff_payroll_position_versions.position_code CHECK constraint.
const positionNames: Record<string, string> = {
  admissions_manager: "Quản lý tuyển sinh",
  operations_assistant: "Trợ lý vận hành",
  other: "Chưa gán vị trí",
  teaching_assistant: "Trợ giảng",
};

function mapPayrollSummary(
  payroll: ExecutiveOverview["payroll_summary"],
): DashboardSectionState<PayrollExecutiveSummary> {
  if (!payroll) return hiddenSection();
  return readySection({
    approvedCount: payroll.approved_count,
    draftCount: payroll.draft_count,
    latestPeriodMonth: payroll.latest_period_month,
    reviewCount: payroll.review_count,
    staffByPosition: payroll.by_position.map((position) => ({
      amountVnd: position.amount_vnd,
      employeeCount: position.employee_count,
      positionName: positionNames[position.position_code] ?? position.position_code,
    })),
    statementCount: payroll.statement_count,
    totalPayrollVnd: payroll.total_payroll_vnd,
    variancePercent: calculatePercentChange(payroll.total_payroll_vnd, payroll.prev_total_payroll_vnd),
  });
}

function mapOperationalHighlights(
  operations: ExecutiveOverview["operational_highlights"],
): DashboardSectionState<OperationalHighlightsSummary> {
  return readySection({
    activeClassesCount: operations.active_classes ?? 0,
    activeStaffCount: operations.active_staff ?? 0,
    closedCoachingCount: operations.closed_coaching ?? 0,
    completedSessionsCount: operations.completed_sessions ?? 0,
    gradingCreditUnits: operations.grading_credit_units ?? 0,
  });
}

async function loadExecutiveSections(
  permissions: readonly PermissionCode[],
  selectedMonth: string,
): Promise<ExecutiveSections> {
  if (!hasPermission(permissions, "dashboard.view")) {
    return executiveSectionsWithStatus("hidden");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_dashboard_executive_overview", {
      p_month: `${selectedMonth}-01`,
    });
    if (error) {
      return executiveSectionsWithStatus("error");
    }
    const parsed = executiveOverviewSchema.safeParse(data);
    if (!parsed.success) {
      return executiveSectionsWithStatus("error");
    }
    const overview = parsed.data;
    return {
      admissionsFunnel: mapAdmissionsFunnel(overview.admissions_funnel),
      attention: mapAttention(overview.attention),
      kpis: mapKpis(overview.kpis),
      operationalHighlights: mapOperationalHighlights(overview.operational_highlights),
      payrollSummary: mapPayrollSummary(overview.payroll_summary),
      receivablesAging: mapReceivablesAging(overview.receivables_aging),
      revenueComposition: mapRevenueComposition(overview.revenue_composition),
      revenueTrend: mapRevenueTrend(overview.revenue_trend),
      studentStatus: mapStudentStatus(overview.student_status),
      topClasses: mapTopClasses(overview.top_classes),
    };
  } catch {
    return executiveSectionsWithStatus("error");
  }
}

export async function getRoleAwareDashboardReadModel(
  permissions: readonly PermissionCode[],
  requestedMonth?: string,
): Promise<RoleAwareDashboardReadModel> {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
    ? requestedMonth
    : currentMonthStr;

  const selectedYear = Number(selectedMonth.split("-")[0]);

  // Generate available months for selector
  const availableMonths: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    availableMonths.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  const availableYears = [
    selectedYear,
    selectedYear - 1,
    selectedYear + 1,
  ].filter((y, idx, arr) => arr.indexOf(y) === idx).sort((a, b) => b - a);

  const [
    finance,
    payroll,
    advances,
    gradingCredits,
    coaching,
    executive,
  ] = await Promise.all([
    loadFinanceSummary(permissions),
    loadPayrollSummary(permissions),
    loadAdvanceSummary(permissions),
    loadGradingCreditSummary(permissions),
    loadCoachingSummary(permissions),
    loadExecutiveSections(permissions, selectedMonth),
  ]);

  return {
    ...executive,
    advances,
    availableMonths,
    availableYears,
    coaching,
    finance,
    gradingCredits,
    lastUpdatedAt: new Date().toISOString(),
    payroll,
    selectedMonth,
    selectedYear,
  };
}
