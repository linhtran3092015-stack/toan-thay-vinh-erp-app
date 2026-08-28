import { z } from "zod";

import {
  ALLOWED_FONT_FAMILIES,
  PAYSLIP_BLOCK_TYPES,
  type PayslipTemplateConfiguration,
} from "@/features/payroll/payslip-template/types";

// Helper to sanitize plain text: remove any HTML tags and limit length
export function sanitizePlainText(text: string, maxLength = 500): string {
  if (typeof text !== "string") return "";
  // Strip potential html tags or javascript schemes
  const stripped = text.replace(/<[^>]*>?/gm, "").trim();
  return stripped.slice(0, maxLength);
}

// Hex color validation
const HexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/, {
    message: "Mã màu phải ở định dạng Hex hợp lệ (VD: #1e3a8a)",
  });

export const PayslipPageSchema = z.object({
  margin: z.enum(["compact", "normal", "spacious"]).default("normal"),
  orientation: z.literal("portrait").default("portrait"),
  size: z.literal("A4").default("A4"),
});

export const PayslipBrandingSchema = z.object({
  accentColor: HexColorSchema.default("#f8fafc"),
  borderRadius: z.enum(["none", "sm", "md", "lg", "full"]).default("md"),
  borderStyle: z.enum(["none", "solid", "dashed"]).default("solid"),
  companyName: z
    .string()
    .max(150, "Tên công ty tối đa 150 ký tự")
    .transform((val) => sanitizePlainText(val, 150))
    .default("Trung Tâm Toán Thầy Vinh"),
  draftWatermarkText: z
    .string()
    .max(50, "Chữ mờ bản nháp tối đa 50 ký tự")
    .transform((val) => sanitizePlainText(val, 50))
    .default("BẢN NHÁP"),
  fontFamily: z.enum(ALLOWED_FONT_FAMILIES).default("Be Vietnam Pro"),
  logoUrl: z
    .string()
    .url("Đường dẫn Logo phải là URL hợp lệ")
    .nullable()
    .or(z.literal(""))
    .transform((val) => (val === "" ? null : val))
    .default(null),
  primaryColor: HexColorSchema.default("#1e3a8a"),
  secondaryColor: HexColorSchema.default("#3b82f6"),
  showDraftWatermark: z.boolean().default(true),
  showLogo: z.boolean().default(true),
  subtitle: z
    .string()
    .max(200, "Phụ đề tối đa 200 ký tự")
    .transform((val) => sanitizePlainText(val, 200))
    .default("Hệ thống quản lý giáo dục"),
});

export const PayslipSectionSchema = z.object({
  hideWhenEmpty: z.boolean().default(false),
  id: z.string().min(1, "Mã khối không được rỗng"),
  settings: z.record(z.string(), z.unknown()).default({}),
  title: z
    .string()
    .max(100, "Tiêu đề khối tối đa 100 ký tự")
    .transform((val) => sanitizePlainText(val, 100))
    .default(""),
  type: z.enum(PAYSLIP_BLOCK_TYPES),
  visible: z.boolean().default(true),
});

export const PayslipTemplateConfigurationSchema = z.object({
  branding: PayslipBrandingSchema,
  page: PayslipPageSchema,
  schemaVersion: z.number().int().min(1).default(1),
  sections: z.array(PayslipSectionSchema).min(1, "Phiếu lương cần ít nhất 1 khối"),
});

export function parsePayslipTemplateConfiguration(
  input: unknown,
  fallbackConfig?: PayslipTemplateConfiguration,
): PayslipTemplateConfiguration {
  const result = PayslipTemplateConfigurationSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  if (fallbackConfig) {
    return fallbackConfig;
  }
  return DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG;
}

export const DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG: PayslipTemplateConfiguration = {
  branding: {
    accentColor: "#f8fafc",
    borderRadius: "md",
    borderStyle: "solid",
    companyName: "Trung Tâm Toán Thầy Vinh",
    draftWatermarkText: "BẢN NHÁP",
    fontFamily: "Be Vietnam Pro",
    logoUrl: null,
    primaryColor: "#1e3a8a",
    secondaryColor: "#3b82f6",
    showDraftWatermark: true,
    showLogo: true,
    subtitle: "Hệ thống quản lý giáo dục",
  },
  page: {
    margin: "normal",
    orientation: "portrait",
    size: "A4",
  },
  schemaVersion: 1,
  sections: [
    {
      hideWhenEmpty: false,
      id: "header",
      settings: {
        alignment: "between",
        showPayDate: true,
        showPeriodDates: true,
        showStatusBadge: true,
      },
      title: "TIÊU ĐỀ PHIẾU LƯƠNG",
      type: "header",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "employee_info",
      settings: {
        layout: "grid",
        showAvatar: true,
        showBankInfo: true,
        showDepartment: true,
        showEmployeeCode: true,
        showJoinedDate: true,
        showPosition: true,
      },
      title: "THÔNG TIN NHÂN SỰ",
      type: "employee_info",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "summary",
      settings: {
        highlightNetPay: true,
        showAmountInWords: true,
        showDeductions: true,
        showGross: true,
        showNet: true,
      },
      title: "TỔNG QUAN THU NHẬP",
      type: "summary",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "earnings",
      settings: {
        compactMode: false,
        showFormula: true,
        showNote: true,
        showQuantity: true,
        showUnitRate: true,
      },
      title: "I. CÁC KHOẢN THU NHẬP",
      type: "earnings",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "deductions",
      settings: {
        compactMode: false,
        showNote: true,
      },
      title: "II. TẠM ỨNG & KHẤU TRỪ",
      type: "deductions",
      visible: true,
    },
    {
      hideWhenEmpty: true,
      id: "work_hours",
      settings: {
        showDailyRate: true,
        showModeBreakdown: true,
      },
      title: "Chi tiết công & giờ làm",
      type: "work_hours",
      visible: true,
    },
    {
      hideWhenEmpty: true,
      id: "grading",
      settings: {
        showExplanation: true,
        showPoolAmount: true,
      },
      title: "Chi tiết chấm bài",
      type: "grading",
      visible: true,
    },
    {
      hideWhenEmpty: true,
      id: "commissions",
      settings: {
        showBasisRevenue: true,
        showRatePercentage: true,
      },
      title: "Chi tiết hoa hồng & tái phí",
      type: "commissions",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "totals",
      settings: {
        highlightNetPay: true,
        showEquationFormula: true,
      },
      title: "TỔNG KẾT LƯƠNG",
      type: "totals",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "notes",
      settings: {
        customNotes:
          "Mọi thắc mắc về bảng lương vui lòng gửi yêu cầu phản hồi trong thời hạn quy định.",
        employeeSignatureLabel: "Người nhận lương\n(Ký và ghi rõ họ tên)",
        managerSignatureLabel: "Người lập biểu\n(Ký và ghi rõ họ tên)",
        showSignatures: true,
      },
      title: "GHI CHÚ & XÁC NHẬN",
      type: "notes",
      visible: true,
    },
    {
      hideWhenEmpty: false,
      id: "footer",
      settings: {
        address: "Hà Nội, Việt Nam",
        customFooterText:
          "Phiếu lương điện tử được tạo tự động bởi Hệ thống ERP Toán Thầy Vinh.",
        hotline: "0987 654 321",
        showCompanyInfo: true,
        website: "toanthayvinh.edu.vn",
      },
      title: "CHÂN TRANG",
      type: "footer",
      visible: true,
    },
  ],
};
