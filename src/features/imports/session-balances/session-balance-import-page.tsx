"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createSessionBalanceImportBatchAction,
  dryRunSessionBalanceImportAction,
} from "@/features/imports/session-balances/actions";
import { SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS } from "@/features/imports/session-balances/fields";
import {
  buildSessionBalanceImportAutomaticMapping,
  mapSessionBalanceImportWorkbookRows,
  validateSessionBalanceImportColumnMapping,
} from "@/features/imports/session-balances/mapping";
import { downloadSessionBalanceImportTemplate } from "@/features/imports/session-balances/template-browser";
import type {
  SessionBalanceImportBatchListItem,
  SessionBalanceImportCellValue,
  SessionBalanceImportColumnMapping,
  SessionBalanceImportDryRunResult,
  SessionBalanceImportFieldKey,
  SessionBalanceImportParsedWorkbook,
  SessionBalanceImportValidationStatus,
} from "@/features/imports/session-balances/types";
import {
  parseSessionBalanceImportWorkbook,
  SessionBalanceImportWorkbookError,
} from "@/features/imports/session-balances/workbook";

const controlClassName =
  "h-10 w-full rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle";

function getTodayInVietnam(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function formatBatchDateTime(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(d);
  } catch {
    return isoString;
  }
}

function displayCellValue(
  value: SessionBalanceImportCellValue | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function getStatusTone(
  status: SessionBalanceImportValidationStatus,
): "danger" | "neutral" | "success" | "warning" {
  if (status === "invalid") {
    return "danger";
  }
  if (status === "review") {
    return "warning";
  }
  if (status === "no_change") {
    return "neutral";
  }
  return "success";
}

function getStatusLabel(
  status: SessionBalanceImportValidationStatus,
): string {
  if (status === "invalid") {
    return "Không hợp lệ";
  }
  if (status === "review") {
    return "Cần xem lại";
  }
  if (status === "no_change") {
    return "Không thay đổi";
  }
  return "Hợp lệ";
}

export interface SessionBalanceImportPageProps {
  batches?: SessionBalanceImportBatchListItem[];
  canApprove?: boolean;
  currentUserId?: string | null;
}

export function SessionBalanceImportPage({
  batches = [],
  canApprove = false,
  currentUserId = null,
}: SessionBalanceImportPageProps = {}) {
  const router = useRouter();

  const [effectiveOn, setEffectiveOn] = useState<string>(getTodayInVietnam);
  const [workbook, setWorkbook] =
    useState<SessionBalanceImportParsedWorkbook | null>(null);
  const [mapping, setMapping] = useState<SessionBalanceImportColumnMapping>(
    {},
  );
  const [dryRunResult, setDryRunResult] =
    useState<SessionBalanceImportDryRunResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [templateDownloadError, setTemplateDownloadError] = useState<
    string | null
  >(null);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [automaticMappingNotice, setAutomaticMappingNotice] = useState<
    string | null
  >(null);
  const [inputKey, setInputKey] = useState(0);

  // Batch creation states
  const [createBatchReason, setCreateBatchReason] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [createBatchError, setCreateBatchError] = useState<string | null>(
    null,
  );

  const [isPending, startTransition] = useTransition();
  const [isCreatingBatch, startBatchTransition] = useTransition();

  const mappingValidation = useMemo(
    () =>
      workbook
        ? validateSessionBalanceImportColumnMapping(
            workbook.columns,
            mapping,
          )
        : null,
    [mapping, workbook],
  );

  const mappedRows = useMemo(() => {
    if (!workbook || !mappingValidation?.isValid) {
      return [];
    }
    return mapSessionBalanceImportWorkbookRows(workbook, mapping);
  }, [mapping, mappingValidation?.isValid, workbook]);

  const previewRows = mappedRows.slice(0, 20);

  const resultRows = dryRunResult?.rows.slice(0, 500) ?? [];

  const hasFractionalReviewRows = useMemo(() => {
    if (!dryRunResult) return false;
    return dryRunResult.rows.some(
      (r) =>
        r.validation_status === "review" &&
        r.validation_code === "BALANCE_HAS_FRACTIONAL_PART",
    );
  }, [dryRunResult]);

  const hasZeroNoChangeRows = useMemo(() => {
    if (!dryRunResult) return false;
    return dryRunResult.rows.some((r) => r.validation_status === "no_change");
  }, [dryRunResult]);

  async function handleTemplateDownload(): Promise<void> {
    setTemplateDownloadError(null);
    setIsTemplateDownloading(true);

    try {
      await downloadSessionBalanceImportTemplate();
    } catch (error) {
      setTemplateDownloadError(
        error instanceof Error
          ? error.message
          : "Không thể tạo file mẫu import số dư buổi.",
      );
    } finally {
      setIsTemplateDownloading(false);
    }
  }

  function resetImport(): void {
    setWorkbook(null);
    setMapping({});
    setDryRunResult(null);
    setFileError(null);
    setActionError(null);
    setAutomaticMappingNotice(null);
    setCreateBatchReason("");
    setIsConfirmed(false);
    setCreateBatchError(null);
    setInputKey((current) => current + 1);
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];

    setWorkbook(null);
    setMapping({});
    setDryRunResult(null);
    setFileError(null);
    setActionError(null);
    setAutomaticMappingNotice(null);
    setCreateBatchReason("");
    setIsConfirmed(false);
    setCreateBatchError(null);

    if (!file) {
      return;
    }

    try {
      const parsedWorkbook = await parseSessionBalanceImportWorkbook(file);
      const automaticMapping = buildSessionBalanceImportAutomaticMapping(
        parsedWorkbook.columns,
      );

      setWorkbook(parsedWorkbook);
      setMapping(automaticMapping.mapping);

      const mappedCount = Object.keys(automaticMapping.mapping).length;
      if (mappedCount > 0) {
        setAutomaticMappingNotice(
          `Hệ thống đã tự động nhận diện ${mappedCount}/${SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.length} cột tiêu đề dựa trên file import.`,
        );
      } else {
        setAutomaticMappingNotice(
          "Không thể tự động nhận diện tiêu đề cột. Vui lòng chọn ánh xạ thủ công bên dưới.",
        );
      }
    } catch (error) {
      if (error instanceof SessionBalanceImportWorkbookError) {
        setFileError(error.message);
      } else {
        setFileError(
          "Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.",
        );
      }
    }
  }

  function handleMappingChange(
    fieldKey: SessionBalanceImportFieldKey,
    columnKey: string,
  ): void {
    // Invalidate stale dry run when mapping changes
    setDryRunResult(null);
    setActionError(null);
    setCreateBatchError(null);
    setMapping((current) => ({
      ...current,
      [fieldKey]: columnKey === "" ? null : columnKey,
    }));
  }

  function handleDryRun(): void {
    if (!workbook || !mappingValidation?.isValid || mappedRows.length === 0) {
      return;
    }

    if (!effectiveOn) {
      setActionError("Vui lòng chọn ngày hiệu lực số dư.");
      return;
    }

    setActionError(null);
    setDryRunResult(null);
    setCreateBatchError(null);

    startTransition(async () => {
      const result = await dryRunSessionBalanceImportAction({
        effective_on: effectiveOn,
        rows: mappedRows,
      });

      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      setDryRunResult(result.data);
    });
  }

  function handleCreateBatch(): void {
    if (
      !workbook ||
      !dryRunResult ||
      !createBatchReason.trim() ||
      !isConfirmed ||
      !effectiveOn
    ) {
      return;
    }

    setCreateBatchError(null);

    startBatchTransition(async () => {
      const result = await createSessionBalanceImportBatchAction({
        effectiveOn,
        reason: createBatchReason.trim(),
        rows: mappedRows,
        sourceFilename: workbook.sourceFilename,
        sourceSha256: workbook.sourceSha256,
      });

      if (!result.ok) {
        setCreateBatchError(result.message);
        return;
      }

      router.push(`/imports/session-balances/${result.data.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Import số dư buổi đầu kỳ
        </h1>
        <p className="text-sm text-ink-subtle">
          Kiểm tra dữ liệu số dư buổi đầu kỳ từ file Excel và khởi tạo batch đối soát.
        </p>
      </header>

      {/* Batch History & Pending Approvals List */}
      {batches.length > 0 ? (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
                <span>📋 Danh sách Batch đối soát &amp; Phê duyệt ({batches.length})</span>
              </CardTitle>
              <p className="text-xs text-ink-subtle">
                Chọn batch đang chờ duyệt để mở trang phê duyệt chính thức
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b border-hairline bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
                  <tr>
                    <th className="px-3 py-2.5">Thời gian tạo</th>
                    <th className="px-3 py-2.5">File nguồn / Lý do</th>
                    <th className="px-3 py-2.5">Người tạo</th>
                    <th className="px-3 py-2.5 text-center">Số dòng</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {batches.map((b) => {
                    const isMaker = currentUserId === b.created_by;
                    const isAwaitingApproval = b.status === "awaiting_approval";
                    const isAwaitingReconciliation = b.status === "awaiting_reconciliation";

                    let statusTone: "danger" | "neutral" | "success" | "warning" = "neutral";
                    let statusLabel = b.status as string;

                    if (b.status === "approved" || b.status === "posted") {
                      statusTone = "success";
                      statusLabel = b.status === "posted" ? "Đã ghi sổ" : "Đã phê duyệt";
                    } else if (isAwaitingApproval) {
                      statusTone = "warning";
                      statusLabel = isMaker ? "Chờ đối tác duyệt (Maker)" : "Chờ bạn duyệt";
                    } else if (isAwaitingReconciliation) {
                      statusTone = "warning";
                      statusLabel = "Đang chờ đối soát";
                    } else if (b.status === "rejected") {
                      statusTone = "danger";
                      statusLabel = "Đã từ chối";
                    }

                    return (
                      <tr className="hover:bg-surface-2/50 transition-colors" key={b.id}>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-ink-subtle">
                          {formatBatchDateTime(b.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-ink text-sm">{b.source_filename}</p>
                          <p className="text-xs text-ink-subtle line-clamp-1">{b.reason}</p>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink">
                          {b.creator_name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono text-xs">
                          <span className="font-bold text-ink">{b.row_count ?? 0}</span>
                          {b.valid_count != null ? (
                            <span className="text-success ml-1">({b.valid_count} hợp lệ)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge tone={statusTone}>{statusLabel}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <Link href={`/imports/session-balances/${b.id}`}>
                            {isAwaitingApproval && !isMaker && canApprove ? (
                              <Button size="sm" variant="primary">
                                Xem &amp; Phê duyệt →
                              </Button>
                            ) : isAwaitingReconciliation ? (
                              <Button size="sm" variant="outline">
                                Xem đối soát →
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline">
                                Xem chi tiết →
                              </Button>
                            )}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink">
            Bước 1: Chọn ngày hiệu lực &amp; Tải file Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-ink"
                htmlFor="effective-date-input"
              >
                Ngày hiệu lực số dư <span className="text-danger">*</span>
              </label>
              <input
                className={controlClassName}
                id="effective-date-input"
                onChange={(e) => {
                  setEffectiveOn(e.target.value);
                  // Invalidate dry run when effective date changes
                  setDryRunResult(null);
                  setCreateBatchError(null);
                }}
                type="date"
                value={effectiveOn}
              />
              <p className="text-xs text-ink-subtle">
                Ngày hiệu lực sẽ áp dụng cho tất cả các bút toán sổ buổi được ghi từ batch này.
              </p>
            </div>

            <div className="flex flex-col justify-end space-y-1.5">
              <Button
                disabled={isTemplateDownloading}
                onClick={handleTemplateDownload}
                type="button"
                variant="outline"
              >
                {isTemplateDownloading
                  ? "Đang tạo file mẫu..."
                  : "Tải file mẫu Excel (.xlsx)"}
              </Button>
            </div>
          </div>

          {templateDownloadError ? (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {templateDownloadError}
            </div>
          ) : null}

          <div className="space-y-1.5 border-t border-hairline pt-4">
            <label
              className="text-sm font-medium text-ink"
              htmlFor="session-balance-import-file-input"
            >
              Chọn file Excel import (.xlsx, tối đa 5 MB, tối đa 5.000 dòng)
            </label>
            <input
              accept=".xlsx"
              className={controlClassName}
              id="session-balance-import-file-input"
              key={inputKey}
              onChange={handleFileChange}
              type="file"
            />
          </div>

          {fileError ? (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {fileError}
            </div>
          ) : null}

          {workbook ? (
            <div className="flex items-center justify-between rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink">
              <div>
                <span className="font-medium">{workbook.sourceFilename}</span>{" "}
                <span className="text-ink-subtle font-mono text-xs">
                  (SHA: {workbook.sourceSha256.slice(0, 12)}... • {workbook.rowCount} dòng • Sheet: {workbook.sheetName})
                </span>
              </div>
              <Button onClick={resetImport} size="sm" variant="ghost">
                Đổi file khác
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {workbook ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Bước 2: Cấu hình ánh xạ cột
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {automaticMappingNotice ? (
              <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-ink">
                {automaticMappingNotice}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map((definition) => {
                const selectedColumnKey = mapping[definition.key] ?? "";
                const isMissingRequired =
                  definition.required &&
                  mappingValidation?.missingRequiredFields.includes(
                    definition.key,
                  );

                return (
                  <div className="space-y-1.5" key={definition.key}>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor={`mapping-select-${definition.key}`}
                    >
                      {definition.label}{" "}
                      {definition.required ? (
                        <span className="text-danger">*</span>
                      ) : (
                        <span className="text-xs text-ink-subtle">(Tùy chọn)</span>
                      )}
                    </label>
                    <select
                      className={`${controlClassName} ${
                        isMissingRequired
                          ? "border-danger bg-danger/5"
                          : ""
                      }`}
                      id={`mapping-select-${definition.key}`}
                      onChange={(event) =>
                        handleMappingChange(definition.key, event.target.value)
                      }
                      value={selectedColumnKey}
                    >
                      <option value="">-- Bỏ qua cột này --</option>
                      {workbook.columns.map((column) => (
                        <option key={column.columnKey} value={column.columnKey}>
                          Cột {column.columnKey}
                          {column.sourceHeader
                            ? `: ${column.sourceHeader}`
                            : " (không có tiêu đề)"}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {mappingValidation && !mappingValidation.isValid ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger space-y-1">
                <p className="font-semibold">Cấu hình ánh xạ chưa hoàn tất:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {mappingValidation.issues.map((issue, idx) => (
                    <li key={idx}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {workbook && mappingValidation?.isValid ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold text-ink">
              Bước 3: Xem trước dữ liệu ({mappedRows.length} dòng)
            </CardTitle>
            <Button
              disabled={isPending || mappedRows.length === 0}
              onClick={handleDryRun}
              type="button"
            >
              {isPending
                ? "Đang kiểm tra dry-run..."
                : "Kiểm tra dữ liệu (Dry-run)"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b border-hairline bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
                  <tr>
                    <th className="px-3 py-2 text-center w-16">Dòng</th>
                    <th className="px-3 py-2">Mã học viên *</th>
                    <th className="px-3 py-2">Họ tên nguồn</th>
                    <th className="px-3 py-2 text-right">Số dư nguồn *</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {previewRows.map((row, index) => (
                    <tr className="hover:bg-surface-2/50" key={index}>
                      <td className="px-3 py-2 text-center text-ink-subtle">
                        {row.row_number ?? index + 2}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">
                        {displayCellValue(row.student_public_code)}
                      </td>
                      <td className="px-3 py-2">
                        {displayCellValue(row.source_student_name)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {displayCellValue(row.source_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {mappedRows.length > 20 ? (
              <p className="text-xs text-ink-subtle text-center">
                Đang hiển thị 20 / {mappedRows.length} dòng preview. Đầy đủ dữ liệu sẽ được kiểm tra khi chạy Dry-run.
              </p>
            ) : null}

            {actionError ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                {actionError}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {dryRunResult && workbook ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Bước 4: Kết quả kiểm tra dữ liệu (Dry-run)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              <div className="rounded-md border border-hairline bg-surface-2 p-3 text-center">
                <p className="text-xs text-ink-subtle">Tổng số dòng</p>
                <p className="text-xl font-bold text-ink">
                  {dryRunResult.summary.total}
                </p>
              </div>
              <div className="rounded-md border border-success/30 bg-success/5 p-3 text-center">
                <p className="text-xs text-success">Hợp lệ</p>
                <p className="text-xl font-bold text-success">
                  {dryRunResult.summary.valid}
                </p>
              </div>
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-center">
                <p className="text-xs text-warning">Cần xem lại</p>
                <p className="text-xl font-bold text-warning">
                  {dryRunResult.summary.review}
                </p>
              </div>
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-center">
                <p className="text-xs text-danger">Không hợp lệ</p>
                <p className="text-xl font-bold text-danger">
                  {dryRunResult.summary.invalid}
                </p>
              </div>
              <div className="rounded-md border border-hairline bg-surface-1 p-3 text-center">
                <p className="text-xs text-ink-subtle">Không thay đổi</p>
                <p className="text-xl font-bold text-ink-subtle">
                  {dryRunResult.summary.no_change}
                </p>
              </div>
            </div>

            {hasFractionalReviewRows ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm text-ink space-y-1">
                <p className="font-semibold text-warning">
                  ⚠️ Lưu ý về số dư có phần lẻ:
                </p>
                <p>
                  Số dư có phần lẻ (ví dụ: 7.5, -2.5). Hệ thống hiện chỉ post số buổi nguyên; dòng này sẽ không được ghi vào sổ buổi và rơi vào trạng thái <strong>Cần xem lại</strong>.
                </p>
              </div>
            ) : null}

            {hasZeroNoChangeRows ? (
              <div className="rounded-md border border-hairline bg-surface-2 p-4 text-sm text-ink space-y-1">
                <p className="font-semibold text-ink-subtle">
                  ℹ️ Lưu ý về dòng không thay đổi:
                </p>
                <p>
                  Dòng có số dư bằng 0 được xếp loại <strong>Không thay đổi</strong>; không cần tạo giao dịch sổ buổi.
                </p>
              </div>
            ) : null}

            <div className="rounded-md border border-hairline bg-canvas p-4 text-xs text-ink-subtle space-y-1">
              <p className="font-semibold text-ink">Hướng dẫn xử lý các trạng thái:</p>
              <p>
                • <strong>KHÔNG HỢP LỆ (INVALID):</strong> Phải được sửa lại trong file Excel trước khi tiến hành import.
              </p>
              <p>
                • <strong>CẦN XEM LẠI (REVIEW):</strong> Cần đối soát hoặc loại bỏ (exclude) ở bước tạo batch tiếp theo.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">
                Chi tiết dòng kết quả ({resultRows.length} / {dryRunResult.summary.total} dòng)
              </h3>
              <div className="overflow-x-auto rounded-md border border-hairline">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="border-b border-hairline bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
                    <tr>
                      <th className="px-3 py-2 text-center w-16">Dòng</th>
                      <th className="px-3 py-2">Mã học viên</th>
                      <th className="px-3 py-2">Tên nguồn</th>
                      <th className="px-3 py-2 text-right">Số dư nguồn</th>
                      <th className="px-3 py-2 text-right">Hiện tại</th>
                      <th className="px-3 py-2 text-right">Dự kiến sau</th>
                      <th className="px-3 py-2">Trạng thái</th>
                      <th className="px-3 py-2">Thông báo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {resultRows.map((row) => {
                      const tone = getStatusTone(row.validation_status);
                      const label = getStatusLabel(row.validation_status);

                      return (
                        <tr className="hover:bg-surface-2/50" key={row.source_row_number}>
                          <td className="px-3 py-2 text-center text-ink-subtle font-mono">
                            {row.source_row_number}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium">
                            {row.student_public_code ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.source_student_name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {row.source_balance !== null ? row.source_balance : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-ink-subtle">
                            {row.current_balance_before !== null
                              ? row.current_balance_before
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-ink-subtle">
                            {row.expected_balance_after !== null
                              ? row.expected_balance_after
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={tone}>{label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-subtle">
                            {row.validation_message ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bước 5: Tạo batch đối soát */}
            <div className="border-t border-hairline pt-6 space-y-4">
              <h3 className="text-base font-semibold text-ink">
                Bước 5: Tạo batch đối soát
              </h3>
              <div className="rounded-md border border-hairline bg-surface-2 p-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <div>
                    <span className="text-ink-subtle">File nguồn: </span>
                    <span className="font-medium text-ink">{workbook.sourceFilename}</span>
                  </div>
                  <div>
                    <span className="text-ink-subtle">SHA-256: </span>
                    <span className="font-mono text-xs text-ink">{workbook.sourceSha256}</span>
                  </div>
                  <div>
                    <span className="text-ink-subtle">Ngày hiệu lực: </span>
                    <span className="font-medium text-ink">{effectiveOn}</span>
                  </div>
                  <div>
                    <span className="text-ink-subtle">Tổng kết: </span>
                    <span className="text-ink">
                      {dryRunResult.summary.total} dòng (Hợp lệ: {dryRunResult.summary.valid}, Cần xem lại: {dryRunResult.summary.review}, Không hợp lệ: {dryRunResult.summary.invalid}, Không thay đổi: {dryRunResult.summary.no_change})
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="create-batch-reason"
                  >
                    Lý do tạo batch <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="w-full rounded-md border border-hairline bg-surface-1 p-3 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                    id="create-batch-reason"
                    onChange={(e) => setCreateBatchReason(e.target.value)}
                    placeholder="Ví dụ: Pilot Data Import Readiness - số dư buổi đầu kỳ 08/08/2026"
                    value={createBatchReason}
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <input
                    className="mt-1 h-4 w-4 rounded border-hairline text-primary focus:ring-primary"
                    id="confirm-dry-run-check"
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    type="checkbox"
                    checked={isConfirmed}
                  />
                  <label
                    className="text-sm text-ink cursor-pointer"
                    htmlFor="confirm-dry-run-check"
                  >
                    Tôi xác nhận dữ liệu trên là kết quả dry-run của đúng file nguồn này.
                  </label>
                </div>

                {createBatchError ? (
                  <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                    {createBatchError}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    disabled={
                      isCreatingBatch ||
                      !createBatchReason.trim() ||
                      !isConfirmed
                    }
                    onClick={handleCreateBatch}
                    type="button"
                  >
                    {isCreatingBatch
                      ? "Đang tạo batch..."
                      : "Tạo batch đối soát"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
