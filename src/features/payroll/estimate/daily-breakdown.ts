import type {
  StaffEstimateLine,
  StaffMonthShift,
  StaffPayrollEstimate,
} from "@/features/payroll/estimate/types";

/**
 * Nguồn gắn với một ngày cụ thể. Mọi nguồn khác (quỹ chấm bài, ngưỡng doanh thu,
 * bù trừ lương khoán, tạm ứng, điều chỉnh thủ công...) là khoản tính theo tháng.
 */
export const datedSourceKinds: ReadonlySet<string> = new Set([
  "payroll_source_fact",
  "time_entry",
  "timekeeping",
]);

export const baseSalaryLineTypes: ReadonlySet<string> = new Set(["base_offline", "base_online"]);

export interface DailyPayrollDay {
  allowanceVnd: number;
  baseSalaryVnd: number;
  bonusVnd: number;
  dayOfMonth: number;
  deductionVnd: number;
  hasOpenShift: boolean;
  isFuture: boolean;
  isToday: boolean;
  lines: StaffEstimateLine[];
  pendingVerificationCount: number;
  shifts: StaffMonthShift[];
  /** Tổng thu nhập phát sinh trong ngày sau khi trừ khấu trừ gắn ngày (hiếm). */
  totalVnd: number;
  /** 0 = Chủ nhật ... 6 = Thứ bảy */
  weekday: number;
  workDate: string;
  workedMinutes: number;
}

export interface DailyPayrollBreakdown {
  /** Số ngày có công hoặc có tiền phát sinh. */
  activeDayCount: number;
  dailyTotalVnd: number;
  days: DailyPayrollDay[];
  /** Tổng theo ngày + khoản theo tháng; bằng lương tạm tính sau khấu trừ. */
  grandTotalVnd: number;
  monthlyDeductionsVnd: number;
  monthlyEarningsVnd: number;
  monthlyItems: StaffEstimateLine[];
  monthlyNetVnd: number;
  /** Công đã tính tiền cộng theo ngày (phút). */
  totalWorkedMinutes: number;
}

export function isDatedLine(line: Pick<StaffEstimateLine, "sourceKind" | "workDate">): boolean {
  return Boolean(line.workDate) && Boolean(line.sourceKind) && datedSourceKinds.has(line.sourceKind as string);
}

export function getTodayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(now);
}

function toDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Gom các dòng lương và ca làm việc của tháng thành bảng theo ngày (đủ mọi ngày
 * trong tháng) cộng phần "khoản tính theo tháng". Hàm thuần, không phụ thuộc UI.
 */
export function buildDailyPayrollBreakdown(
  estimate: Pick<StaffPayrollEstimate, "lines" | "month" | "shifts">,
  options: { today?: string } = {},
): DailyPayrollBreakdown {
  const today = options.today ?? getTodayInVietnam();
  const [yearText, monthText] = estimate.month.slice(0, 7).split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const dayMap = new Map<string, DailyPayrollDay>();

  for (let day = 1; day <= dayCount; day += 1) {
    const workDate = toDateKey(year, monthIndex, day);
    dayMap.set(workDate, {
      allowanceVnd: 0,
      baseSalaryVnd: 0,
      bonusVnd: 0,
      dayOfMonth: day,
      deductionVnd: 0,
      hasOpenShift: false,
      isFuture: workDate > today,
      isToday: workDate === today,
      lines: [],
      pendingVerificationCount: 0,
      shifts: [],
      totalVnd: 0,
      weekday: new Date(Date.UTC(year, monthIndex, day)).getUTCDay(),
      workDate,
      workedMinutes: 0,
    });
  }

  for (const shift of estimate.shifts ?? []) {
    const day = dayMap.get(shift.workDate.slice(0, 10));
    if (!day) continue;

    day.shifts.push(shift);

    if (shift.status === "open" || !shift.checkOutAt) {
      day.hasOpenShift = true;
      continue;
    }

    day.workedMinutes += shift.workedMinutes;
    if (shift.isPendingVerification) {
      day.pendingVerificationCount += 1;
    }
  }

  const monthlyItems: StaffEstimateLine[] = [];

  for (const line of estimate.lines ?? []) {
    const day = isDatedLine(line) ? dayMap.get((line.workDate as string).slice(0, 10)) : undefined;

    if (!day) {
      monthlyItems.push(line);
      continue;
    }

    day.lines.push(line);

    if (line.direction === "deduction") {
      day.deductionVnd += line.amountVnd;
    } else if (baseSalaryLineTypes.has(line.lineType)) {
      day.baseSalaryVnd += line.amountVnd;
    } else if (line.lineType === "teaching_allowance") {
      day.allowanceVnd += line.amountVnd;
    } else {
      day.bonusVnd += line.amountVnd;
    }
  }

  const days = Array.from(dayMap.values());
  let dailyTotalVnd = 0;
  let activeDayCount = 0;
  let totalWorkedMinutes = 0;

  for (const day of days) {
    day.totalVnd = day.baseSalaryVnd + day.allowanceVnd + day.bonusVnd - day.deductionVnd;
    dailyTotalVnd += day.totalVnd;
    totalWorkedMinutes += day.workedMinutes;
    if (day.totalVnd !== 0 || day.workedMinutes > 0 || day.hasOpenShift) {
      activeDayCount += 1;
    }
  }

  const monthlyEarningsVnd = monthlyItems
    .filter((line) => line.direction === "earning")
    .reduce((sum, line) => sum + line.amountVnd, 0);
  const monthlyDeductionsVnd = monthlyItems
    .filter((line) => line.direction === "deduction")
    .reduce((sum, line) => sum + line.amountVnd, 0);
  const monthlyNetVnd = monthlyEarningsVnd - monthlyDeductionsVnd;

  return {
    activeDayCount,
    dailyTotalVnd,
    days,
    grandTotalVnd: dailyTotalVnd + monthlyNetVnd,
    monthlyDeductionsVnd,
    monthlyEarningsVnd,
    monthlyItems,
    monthlyNetVnd,
    totalWorkedMinutes,
  };
}

const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export function getWeekdayLabel(weekday: number): string {
  return weekdayLabels[weekday] ?? "";
}

/** "HH:mm" theo giờ Việt Nam từ chuỗi ISO. */
export function formatClockTime(value: string | null): string {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
