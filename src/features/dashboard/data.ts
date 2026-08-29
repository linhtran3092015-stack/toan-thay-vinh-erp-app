import "server-only";

import { getSalaryAdvancesDashboardResult } from "@/features/advances/data";
import { getCoachingRecordsDashboardResult } from "@/features/coaching/data";
import type {
  AdmissionsFunnelStep,
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
  PositionPayrollBreakdown,
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

function getPreviousMonth(monthStr: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return monthStr;
  let year = Number(match[1]);
  let month = Number(match[2]) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
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

// 1. Executive Top KPIs
async function loadExecutiveKpis(
  permissions: readonly PermissionCode[],
  selectedMonth: string,
): Promise<DashboardSectionState<ExecutiveKpisSummary>> {
  const canViewFinance =
    hasPermission(permissions, "finance.view") ||
    hasPermission(permissions, "cashflow.view") ||
    hasPermission(permissions, "payments.view");
  const canViewStudents = hasPermission(permissions, "students.view");

  if (!canViewFinance && !canViewStudents) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const prevMonth = getPreviousMonth(selectedMonth);

    const monthStart = `${selectedMonth}-01T00:00:00.000Z`;
    const nextMonthObj = new Date(`${selectedMonth}-01T00:00:00.000Z`);
    nextMonthObj.setUTCMonth(nextMonthObj.getUTCMonth() + 1);
    const monthEnd = nextMonthObj.toISOString();

    const prevMonthStart = `${prevMonth}-01T00:00:00.000Z`;
    const prevMonthEnd = monthStart;

    const [
      studentsRes,
      cashflowCurrentRes,
      cashflowPrevRes,
      paymentRequestsRes,
    ] = await Promise.all([
      canViewStudents
        ? supabase
            .from("students")
            .select("id, lifecycle_status, created_at")
        : Promise.resolve({ data: null, error: null }),
      canViewFinance
        ? supabase
            .from("finance_cashflow_records")
            .select("record_type, amount_vnd, created_at")
            .gte("created_at", monthStart)
            .lt("created_at", monthEnd)
        : Promise.resolve({ data: null, error: null }),
      canViewFinance
        ? supabase
            .from("finance_cashflow_records")
            .select("record_type, amount_vnd, created_at")
            .gte("created_at", prevMonthStart)
            .lt("created_at", prevMonthEnd)
        : Promise.resolve({ data: null, error: null }),
      canViewFinance
        ? supabase
            .from("student_payment_requests")
            .select("expected_amount_vnd, paid_amount_vnd, status")
            .in("status", ["pending", "partially_paid"])
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (
      (canViewStudents && studentsRes.error) ||
      (canViewFinance &&
        (cashflowCurrentRes.error ||
          cashflowPrevRes.error ||
          paymentRequestsRes.error))
    ) {
      return errorSection();
    }

    // Students
    const allStudents = studentsRes.data ?? [];
    const activeStudents = allStudents.filter(
      (s) => s.lifecycle_status === "active" || s.lifecycle_status === "resumed",
    ).length;
    const totalStudents = activeStudents > 0 ? activeStudents : allStudents.length;

    // Previous students
    const prevStudentsCount = allStudents.filter((s) => s.created_at < monthStart).length;
    const totalStudentsChangePercent =
      prevStudentsCount > 0
        ? calculatePercentChange(allStudents.length, prevStudentsCount)
        : null;

    // Current Cashflow
    const currentRecords = cashflowCurrentRes.data ?? [];
    const currentReceipts = currentRecords
      .filter((r) => r.record_type === "receipt")
      .reduce((sum, r) => sum + Number(r.amount_vnd), 0);
    const currentDisbursements = currentRecords
      .filter((r) => r.record_type === "disbursement")
      .reduce((sum, r) => sum + Number(r.amount_vnd), 0);
    const currentRefunds = currentRecords
      .filter((r) => r.record_type === "refund")
      .reduce((sum, r) => sum + Number(r.amount_vnd), 0);
    const currentNet = currentReceipts - currentDisbursements - currentRefunds;

    // Previous Cashflow
    const prevRecords = cashflowPrevRes.data ?? [];
    const prevReceipts = prevRecords
      .filter((r) => r.record_type === "receipt")
      .reduce((sum, r) => sum + Number(r.amount_vnd), 0);
    const prevDisbursements = prevRecords
      .filter((r) => r.record_type === "disbursement")
      .reduce((sum, r) => sum + Number(r.amount_vnd), 0);
    const prevRefunds = prevRecords
      .filter((r) => r.record_type === "refund")
      .reduce((sum, r) => sum + Number(r.amount_vnd), 0);
    const prevNet = prevReceipts - prevDisbursements - prevRefunds;

    // Receivables
    const pendingRequests = paymentRequestsRes.data ?? [];
    const receivablesVnd = pendingRequests.reduce(
      (sum, r) =>
        sum + (Number(r.expected_amount_vnd) - Number(r.paid_amount_vnd || 0)),
      0,
    );

    return readySection({
      disbursementChangePercent: calculatePercentChange(
        currentDisbursements,
        prevDisbursements,
      ),
      disbursementVnd: currentDisbursements,
      netCashflowChangePercent: calculatePercentChange(currentNet, prevNet),
      netCashflowVnd: currentNet,
      receivablesVnd,
      revenueChangePercent: calculatePercentChange(currentReceipts, prevReceipts),
      revenueVnd: currentReceipts,
      totalStudents,
      totalStudentsChangePercent,
    });
  } catch {
    return errorSection();
  }
}

// 2. Attention Panel
async function loadAttentionItems(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<AttentionItem[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const items: AttentionItem[] = [];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      payrollRes,
      advancesRes,
      timekeepingRes,
      overduePaymentRes,
      coachingRes,
      importBatchRes,
    ] = await Promise.all([
      hasPermission(permissions, "payroll.view")
        ? supabase
            .from("payroll_periods")
            .select("id, month, status")
            .eq("status", "review")
        : Promise.resolve({ data: null, error: null }),
      hasPermission(permissions, "advances.view")
        ? supabase
            .from("salary_advances")
            .select("id, status")
            .in("status", ["requested", "review"])
        : Promise.resolve({ data: null, error: null }),
      hasPermission(permissions, "timekeeping.approve_adjustment") ||
      hasPermission(permissions, "timekeeping.view")
        ? supabase
            .from("time_entry_adjustment_requests")
            .select("id, status")
            .eq("status", "pending")
        : Promise.resolve({ data: null, error: null }),
      hasPermission(permissions, "payments.view") ||
      hasPermission(permissions, "finance.view")
        ? supabase
            .from("student_payment_requests")
            .select("id, status, created_at")
            .eq("status", "pending")
            .lt("created_at", fourteenDaysAgo)
        : Promise.resolve({ data: null, error: null }),
      hasPermission(permissions, "coaching.view")
        ? supabase
            .from("coaching_records")
            .select("id, priority, current_status")
            .eq("priority", "high")
            .in("current_status", ["open", "in_progress"])
        : Promise.resolve({ data: null, error: null }),
      hasPermission(permissions, "payroll.import") ||
      hasPermission(permissions, "payroll.view")
        ? supabase
            .from("payroll_import_batches")
            .select("id, status")
            .eq("status", "conflicted")
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (payrollRes.data && payrollRes.data.length > 0) {
      items.push({
        count: payrollRes.data.length,
        description: "Bảng lương các kỳ đã hoàn thành tính toán, cần kiểm tra và phê duyệt.",
        href: "/payroll",
        id: "payroll-review",
        module: "Bảng lương",
        severity: "danger",
        title: `${payrollRes.data.length} kỳ bảng lương đang chờ duyệt`,
      });
    }

    if (advancesRes.data && advancesRes.data.length > 0) {
      items.push({
        count: advancesRes.data.length,
        description: "Nhân viên gửi yêu cầu tạm ứng lương trong tháng, chờ xét duyệt.",
        href: "/advances",
        id: "advances-pending",
        module: "Tạm ứng",
        severity: "warning",
        title: `${advancesRes.data.length} yêu cầu tạm ứng lương cần phê duyệt`,
      });
    }

    if (timekeepingRes.data && timekeepingRes.data.length > 0) {
      items.push({
        count: timekeepingRes.data.length,
        description: "Đơn xin giải trình hoặc điều chỉnh giờ vào/ra của nhân sự.",
        href: "/payroll",
        id: "timekeeping-adj",
        module: "Chấm công",
        severity: "warning",
        title: `${timekeepingRes.data.length} yêu cầu điều chỉnh bảng công chờ duyệt`,
      });
    }

    if (overduePaymentRes.data && overduePaymentRes.data.length > 0) {
      items.push({
        count: overduePaymentRes.data.length,
        description: "Yêu cầu thanh toán đã tạo quá 14 ngày nhưng chưa thu được tiền.",
        href: "/finance",
        id: "payments-overdue",
        module: "Tài chính",
        severity: "danger",
        title: `${overduePaymentRes.data.length} khoản học phí quá hạn cần đôn đốc`,
      });
    }

    if (coachingRes.data && coachingRes.data.length > 0) {
      items.push({
        count: coachingRes.data.length,
        description: "Học sinh có vấn đề học tập hoặc chuyên cần mức độ cao cần theo sát.",
        href: "/coaching",
        id: "coaching-urgent",
        module: "Coaching",
        severity: "warning",
        title: `${coachingRes.data.length} học sinh có phiếu Coaching ưu tiên cao`,
      });
    }

    if (importBatchRes.data && importBatchRes.data.length > 0) {
      items.push({
        count: importBatchRes.data.length,
        description: "Tệp tải lên dữ liệu đối soát bảng lương phát sinh xung đột.",
        href: "/payroll",
        id: "import-conflicted",
        module: "Dữ liệu",
        severity: "info",
        title: `${importBatchRes.data.length} đợt import bảng lương có xung đột cần giải quyết`,
      });
    }

    return readySection(items);
  } catch {
    return errorSection();
  }
}

// 3. Biểu đồ Doanh thu & Chi phí 12 tháng
async function loadRevenueMonthlyTrend(
  permissions: readonly PermissionCode[],
  selectedYear: number,
): Promise<DashboardSectionState<MonthlyRevenueTrendItem[]>> {
  if (
    !hasPermission(permissions, "finance.view") &&
    !hasPermission(permissions, "cashflow.view")
  ) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const yearStart = `${selectedYear}-01-01T00:00:00.000Z`;
    const yearEnd = `${selectedYear + 1}-01-01T00:00:00.000Z`;

    const { data, error } = await supabase
      .from("finance_cashflow_records")
      .select("record_type, amount_vnd, created_at")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd);

    if (error) return errorSection();

    const monthlyMap = new Map<number, { cost: number; net: number; revenue: number }>();
    for (let month = 1; month <= 12; month += 1) {
      monthlyMap.set(month, { cost: 0, net: 0, revenue: 0 });
    }

    for (const record of data ?? []) {
      const date = new Date(record.created_at);
      const month = date.getUTCMonth() + 1;
      const current = monthlyMap.get(month);
      if (current) {
        const amount = Number(record.amount_vnd);
        if (record.record_type === "receipt") {
          current.revenue += amount;
          current.net += amount;
        } else if (record.record_type === "disbursement") {
          current.cost += amount;
          current.net -= amount;
        } else if (record.record_type === "refund") {
          current.net -= amount;
        }
      }
    }

    const items: MonthlyRevenueTrendItem[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const val = monthlyMap.get(month)!;
      items.push({
        costVnd: val.cost,
        month: `${selectedYear}-${String(month).padStart(2, "0")}`,
        monthLabel: `T${month}`,
        netVnd: val.net,
        revenueVnd: val.revenue,
      });
    }

    return readySection(items);
  } catch {
    return errorSection();
  }
}

// 4. Cơ cấu Doanh thu
async function loadRevenueComposition(
  permissions: readonly PermissionCode[],
  selectedMonth: string,
): Promise<DashboardSectionState<RevenueCompositionItem[]>> {
  if (
    !hasPermission(permissions, "finance.view") &&
    !hasPermission(permissions, "cashflow.view")
  ) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const monthStart = `${selectedMonth}-01T00:00:00.000Z`;
    const nextMonthObj = new Date(`${selectedMonth}-01T00:00:00.000Z`);
    nextMonthObj.setUTCMonth(nextMonthObj.getUTCMonth() + 1);
    const monthEnd = nextMonthObj.toISOString();

    const { data, error } = await supabase
      .from("finance_cashflow_records")
      .select("category, amount_vnd, record_type")
      .eq("record_type", "receipt")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);

    if (error) return errorSection();

    const categoryLabels: Record<string, string> = {
      exam_fee: "Lệ phí thi",
      materials: "Tài liệu & Học cụ",
      other: "Khác",
      registration: "Phí đăng ký",
      service: "Phí dịch vụ",
      tuition: "Học phí",
      workshop: "Chuyên đề / Sự kiện",
    };

    const categoryTotals = new Map<string, number>();
    let totalRevenue = 0;

    for (const row of data ?? []) {
      const cat = row.category || "tuition";
      const amt = Number(row.amount_vnd);
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + amt);
      totalRevenue += amt;
    }

    const items: RevenueCompositionItem[] = [];
    for (const [category, amountVnd] of categoryTotals.entries()) {
      const sharePercent =
        totalRevenue > 0
          ? Number(((amountVnd / totalRevenue) * 100).toFixed(1))
          : 0;
      items.push({
        amountVnd,
        category,
        label: categoryLabels[category] ?? category,
        sharePercent,
      });
    }

    items.sort((a, b) => b.amountVnd - a.amountVnd);

    if (items.length === 0) {
      items.push({
        amountVnd: 0,
        category: "tuition",
        label: "Học phí",
        sharePercent: 100,
      });
    }

    return readySection(items);
  } catch {
    return errorSection();
  }
}

// 5. Top Khối / Lớp
async function loadTopGradesAndClasses(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<TopGradeOrClassItem[]>> {
  if (
    !hasPermission(permissions, "classes.view") &&
    !hasPermission(permissions, "students.view")
  ) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const [classesRes, enrollmentsRes] = await Promise.all([
      supabase.from("classes").select("id, name, code, grade, level, status"),
      supabase
        .from("student_enrollments")
        .select("class_id, status")
        .eq("status", "active")
        .is("effective_to", null),
    ]);

    if (classesRes.error || enrollmentsRes.error) return errorSection();

    const studentCountByClass = new Map<string, number>();
    for (const enrollment of enrollmentsRes.data ?? []) {
      studentCountByClass.set(
        enrollment.class_id,
        (studentCountByClass.get(enrollment.class_id) ?? 0) + 1,
      );
    }

    const classItems: TopGradeOrClassItem[] = (classesRes.data ?? []).map((c) => {
      const studentCount = studentCountByClass.get(c.id) ?? 0;
      const revenueVnd = studentCount * 1_800_000;
      return {
        code: c.code,
        id: c.id,
        name: c.name,
        rank: 0,
        revenueVnd,
        studentCount,
      };
    });

    classItems.sort((a, b) => b.studentCount - a.studentCount);
    const top5 = classItems.slice(0, 5).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return readySection(top5);
  } catch {
    return errorSection();
  }
}

// 6. Phễu tuyển sinh (Admissions CRM Funnel)
async function loadAdmissionsFunnel(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<AdmissionsFunnelSummary>> {
  if (!hasPermission(permissions, "crm.view")) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const [casesRes, sourcesRes] = await Promise.all([
      supabase.from("crm_cases").select("id, status, source_id:lead_source_id"),
      supabase.from("crm_lead_sources").select("id, name"),
    ]);

    if (casesRes.error) return errorSection();

    const cases = casesRes.data ?? [];
    const totalLeads = cases.length;

    const contactedCount = cases.filter(
      (c) => c.status !== "lead" && c.status !== "new",
    ).length;
    const consultedCount = cases.filter((c) =>
      [
        "consulting",
        "trial_scheduled",
        "trial_completed",
        "registered",
        "enrolled",
        "official",
      ].includes(c.status),
    ).length;
    const registeredCount = cases.filter((c) =>
      [
        "trial_scheduled",
        "trial_completed",
        "registered",
        "enrolled",
        "official",
      ].includes(c.status),
    ).length;
    const enrolledCount = cases.filter((c) =>
      ["enrolled", "official"].includes(c.status),
    ).length;

    const baseCount = Math.max(1, totalLeads);

    const steps: AdmissionsFunnelStep[] = [
      {
        count: totalLeads,
        key: "leads",
        label: "Tổng tiềm năng",
        percentage: 100,
      },
      {
        count: contactedCount,
        key: "contacted",
        label: "Đã liên hệ",
        percentage: Number(((contactedCount / baseCount) * 100).toFixed(1)),
      },
      {
        count: consultedCount,
        key: "consulted",
        label: "Đã tư vấn",
        percentage: Number(((consultedCount / baseCount) * 100).toFixed(1)),
      },
      {
        count: registeredCount,
        key: "registered",
        label: "Đã đăng ký / Học thử",
        percentage: Number(((registeredCount / baseCount) * 100).toFixed(1)),
      },
      {
        count: enrolledCount,
        key: "enrolled",
        label: "Đã nhập học",
        percentage: Number(((enrolledCount / baseCount) * 100).toFixed(1)),
      },
    ];

    const sourceNameMap = new Map<string, string>(
      (sourcesRes.data ?? []).map((s) => [s.id, s.name]),
    );

    const sourceCounts = new Map<string, number>();
    for (const c of cases) {
      const sourceName =
        (c.source_id ? sourceNameMap.get(c.source_id) : null) ??
        "Fanpage / Trực tiếp";
      sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1);
    }

    const topSources = Array.from(sourceCounts.entries())
      .map(([name, count]) => ({ count, name }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const conversionRatePercent = Number(
      ((enrolledCount / baseCount) * 100).toFixed(1),
    );

    return readySection({
      conversionRatePercent,
      steps,
      topSources,
      totalLeads,
    });
  } catch {
    return errorSection();
  }
}

// 7. Tình hình học sinh (Student Status Distribution)
async function loadStudentStatusComposition(
  permissions: readonly PermissionCode[],
): Promise<DashboardSectionState<StudentStatusDistribution>> {
  if (!hasPermission(permissions, "students.view")) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("students")
      .select("id, lifecycle_status");

    if (error) return errorSection();

    const students = data ?? [];
    const totalCount = students.length;

    let activeCount = 0;
    let reservedCount = 0;
    let completedCount = 0;
    let waitingCount = 0;

    for (const s of students) {
      if (s.lifecycle_status === "active" || s.lifecycle_status === "resumed") {
        activeCount += 1;
      } else if (s.lifecycle_status === "reserved") {
        reservedCount += 1;
      } else if (s.lifecycle_status === "completed") {
        completedCount += 1;
      } else {
        waitingCount += 1;
      }
    }

    const base = Math.max(1, totalCount);

    const items = [
      {
        color: "#16794C",
        count: activeCount,
        key: "active",
        label: "Đang theo học",
        percentage: Number(((activeCount / base) * 100).toFixed(1)),
      },
      {
        color: "#C06A1B",
        count: reservedCount,
        key: "reserved",
        label: "Bảo lưu / Tạm nghỉ",
        percentage: Number(((reservedCount / base) * 100).toFixed(1)),
      },
      {
        color: "#667085",
        count: completedCount,
        key: "completed",
        label: "Đã hoàn thành / Nghỉ",
        percentage: Number(((completedCount / base) * 100).toFixed(1)),
      },
      {
        color: "#315FCC",
        count: waitingCount,
        key: "waiting",
        label: "Chờ xếp lớp / Quan tâm",
        percentage: Number(((waitingCount / base) * 100).toFixed(1)),
      },
    ];

    return readySection({
      activeCount,
      completedCount,
      items,
      reservedCount,
      totalCount,
      waitingCount,
    });
  } catch {
    return errorSection();
  }
}

// 8. Công nợ phải thu & Tuổi nợ (Receivables Aging)
async function loadReceivablesAging(
  permissions: readonly PermissionCode[],
  selectedMonth: string,
): Promise<DashboardSectionState<ReceivablesAgingDistribution>> {
  if (
    !hasPermission(permissions, "finance.view") &&
    !hasPermission(permissions, "payments.view")
  ) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const monthStart = `${selectedMonth}-01T00:00:00.000Z`;
    const nextMonthObj = new Date(`${selectedMonth}-01T00:00:00.000Z`);
    nextMonthObj.setUTCMonth(nextMonthObj.getUTCMonth() + 1);
    const monthEnd = nextMonthObj.toISOString();

    const [pendingRes, paidRes] = await Promise.all([
      supabase
        .from("student_payment_requests")
        .select("expected_amount_vnd, paid_amount_vnd, created_at, status")
        .in("status", ["pending", "partially_paid"]),
      supabase
        .from("student_payment_requests")
        .select("paid_amount_vnd, paid_at")
        .eq("status", "paid")
        .gte("paid_at", monthStart)
        .lt("paid_at", monthEnd),
    ]);

    if (pendingRes.error || paidRes.error) return errorSection();

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    let under30DaysVnd = 0;
    let from31To60DaysVnd = 0;
    let over60DaysVnd = 0;
    let totalReceivablesVnd = 0;

    for (const req of pendingRes.data ?? []) {
      const debt =
        Number(req.expected_amount_vnd) - Number(req.paid_amount_vnd || 0);
      if (debt <= 0) continue;
      totalReceivablesVnd += debt;

      const createdTime = new Date(req.created_at).getTime();
      const ageDays = (now - createdTime) / MS_PER_DAY;

      if (ageDays <= 30) {
        under30DaysVnd += debt;
      } else if (ageDays <= 60) {
        from31To60DaysVnd += debt;
      } else {
        over60DaysVnd += debt;
      }
    }

    const collectedVnd = (paidRes.data ?? []).reduce(
      (sum, r) => sum + Number(r.paid_amount_vnd || 0),
      0,
    );

    const base = Math.max(1, totalReceivablesVnd);

    const items = [
      {
        amountVnd: under30DaysVnd,
        color: "#315FCC",
        key: "under_30",
        label: "Trong hạn / Dưới 30 ngày",
        percentage: Number(((under30DaysVnd / base) * 100).toFixed(1)),
      },
      {
        amountVnd: from31To60DaysVnd,
        color: "#C06A1B",
        key: "31_to_60",
        label: "Quá hạn 31–60 ngày",
        percentage: Number(((from31To60DaysVnd / base) * 100).toFixed(1)),
      },
      {
        amountVnd: over60DaysVnd,
        color: "#C33752",
        key: "over_60",
        label: "Quá hạn trên 60 ngày",
        percentage: Number(((over60DaysVnd / base) * 100).toFixed(1)),
      },
    ];

    return readySection({
      collectedVnd,
      from31To60DaysVnd,
      items,
      over60DaysVnd,
      totalReceivablesVnd,
      under30DaysVnd,
    });
  } catch {
    return errorSection();
  }
}

// 9. Quỹ lương & Nhân sự (Payroll & HR Executive Summary)
async function loadPayrollExecutiveSummary(
  permissions: readonly PermissionCode[],
  selectedMonth: string,
): Promise<DashboardSectionState<PayrollExecutiveSummary>> {
  if (
    !hasPermission(permissions, "payroll.view") &&
    !hasPermission(permissions, "payroll.dashboard.view")
  ) {
    return hiddenSection();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const prevMonth = getPreviousMonth(selectedMonth);

    const [payrollRes, statementsRes, prevStatementsRes, staffRes] =
      await Promise.all([
        getPayrollDashboardResult(),
        supabase
          .from("payroll_statements")
          .select(
            `
          id,
          period_id,
          payroll_periods!inner(month, status),
          staff_id
        `,
          )
          .eq("payroll_periods.month", selectedMonth),
        supabase
          .from("payroll_statements")
          .select(
            `
          payroll_periods!inner(month)
        `,
          )
          .eq("payroll_periods.month", prevMonth),
        supabase
          .from("staff_payroll_position_versions")
          .select("staff_id, position_code, effective_from")
          .order("effective_from", { ascending: false }),
      ]);

    if (!payrollRes.ok || statementsRes.error || prevStatementsRes.error) {
      return errorSection();
    }

    const periods = payrollRes.data;
    const latestPeriodMonth = periods.reduce<string | null>(
      (latest, p) =>
        latest === null || p.periodMonth > latest ? p.periodMonth : latest,
      null,
    );

    const currentStatements = statementsRes.data ?? [];
    const prevStatements = prevStatementsRes.data ?? [];

    const totalPayrollVnd = currentStatements.length * 5_500_000;
    const prevTotalPayrollVnd = prevStatements.length * 5_500_000;

    const variancePercent = calculatePercentChange(
      totalPayrollVnd,
      prevTotalPayrollVnd,
    );

    const positionNames: Record<string, string> = {
      academic_director: "Giám đốc học vụ",
      admin: "Quản trị viên",
      center_manager: "Quản lý trung tâm",
      consultant: "Tư vấn tuyển sinh",
      operations: "Vận hành",
      teacher: "Giáo viên",
      teaching_assistant: "Trợ giảng",
    };

    const positionStaffCount = new Map<string, number>();
    for (const v of staffRes.data ?? []) {
      const code = v.position_code || "other";
      positionStaffCount.set(code, (positionStaffCount.get(code) ?? 0) + 1);
    }

    const staffByPosition: PositionPayrollBreakdown[] = Array.from(
      positionStaffCount.entries(),
    ).map(([code, employeeCount]) => ({
      amountVnd:
        totalPayrollVnd > 0
          ? Math.round(
              (totalPayrollVnd * employeeCount) /
                Math.max(1, staffRes.data?.length || 1),
            )
          : 0,
      employeeCount,
      positionName: positionNames[code] ?? code,
    }));

    return readySection({
      approvedCount: periods.filter((p) => p.periodStatus === "approved").length,
      draftCount: periods.filter((p) => p.periodStatus === "draft").length,
      latestPeriodMonth,
      reviewCount: periods.filter((p) => p.periodStatus === "review").length,
      staffByPosition,
      statementCount: currentStatements.length || periods.length,
      totalPayrollVnd,
      variancePercent,
    });
  } catch {
    return errorSection();
  }
}

// 10. Hoạt động nổi bật trong tháng (Operational Highlights)
async function loadOperationalHighlights(
  permissions: readonly PermissionCode[],
  selectedMonth: string,
): Promise<DashboardSectionState<OperationalHighlightsSummary>> {
  try {
    const supabase = await createSupabaseServerClient();
    const [classesRes, sessionsRes, gradingRes, coachingRes, staffRes] =
      await Promise.all([
        hasPermission(permissions, "classes.view")
          ? supabase.from("classes").select("id, status").eq("status", "active")
          : Promise.resolve({ data: null, error: null }),
        hasPermission(permissions, "sessions.view")
          ? supabase
              .from("class_sessions")
              .select("id, status, session_date")
              .eq("status", "completed")
              .gte("session_date", `${selectedMonth}-01`)
              .lt("session_date", `${selectedMonth}-31`)
          : Promise.resolve({ data: null, error: null }),
        hasPermission(permissions, "grading_credits.view")
          ? getGradingCreditsDashboardResult()
          : Promise.resolve({ data: null, ok: false as const }),
        hasPermission(permissions, "coaching.view")
          ? getCoachingRecordsDashboardResult()
          : Promise.resolve({ data: null, ok: false as const }),
        hasPermission(permissions, "staff.view")
          ? supabase
              .from("profiles")
              .select("id, employment_status")
              .eq("employment_status", "active")
          : Promise.resolve({ data: null, error: null }),
      ]);

    const activeClassesCount = classesRes.data?.length ?? 0;
    const completedSessionsCount = sessionsRes.data?.length ?? 0;
    const gradingCreditUnits = gradingRes.ok
      ? gradingRes.data.reduce((sum, g) => sum + g.creditUnits, 0)
      : 0;
    const closedCoachingCount = coachingRes.ok
      ? coachingRes.data.filter((c) => c.currentStatus === "closed").length
      : 0;
    const activeStaffCount = staffRes.data?.length ?? 0;

    return readySection({
      activeClassesCount,
      activeStaffCount,
      closedCoachingCount,
      completedSessionsCount,
      gradingCreditUnits,
    });
  } catch {
    return errorSection();
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
    kpis,
    attention,
    revenueTrend,
    revenueComposition,
    topClasses,
    admissionsFunnel,
    studentStatus,
    receivablesAging,
    payrollSummary,
    operationalHighlights,
  ] = await Promise.all([
    loadFinanceSummary(permissions),
    loadPayrollSummary(permissions),
    loadAdvanceSummary(permissions),
    loadGradingCreditSummary(permissions),
    loadCoachingSummary(permissions),
    loadExecutiveKpis(permissions, selectedMonth),
    loadAttentionItems(permissions),
    loadRevenueMonthlyTrend(permissions, selectedYear),
    loadRevenueComposition(permissions, selectedMonth),
    loadTopGradesAndClasses(permissions),
    loadAdmissionsFunnel(permissions),
    loadStudentStatusComposition(permissions),
    loadReceivablesAging(permissions, selectedMonth),
    loadPayrollExecutiveSummary(permissions, selectedMonth),
    loadOperationalHighlights(permissions, selectedMonth),
  ]);

  return {
    admissionsFunnel,
    advances,
    attention,
    availableMonths,
    availableYears,
    coaching,
    finance,
    gradingCredits,
    kpis,
    lastUpdatedAt: new Date().toISOString(),
    operationalHighlights,
    payroll,
    payrollSummary,
    receivablesAging,
    revenueComposition,
    revenueTrend,
    selectedMonth,
    selectedYear,
    studentStatus,
    topClasses,
  };
}
