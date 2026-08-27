import { getLineTypeLabel } from "@/features/payroll/payroll-presentation";
import {
  payrollPositionLabels,
  type PayrollPositionCode,
} from "@/features/staff/payroll-profile-types";
import type {
  PayrollDashboardData,
  PayrollDashboardEmployee,
  PayrollDashboardPositionOption,
  PayrollDashboardPositionSummary,
  PayrollDashboardSource,
  PayrollDashboardSourceStatement,
} from "@/features/payroll/dashboard/read-models";
import { UNASSIGNED_POSITION_CODE } from "@/features/payroll/dashboard/read-models";

function addMonths(month: string, offset: number): string {
  const [year, monthNumber] = month.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function calculateChangePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function getPayrollPositionName(code: string | null): string {
  if (!code || code === UNASSIGNED_POSITION_CODE) return "Chưa phân loại";
  if (Object.hasOwn(payrollPositionLabels, code)) {
    return payrollPositionLabels[code as PayrollPositionCode];
  }
  return code.replaceAll("_", " ");
}

function getPositionCode(statement: PayrollDashboardSourceStatement): string {
  return statement.positionCode ?? UNASSIGNED_POSITION_CODE;
}

function sumPayroll(statements: readonly PayrollDashboardSourceStatement[]): number {
  return statements.reduce((sum, statement) => sum + statement.payableAmountVnd, 0);
}

function toEmployee(
  current: PayrollDashboardSourceStatement,
  previous: PayrollDashboardSourceStatement | undefined,
  totalPayroll: number,
): PayrollDashboardEmployee {
  const previousPayroll = previous?.payableAmountVnd ?? 0;
  const currentPayroll = current.payableAmountVnd;
  const positionCode = getPositionCode(current);
  return {
    change: currentPayroll - previousPayroll,
    changePercent: calculateChangePercent(currentPayroll, previousPayroll),
    currentPayroll,
    isNew: previous === undefined,
    positionCode,
    positionName: getPayrollPositionName(positionCode),
    previousPayroll,
    sharePercent: totalPayroll === 0 ? 0 : (currentPayroll / totalPayroll) * 100,
    staffDisplayName: current.staffDisplayName,
    staffEmployeeCode: current.staffEmployeeCode,
    staffId: current.staffId,
  };
}

function toDepartedEmployee(
  previous: PayrollDashboardSourceStatement,
): PayrollDashboardEmployee {
  const positionCode = getPositionCode(previous);
  return {
    change: -previous.payableAmountVnd,
    changePercent: previous.payableAmountVnd === 0 ? null : -100,
    currentPayroll: 0,
    isNew: false,
    positionCode,
    positionName: getPayrollPositionName(positionCode),
    previousPayroll: previous.payableAmountVnd,
    sharePercent: 0,
    staffDisplayName: previous.staffDisplayName,
    staffEmployeeCode: previous.staffEmployeeCode,
    staffId: previous.staffId,
  };
}

function buildPositionSummaries(
  statements: readonly PayrollDashboardSourceStatement[],
  totalPayroll: number,
): PayrollDashboardPositionSummary[] {
  const groups = new Map<string, PayrollDashboardSourceStatement[]>();
  for (const statement of statements) {
    const code = getPositionCode(statement);
    groups.set(code, [...(groups.get(code) ?? []), statement]);
  }

  return [...groups.entries()]
    .map(([positionCode, group]) => {
      const values = group.map((statement) => statement.payableAmountVnd);
      const groupTotal = values.reduce((sum, value) => sum + value, 0);
      return {
        averagePayroll: group.length === 0 ? 0 : groupTotal / group.length,
        employeeCount: new Set(group.map((statement) => statement.staffId)).size,
        highestPayroll: Math.max(...values),
        lowestPayroll: Math.min(...values),
        positionCode,
        positionName: getPayrollPositionName(positionCode),
        sharePercent: totalPayroll === 0 ? 0 : (groupTotal / totalPayroll) * 100,
        totalPayroll: groupTotal,
      };
    })
    .sort((left, right) => right.totalPayroll - left.totalPayroll);
}

function buildPositionOptions(source: PayrollDashboardSource): PayrollDashboardPositionOption[] {
  const codes = new Set(
    source.positionOptions.map((position) => position.code ?? UNASSIGNED_POSITION_CODE),
  );
  if (source.selectedPositionCode) {
    codes.add(source.selectedPositionCode);
  }
  return [...codes]
    .map((code) => ({ code, name: getPayrollPositionName(code) }))
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));
}

export function buildPayrollDashboardData(source: PayrollDashboardSource): PayrollDashboardData {
  const selectedMonth = source.selectedMonth.slice(0, 10);
  const previousMonth = addMonths(selectedMonth, -1);
  const currentStatements = source.statements.filter((item) => item.month === selectedMonth);
  const previousStatements = source.statements.filter((item) => item.month === previousMonth);
  const previousByStaff = new Map(previousStatements.map((item) => [item.staffId, item]));
  const currentStaff = new Set(currentStatements.map((item) => item.staffId));
  const previousStaff = new Set(previousStatements.map((item) => item.staffId));
  const totalPayroll = sumPayroll(currentStatements);
  const previousMonthPayroll = sumPayroll(previousStatements);
  const employees = currentStatements
    .map((statement) => toEmployee(statement, previousByStaff.get(statement.staffId), totalPayroll))
    .sort((left, right) => right.currentPayroll - left.currentPayroll);
  const changeEmployees = [
    ...employees,
    ...previousStatements
      .filter((statement) => !currentStaff.has(statement.staffId))
      .map(toDepartedEmployee),
  ];
  const byPosition = buildPositionSummaries(currentStatements, totalPayroll);

  const compositionForMonth = source.composition.filter((item) => item.month === selectedMonth);
  const grossEarnings = compositionForMonth
    .filter((item) => item.direction === "earning")
    .reduce((sum, item) => sum + item.amountVnd, 0);
  const composition = compositionForMonth
    .map((item) => ({
      ...item,
      label: getLineTypeLabel(item.lineType),
      sharePercent: grossEarnings === 0 ? 0 : (item.amountVnd / grossEarnings) * 100,
    }))
    .sort((left, right) => right.amountVnd - left.amountVnd);

  const trend = Array.from({ length: 6 }, (_, index) => addMonths(selectedMonth, index - 5))
    .map((month) => {
      const statements = source.statements.filter((item) => item.month === month);
      return {
        employeeCount: new Set(statements.map((item) => item.staffId)).size,
        month,
        totalPayroll: sumPayroll(statements),
      };
    });

  const payrollChange = totalPayroll - previousMonthPayroll;
  const payrollChangePercent = calculateChangePercent(totalPayroll, previousMonthPayroll);
  const averageSalary = currentStaff.size === 0 ? 0 : totalPayroll / currentStaff.size;
  const previousAverage = previousStaff.size === 0 ? 0 : previousMonthPayroll / previousStaff.size;
  const averageChangePercent = calculateChangePercent(averageSalary, previousAverage);
  const comparableEmployees = changeEmployees.filter((employee) => employee.change !== 0);
  const increases = comparableEmployees
    .filter((employee) => employee.change > 0)
    .sort((left, right) => right.change - left.change)
    .slice(0, 3);
  const decreases = comparableEmployees
    .filter((employee) => employee.change < 0)
    .sort((left, right) => left.change - right.change)
    .slice(0, 3);

  const insights: string[] = [];
  if (payrollChangePercent !== null && Math.abs(payrollChangePercent) >= 5) {
    insights.push(`Quỹ lương ${payrollChangePercent > 0 ? "tăng" : "giảm"} ${Math.abs(payrollChangePercent).toFixed(1).replace(".", ",")}% so với tháng trước.`);
  }
  if (byPosition[0] && byPosition[0].sharePercent >= 35) {
    insights.push(`${byPosition[0].positionName} chiếm ${byPosition[0].sharePercent.toFixed(1).replace(".", ",")}% tổng quỹ lương.`);
  }
  const largeIncreaseCount = employees.filter(
    (employee) => employee.changePercent !== null && employee.changePercent >= 30,
  ).length;
  if (largeIncreaseCount > 0) {
    insights.push(`${largeIncreaseCount} nhân sự có tổng lương tăng từ 30% so với tháng trước.`);
  }
  if (averageChangePercent !== null && Math.abs(averageChangePercent) >= 5) {
    insights.push(`Chi phí trung bình mỗi nhân sự ${averageChangePercent > 0 ? "tăng" : "giảm"} ${Math.abs(averageChangePercent).toFixed(1).replace(".", ",")}% so với tháng trước.`);
  }

  return {
    byPosition,
    composition,
    filters: {
      availableMonths: source.periods,
      positions: buildPositionOptions(source),
      selectedMonth,
      selectedPositionCode: source.selectedPositionCode,
    },
    insights: insights.slice(0, 4),
    periodStatus: currentStatements[0]?.periodStatus
      ?? source.periods.find((period) => period.month === selectedMonth)?.status
      ?? null,
    significantChanges: { decreases, increases },
    summary: {
      averageSalary,
      employeeChange: currentStaff.size - previousStaff.size,
      employeeCount: currentStaff.size,
      highestPaidEmployee: employees[0] ?? null,
      payrollChange,
      payrollChangePercent,
      previousMonthPayroll,
      totalPayroll,
    },
    topEmployees: employees.slice(0, 10),
    trend,
  };
}
