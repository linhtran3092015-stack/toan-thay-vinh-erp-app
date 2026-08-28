"use client";

import {
  AlignLeft,
  Eye,
  EyeOff,
  HelpCircle,
  Palette,
  Settings2,
  Trash2,
  Type,
} from "lucide-react";

import {
  ALLOWED_FONT_FAMILIES,
  type AllowedFontFamily,
  type BlockSettings,
  type PayslipBrandingConfig,
  type PayslipSectionConfig,
} from "@/features/payroll/payslip-template/types";

const COLOR_PRESETS = [
  { label: "Navy (Toán Thầy Vinh)", value: "#1e3a8a" },
  { label: "Slate Tối Giản", value: "#0f172a" },
  { label: "Xanh Ngọc (Emerald)", value: "#047857" },
  { label: "Tím Chuyên Nghiệp", value: "#6d28d9" },
  { label: "Đỏ Đô (Burgundy)", value: "#991b1b" },
  { label: "Xanh Cyan Hiện Đại", value: "#0e7490" },
];

interface EditorRightPanelProps {
  branding: PayslipBrandingConfig;
  onDeleteSection: (id: string) => void;
  onUpdateBranding: (branding: Partial<PayslipBrandingConfig>) => void;
  onUpdateSection: (
    id: string,
    updates: Partial<PayslipSectionConfig>,
    settingsUpdates?: Partial<BlockSettings>,
  ) => void;
  selectedBlockId: string | null;
  selectedSection: PayslipSectionConfig | null;
}

export function EditorRightPanel({
  branding,
  onDeleteSection,
  onUpdateBranding,
  onUpdateSection,
  selectedBlockId,
  selectedSection,
}: EditorRightPanelProps) {
  // If no block selected -> Show Global Branding settings
  if (!selectedSection || selectedBlockId === null) {
    return (
      <div className="w-full lg:w-80 shrink-0 space-y-5 rounded-2xl border border-hairline bg-surface-base p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-hairline pb-3">
          <Palette className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-ink">
            Giao diện chung (Branding)
          </h3>
        </div>

        {/* Primary Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink flex items-center justify-between" htmlFor="brand-primary-color">
            <span>Màu chủ đạo (Primary Color) *</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {branding.primaryColor}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              className="size-9 rounded-xl border border-hairline cursor-pointer p-0.5"
              id="brand-primary-color"
              onChange={(e) => onUpdateBranding({ primaryColor: e.target.value })}
              type="color"
              value={branding.primaryColor}
            />
            <input
              className="flex-1 rounded-xl border border-hairline bg-surface-base px-3 py-1.5 font-mono text-xs text-ink uppercase"
              onChange={(e) => onUpdateBranding({ primaryColor: e.target.value })}
              type="text"
              value={branding.primaryColor}
            />
          </div>

          {/* Color Presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {COLOR_PRESETS.map((preset) => (
              <button
                className={`size-6 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                  branding.primaryColor.toLowerCase() === preset.value.toLowerCase()
                    ? "ring-2 ring-primary ring-offset-1"
                    : "border-hairline"
                }`}
                key={preset.value}
                onClick={() => onUpdateBranding({ primaryColor: preset.value })}
                style={{ backgroundColor: preset.value }}
                title={preset.label}
                type="button"
              />
            ))}
          </div>
        </div>

        {/* Secondary Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink flex items-center justify-between" htmlFor="brand-secondary-color">
            <span>Màu phụ (Secondary / Highlight)</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {branding.secondaryColor}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              className="size-9 rounded-xl border border-hairline cursor-pointer p-0.5"
              id="brand-secondary-color"
              onChange={(e) => onUpdateBranding({ secondaryColor: e.target.value })}
              type="color"
              value={branding.secondaryColor}
            />
            <input
              className="flex-1 rounded-xl border border-hairline bg-surface-base px-3 py-1.5 font-mono text-xs text-ink uppercase"
              onChange={(e) => onUpdateBranding({ secondaryColor: e.target.value })}
              type="text"
              value={branding.secondaryColor}
            />
          </div>
        </div>

        {/* Font Family whitelist */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink" htmlFor="brand-font-family">
            Kiểu chữ (Font Family)
          </label>
          <select
            className="w-full rounded-xl border border-hairline bg-surface-base px-3 py-2 text-xs font-medium text-ink focus:border-primary focus:outline-hidden"
            id="brand-font-family"
            onChange={(e) =>
              onUpdateBranding({ fontFamily: e.target.value as AllowedFontFamily })
            }
            value={branding.fontFamily}
          >
            {ALLOWED_FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Company Name & Subtitle */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink" htmlFor="brand-company-name">
            Tên trung tâm / Đơn vị
          </label>
          <input
            className="w-full rounded-xl border border-hairline bg-surface-base px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted"
            id="brand-company-name"
            maxLength={150}
            onChange={(e) => onUpdateBranding({ companyName: e.target.value })}
            placeholder="Trung Tâm Toán Thầy Vinh"
            type="text"
            value={branding.companyName}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink" htmlFor="brand-subtitle">
            Phụ đề / Khẩu hiệu
          </label>
          <input
            className="w-full rounded-xl border border-hairline bg-surface-base px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted"
            id="brand-subtitle"
            maxLength={200}
            onChange={(e) => onUpdateBranding({ subtitle: e.target.value })}
            placeholder="Hệ thống quản lý giáo dục"
            type="text"
            value={branding.subtitle}
          />
        </div>

        {/* Logo settings */}
        <div className="space-y-2 rounded-xl border border-hairline bg-surface-subtle/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Hiển thị Logo</span>
            <input
              checked={branding.showLogo}
              className="size-4 rounded-md border-hairline text-primary focus:ring-primary cursor-pointer"
              onChange={(e) => onUpdateBranding({ showLogo: e.target.checked })}
              type="checkbox"
            />
          </div>
          {branding.showLogo ? (
            <div className="space-y-1 pt-1">
              <label className="text-[11px] text-ink-muted block" htmlFor="brand-logo-url">
                Đường dẫn Logo (URL)
              </label>
              <input
                className="w-full rounded-lg border border-hairline bg-surface-base px-2.5 py-1 text-xs text-ink placeholder:text-ink-muted"
                id="brand-logo-url"
                onChange={(e) => onUpdateBranding({ logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                type="url"
                value={branding.logoUrl || ""}
              />
              <p className="text-[10px] text-ink-muted">
                Nếu để trống, hệ thống dùng logo chuẩn mặc định.
              </p>
            </div>
          ) : null}
        </div>

        {/* Draft Watermark */}
        <div className="space-y-2 rounded-xl border border-hairline bg-surface-subtle/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">
              Chữ mờ khi kỳ chưa chốt
            </span>
            <input
              checked={branding.showDraftWatermark}
              className="size-4 rounded-md border-hairline text-primary focus:ring-primary cursor-pointer"
              onChange={(e) =>
                onUpdateBranding({ showDraftWatermark: e.target.checked })
              }
              type="checkbox"
            />
          </div>
          {branding.showDraftWatermark ? (
            <div className="space-y-1 pt-1">
              <label className="text-[11px] text-ink-muted block" htmlFor="brand-watermark-text">
                Nội dung chữ mờ
              </label>
              <input
                className="w-full rounded-lg border border-hairline bg-surface-base px-2.5 py-1 text-xs text-ink placeholder:text-ink-muted uppercase"
                id="brand-watermark-text"
                maxLength={50}
                onChange={(e) =>
                  onUpdateBranding({ draftWatermarkText: e.target.value })
                }
                placeholder="BẢN NHÁP"
                type="text"
                value={branding.draftWatermarkText}
              />
            </div>
          ) : null}
        </div>

        {/* Border Radius */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink" htmlFor="brand-border-radius">
            Độ bo góc thẻ (Border Radius)
          </label>
          <select
            className="w-full rounded-xl border border-hairline bg-surface-base px-3 py-2 text-xs font-medium text-ink focus:border-primary focus:outline-hidden"
            id="brand-border-radius"
            onChange={(e) =>
              onUpdateBranding({
                borderRadius: e.target.value as "none" | "sm" | "md" | "lg" | "full",
              })
            }
            value={branding.borderRadius}
          >
            <option value="none">Vuông góc (None)</option>
            <option value="sm">Bo nhẹ (Small - 6px)</option>
            <option value="md">Bo vừa (Medium - 12px)</option>
            <option value="lg">Bo tròn (Large - 16px)</option>
          </select>
        </div>
      </div>
    );
  }

  // Specific Block Settings
  const settings = (selectedSection.settings || {}) as Record<string, unknown>;

  const handleUpdateSetting = (key: string, value: unknown) => {
    onUpdateSection(selectedSection.id, {}, { [key]: value });
  };

  return (
    <div className="w-full lg:w-80 shrink-0 space-y-5 rounded-2xl border border-hairline bg-surface-base p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-primary" />
          <div>
            <h3 className="text-xs font-bold uppercase text-ink">
              Cài đặt khối
            </h3>
            <span className="text-[10px] font-mono text-primary font-bold">
              {selectedSection.type}
            </span>
          </div>
        </div>

        <button
          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
          onClick={() => onDeleteSection(selectedSection.id)}
          title="Xóa khối khỏi mẫu"
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Section Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-ink" htmlFor="section-title">
          Tiêu đề khối hiển thị
        </label>
        <input
          className="w-full rounded-xl border border-hairline bg-surface-base px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted"
          id="section-title"
          maxLength={100}
          onChange={(e) =>
            onUpdateSection(selectedSection.id, { title: e.target.value })
          }
          placeholder="Tiêu đề hiển thị"
          type="text"
          value={selectedSection.title}
        />
      </div>

      {/* Common Toggles */}
      <div className="space-y-2 rounded-xl border border-hairline bg-surface-subtle/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink">Hiển thị khối</span>
          <input
            checked={selectedSection.visible}
            className="size-4 rounded-md border-hairline text-primary focus:ring-primary cursor-pointer"
            onChange={(e) =>
              onUpdateSection(selectedSection.id, { visible: e.target.checked })
            }
            type="checkbox"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-semibold text-ink block">
              Ẩn khi không có dữ liệu
            </span>
            <span className="text-[10px] text-ink-muted block">
              Tự động ẩn nếu nhân sự không phát sinh mục này
            </span>
          </div>
          <input
            checked={selectedSection.hideWhenEmpty ?? false}
            className="size-4 rounded-md border-hairline text-primary focus:ring-primary cursor-pointer"
            onChange={(e) =>
              onUpdateSection(selectedSection.id, {
                hideWhenEmpty: e.target.checked,
              })
            }
            type="checkbox"
          />
        </div>
      </div>

      {/* Block Specific Options */}
      {selectedSection.type === "header" ? (
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-bold uppercase text-ink-muted">
            Tùy chọn Tiêu đề
          </h4>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện ngày trong kỳ (Từ ngày - Đến ngày)</span>
            <input
              checked={settings.showPeriodDates !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showPeriodDates", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện ngày thanh toán lương</span>
            <input
              checked={settings.showPayDate !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showPayDate", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện huy hiệu trạng thái kỳ lương</span>
            <input
              checked={settings.showStatusBadge !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showStatusBadge", e.target.checked)
              }
              type="checkbox"
            />
          </label>
        </div>
      ) : null}

      {selectedSection.type === "employee_info" ? (
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-bold uppercase text-ink-muted">
            Thông tin nhân sự hiển thị
          </h4>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện mã nhân sự</span>
            <input
              checked={settings.showEmployeeCode !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showEmployeeCode", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện vị trí công việc</span>
            <input
              checked={settings.showPosition !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showPosition", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện bộ phận / phòng ban</span>
            <input
              checked={settings.showDepartment !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showDepartment", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện ngày vào làm</span>
            <input
              checked={settings.showJoinedDate !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showJoinedDate", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện thông tin ngân hàng (đã che số)</span>
            <input
              checked={settings.showBankInfo !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showBankInfo", e.target.checked)
              }
              type="checkbox"
            />
          </label>
        </div>
      ) : null}

      {selectedSection.type === "earnings" ? (
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-bold uppercase text-ink-muted">
            Tùy chọn Bảng thu nhập
          </h4>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện số lượng / số buổi</span>
            <input
              checked={settings.showQuantity !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showQuantity", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện đơn giá</span>
            <input
              checked={settings.showUnitRate !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showUnitRate", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện giải thích công thức</span>
            <input
              checked={settings.showFormula !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showFormula", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Chế độ bảng thu gọn (Compact)</span>
            <input
              checked={settings.compactMode === true}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("compactMode", e.target.checked)
              }
              type="checkbox"
            />
          </label>
        </div>
      ) : null}

      {selectedSection.type === "notes" ? (
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-bold uppercase text-ink-muted">
            Tùy chọn Ghi chú & Chữ ký
          </h4>
          <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
            <span>Hiện khung chữ ký xác nhận</span>
            <input
              checked={settings.showSignatures !== false}
              className="size-4 rounded-md text-primary"
              onChange={(e) =>
                handleUpdateSetting("showSignatures", e.target.checked)
              }
              type="checkbox"
            />
          </label>
          <div className="space-y-1">
            <label className="text-[11px] text-ink-muted block" htmlFor="notes-custom-text">
              Nội dung ghi chú
            </label>
            <textarea
              className="w-full rounded-xl border border-hairline bg-surface-base p-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-hidden"
              id="notes-custom-text"
              maxLength={500}
              onChange={(e) =>
                handleUpdateSetting("customNotes", e.target.value)
              }
              rows={3}
              value={(settings.customNotes as string) || ""}
            />
          </div>
        </div>
      ) : null}

      {selectedSection.type === "footer" ? (
        <div className="space-y-3 pt-1">
          <h4 className="text-[11px] font-bold uppercase text-ink-muted">
            Tùy chọn Chân trang
          </h4>
          <div className="space-y-1">
            <label className="text-[11px] text-ink-muted block" htmlFor="footer-hotline">
              Hotline
            </label>
            <input
              className="w-full rounded-lg border border-hairline bg-surface-base px-2.5 py-1 text-xs text-ink"
              id="footer-hotline"
              maxLength={50}
              onChange={(e) => handleUpdateSetting("hotline", e.target.value)}
              type="text"
              value={(settings.hotline as string) || ""}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-ink-muted block" htmlFor="footer-website">
              Website
            </label>
            <input
              className="w-full rounded-lg border border-hairline bg-surface-base px-2.5 py-1 text-xs text-ink"
              id="footer-website"
              maxLength={100}
              onChange={(e) => handleUpdateSetting("website", e.target.value)}
              type="text"
              value={(settings.website as string) || ""}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-ink-muted block" htmlFor="footer-address">
              Địa chỉ
            </label>
            <input
              className="w-full rounded-lg border border-hairline bg-surface-base px-2.5 py-1 text-xs text-ink"
              id="footer-address"
              maxLength={200}
              onChange={(e) => handleUpdateSetting("address", e.target.value)}
              type="text"
              value={(settings.address as string) || ""}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-ink-muted block" htmlFor="footer-custom-text">
              Ghi chú chân trang
            </label>
            <input
              className="w-full rounded-lg border border-hairline bg-surface-base px-2.5 py-1 text-xs text-ink"
              id="footer-custom-text"
              maxLength={200}
              onChange={(e) =>
                handleUpdateSetting("customFooterText", e.target.value)
              }
              type="text"
              value={(settings.customFooterText as string) || ""}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
