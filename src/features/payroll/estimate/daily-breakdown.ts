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

/**
 * Trạng thái tính tiền của một ca, đọc từ dòng lương công gắn với ca đó
 * (`sourceKind = "time_entry"`, `sourceId` = id ca chấm công). Một ca đã kết thúc
 * chỉ được coi là đã tính tiền khi có dòng lương công gắn với nó (dòng lương công
 * cần phút công > 0 và đơn giá ngày công offline):
 * - `open`: ca đang mở, chưa tính tiền.
 * - `provisional`: chưa xác minh nhưng đã được tính tạm (dòng lương công mang
 *   `isPendingVerification`; RPC chỉ tính tạm khi có ngoại lệ chấm công đang chờ duyệt).
 * - `unverified_unpaid`: chưa xác minh và không có dòng lương công nào: chưa tính tiền.
 * - `not_in_pay`: tháng tạm tính, ca đã xác minh nhưng không có dòng lương công
 *   (lý do lấy từ cảnh báo thiếu đơn giá của ngày, nếu có). Tháng
 *   đã duyệt không suy ra trạng thái này: dòng lương đã chốt có thể thiếu khóa
 *   nguồn (kỳ cũ) và ca đọc trực tiếp có thể đổi sau khi chốt.
 * - `counted`: đã có dòng lương công không còn chờ xác minh dù ca hiện vẫn chưa
 *   xác minh (kỳ đã chốt trước khi trạng thái ca thay đổi).
 * - `verified`: ca đã xác minh và có dòng lương công.
 */
export type ShiftPayState = "counted" | "not_in_pay" | "open" | "provisional" | "unverified_unpaid" | "verified";

export type NotInPayReason = "missing_daily_rate";

export type DailyPayrollShift = StaffMonthShift & { notInPayReason: NotInPayReason | null; payState: ShiftPayState };

export interface DailyPayrollDay {
  allowanceVnd: number;
  baseSalaryVnd: number;
  bonusVnd: number;
  /** Đơn giá ngày công offline của dòng lương công offline đầu tiên trong ngày (nếu có). */
  dailyRateVnd: number | null;
  dayOfMonth: number;
  deductionVnd: number;
  hasOpenShift: boolean;
  isFuture: boolean;
  isToday: boolean;
  lines: StaffEstimateLine[];
  /** Ca chưa xác minh nhưng đã được tính tạm vào lương. */
  pendingVerificationCount: number;
  shifts: DailyPayrollShift[];
  /** Tổng thu nhập phát sinh trong ngày sau khi trừ khấu trừ gắn ngày (hiếm). */
  totalVnd: number;
  /** Ca đã xác minh nhưng không có dòng lương công (xem `not_in_pay`). */
  notInPayCount: number;
  /** Ca đã kết thúc, chưa xác minh và chưa được tính tiền. */
  unverifiedUnpaidCount: number;
  /** 0 = Chủ nhật ... 6 = Thứ bảy */
  weekday: number;
  workDate: string;
  /** Phút công đã tính tiền (không gồm ca đang mở và ca không có dòng lương công). */
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

/**
 * Ca chấm công đã có dòng lương công, kèm cờ "tính tạm". Kỳ đã chốt không
 * bao giờ tính tạm (bản chốt chỉ gồm công đã xác minh).
 */
export function getPaidTimeEntries(
  estimate: Pick<StaffPayrollEstimate, "lines"> & Partial<Pick<StaffPayrollEstimate, "status">>,
): Map<string, { provisional: boolean }> {
  const paid = new Map<string, { provisional: boolean }>();
  const isApproved = estimate.status === "approved";
  for (const line of estimate.lines ?? []) {
    if (line.sourceKind !== "time_entry" || !line.sourceId || !baseSalaryLineTypes.has(line.lineType)) continue;
    if (line.direction !== "earning") continue;
    const provisional = !isApproved && line.isPendingVerification === true;
    const existing = paid.get(line.sourceId);
    paid.set(line.sourceId, { provisional: (existing?.provisional ?? false) || provisional });
  }
  return paid;
}

export interface ShiftPayContext {
  isApproved: boolean;
  /** Ngày có cảnh báo thiếu đơn giá (details.work_date), để nói vì sao ca chưa tính. */
  issueByWorkDate: ReadonlyMap<string, NotInPayReason>;
  /** Mã ca chấm công → có dòng lương công, kèm cờ "tính tạm". Rỗng = chưa ca nào được tính. */
  paidTimeEntries: ReadonlyMap<string, { provisional: boolean }>;
}

export function getShiftPayContext(
  estimate: Pick<StaffPayrollEstimate, "lines"> & Partial<Pick<StaffPayrollEstimate, "issues" | "status">>,
): ShiftPayContext {
  const issueByWorkDate = new Map<string, NotInPayReason>();
  // Base pay lines need only a daily rate (not a payroll position), so the only
  // known reason a verified shift has no base line is a missing daily rate.
  for (const issue of estimate.issues ?? []) {
    const workDate = issue.details?.work_date;
    if (issue.issueCode === "missing_daily_rate" && typeof workDate === "string") {
      issueByWorkDate.set(workDate.slice(0, 10), "missing_daily_rate");
    }
  }
  return {
    isApproved: estimate.status === "approved",
    issueByWorkDate,
    paidTimeEntries: getPaidTimeEntries(estimate),
  };
}

/** Lý do ca `not_in_pay` chưa được tính, nếu cảnh báo của ngày đó cho biết. */
export function getNotInPayReason(
  shift: Pick<StaffMonthShift, "workDate">,
  context: ShiftPayContext,
): NotInPayReason | null {
  return context.issueByWorkDate.get(shift.workDate) ?? null;
}

export function getShiftPayState(
  shift: Pick<StaffMonthShift, "checkOutAt" | "id" | "isPendingVerification" | "status" | "workedMinutes">,
  context: ShiftPayContext,
): ShiftPayState {
  if (isOpenShift(shift)) return "open";
  const paid = context.paidTimeEntries.get(shift.id);
  if (paid) {
    if (!shift.isPendingVerification) return "verified";
    return paid.provisional ? "provisional" : "counted";
  }
  // Final pay only includes time entries verified at approval.
  if (shift.isPendingVerification) return "unverified_unpaid";
  // Approved: frozen lines may lack source keys (older periods) and the live
  // shift may have changed since, so never infer "not in pay" there.
  // A 0-minute shift has nothing to pay (base lines need worked minutes > 0).
  if (context.isApproved || shift.workedMinutes <= 0) return "verified";
  // Estimate mode links every base line to its time entry: no line = not paid
  // (no daily rate, no payroll position, or not eligible this month).
  return "not_in_pay";
}

/** Nhãn và tông của trạng thái tính tiền một ca; dùng chung cho mọi nơi liệt kê ca. */
export function getShiftPayBadge(
  payState: ShiftPayState,
  options: { isApproved: boolean; notInPayReason?: NotInPayReason | null },
): { label: string; tone: "neutral" | "success" | "warning" } {
  switch (payState) {
    case "counted":
      return { label: "Đã tính", tone: "success" };
    case "not_in_pay":
      return {
        label: options.notInPayReason === "missing_daily_rate" ? "Chưa tính · thiếu đơn giá" : "Chưa tính",
        tone: "neutral",
      };
    case "open":
      return { label: "Chưa tính", tone: "neutral" };
    case "provisional":
      return { label: "Chờ xác minh (tính tạm)", tone: "warning" };
    case "unverified_unpaid":
      return { label: "Chưa tính · chưa xác minh", tone: "neutral" };
    case "verified":
      return { label: "Đã xác minh", tone: "success" };
  }
}

function toDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Gom các dòng lương và ca làm việc của tháng thành bảng theo ngày (đủ mọi ngày
 * trong tháng) cộng phần "khoản tính theo tháng". Hàm thuần, không phụ thuộc UI.
 */
export function buildDailyPayrollBreakdown(
  estimate: Pick<StaffPayrollEstimate, "lines" | "month" | "shifts"> & Partial<Pick<StaffPayrollEstimate, "issues" | "status">>,
  options: { today?: string } = {},
): DailyPayrollBreakdown {
  const today = options.today ?? getTodayInVietnam();
  const payContext = getShiftPayContext(estimate);
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
      dailyRateVnd: null,
      dayOfMonth: day,
      deductionVnd: 0,
      hasOpenShift: false,
      isFuture: workDate > today,
      isToday: workDate === today,
      lines: [],
      notInPayCount: 0,
      pendingVerificationCount: 0,
      shifts: [],
      totalVnd: 0,
      unverifiedUnpaidCount: 0,
      weekday: new Date(Date.UTC(year, monthIndex, day)).getUTCDay(),
      workDate,
      workedMinutes: 0,
    });
  }

  for (const shift of estimate.shifts ?? []) {
    const day = dayMap.get(shift.workDate.slice(0, 10));
    if (!day) continue;

    const payState = getShiftPayState(shift, payContext);
    day.shifts.push({
      ...shift,
      notInPayReason: payState === "not_in_pay" ? getNotInPayReason(shift, payContext) : null,
      payState,
    });

    if (payState === "open") {
      day.hasOpenShift = true;
      continue;
    }

    if (payState === "unverified_unpaid") {
      // Not in pay: its minutes are not "đã tính tiền".
      day.unverifiedUnpaidCount += 1;
      continue;
    }

    if (payState === "not_in_pay") {
      // Verified but no base pay line links to it: not "đã tính tiền" either.
      day.notInPayCount += 1;
      continue;
    }

    day.workedMinutes += shift.workedMinutes;
    if (payState === "provisional") {
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
      // base_online carries the full offline rate while pay uses the online share:
      // only an offline line states the day rate.
      if (line.lineType === "base_offline" && day.dailyRateVnd === null && line.unitRateVnd !== null) {
        day.dailyRateVnd = line.unitRateVnd;
      }
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
    if (day.totalVnd !== 0 || day.workedMinutes > 0 || day.hasOpenShift || day.unverifiedUnpaidCount > 0 || day.notInPayCount > 0) {
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

/**
 * Đơn giá ngày công offline của tháng: lấy dòng lương công offline có ngày công
 * muộn nhất (dòng dự tính không xếp theo ngày), và báo khi trong tháng có hơn
 * một mức. Null khi tháng chưa có dòng lương công offline nào: không suy ra số 0.
 */
export function getOfflineDailyRate(
  lines: readonly StaffEstimateLine[],
): { hasMultipleRates: boolean; latestRateVnd: number } | null {
  let latest: StaffEstimateLine | null = null;
  const rates = new Set<number>();
  for (const line of lines) {
    if (line.lineType !== "base_offline" || line.unitRateVnd === null) continue;
    rates.add(line.unitRateVnd);
    if (!latest || (line.workDate ?? "") > (latest.workDate ?? "")) latest = line;
  }
  if (!latest || latest.unitRateVnd === null) return null;
  return { hasMultipleRates: rates.size > 1, latestRateVnd: latest.unitRateVnd };
}

export function isOpenShift(shift: Pick<StaffMonthShift, "checkOutAt" | "status">): boolean {
  return shift.status === "open" || !shift.checkOutAt;
}

/**
 * Ca đã kết thúc nhưng chờ xác minh công và được tính tạm vào lương (có dòng
 * lương công tính tạm gắn với ca). Số ca = số ca tính tạm đó, vì
 * `statement.pendingVerificationCount` đếm cả ca chờ xác minh không được tính
 * tiền (0 phút, thiếu đơn giá). Chỉ payload cũ không có danh sách ca mới lấy số
 * theo bảng lương.
 */
export function getPendingVerificationSummary(
  estimate: Pick<StaffPayrollEstimate, "lines" | "shifts" | "statement"> & Partial<Pick<StaffPayrollEstimate, "status">>,
): { count: number; shifts: StaffMonthShift[] } {
  const payContext = getShiftPayContext(estimate);
  const allShifts = estimate.shifts ?? [];
  const shifts = allShifts
    .filter((shift) => getShiftPayState(shift, payContext) === "provisional")
    .sort((left, right) => left.workDate.localeCompare(right.workDate));
  const count = allShifts.length > 0 ? shifts.length : estimate.statement?.pendingVerificationCount ?? 0;
  return { count, shifts };
}

/** "dd/MM" của một ngày YYYY-MM-DD. */
export function formatDayMonth(workDate: string): string {
  const [, month, day] = workDate.slice(0, 10).split("-");
  return `${day}/${month}`;
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
