import type { FinanceOrderReadModel } from "./read-models";

type BadgeTone = "info" | "neutral" | "success" | "warning";

export function getFinanceOrderTypePresentation(
  type: FinanceOrderReadModel["orderType"],
): { label: string; tone: BadgeTone } {
  switch (type) {
    case "new_enrollment":
      return { label: "Tuyển mới", tone: "success" };
    case "renewal":
      return { label: "Tái phí", tone: "info" };
    case "unknown":
      return { label: "Chưa xác định", tone: "warning" };
  }
}

export function getFinanceOrderSourceLabel(
  order: Pick<FinanceOrderReadModel, "leadSourceName" | "sourceLabel">,
): string {
  // A known source outside MMA/SB (walk-in, referral…) is named, not "unknown".
  if (!order.sourceLabel) return order.leadSourceName ?? "Chưa xác định";
  return order.leadSourceName
    ? `${order.sourceLabel} · ${order.leadSourceName}`
    : order.sourceLabel;
}

export function getFinanceOrderCostPresentation(
  order: Pick<
    FinanceOrderReadModel,
    "mechanismCode" | "operatingCostStatus" | "operatingCostVnd"
  >,
): { description: string; label: string; tone: BadgeTone } {
  if (order.operatingCostStatus === "unconfigured" || order.operatingCostVnd === null) {
    return {
      description: "Chính sách vận hành cho tổ hợp này chưa được cấu hình; hệ thống không gán 0 VND.",
      label: "Chưa cấu hình",
      tone: "warning",
    };
  }

  switch (order.mechanismCode) {
    case "renewal_sb_20_percent":
      return { description: "Tái phí · SB: 20% học phí", label: "20% học phí", tone: "info" };
    case "renewal_mma_zero":
      return { description: "Tái phí · MMA: 0 VND", label: "0 VND", tone: "neutral" };
    case "new_enrollment_sb_fixed_plus_25_percent":
      return {
        description: "Tuyển mới · SB: 700.000 VND + 25% học phí",
        label: "700.000 + 25%",
        tone: "success",
      };
    default:
      return { description: "Chính sách vận hành đã cấu hình.", label: "Đã cấu hình", tone: "neutral" };
  }
}

/** `Đợt 2 (11–20)`: the short label and the range, each written once below. */
export function getSettlementPeriodLabel(period: 1 | 2 | 3): string {
  return `${getSettlementPeriodShortLabel(period)} (${getSettlementPeriodRange(period)})`;
}

export const financeDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
});

export function formatFinanceDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : financeDateTimeFormatter.format(date);
}

/** Day range of a settlement period in the Vietnam bank date: `01–10`, `11–20`, `21–cuối tháng`. */
export function getSettlementPeriodRange(period: 1 | 2 | 3): string {
  return period === 1 ? "01–10" : period === 2 ? "11–20" : "21–cuối tháng";
}

/** Compact column text `Đợt 2`; the full `getSettlementPeriodLabel` goes in a `title`. */
export function getSettlementPeriodShortLabel(period: 1 | 2 | 3): string {
  return `Đợt ${period}`;
}
