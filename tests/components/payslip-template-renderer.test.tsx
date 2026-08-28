import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PAYSLIP_SAMPLE_DATA } from "@/features/payroll/payslip-template/sample-data";
import { DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG } from "@/features/payroll/payslip-template/schema";
import type { PayslipTemplateConfiguration } from "@/features/payroll/payslip-template/types";

describe("PayslipDocument Template-Aware Renderer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with default template configuration correctly", () => {
    render(<PayslipDocument data={PAYSLIP_SAMPLE_DATA} />);

    expect(screen.getByText("Trung Tâm Toán Thầy Vinh")).toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Văn A (Mẫu)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10.100.000 đ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("I. CÁC KHOẢN THU NHẬP")).toBeInTheDocument();
    expect(screen.getByText("II. TẠM ỨNG & KHẤU TRỪ")).toBeInTheDocument();
  });

  it("honors custom company name and subtitle from template config", () => {
    const customConfig: PayslipTemplateConfiguration = {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      branding: {
        ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.branding,
        companyName: "Trung Tâm Giáo Dục Minh Trí",
        subtitle: "Khơi nguồn đam mê Toán học",
      },
    };

    render(
      <PayslipDocument
        data={PAYSLIP_SAMPLE_DATA}
        templateConfig={customConfig}
      />,
    );

    expect(screen.getByText("Trung Tâm Giáo Dục Minh Trí")).toBeInTheDocument();
    expect(screen.getByText("Khơi nguồn đam mê Toán học")).toBeInTheDocument();
  });

  it("hides disabled sections when visible is false", () => {
    const customConfig: PayslipTemplateConfiguration = {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      sections: DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.sections.map(
        (section) => {
          if (section.type === "totals") {
            return { ...section, visible: false };
          }
          return section;
        },
      ),
    };

    render(
      <PayslipDocument
        data={PAYSLIP_SAMPLE_DATA}
        templateConfig={customConfig}
      />,
    );

    // Totals formula bar shouldn't render
    expect(screen.queryByText("Tổng Thu Nhập")).not.toBeInTheDocument();
  });

  it("displays custom draft watermark text when period is draft", () => {
    const draftData = {
      ...PAYSLIP_SAMPLE_DATA,
      period: {
        ...PAYSLIP_SAMPLE_DATA.period,
        status: "draft" as const,
      },
    };

    const customConfig: PayslipTemplateConfiguration = {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      branding: {
        ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.branding,
        draftWatermarkText: "DỰ THẢO NỘI BỘ",
        showDraftWatermark: true,
      },
    };

    render(
      <PayslipDocument data={draftData} templateConfig={customConfig} />,
    );

    expect(screen.getByText("DỰ THẢO NỘI BỘ")).toBeInTheDocument();
  });

  it("supports interactive editor selection mode", () => {
    const handleSelectBlock = () => {};

    render(
      <PayslipDocument
        data={PAYSLIP_SAMPLE_DATA}
        isEditorMode={true}
        onSelectBlock={handleSelectBlock}
        selectedBlockId="header"
      />,
    );

    expect(screen.getAllByText("Phiếu Lương").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("TTV")).toBeInTheDocument();
  });
});
