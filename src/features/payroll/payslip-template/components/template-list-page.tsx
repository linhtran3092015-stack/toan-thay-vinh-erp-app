"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  History,
  LayoutTemplate,
  Loader2,
  Plus,
  Star,
} from "lucide-react";

import {
  archiveTemplateAction,
  cloneTemplateAction,
  setDefaultTemplateAction,
} from "@/features/payroll/payslip-template/actions";
import { TEMPLATE_PRESETS } from "@/features/payroll/payslip-template/preset-configs";
import type { PayslipTemplateSummary } from "@/features/payroll/payslip-template/types";

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}

interface TemplateListPageProps {
  templates: readonly PayslipTemplateSummary[];
}

export function TemplateListPage({ templates }: TemplateListPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [selectedTemplateForClone, setSelectedTemplateForClone] = useState<PayslipTemplateSummary | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");

  const [createPresetModalOpen, setCreatePresetModalOpen] = useState(false);

  const handleSetDefault = (template: PayslipTemplateSummary) => {
    if (template.isDefault) return;
    if (
      !confirm(
        `Bạn có chắc chắn muốn đặt mẫu "${template.name}" làm mẫu phiếu lương mặc định cho toàn hệ thống?`,
      )
    ) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActiveTemplateId(template.id);

    startTransition(async () => {
      const res = await setDefaultTemplateAction(template.id);
      setActiveTemplateId(null);
      if (res.ok) {
        setSuccessMsg(`Đã đặt "${template.name}" làm mẫu mặc định thành công.`);
        router.refresh();
      } else {
        setErrorMsg(res.message);
      }
    });
  };

  const handleArchive = (template: PayslipTemplateSummary) => {
    if (template.isDefault) {
      alert("Không thể lưu trữ mẫu mặc định. Hãy chọn mẫu khác làm mặc định trước.");
      return;
    }

    if (
      !confirm(
        `Bạn có chắc chắn muốn lưu trữ mẫu "${template.name}"? Mẫu sẽ không xuất hiện trong danh sách hoạt động.`,
      )
    ) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActiveTemplateId(template.id);

    startTransition(async () => {
      const res = await archiveTemplateAction(template.id);
      setActiveTemplateId(null);
      if (res.ok) {
        setSuccessMsg(`Đã lưu trữ mẫu "${template.name}".`);
        router.refresh();
      } else {
        setErrorMsg(res.message);
      }
    });
  };

  const handleOpenClone = (template: PayslipTemplateSummary) => {
    setSelectedTemplateForClone(template);
    setNewTemplateName(`${template.name} (Bản sao)`);
    setCloneModalOpen(true);
  };

  const handleConfirmClone = () => {
    if (!selectedTemplateForClone || !newTemplateName.trim()) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await cloneTemplateAction(
        selectedTemplateForClone.id,
        newTemplateName.trim(),
      );
      setCloneModalOpen(false);
      setSelectedTemplateForClone(null);
      if (res.ok) {
        setSuccessMsg("Nhân bản mẫu thành công.");
        router.refresh();
      } else {
        setErrorMsg(res.message);
      }
    });
  };

  const handleCreateFromPreset = (presetId: string) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // Use default standard template as base clone or direct creation
    const standardTemplate = templates.find((t) => t.slug === "toan-thay-vinh-standard") || templates[0];
    if (!standardTemplate) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await cloneTemplateAction(
        standardTemplate.id,
        `Mẫu ${preset.name} - ${new Date().toLocaleDateString("vi-VN")}`,
      );
      setCreatePresetModalOpen(false);
      if (res.ok && res.data?.id) {
        router.push(`/payroll/settings/payslip-templates/${res.data.id}/editor`);
      } else {
        setErrorMsg(res.ok ? null : res.message);
      }
    });
  };

  const activeTemplates = templates.filter((t) => !t.isArchived);
  const archivedTemplates = templates.filter((t) => t.isArchived);

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Lỗi thao tác:</p>
          <p>{errorMsg}</p>
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <p>{successMsg}</p>
        </div>
      ) : null}

      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">
            Danh sách Mẫu Phiếu Lương ({activeTemplates.length})
          </h2>
          <p className="text-xs text-ink-muted">
            Mẫu mặc định được gắn sao vàng sẽ được áp dụng tự động cho toàn bộ nhân sự khi xem phiếu lương.
          </p>
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
          onClick={() => setCreatePresetModalOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          Tạo mẫu mới
        </button>
      </div>

      {/* Templates Table Frame */}
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-base shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-surface-subtle text-xs font-bold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-6 py-4">Tên mẫu phiếu lương</th>
                <th className="px-4 py-4 text-center">Trạng thái</th>
                <th className="px-4 py-4 text-center">Phiên bản</th>
                <th className="px-4 py-4">Người sửa</th>
                <th className="px-4 py-4">Ngày cập nhật</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {activeTemplates.map((template) => {
                const isOperating = isPending && activeTemplateId === template.id;

                return (
                  <tr
                    className={`transition-colors hover:bg-surface-subtle/50 ${
                      template.isDefault ? "bg-amber-500/[0.03]" : ""
                    }`}
                    key={template.id}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-lg p-2 ${
                            template.isDefault
                              ? "bg-amber-100 text-amber-700"
                              : "bg-surface-subtle text-ink-muted"
                          }`}
                        >
                          <LayoutTemplate className="size-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink">
                              {template.name}
                            </span>
                            {template.isDefault ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                                <Star className="size-3 fill-amber-500 text-amber-600" />
                                Mặc định
                              </span>
                            ) : null}
                          </div>
                          {template.description ? (
                            <p className="mt-0.5 text-xs text-ink-muted line-clamp-1">
                              {template.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {template.currentDraftVersionNumber ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                          Đang có bản nháp (v{template.currentDraftVersionNumber})
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          Đã xuất bản (v{template.latestPublishedVersionNumber})
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-xs font-semibold text-ink">
                        v{template.latestPublishedVersionNumber ?? template.currentDraftVersionNumber ?? 1}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        ({template.totalVersions} versions)
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-ink-muted">
                      {template.createdByName || template.createdByEmail || "Hệ thống"}
                    </td>

                    <td className="px-4 py-4 text-xs text-ink-muted">
                      {formatDateTime(template.updatedAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                          href={`/payroll/settings/payslip-templates/${template.id}/editor`}
                        >
                          <Edit3 className="size-3.5" />
                          Chỉnh sửa
                        </Link>

                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-base px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
                          onClick={() => handleOpenClone(template)}
                          title="Nhân bản mẫu"
                          type="button"
                        >
                          <Copy className="size-3.5 text-ink-muted" />
                          <span className="hidden md:inline">Nhân bản</span>
                        </button>

                        {!template.isDefault ? (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                            disabled={isOperating}
                            onClick={() => handleSetDefault(template)}
                            title="Đặt làm mẫu mặc định"
                            type="button"
                          >
                            {isOperating ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Star className="size-3.5" />
                            )}
                            <span className="hidden md:inline">Đặt mặc định</span>
                          </button>
                        ) : null}

                        {!template.isDefault ? (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                            disabled={isOperating}
                            onClick={() => handleArchive(template)}
                            title="Lưu trữ mẫu"
                            type="button"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Clone Template */}
      {cloneModalOpen && selectedTemplateForClone ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-base p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-ink">
              Nhân bản Mẫu Phiếu Lương
            </h3>
            <p className="text-xs text-ink-muted">
              Tạo bản sao mới từ mẫu &ldquo;{selectedTemplateForClone.name}&rdquo;. Bản sao sẽ mang toàn bộ cấu hình hiển thị và bắt đầu ở trạng thái bản nháp.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink" htmlFor="new-template-name">
                Tên mẫu mới *
              </label>
              <input
                className="w-full rounded-xl border border-hairline bg-surface-base px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-hidden"
                id="new-template-name"
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="VD: Mẫu Phiếu Lương Thu Gọn"
                type="text"
                value={newTemplateName}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-hairline bg-surface-base px-4 py-2 text-xs font-medium text-ink hover:bg-surface-subtle cursor-pointer"
                disabled={isPending}
                onClick={() => setCloneModalOpen(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover cursor-pointer disabled:opacity-50"
                disabled={isPending || !newTemplateName.trim()}
                onClick={handleConfirmClone}
                type="button"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Tạo bản sao
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Create from Presets */}
      {createPresetModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-hairline bg-surface-base p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Chọn Mẫu Khởi Tạo (Preset)
                </h3>
                <p className="text-xs text-ink-muted">
                  Bắt đầu tạo mẫu phiếu lương mới từ một bộ giao diện chuẩn đã thiết kế sẵn.
                </p>
              </div>
              <button
                className="text-ink-muted hover:text-ink cursor-pointer text-sm font-semibold"
                onClick={() => setCreatePresetModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATE_PRESETS.map((preset) => (
                <div
                  className="rounded-xl border border-hairline p-4 transition-all hover:border-primary hover:shadow-md bg-surface-subtle/30 flex flex-col justify-between"
                  key={preset.id}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-ink">
                        {preset.name}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                        {preset.id}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <button
                    className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => handleCreateFromPreset(preset.id)}
                    type="button"
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin mx-auto" />
                    ) : (
                      "Bắt đầu thiết kế với mẫu này"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
