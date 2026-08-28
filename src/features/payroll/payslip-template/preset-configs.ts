import { DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG } from "@/features/payroll/payslip-template/schema";
import type { PayslipTemplateConfiguration } from "@/features/payroll/payslip-template/types";

export interface TemplatePreset {
  configuration: PayslipTemplateConfiguration;
  description: string;
  id: string;
  name: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    configuration: DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
    description:
      "Mẫu chuẩn A4 của Toán Thầy Vinh với đầy đủ thông tin thu nhập, khấu trừ và công thức chi tiết.",
    id: "standard",
    name: "Toán Thầy Vinh – Chuẩn",
  },
  {
    configuration: {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      branding: {
        ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.branding,
        borderRadius: "sm",
        primaryColor: "#0f172a",
        secondaryColor: "#475569",
      },
      page: {
        margin: "compact",
        orientation: "portrait",
        size: "A4",
      },
      sections: DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.sections.map(
        (section) => {
          if (section.type === "earnings" || section.type === "deductions") {
            return {
              ...section,
              settings: {
                ...section.settings,
                compactMode: true,
              },
            };
          }
          return section;
        },
      ),
    },
    description:
      "Mẫu thu gọn, tiết kiệm diện tích cho các bảng lương nhiều dòng.",
    id: "compact",
    name: "Mẫu Gọn (Compact)",
  },
  {
    configuration: {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      branding: {
        ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.branding,
        accentColor: "#f1f5f9",
        borderRadius: "none",
        borderStyle: "solid",
        primaryColor: "#334155",
        secondaryColor: "#64748b",
        showLogo: false,
      },
      sections: DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.sections.map(
        (section) => {
          if (
            section.type === "work_hours" ||
            section.type === "grading" ||
            section.type === "commissions"
          ) {
            return { ...section, visible: false };
          }
          return section;
        },
      ),
    },
    description:
      "Thiết kế tối giản, tập trung vào số liệu tổng quan và thu nhập thực nhận.",
    id: "minimal",
    name: "Tối Giản (Minimal)",
  },
  {
    configuration: {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      branding: {
        ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.branding,
        accentColor: "#eff6ff",
        borderRadius: "lg",
        primaryColor: "#1e40af",
        secondaryColor: "#2563eb",
      },
      sections: DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.sections.map(
        (section) => {
          if (section.type === "earnings") {
            return {
              ...section,
              settings: {
                ...section.settings,
                compactMode: false,
                showFormula: true,
                showNote: true,
                showQuantity: true,
                showUnitRate: true,
              },
            };
          }
          return section;
        },
      ),
    },
    description:
      "Mẫu chi tiết tối đa, hiển thị rõ ràng từng công thức tính toán và số liệu thành phần.",
    id: "detailed",
    name: "Chi Tiết (Detailed)",
  },
];
