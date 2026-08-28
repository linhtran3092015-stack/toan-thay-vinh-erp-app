import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateEditor } from "@/features/payroll/payslip-template/components/template-editor";
import { TemplateListPage } from "@/features/payroll/payslip-template/components/template-list-page";
import { DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG } from "@/features/payroll/payslip-template/schema";
import type {
  PayslipTemplateDetail,
  PayslipTemplateSummary,
} from "@/features/payroll/payslip-template/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/payroll/settings/payslip-templates",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock("@/features/payroll/payslip-template/actions", () => ({
  archiveTemplateAction: vi.fn().mockResolvedValue({ ok: true }),
  cloneTemplateAction: vi.fn().mockResolvedValue({ data: { id: "cloned-id" }, ok: true }),
  createDraftAction: vi.fn().mockResolvedValue({ data: { versionNumber: 2 }, ok: true }),
  publishTemplateAction: vi.fn().mockResolvedValue({ ok: true }),
  saveDraftAction: vi.fn().mockResolvedValue({ ok: true }),
  setDefaultTemplateAction: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Payslip Template Builder UI Components", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTemplates: PayslipTemplateSummary[] = [
    {
      createdAt: "2026-08-01T00:00:00Z",
      createdByEmail: "admin@toanthayvinh.edu.vn",
      createdByName: "Quản trị viên",
      currentDraftVersionNumber: null,
      description: "Mẫu chuẩn A4 của trung tâm",
      id: "template-1",
      isArchived: false,
      isDefault: true,
      latestPublishedVersionNumber: 1,
      name: "Toán Thầy Vinh – Standard",
      slug: "toan-thay-vinh-standard",
      totalVersions: 1,
      updatedAt: "2026-08-01T00:00:00Z",
    },
    {
      createdAt: "2026-08-02T00:00:00Z",
      createdByEmail: "accountant@toanthayvinh.edu.vn",
      createdByName: "Kế toán viên",
      currentDraftVersionNumber: 2,
      description: "Mẫu thu gọn cho giáo viên",
      id: "template-2",
      isArchived: false,
      isDefault: false,
      latestPublishedVersionNumber: 1,
      name: "Mẫu Thu Gọn",
      slug: "mau-thu-gon",
      totalVersions: 2,
      updatedAt: "2026-08-02T00:00:00Z",
    },
  ];

  const mockDetail: PayslipTemplateDetail = {
    activeVersion: {
      configuration: DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      createdAt: "2026-08-01T00:00:00Z",
      id: "version-1",
      publishedAt: "2026-08-01T00:00:00Z",
      schemaVersion: 1,
      status: "published",
      versionNumber: 1,
    },
    description: "Mẫu chuẩn A4 của trung tâm",
    id: "template-1",
    isArchived: false,
    isDefault: true,
    name: "Toán Thầy Vinh – Standard",
    slug: "toan-thay-vinh-standard",
    versions: [
      {
        createdAt: "2026-08-01T00:00:00Z",
        createdByEmail: "admin@toanthayvinh.edu.vn",
        createdByName: "Quản trị viên",
        id: "version-1",
        publishedAt: "2026-08-01T00:00:00Z",
        schemaVersion: 1,
        status: "published",
        templateId: "template-1",
        versionNumber: 1,
      },
    ],
  };

  it("renders template list page with template rows and default badge", () => {
    render(<TemplateListPage templates={mockTemplates} />);

    expect(screen.getAllByText("Toán Thầy Vinh – Standard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mẫu Thu Gọn")).toBeInTheDocument();
    expect(screen.getByText("Mặc định")).toBeInTheDocument();
    expect(screen.getByText("Đang có bản nháp (v2)")).toBeInTheDocument();
  });

  it("opens create preset modal when clicking Tạo mẫu mới", () => {
    render(<TemplateListPage templates={mockTemplates} />);

    const createButton = screen.getByRole("button", { name: /Tạo mẫu mới/i });
    fireEvent.click(createButton);

    expect(screen.getByText("Chọn Mẫu Khởi Tạo (Preset)")).toBeInTheDocument();
  });

  it("renders 3-panel template editor with toolbar, canvas, and sidebars", () => {
    render(<TemplateEditor initialDetail={mockDetail} />);

    // Toolbar elements
    expect(screen.getAllByText("Toán Thầy Vinh – Standard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Lưu nháp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất bản/i })).toBeInTheDocument();

    // Left sidebar elements
    expect(screen.getAllByText(/Giao diện chung/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Cấu trúc & Thành phần")).toBeInTheDocument();

    // Right panel (defaults to Branding settings)
    expect(screen.getByLabelText(/Màu chủ đạo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kiểu chữ/i)).toBeInTheDocument();
  });

  it("updates right panel to block settings when clicking a block in left sidebar", () => {
    render(<TemplateEditor initialDetail={mockDetail} />);

    // Click on "TIÊU ĐỀ PHIẾU LƯƠNG" in the list
    const headerBlockButton = screen.getAllByRole("button", {
      name: /TIÊU ĐỀ PHIẾU LƯƠNG/i,
    })[0];
    fireEvent.click(headerBlockButton);

    // Right panel should now show header block options
    expect(screen.getByText("Cài đặt khối")).toBeInTheDocument();
    expect(screen.getByText("Tùy chọn Tiêu đề")).toBeInTheDocument();
  });
});
