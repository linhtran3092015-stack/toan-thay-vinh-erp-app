import { PIECEWORK_OFFSET } from "@/features/payroll/payroll-line-groups";
import type { PayrollLineRead } from "@/features/payroll/read-models";

const lineTypeLabels: Record<string, string> = {
  advance_deduction: "Khấu trừ tạm ứng",
  admissions_revenue_tier_bonus: "Hoa hồng theo mức doanh thu",
  addon_product_sales_bonus: "Thưởng bán sản phẩm phụ",
  base_offline: "Lương công offline",
  base_online: "Lương công online",
  center_renewal_duty_bonus: "Thưởng quản lý và trực tin nhắn",
  commission: "Hoa hồng",
  daily_admin_reporting_bonus: "Thưởng nhập dòng tiền và báo cáo",
  grading_bonus: "Thưởng chấm bài",
  hourly_wage: "Lương theo giờ",
  kpi_bonus: "Thưởng KPI",
  manual_deduction: "Điều chỉnh giảm",
  manual_reward: "Điều chỉnh tăng",
  new_student_fixed_bonus: "Thưởng tuyển sinh theo nguồn",
  new_student_revenue_bonus: "Thưởng doanh thu tuyển mới",
  operations_grade_renewal_bonus: "Thưởng tái phí khối phụ trách",
  payroll_processing_bonus: "Thưởng tính lương nhân sự",
  piecework_offset: "Phần lương khoán đã tính trong lương cứng",
  record_excess_bonus: "Thưởng doanh thu vượt kỷ lục",
  revenue_bonus: "Thưởng doanh thu",
  staff_recruitment_care_bonus: "Thưởng tuyển dụng và chăm sóc nhân sự",
  student_coaching_bonus: "Thưởng coaching học sinh",
  teaching_allowance: "Phụ cấp trợ giảng",
};

const sourceKindLabels: Record<string, string> = {
  calculation_run: "Kết quả tính trong phiên hiện tại",
  carried_manual_line: "Điều chỉnh được chuyển từ phiên trước",
  coaching_renewal_revenue: "Doanh thu tái phí của học sinh coaching",
  grading_pool: "Dữ liệu phiếu chấm và quỹ chấm bài",
  manual_adjustment: "Điều chỉnh thủ công",
  monthly_center_metric: "Chỉ số tổng hợp toàn trung tâm",
  monthly_new_enrollment_revenue: "Doanh thu tuyển sinh mới trong tháng",
  payroll_source_fact: "Dữ liệu nghiệp vụ đã được ghi nhận",
  salary_advance: "Đề nghị tạm ứng đã duyệt",
  system: "Dữ liệu hệ thống",
  time_entry: "Bản ghi chấm công",
  timekeeping: "Bản ghi chấm công",
};

const metadataLabels: Record<string, string> = {
  amount_per_day_vnd: "Mức áp dụng mỗi ngày",
  amount_per_staff_vnd: "Mức áp dụng mỗi nhân sự",
  amount_vnd: "Số tiền ghi nhận",
  base_floor_basis_points: "Tỷ lệ ngưỡng lương cứng",
  base_salary_vnd: "Lương cứng làm căn cứ",
  center_renewal_revenue_vnd: "Doanh thu tái phí toàn trung tâm",
  daily_rate_vnd: "Đơn giá ngày",
  event_date: "Ngày phát sinh",
  grade: "Khối lớp",
  mode: "Hình thức làm việc",
  monthly_pool_vnd: "Quỹ chấm bài tháng",
  offset_vnd: "Phần đã tính trong lương cứng",
  order_value_vnd: "Giá trị đơn hàng",
  payroll_statement_count: "Số bảng lương",
  period_month: "Kỳ dữ liệu",
  piecework_vnd: "Lương khoán đạt được",
  rate_basis_points: "Tỷ lệ áp dụng",
  record_revenue_vnd: "Mốc doanh thu kỷ lục",
  request_note: "Nội dung tạm ứng",
  revenue_rate_basis_points: "Tỷ lệ doanh thu",
  revenue_vnd: "Doanh thu làm căn cứ",
  source: "Nguồn nhập",
  source_code: "Mã nguồn tuyển sinh",
  staff_credits: "Phiếu chấm của nhân sự",
  total_credits: "Tổng phiếu chấm",
  work_date: "Ngày làm việc",
  worked_minutes: "Thời gian làm việc",
};

export function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

/** A signed amount with a typographic minus ("−30.000 VND"); positive amounts carry no sign. */
export function formatSignedCurrency(value: number): string {
  return `${value < 0 ? "−" : ""}${formatCurrency(Math.abs(value))}`;
}

export function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value: string): string {
  // Fixed to Vietnam time: server components render on UTC hosts (Vercel), and
  // client components must render the same text the server did.
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(new Date(value));
}

export function formatWorkMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

export function getLineTypeLabel(lineType: string): string {
  return Object.hasOwn(lineTypeLabels, lineType)
    ? lineTypeLabels[lineType]
    : `Loại khoản chưa hỗ trợ: ${lineType}`;
}

/** The engine's note on the offset reads like a penalty; staff see what it actually is. */
export function getLineNote(line: { lineType: string; note: string | null }): string | null {
  if (line.lineType === PIECEWORK_OFFSET) return "Không phải khoản bị trừ: phần lương khoán này đã được trả trong lương cứng.";
  return line.note;
}

export function getSourceKindLabel(sourceKind: string | null): string {
  if (!sourceKind) return "Không có nguồn dữ liệu riêng";
  return Object.hasOwn(sourceKindLabels, sourceKind)
    ? sourceKindLabels[sourceKind]
    : `Nguồn dữ liệu: ${sourceKind}`;
}

export function getNumber(source: Record<string, unknown> | undefined, key: string): number | null {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatPercentage(basisPoints: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}

/**
 * The lương cứng floor of a piecework offset. Live estimates and period runs
 * since 20260918160000 (compute_payroll_projection) store basis_points; runs
 * made by the engine up to 20260915170000 stored base_floor_basis_points.
 */
export function getFloorBasisPoints(snapshot: Record<string, unknown> | undefined): number | null {
  return getNumber(snapshot, "basis_points") ?? getNumber(snapshot, "base_floor_basis_points");
}

function getRateBasisPoints(line: PayrollLineRead): number | null {
  return getNumber(line.formulaSnapshot, "rate_basis_points")
    ?? getNumber(line.formulaSnapshot, "revenue_rate_basis_points")
    ?? (line.unitLabel === "basis points" ? line.unitRateVnd : null);
}

function getRevenueBasis(line: PayrollLineRead): number | null {
  return getNumber(line.formulaSnapshot, "revenue_vnd")
    ?? getNumber(line.evidenceSnapshot, "order_value_vnd")
    ?? getNumber(line.evidenceSnapshot, "center_renewal_revenue_vnd")
    ?? (line.unitLabel === "VND doanh thu" ? line.unitRateVnd : null);
}

function getFixedSourceAmount(line: PayrollLineRead): number | null {
  const sourceCode = line.evidenceSnapshot.source_code;
  const fixedBySource = line.formulaSnapshot.fixed_by_source;
  if (typeof sourceCode !== "string" || !fixedBySource || typeof fixedBySource !== "object" || Array.isArray(fixedBySource)) {
    return null;
  }
  return getNumber(fixedBySource as Record<string, unknown>, sourceCode);
}

export function getLineInputSummary(line: PayrollLineRead): string {
  const workedMinutes = getNumber(line.formulaSnapshot, "worked_minutes") ?? line.workMinutes;
  const minutesPerDay = getNumber(line.formulaSnapshot, "minutes_per_day");
  if (workedMinutes !== null && minutesPerDay !== null) {
    return `${formatWorkMinutes(workedMinutes)} trên chuẩn ${formatWorkMinutes(minutesPerDay)}`;
  }

  const staffCredits = getNumber(line.formulaSnapshot, "staff_credits");
  const totalCredits = getNumber(line.formulaSnapshot, "total_credits");
  if (staffCredits !== null && totalCredits !== null) {
    return `${new Intl.NumberFormat("vi-VN").format(staffCredits)} phiếu trên tổng ${new Intl.NumberFormat("vi-VN").format(totalCredits)} phiếu`;
  }

  const piecework = getNumber(line.formulaSnapshot, "piecework_vnd");
  const baseSalary = getNumber(line.formulaSnapshot, "base_salary_vnd");
  if (line.lineType === PIECEWORK_OFFSET && piecework !== null && baseSalary !== null) {
    return `Lương khoán ${formatCurrency(piecework)}, lương cứng ${formatCurrency(baseSalary)}`;
  }

  if (line.lineType === "new_student_fixed_bonus" && typeof line.evidenceSnapshot.source_code === "string") {
    return `${new Intl.NumberFormat("vi-VN").format(line.quantity ?? 1)} đơn từ nguồn ${line.evidenceSnapshot.source_code}`;
  }

  const revenue = getRevenueBasis(line);
  if (revenue !== null) return `Doanh thu làm căn cứ ${formatCurrency(revenue)}`;

  if (line.quantity !== null) {
    return `${new Intl.NumberFormat("vi-VN").format(line.quantity)}${line.unitLabel ? ` ${line.unitLabel}` : " đơn vị"}`;
  }

  return getLineNote(line) ?? "Số tiền được ghi nhận trực tiếp";
}

export function getLineRateSummary(line: PayrollLineRead): string {
  const dailyRate = getNumber(line.formulaSnapshot, "daily_rate_vnd");
  const modeBasisPoints = getNumber(line.formulaSnapshot, "mode_basis_points");
  if (dailyRate !== null) {
    return `${formatCurrency(dailyRate)}/ngày${modeBasisPoints !== null && modeBasisPoints !== 10_000 ? ` × ${formatPercentage(modeBasisPoints)}` : ""}`;
  }

  const rateBasisPoints = getRateBasisPoints(line);
  if (rateBasisPoints !== null) return formatPercentage(rateBasisPoints);

  const fixedSourceAmount = getFixedSourceAmount(line);
  if (fixedSourceAmount !== null) return `${formatCurrency(fixedSourceAmount)}/đơn`;

  if (line.lineType === "new_student_fixed_bonus") {
    return `${formatCurrency(line.amountVnd / (line.quantity || 1))}/đơn`;
  }

  if (line.unitRateVnd !== null) {
    return `${formatCurrency(line.unitRateVnd)}${line.unitLabel ? `/${line.unitLabel}` : ""}`;
  }

  const fixedAmount = getNumber(line.formulaSnapshot, "amount_vnd")
    ?? getNumber(line.formulaSnapshot, "amount_per_day_vnd")
    ?? getNumber(line.formulaSnapshot, "amount_per_staff_vnd");
  if (fixedAmount !== null) return formatCurrency(fixedAmount);

  return line.policyCode ? `Theo chính sách ${line.policyCode}` : "Số tiền trực tiếp";
}

export function getLineFormulaSummary(line: PayrollLineRead): string {
  const workedMinutes = getNumber(line.formulaSnapshot, "worked_minutes") ?? line.workMinutes;
  const minutesPerDay = getNumber(line.formulaSnapshot, "minutes_per_day");
  const dailyRate = getNumber(line.formulaSnapshot, "daily_rate_vnd");
  const modeBasisPoints = getNumber(line.formulaSnapshot, "mode_basis_points");
  if (workedMinutes !== null && minutesPerDay !== null && dailyRate !== null) {
    const modeFactor = modeBasisPoints !== null && modeBasisPoints !== 10_000
      ? ` × ${formatPercentage(modeBasisPoints)}`
      : "";
    return `${formatWorkMinutes(workedMinutes)} / ${formatWorkMinutes(minutesPerDay)} × ${formatCurrency(dailyRate)}${modeFactor} = ${formatCurrency(line.amountVnd)}`;
  }

  const staffCredits = getNumber(line.formulaSnapshot, "staff_credits");
  const totalCredits = getNumber(line.formulaSnapshot, "total_credits");
  const monthlyPool = getNumber(line.formulaSnapshot, "monthly_pool_vnd");
  if (staffCredits !== null && totalCredits !== null && monthlyPool !== null) {
    return `${new Intl.NumberFormat("vi-VN").format(staffCredits)} phiếu / ${new Intl.NumberFormat("vi-VN").format(totalCredits)} phiếu × ${formatCurrency(monthlyPool)} = ${formatCurrency(line.amountVnd)}`;
  }

  const piecework = getNumber(line.formulaSnapshot, "piecework_vnd");
  const baseSalary = getNumber(line.formulaSnapshot, "base_salary_vnd");
  const floorRate = getFloorBasisPoints(line.formulaSnapshot);
  if (piecework !== null && baseSalary !== null && floorRate !== null) {
    return `Mức thấp hơn giữa lương khoán ${formatCurrency(piecework)} và ${formatCurrency(baseSalary)} × ${formatPercentage(floorRate)} = ${formatCurrency(line.amountVnd)}`;
  }

  const centerRevenue = getNumber(line.evidenceSnapshot, "center_renewal_revenue_vnd");
  const recordRevenue = getNumber(line.formulaSnapshot, "record_revenue_vnd");
  const recordRate = getRateBasisPoints(line);
  if (line.lineType === "record_excess_bonus" && centerRevenue !== null && recordRevenue !== null && recordRate !== null) {
    return `(${formatCurrency(centerRevenue)} − ${formatCurrency(recordRevenue)}) × ${formatPercentage(recordRate)} = ${formatCurrency(line.amountVnd)}`;
  }

  if (line.lineType === "new_student_fixed_bonus") {
    const quantity = line.quantity ?? 1;
    const fixedSourceAmount = getFixedSourceAmount(line) ?? line.amountVnd / quantity;
    return `${new Intl.NumberFormat("vi-VN").format(quantity)} đơn × ${formatCurrency(fixedSourceAmount)} = ${formatCurrency(line.amountVnd)}`;
  }

  const revenue = getRevenueBasis(line);
  const rateBasisPoints = getRateBasisPoints(line);
  if (revenue !== null && rateBasisPoints !== null) {
    return `${formatCurrency(revenue)} × ${formatPercentage(rateBasisPoints)} = ${formatCurrency(line.amountVnd)}`;
  }

  const amountPerStaff = getNumber(line.formulaSnapshot, "amount_per_staff_vnd");
  const statementCount = getNumber(line.evidenceSnapshot, "payroll_statement_count");
  if (amountPerStaff !== null && statementCount !== null) {
    return `${new Intl.NumberFormat("vi-VN").format(statementCount)} nhân sự × ${formatCurrency(amountPerStaff)} = ${formatCurrency(line.amountVnd)}`;
  }

  if (line.quantity !== null && line.unitRateVnd !== null && line.unitLabel !== "basis points") {
    return `${new Intl.NumberFormat("vi-VN").format(line.quantity)}${line.unitLabel ? ` ${line.unitLabel}` : ""} × ${formatCurrency(line.unitRateVnd)} = ${formatCurrency(line.amountVnd)}`;
  }

  return `${getLineNote(line) ?? "Số tiền được ghi nhận"} = ${formatCurrency(line.amountVnd)}`;
}

export interface EvidenceDetail {
  label: string;
  value: string;
}

export function getEvidenceDetails(line: PayrollLineRead): readonly EvidenceDetail[] {
  const details: EvidenceDetail[] = [];

  for (const [key, value] of Object.entries(line.evidenceSnapshot)) {
    if (value === null || value === undefined || key === "evidence_url") continue;
    if (Array.isArray(value)) {
      details.push({ label: metadataLabels[key] ?? key, value: `${value.length} bản ghi` });
      continue;
    }
    if (typeof value === "object") continue;

    let rendered = String(value);
    if (typeof value === "number" && key.endsWith("_vnd")) rendered = formatCurrency(value);
    else if (typeof value === "number" && key.endsWith("basis_points")) rendered = formatPercentage(value);
    else if (key === "work_date" || key === "event_date") rendered = formatDate(rendered);
    else if (key === "period_month") rendered = formatMonth(rendered.slice(0, 10));

    details.push({ label: metadataLabels[key] ?? key, value: rendered });
  }

  return details.slice(0, 4);
}

export function getEvidenceUrl(line: PayrollLineRead): string | null {
  const candidate = line.evidenceSnapshot.evidence_url;
  return typeof candidate === "string" && /^https?:\/\//.test(candidate) ? candidate : null;
}
