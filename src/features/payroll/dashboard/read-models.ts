export const UNASSIGNED_POSITION_CODE = "__unassigned__";

export interface PayrollDashboardSourcePeriod {
  month: string;
  status: string;
}

export interface PayrollDashboardSourceStatement {
  month: string;
  payableAmountVnd: number;
  payrollStatementId: string;
  periodStatus: string;
  positionCode: string | null;
  staffDisplayName: string;
  staffEmployeeCode: string | null;
  staffId: string;
  totalDeductionsVnd: number;
  totalEarningsVnd: number;
}

export interface PayrollDashboardSourceComposition {
  amountVnd: number;
  direction: "deduction" | "earning";
  lineType: string;
  month: string;
}

export interface PayrollDashboardSource {
  composition: readonly PayrollDashboardSourceComposition[];
  periods: readonly PayrollDashboardSourcePeriod[];
  positionOptions: readonly { code: string | null }[];
  selectedMonth: string;
  selectedPositionCode: string | null;
  statements: readonly PayrollDashboardSourceStatement[];
}

export interface PayrollDashboardPositionOption {
  code: string;
  name: string;
}

export interface PayrollDashboardPositionSummary {
  averagePayroll: number;
  employeeCount: number;
  highestPayroll: number;
  lowestPayroll: number;
  positionCode: string;
  positionName: string;
  sharePercent: number;
  totalPayroll: number;
}

export interface PayrollDashboardEmployee {
  change: number;
  changePercent: number | null;
  currentPayroll: number;
  isNew: boolean;
  positionCode: string;
  positionName: string;
  previousPayroll: number;
  sharePercent: number;
  staffDisplayName: string;
  staffEmployeeCode: string | null;
  staffId: string;
}

export interface PayrollDashboardCompositionItem {
  amountVnd: number;
  direction: "deduction" | "earning";
  label: string;
  lineType: string;
  sharePercent: number;
}

export interface PayrollDashboardData {
  byPosition: readonly PayrollDashboardPositionSummary[];
  composition: readonly PayrollDashboardCompositionItem[];
  filters: {
    availableMonths: readonly PayrollDashboardSourcePeriod[];
    positions: readonly PayrollDashboardPositionOption[];
    selectedMonth: string;
    selectedPositionCode: string | null;
  };
  insights: readonly string[];
  periodStatus: string | null;
  significantChanges: {
    decreases: readonly PayrollDashboardEmployee[];
    increases: readonly PayrollDashboardEmployee[];
  };
  summary: {
    averageSalary: number;
    employeeChange: number;
    employeeCount: number;
    highestPaidEmployee: PayrollDashboardEmployee | null;
    payrollChange: number;
    payrollChangePercent: number | null;
    previousMonthPayroll: number;
    totalPayroll: number;
  };
  topEmployees: readonly PayrollDashboardEmployee[];
  trend: readonly {
    employeeCount: number;
    month: string;
    totalPayroll: number;
  }[];
}

export type PayrollDashboardResult =
  | { data: PayrollDashboardData; ok: true }
  | { ok: false };
