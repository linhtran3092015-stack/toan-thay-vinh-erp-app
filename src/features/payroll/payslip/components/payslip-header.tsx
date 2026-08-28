import { Badge } from "@/components/ui/badge";
import type {
  HeaderBlockSettings,
  PayslipBrandingConfig,
} from "@/features/payroll/payslip-template/types";
import type { PayslipPeriodInfo } from "@/features/payroll/payslip/types";
import { Calendar } from "lucide-react";

interface PayslipHeaderProps {
  blockSettings?: HeaderBlockSettings;
  branding?: Partial<PayslipBrandingConfig>;
  period: PayslipPeriodInfo;
}

export function PayslipHeader({
  blockSettings = {},
  branding = {},
  period,
}: PayslipHeaderProps) {
  const getBadgeTone = (status: string): "info" | "neutral" | "success" | "warning" => {
    if (status === "approved") return "success";
    if (status === "review") return "warning";
    return "info";
  };

  const showLogo = branding.showLogo !== false;
  const companyName = branding.companyName || "Trung Tâm Toán Thầy Vinh";
  const subtitle = branding.subtitle || "Hệ thống quản lý giáo dục";
  const logoUrl = branding.logoUrl;

  const showPeriodDates = blockSettings.showPeriodDates !== false;
  const showPayDate = blockSettings.showPayDate !== false;
  const showStatusBadge = blockSettings.showStatusBadge !== false;

  return (
    <header
      className="border-b-2 pb-5"
      style={{ borderColor: branding.primaryColor || "#1e3a8a" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand Left */}
        <div className="flex items-center gap-3">
          {showLogo ? (
            logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={companyName}
                className="h-12 w-12 rounded-lg object-contain"
                src={logoUrl}
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg font-bold text-white shadow-sm"
                style={{ backgroundColor: branding.primaryColor || "#1e3a8a" }}
              >
                <span className="text-lg tracking-wider">TTV</span>
              </div>
            )
          ) : null}
          <div>
            <h1
              className="text-sm font-bold tracking-tight uppercase sm:text-base"
              style={{ color: branding.primaryColor || "#1e3a8a" }}
            >
              {companyName}
            </h1>
            {subtitle ? (
              <p className="text-xs italic text-slate-600">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {/* Center Title */}
        <div className="text-center sm:px-4">
          <h2
            className="text-xl font-extrabold tracking-tight uppercase sm:text-2xl"
            style={{ color: branding.primaryColor || "#1e3a8a" }}
          >
            Phiếu Lương
          </h2>
          <p
            className="text-sm font-bold"
            style={{ color: branding.secondaryColor || "#3b82f6" }}
          >
            {period.periodMonthFormatted}
          </p>
        </div>

        {/* Right Info Box */}
        <div className="flex flex-col items-start rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs text-slate-900 sm:items-end sm:text-right">
          {showPeriodDates ? (
            <>
              <div
                className="flex items-center gap-1.5 font-semibold"
                style={{ color: branding.primaryColor || "#1e3a8a" }}
              >
                <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span>KỲ LƯƠNG</span>
              </div>
              <p className="mt-0.5 font-medium tabular-nums">
                {period.periodStartDate} – {period.periodEndDate}
              </p>
            </>
          ) : null}

          {showPayDate ? (
            <p className="mt-0.5 text-slate-600">
              Ngày trả lương:{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {period.payDateFormatted}
              </span>
            </p>
          ) : null}

          {showStatusBadge ? (
            <div className="mt-1">
              <Badge tone={getBadgeTone(period.status)}>{period.statusLabel}</Badge>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
