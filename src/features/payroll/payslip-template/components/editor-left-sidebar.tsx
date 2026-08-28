"use client";

import {
  Banknote,
  Calculator,
  CalendarCheck,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  LayoutTemplate,
  Minus,
  Percent,
  Plus,
  Receipt,
  UserCheck,
} from "lucide-react";

import type {
  PayslipBlockType,
  PayslipSectionConfig,
} from "@/features/payroll/payslip-template/types";

interface BlockCategoryItem {
  defaultTitle: string;
  description: string;
  icon: typeof LayoutTemplate;
  type: PayslipBlockType;
}

const AVAILABLE_PALETTE_BLOCKS: {
  category: string;
  items: BlockCategoryItem[];
}[] = [
  {
    category: "Thông tin chung",
    items: [
      {
        defaultTitle: "TIÊU ĐỀ PHIẾU LƯƠNG",
        description: "Logo, tên trung tâm, kỳ lương và ngày trả",
        icon: LayoutTemplate,
        type: "header",
      },
      {
        defaultTitle: "THÔNG TIN NHÂN SỰ",
        description: "Mã nhân sự, vị trí, chức vụ, tài khoản ngân hàng",
        icon: UserCheck,
        type: "employee_info",
      },
      {
        defaultTitle: "TỔNG QUAN THU NHẬP",
        description: "Gross, Khấu trừ và Thực nhận nổi bật",
        icon: Receipt,
        type: "summary",
      },
    ],
  },
  {
    category: "Thu nhập & Khấu trừ",
    items: [
      {
        defaultTitle: "I. CÁC KHOẢN THU NHẬP",
        description: "Bảng chi tiết các khoản thu nhập được hưởng",
        icon: Banknote,
        type: "earnings",
      },
      {
        defaultTitle: "II. TẠM ỨNG & KHẤU TRỪ",
        description: "Bảng chi tiết các khoản tạm ứng và khấu trừ",
        icon: CreditCard,
        type: "deductions",
      },
      {
        defaultTitle: "Chi tiết công & giờ làm",
        description: "Thống kê buổi trực tiếp, online và đơn giá",
        icon: CalendarCheck,
        type: "work_hours",
      },
      {
        defaultTitle: "Chi tiết chấm bài",
        description: "Số bài chấm, hệ số và thù lao chấm bài",
        icon: GraduationCap,
        type: "grading",
      },
      {
        defaultTitle: "Chi tiết hoa hồng & tái phí",
        description: "Hoa hồng tuyển sinh và hoa hồng quản lý",
        icon: Percent,
        type: "commissions",
      },
    ],
  },
  {
    category: "Tổng kết & Khác",
    items: [
      {
        defaultTitle: "TỔNG KẾT LƯƠNG",
        description: "Thanh công thức Gross - Khấu trừ = Thực nhận",
        icon: Calculator,
        type: "totals",
      },
      {
        defaultTitle: "GHI CHÚ & XÁC NHẬN",
        description: "Ghi chú nội bộ, chữ ký nhân viên và quản lý",
        icon: FileText,
        type: "notes",
      },
      {
        defaultTitle: "CHÂN TRANG",
        description: "Địa chỉ, hotline, website và ghi chú hệ thống",
        icon: Layers,
        type: "footer",
      },
      {
        defaultTitle: "Đường kẻ phân cách",
        description: "Đường kẻ ngang phân tách các nội dung",
        icon: Minus,
        type: "divider",
      },
    ],
  },
];

interface EditorLeftSidebarProps {
  onAddSection: (type: PayslipBlockType, defaultTitle: string) => void;
  onSelectBlock: (id: string | null) => void;
  onToggleSectionVisibility: (id: string) => void;
  sections: PayslipSectionConfig[];
  selectedBlockId: string | null;
}

export function EditorLeftSidebar({
  onAddSection,
  onSelectBlock,
  onToggleSectionVisibility,
  sections,
  selectedBlockId,
}: EditorLeftSidebarProps) {
  const existingTypes = new Set(sections.map((s) => s.type));

  return (
    <div className="w-full lg:w-72 shrink-0 space-y-5 rounded-2xl border border-hairline bg-surface-base p-4 shadow-xs">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Cấu trúc & Thành phần
        </h3>
        <p className="text-[11px] text-ink-muted mt-0.5">
          Nhấp vào khối để chỉnh sửa thiết lập hiển thị.
        </p>
      </div>

      {/* Global Branding Card Shortcut */}
      <button
        className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
          selectedBlockId === null
            ? "border-primary bg-primary/5 shadow-xs"
            : "border-hairline bg-surface-subtle/50 hover:border-hairline-strong hover:bg-surface-subtle"
        }`}
        onClick={() => onSelectBlock(null)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <div className="size-3.5 rounded-full bg-primary" />
          <span className="text-xs font-bold text-ink">
            Giao diện chung (Branding)
          </span>
        </div>
        <p className="text-[11px] text-ink-muted mt-1">
          Màu chủ đạo, font chữ, logo, khung viền
        </p>
      </button>

      {/* Active Section List */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-bold text-ink-muted uppercase">
          Các khối đang có ({sections.length})
        </h4>
        <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
          {sections.map((section, idx) => {
            const isSelected = selectedBlockId === section.id;

            return (
              <div
                className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-hairline bg-surface-base text-ink hover:bg-surface-subtle"
                }`}
                key={section.id}
              >
                <button
                  className="flex items-center gap-2 flex-1 text-left truncate cursor-pointer"
                  onClick={() => onSelectBlock(section.id)}
                  type="button"
                >
                  <span className="text-[10px] font-mono text-ink-muted">
                    {idx + 1}.
                  </span>
                  <span className="truncate">
                    {section.title || section.type}
                  </span>
                </button>

                <button
                  className={`size-6 flex items-center justify-center rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer ${
                    section.visible ? "text-primary" : "text-ink-muted opacity-60"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSectionVisibility(section.id);
                  }}
                  title={section.visible ? "Đang hiện (nhấp để ẩn)" : "Đang ẩn (nhấp để hiện)"}
                  type="button"
                >
                  {section.visible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-hairline" />

      {/* Block Palette to Add */}
      <div className="space-y-4">
        <h4 className="text-[11px] font-bold text-ink-muted uppercase">
          Thêm thành phần
        </h4>

        {AVAILABLE_PALETTE_BLOCKS.map((group) => (
          <div className="space-y-1.5" key={group.category}>
            <span className="text-[10px] font-semibold text-ink-muted block">
              {group.category}
            </span>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isAdded = existingTypes.has(item.type);
                const IconComponent = item.icon;

                return (
                  <button
                    className={`w-full flex items-center justify-between rounded-xl border border-hairline px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isAdded
                        ? "bg-surface-subtle/40 opacity-70 hover:opacity-100"
                        : "bg-surface-base hover:border-primary hover:bg-primary/5"
                    }`}
                    key={item.type}
                    onClick={() => onAddSection(item.type, item.defaultTitle)}
                    type="button"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconComponent className="size-3.5 text-primary shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-ink block truncate">
                          {item.defaultTitle}
                        </span>
                        <span className="text-[10px] text-ink-muted block truncate">
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <Plus className="size-3.5 text-ink-muted shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
