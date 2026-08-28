import { PayslipBreakdowns } from "@/features/payroll/payslip/components/payslip-breakdowns";
import { PayslipEmployeeCard } from "@/features/payroll/payslip/components/payslip-employee-card";
import { PayslipHeader } from "@/features/payroll/payslip/components/payslip-header";
import { PayslipLineTables } from "@/features/payroll/payslip/components/payslip-line-tables";
import { PayslipNotesFooter } from "@/features/payroll/payslip/components/payslip-notes-footer";
import { PayslipSummaryCard } from "@/features/payroll/payslip/components/payslip-summary-card";
import { PayslipSummaryFormula } from "@/features/payroll/payslip/components/payslip-summary-formula";
import { DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG } from "@/features/payroll/payslip-template/schema";
import type {
  EarningsBlockSettings,
  EmployeeInfoBlockSettings,
  FooterBlockSettings,
  HeaderBlockSettings,
  NotesBlockSettings,
  PayslipSectionConfig,
  PayslipTemplateConfiguration,
  SummaryBlockSettings,
  TotalsBlockSettings,
} from "@/features/payroll/payslip-template/types";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";

interface PayslipDocumentProps {
  data: PayslipDocumentData;
  isEditorMode?: boolean;
  onSelectBlock?: (id: string) => void;
  selectedBlockId?: string | null;
  templateConfig?: PayslipTemplateConfiguration;
}

export function PayslipDocument({
  data,
  isEditorMode = false,
  onSelectBlock,
  selectedBlockId,
  templateConfig,
}: PayslipDocumentProps) {
  const config = templateConfig ?? data.templateConfig ?? DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG;
  const branding = config.branding;
  const isDraft = data.period.status === "draft";
  const showDraftWatermark =
    isDraft && (branding.showDraftWatermark !== false);

  const borderRadiusClasses = {
    full: "rounded-3xl",
    lg: "rounded-2xl",
    md: "rounded-xl",
    none: "rounded-none",
    sm: "rounded-lg",
  }[branding.borderRadius || "md"];

  const fontFamilies = {
    Arial: "Arial, sans-serif",
    "Be Vietnam Pro": "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "Noto Sans": "'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    Roboto: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const selectedFont = fontFamilies[branding.fontFamily] || fontFamilies["Be Vietnam Pro"];

  // Helper to render section block
  const renderSectionContent = (section: PayslipSectionConfig) => {
    const settings = section.settings || {};

    switch (section.type) {
      case "header":
        return (
          <PayslipHeader
            blockSettings={settings as HeaderBlockSettings}
            branding={branding}
            period={data.period}
          />
        );

      case "employee_info":
        return (
          <PayslipEmployeeCard
            blockSettings={settings as EmployeeInfoBlockSettings}
            branding={branding}
            employee={data.employee}
          />
        );

      case "summary":
        return (
          <PayslipSummaryCard
            blockSettings={settings as SummaryBlockSettings}
            branding={branding}
            totals={data.totals}
          />
        );

      case "earnings":
        return (
          <PayslipLineTables
            blockSettings={settings as EarningsBlockSettings}
            branding={branding}
            deductions={[]}
            earnings={data.earnings}
            mode="earnings"
            title={section.title}
            totals={data.totals}
          />
        );

      case "deductions":
        return (
          <PayslipLineTables
            blockSettings={settings as EarningsBlockSettings}
            branding={branding}
            deductions={data.deductions}
            earnings={[]}
            mode="deductions"
            title={section.title}
            totals={data.totals}
          />
        );

      case "work_hours":
        return (
          <PayslipBreakdowns
            blockSettings={settings as Record<string, unknown>}
            branding={branding}
            breakdowns={{
              commissions: [],
              grading: null,
              workHours: data.breakdowns.workHours,
            }}
            title={section.title}
          />
        );

      case "grading":
        return (
          <PayslipBreakdowns
            blockSettings={settings as Record<string, unknown>}
            branding={branding}
            breakdowns={{
              commissions: [],
              grading: data.breakdowns.grading,
              workHours: [],
            }}
            title={section.title}
          />
        );

      case "commissions":
        return (
          <PayslipBreakdowns
            blockSettings={settings as Record<string, unknown>}
            branding={branding}
            breakdowns={{
              commissions: data.breakdowns.commissions,
              grading: null,
              workHours: [],
            }}
            title={section.title}
          />
        );

      case "totals":
        return (
          <PayslipSummaryFormula
            blockSettings={settings as TotalsBlockSettings}
            branding={branding}
            totals={data.totals}
          />
        );

      case "notes":
        return (
          <PayslipNotesFooter
            blockSettings={settings as NotesBlockSettings & FooterBlockSettings}
            branding={branding}
            employee={data.employee}
            mode="notes"
            period={data.period}
          />
        );

      case "footer":
        return (
          <PayslipNotesFooter
            blockSettings={settings as NotesBlockSettings & FooterBlockSettings}
            branding={branding}
            employee={data.employee}
            mode="footer"
            period={data.period}
          />
        );

      case "divider":
        return <hr className="my-4 border-slate-200" />;

      case "spacer": {
        const height = ((settings as { heightPx?: number }).heightPx) || 16;
        return <div style={{ height }} />;
      }

      default:
        return null;
    }
  };

  return (
    <article
      aria-label={`Phiếu lương ${data.employee.displayName} - ${data.period.periodMonthFormatted}`}
      className={`relative mx-auto my-6 max-w-[210mm] overflow-hidden border border-slate-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg print:my-0 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none sm:p-8 ${borderRadiusClasses}`}
      style={{
        fontFamily: selectedFont,
      }}
    >
      {/* Draft Watermark */}
      {showDraftWatermark ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none"
        >
          <span className="rotate-[-30deg] text-6xl font-black tracking-widest text-slate-900/[0.05] uppercase sm:text-8xl">
            {branding.draftWatermarkText || "BẢN NHÁP"}
          </span>
        </div>
      ) : null}

      <div className="relative z-10 space-y-6">
        {config.sections.map((section) => {
          // Check visibility
          if (!section.visible && !isEditorMode) {
            return null;
          }

          // Check hideWhenEmpty rule
          if (section.hideWhenEmpty && !isEditorMode) {
            if (section.type === "work_hours" && data.breakdowns.workHours.length === 0) return null;
            if (section.type === "grading" && !data.breakdowns.grading) return null;
            if (section.type === "commissions" && data.breakdowns.commissions.length === 0) return null;
            if (section.type === "earnings" && data.earnings.length === 0) return null;
            if (section.type === "deductions" && data.deductions.length === 0) return null;
          }

          const isSelected = isEditorMode && selectedBlockId === section.id;

          return (
            <div
              className={`transition-all ${
                isEditorMode
                  ? `cursor-pointer rounded-xl p-1 transition-all ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-2 bg-primary/[0.02]"
                        : "hover:ring-1 hover:ring-slate-300"
                    } ${!section.visible ? "opacity-40 border border-dashed border-slate-300" : ""}`
                  : ""
              }`}
              key={section.id}
              onClick={(e) => {
                if (isEditorMode && onSelectBlock) {
                  e.stopPropagation();
                  onSelectBlock(section.id);
                }
              }}
            >
              {renderSectionContent(section)}
            </div>
          );
        })}
      </div>
    </article>
  );
}
