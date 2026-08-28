"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Monitor, Sparkles, X } from "lucide-react";

import {
  createDraftAction,
  publishTemplateAction,
  saveDraftAction,
} from "@/features/payroll/payslip-template/actions";
import { EditorCanvas } from "@/features/payroll/payslip-template/components/editor-canvas";
import { EditorLeftSidebar } from "@/features/payroll/payslip-template/components/editor-left-sidebar";
import { EditorRightPanel } from "@/features/payroll/payslip-template/components/editor-right-panel";
import { EditorToolbar } from "@/features/payroll/payslip-template/components/editor-toolbar";
import { TemplateVersionHistoryDialog } from "@/features/payroll/payslip-template/components/template-version-history";
import { TEMPLATE_PRESETS } from "@/features/payroll/payslip-template/preset-configs";
import type {
  BlockSettings,
  PayslipBlockType,
  PayslipBrandingConfig,
  PayslipSectionConfig,
  PayslipTemplateConfiguration,
  PayslipTemplateDetail,
} from "@/features/payroll/payslip-template/types";

interface TemplateEditorProps {
  initialDetail: PayslipTemplateDetail;
}

export function TemplateEditor({ initialDetail }: TemplateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Template metadata & active version
  const [templateDetail] = useState(initialDetail);
  const [activeVersionNumber, setActiveVersionNumber] = useState(
    initialDetail.activeVersion.versionNumber,
  );
  const [activeStatus, setActiveStatus] = useState(
    initialDetail.activeVersion.status,
  );

  // In-memory configuration state for live editing
  const [configuration, setConfiguration] =
    useState<PayslipTemplateConfiguration>(
      initialDetail.activeVersion.configuration,
    );

  // Editor UI state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dialogs
  const [historyOpen, setHistoryOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [publishConfirmationOpen, setPublishConfirmationOpen] = useState(false);

  // Warn on leave if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Updating Branding Settings
  const handleUpdateBranding = (updates: Partial<PayslipBrandingConfig>) => {
    setConfiguration((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        ...updates,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Updating Section Config & Settings
  const handleUpdateSection = (
    sectionId: string,
    updates: Partial<PayslipSectionConfig>,
    settingsUpdates?: Partial<BlockSettings>,
  ) => {
    setConfiguration((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            ...updates,
            settings: {
              ...(s.settings || {}),
              ...(settingsUpdates || {}),
            },
          };
        }
        return s;
      }),
    }));
    setHasUnsavedChanges(true);
  };

  // Reordering Sections via Drag-and-Drop
  const handleReorderSections = (newSections: PayslipSectionConfig[]) => {
    setConfiguration((prev) => ({
      ...prev,
      sections: newSections,
    }));
    setHasUnsavedChanges(true);
  };

  // Toggling Section Visibility
  const handleToggleSectionVisibility = (sectionId: string) => {
    setConfiguration((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id === sectionId) {
          return { ...s, visible: !s.visible };
        }
        return s;
      }),
    }));
    setHasUnsavedChanges(true);
  };

  // Adding Section from Palette
  const handleAddSection = (type: PayslipBlockType, defaultTitle: string) => {
    const newId = `${type}_${Date.now().toString().slice(-4)}`;
    const newSection: PayslipSectionConfig = {
      hideWhenEmpty: false,
      id: newId,
      settings: {},
      title: defaultTitle,
      type,
      visible: true,
    };

    setConfiguration((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setSelectedBlockId(newId);
    setHasUnsavedChanges(true);
  };

  // Deleting Section
  const handleDeleteSection = (sectionId: string) => {
    setConfiguration((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    if (selectedBlockId === sectionId) {
      setSelectedBlockId(null);
    }
    setHasUnsavedChanges(true);
  };

  // Applying Preset Configuration
  const handleApplyPreset = (presetConfig: PayslipTemplateConfiguration) => {
    setConfiguration(presetConfig);
    setPresetsOpen(false);
    setHasUnsavedChanges(true);
    setSuccessMsg("Đã áp dụng mẫu giao diện có sẵn vào bản nháp.");
  };

  // Save Draft Action
  const handleSaveDraft = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      // If active version is already published, create a new draft first
      let targetVersionNumber = activeVersionNumber;
      if (activeStatus === "published") {
        const draftRes = await createDraftAction(templateDetail.id);
        if (!draftRes.ok || !draftRes.data) {
          setErrorMsg(draftRes.ok ? "Lỗi không xác định" : draftRes.message);
          return;
        }
        targetVersionNumber = draftRes.data.versionNumber;
        setActiveVersionNumber(targetVersionNumber);
        setActiveStatus("draft");
      }

      const saveRes = await saveDraftAction(
        templateDetail.id,
        targetVersionNumber,
        configuration,
      );

      if (saveRes.ok) {
        setHasUnsavedChanges(false);
        setSuccessMsg(
          `Đã lưu bản nháp v${targetVersionNumber} thành công.`,
        );
      } else {
        setErrorMsg(saveRes.message);
      }
    });
  };

  // Publish Action
  const handleConfirmPublish = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setPublishConfirmationOpen(false);

    startTransition(async () => {
      // Ensure draft is saved first
      let targetVersionNumber = activeVersionNumber;
      if (activeStatus === "published" || hasUnsavedChanges) {
        if (activeStatus === "published") {
          const draftRes = await createDraftAction(templateDetail.id);
          if (!draftRes.ok || !draftRes.data) {
            setErrorMsg(draftRes.ok ? "Lỗi" : draftRes.message);
            return;
          }
          targetVersionNumber = draftRes.data.versionNumber;
        }

        const saveRes = await saveDraftAction(
          templateDetail.id,
          targetVersionNumber,
          configuration,
        );
        if (!saveRes.ok) {
          setErrorMsg(saveRes.message);
          return;
        }
      }

      const pubRes = await publishTemplateAction(
        templateDetail.id,
        targetVersionNumber,
      );

      if (pubRes.ok) {
        setActiveVersionNumber(targetVersionNumber);
        setActiveStatus("published");
        setHasUnsavedChanges(false);
        setSuccessMsg(
          `Đã xuất bản phiên bản v${targetVersionNumber} thành công! Phiếu lương sẽ áp dụng phiên bản này.`,
        );
        router.refresh();
      } else {
        setErrorMsg(pubRes.message);
      }
    });
  };

  const selectedSection =
    configuration.sections.find((s) => s.id === selectedBlockId) || null;

  return (
    <div className="space-y-4">
      {/* Mobile Screen Notice */}
      <div className="block lg:hidden rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
        <div className="flex items-center gap-2 font-bold mb-1">
          <Monitor className="size-4" />
          Trình thiết kế phiếu lương tối ưu cho màn hình lớn (Desktop)
        </div>
        <p>
          Bạn đang xem trên thiết bị màn hình nhỏ. Hãy sử dụng máy tính để có trải nghiệm kéo thả và chỉnh sửa trực quan thuận tiện nhất.
        </p>
      </div>

      {/* Alert Messages */}
      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
          <p className="font-semibold">Lỗi:</p>
          <p>{errorMsg}</p>
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <p>{successMsg}</p>
        </div>
      ) : null}

      {/* Editor Top Toolbar */}
      <EditorToolbar
        hasUnsavedChanges={hasUnsavedChanges}
        isDraft={activeStatus === "draft"}
        isSaving={isPending}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPresets={() => setPresetsOpen(true)}
        onPublish={() => setPublishConfirmationOpen(true)}
        onSaveDraft={handleSaveDraft}
        onZoomChange={setZoomLevel}
        templateName={templateDetail.name}
        versionNumber={activeVersionNumber}
        zoom={zoomLevel}
      />

      {/* Main 3-Panel Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-4">
        {/* Left Sidebar: Block Structure & Palette */}
        <EditorLeftSidebar
          onAddSection={handleAddSection}
          onSelectBlock={setSelectedBlockId}
          onToggleSectionVisibility={handleToggleSectionVisibility}
          sections={configuration.sections}
          selectedBlockId={selectedBlockId}
        />

        {/* Center: Live Interactive A4 Canvas Preview */}
        <EditorCanvas
          configuration={configuration}
          onReorderSections={handleReorderSections}
          onSelectBlock={setSelectedBlockId}
          selectedBlockId={selectedBlockId}
          zoom={zoomLevel}
        />

        {/* Right Panel: Settings (Branding or Block-specific) */}
        <EditorRightPanel
          branding={configuration.branding}
          onDeleteSection={handleDeleteSection}
          onUpdateBranding={handleUpdateBranding}
          onUpdateSection={handleUpdateSection}
          selectedBlockId={selectedBlockId}
          selectedSection={selectedSection}
        />
      </div>

      {/* Version History Modal */}
      <TemplateVersionHistoryDialog
        currentVersionNumber={activeVersionNumber}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectVersion={(vNum) => {
          router.push(
            `/payroll/settings/payslip-templates/${templateDetail.id}/editor?v=${vNum}`,
          );
        }}
        templateName={templateDetail.name}
        versions={templateDetail.versions}
      />

      {/* Presets Modal */}
      {presetsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-hairline bg-surface-base p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-amber-500" />
                <h3 className="text-base font-bold text-ink">
                  Áp dụng mẫu giao diện có sẵn (Preset)
                </h3>
              </div>
              <button
                className="text-ink-muted hover:text-ink cursor-pointer"
                onClick={() => setPresetsOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Chọn mẫu giao diện có sẵn để nạp vào bản nháp hiện tại. Thao tác này sẽ ghi đè cấu hình hiển thị đang chỉnh sửa.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATE_PRESETS.map((preset) => (
                <div
                  className="rounded-xl border border-hairline p-4 transition-all hover:border-primary hover:shadow-xs bg-surface-subtle/30 flex flex-col justify-between"
                  key={preset.id}
                >
                  <div className="space-y-1.5">
                    <span className="font-bold text-sm text-ink block">
                      {preset.name}
                    </span>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                  <button
                    className="mt-3 w-full rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                    onClick={() => handleApplyPreset(preset.configuration)}
                    type="button"
                  >
                    Nạp mẫu này
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal: Publish Version */}
      {publishConfirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-base p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-ink">
              Xuất bản phiên bản mẫu phiếu lương?
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Khi xuất bản, phiên bản này sẽ trở thành phiên bản chính thức bất biến (immutable) và được áp dụng cho nhân sự khi xem phiếu lương.
            </p>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              Mẫu: <strong>{templateDetail.name}</strong> — Phiên bản: <strong>v{activeVersionNumber}</strong>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-hairline bg-surface-base px-4 py-2 text-xs font-medium text-ink hover:bg-surface-subtle cursor-pointer"
                onClick={() => setPublishConfirmationOpen(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                disabled={isPending}
                onClick={handleConfirmPublish}
                type="button"
              >
                Xác nhận xuất bản
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
