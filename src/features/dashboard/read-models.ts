export type DashboardSectionState<T> =
  | {
      status: "hidden";
    }
  | {
      status: "error";
    }
  | {
      data: T;
      status: "ready";
    };

// Legacy summaries for backward compatibility
export interface DashboardFinanceSummary {
  disbursementVnd: number;
  netCashflowVnd: number;
  paymentRequestCount: number;
  receiptVnd: number;
  refundVnd: number;
}

export interface DashboardPayrollSummary {
  approvedStatementCount: number;
  draftStatementCount: number;
  latestPeriodMonth: string | null;
  reviewStatementCount: number;
  statementCount: number;
}

export interface DashboardAdvanceSummary {
  approvedUndeductedCount: number;
  deductedCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  requestCount: number;
  totalRequestedVnd: number;
}

export interface DashboardGradingCreditSummary {
  entryCount: number;
  latestCreditedAt: string | null;
  totalCreditUnits: number;
}

export interface DashboardCoachingSummary {
  closedCount: number;
  highPriorityCount: number;
  inProgressCount: number;
  openCount: number;
  recordCount: number;
}

// Executive Dashboard Models
export interface ExecutiveKpisSummary {
  disbursementChangePercent: number | null;
  disbursementVnd: number;
  netCashflowChangePercent: number | null;
  netCashflowVnd: number;
  receivablesVnd: number;
  revenueChangePercent: number | null;
  revenueVnd: number;
  totalStudents: number;
  totalStudentsChangePercent: number | null;
}

export interface AttentionItem {
  count: number;
  description: string;
  href: string;
  id: string;
  module: string;
  severity: "danger" | "info" | "warning";
  title: string;
}

export interface MonthlyRevenueTrendItem {
  costVnd: number;
  month: string;
  monthLabel: string;
  netVnd: number;
  revenueVnd: number;
}

export interface RevenueCompositionItem {
  amountVnd: number;
  category: string;
  color?: string;
  label: string;
  sharePercent: number;
}

export interface TopGradeOrClassItem {
  code: string;
  id: string;
  name: string;
  rank: number;
  revenueVnd: number;
  studentCount: number;
}

export interface AdmissionsFunnelStep {
  count: number;
  key: "consulted" | "contacted" | "enrolled" | "leads" | "registered";
  label: string;
  percentage: number;
}

export interface AdmissionsFunnelSummary {
  conversionRatePercent: number;
  steps: AdmissionsFunnelStep[];
  topSources: { count: number; name: string }[];
  totalLeads: number;
}

export interface StudentStatusItem {
  color: string;
  count: number;
  key: string;
  label: string;
  percentage: number;
}

export interface StudentStatusDistribution {
  activeCount: number;
  completedCount: number;
  items: StudentStatusItem[];
  reservedCount: number;
  totalCount: number;
  waitingCount: number;
}

export interface ReceivablesAgingItem {
  amountVnd: number;
  color: string;
  key: string;
  label: string;
  percentage: number;
}

export interface ReceivablesAgingDistribution {
  collectedVnd: number;
  from31To60DaysVnd: number;
  items: ReceivablesAgingItem[];
  over60DaysVnd: number;
  totalReceivablesVnd: number;
  under30DaysVnd: number;
}

export interface PositionPayrollBreakdown {
  amountVnd: number;
  employeeCount: number;
  positionName: string;
}

export interface PayrollExecutiveSummary {
  approvedCount: number;
  draftCount: number;
  latestPeriodMonth: string | null;
  reviewCount: number;
  staffByPosition: PositionPayrollBreakdown[];
  statementCount: number;
  totalPayrollVnd: number;
  variancePercent: number | null;
}

export interface OperationalHighlightsSummary {
  activeClassesCount: number;
  activeStaffCount: number;
  closedCoachingCount: number;
  completedSessionsCount: number;
  gradingCreditUnits: number;
}

export interface RoleAwareDashboardReadModel {
  // Legacy modules
  advances: DashboardSectionState<DashboardAdvanceSummary>;
  coaching: DashboardSectionState<DashboardCoachingSummary>;
  finance: DashboardSectionState<DashboardFinanceSummary>;
  gradingCredits: DashboardSectionState<DashboardGradingCreditSummary>;
  payroll: DashboardSectionState<DashboardPayrollSummary>;

  // Executive modules
  admissionsFunnel: DashboardSectionState<AdmissionsFunnelSummary>;
  attention: DashboardSectionState<AttentionItem[]>;
  availableMonths: string[];
  availableYears: number[];
  kpis: DashboardSectionState<ExecutiveKpisSummary>;
  lastUpdatedAt: string;
  operationalHighlights: DashboardSectionState<OperationalHighlightsSummary>;
  payrollSummary: DashboardSectionState<PayrollExecutiveSummary>;
  receivablesAging: DashboardSectionState<ReceivablesAgingDistribution>;
  revenueComposition: DashboardSectionState<RevenueCompositionItem[]>;
  revenueTrend: DashboardSectionState<MonthlyRevenueTrendItem[]>;
  selectedMonth: string;
  selectedYear: number;
  studentStatus: DashboardSectionState<StudentStatusDistribution>;
  topClasses: DashboardSectionState<TopGradeOrClassItem[]>;
}
