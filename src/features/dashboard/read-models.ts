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
  totalPayableVnd: number;
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

export interface DashboardCommissionSummary {
  accrualCount: number;
  latestRecognizedAt: string | null;
  mmaAccrualCount: number;
  recognizedRevenueVnd: number;
  sandboxAccrualCount: number;
}

export interface DashboardCoachingSummary {
  closedCount: number;
  highPriorityCount: number;
  inProgressCount: number;
  openCount: number;
  recordCount: number;
}

export interface RoleAwareDashboardReadModel {
  advances: DashboardSectionState<DashboardAdvanceSummary>;
  coaching: DashboardSectionState<DashboardCoachingSummary>;
  commissions: DashboardSectionState<DashboardCommissionSummary>;
  finance: DashboardSectionState<DashboardFinanceSummary>;
  gradingCredits: DashboardSectionState<DashboardGradingCreditSummary>;
  payroll: DashboardSectionState<DashboardPayrollSummary>;
}
