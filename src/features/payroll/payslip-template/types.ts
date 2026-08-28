export const PAYSLIP_BLOCK_TYPES = [
  "header",
  "employee_info",
  "summary",
  "earnings",
  "deductions",
  "work_hours",
  "grading",
  "commissions",
  "totals",
  "notes",
  "footer",
  "divider",
  "spacer",
] as const;

export type PayslipBlockType = (typeof PAYSLIP_BLOCK_TYPES)[number];

export const ALLOWED_FONT_FAMILIES = [
  "Be Vietnam Pro",
  "Inter",
  "Roboto",
  "Noto Sans",
  "Arial",
] as const;

export type AllowedFontFamily = (typeof ALLOWED_FONT_FAMILIES)[number];

export interface PayslipPageConfig {
  margin: "compact" | "normal" | "spacious";
  orientation: "portrait";
  size: "A4";
}

export interface PayslipBrandingConfig {
  accentColor: string;
  borderRadius: "none" | "sm" | "md" | "lg" | "full";
  borderStyle: "none" | "solid" | "dashed";
  companyName: string;
  draftWatermarkText: string;
  fontFamily: AllowedFontFamily;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  showDraftWatermark: boolean;
  showLogo: boolean;
  subtitle: string;
}

export interface HeaderBlockSettings {
  alignment?: "left" | "center" | "between";
  showPayDate?: boolean;
  showPeriodDates?: boolean;
  showStatusBadge?: boolean;
}

export interface EmployeeInfoBlockSettings {
  layout?: "grid" | "stack";
  showAvatar?: boolean;
  showBankInfo?: boolean;
  showDepartment?: boolean;
  showEmployeeCode?: boolean;
  showJoinedDate?: boolean;
  showPosition?: boolean;
}

export interface SummaryBlockSettings {
  highlightNetPay?: boolean;
  showAmountInWords?: boolean;
  showDeductions?: boolean;
  showGross?: boolean;
  showNet?: boolean;
}

export interface EarningsBlockSettings {
  compactMode?: boolean;
  showFormula?: boolean;
  showNote?: boolean;
  showQuantity?: boolean;
  showUnitRate?: boolean;
}

export interface DeductionsBlockSettings {
  compactMode?: boolean;
  showNote?: boolean;
}

export interface WorkHoursBlockSettings {
  showDailyRate?: boolean;
  showModeBreakdown?: boolean;
}

export interface GradingBlockSettings {
  showExplanation?: boolean;
  showPoolAmount?: boolean;
}

export interface CommissionsBlockSettings {
  showBasisRevenue?: boolean;
  showRatePercentage?: boolean;
}

export interface TotalsBlockSettings {
  highlightNetPay?: boolean;
  showEquationFormula?: boolean;
}

export interface NotesBlockSettings {
  customNotes?: string;
  employeeSignatureLabel?: string;
  managerSignatureLabel?: string;
  showSignatures?: boolean;
}

export interface FooterBlockSettings {
  address?: string;
  customFooterText?: string;
  hotline?: string;
  showCompanyInfo?: boolean;
  website?: string;
}

export interface SpacerBlockSettings {
  heightPx?: number;
}

export type BlockSettings =
  | HeaderBlockSettings
  | EmployeeInfoBlockSettings
  | SummaryBlockSettings
  | EarningsBlockSettings
  | DeductionsBlockSettings
  | WorkHoursBlockSettings
  | GradingBlockSettings
  | CommissionsBlockSettings
  | TotalsBlockSettings
  | NotesBlockSettings
  | FooterBlockSettings
  | SpacerBlockSettings
  | Record<string, unknown>;

export interface PayslipSectionConfig {
  hideWhenEmpty?: boolean;
  id: string;
  settings?: BlockSettings;
  title: string;
  type: PayslipBlockType;
  visible: boolean;
}

export interface PayslipTemplateConfiguration {
  branding: PayslipBrandingConfig;
  page: PayslipPageConfig;
  schemaVersion: number;
  sections: PayslipSectionConfig[];
}

export type PayslipTemplateStatus = "draft" | "published" | "archived";

export interface PayslipTemplateSummary {
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
  currentDraftVersionNumber: number | null;
  description: string | null;
  id: string;
  isArchived: boolean;
  isDefault: boolean;
  latestPublishedVersionNumber: number | null;
  name: string;
  slug: string;
  totalVersions: number;
  updatedAt: string;
}

export interface PayslipTemplateVersionSummary {
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
  id: string;
  publishedAt: string | null;
  schemaVersion: number;
  status: PayslipTemplateStatus;
  templateId: string;
  versionNumber: number;
}

export interface PayslipTemplateDetail {
  activeVersion: {
    configuration: PayslipTemplateConfiguration;
    createdAt: string;
    id: string;
    publishedAt: string | null;
    schemaVersion: number;
    status: PayslipTemplateStatus;
    versionNumber: number;
  };
  description: string | null;
  id: string;
  isArchived: boolean;
  isDefault: boolean;
  name: string;
  slug: string;
  versions: PayslipTemplateVersionSummary[];
}
