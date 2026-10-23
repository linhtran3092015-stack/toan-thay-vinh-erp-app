"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import type { StepperStep } from "@/components/patterns/stepper";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ImportActionBar } from "@/features/imports/components/import-action-bar";
import { ImportFileStep } from "@/features/imports/components/import-file-step";
import { ImportReviewTable, type ImportReviewColumn } from "@/features/imports/components/import-review-table";
import { ImportSummaryStrip } from "@/features/imports/components/import-summary-strip";
import { ImportWizardFrame } from "@/features/imports/components/import-wizard-frame";
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
import {
  getSessionBalanceBatchHref,
  SessionBalanceBatchList,
} from "@/features/imports/session-balances/session-balance-batch-list";
import type { SessionBalanceImportPageActions } from "@/features/imports/session-balances/session-balance-import-action-overrides";
import {
  formatSessionBalance,
  getSessionBalanceRowIssue,
  getSessionBalanceRowSeverity,
} from "@/features/imports/session-balances/session-balance-import-labels";
import { downloadSessionBalanceImportTemplate } from "@/features/imports/session-balances/template-browser";
import type {
  SessionBalanceImportBatchListItem,
  SessionBalanceImportCellValue,
  SessionBalanceImportColumnMapping,
  SessionBalanceImportDryRunResult,
  SessionBalanceImportFieldKey,
  SessionBalanceImportMappingIssue,
  SessionBalanceImportParsedWorkbook,
  SessionBalanceImportRowResult,
} from "@/features/imports/session-balances/types";
import {
  parseSessionBalanceImportWorkbook,
  SESSION_BALANCE_IMPORT_MAX_FILE_BYTES,
  SESSION_BALANCE_IMPORT_MAX_ROWS,
  SessionBalanceImportWorkbookError,
} from "@/features/imports/session-balances/workbook";
import { formatIsoDate, getVietnamToday } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

export type SessionBalanceImportStep = "file" | "mapping" | "review" | "create";

const STEP_ORDER: readonly SessionBalanceImportStep[] = ["file", "mapping", "review", "create"];

/** Wizard step names (W1): the pipeline's real stages up to the batch; reconcile/approve/post live on the batch page. */
export const SESSION_BALANCE_IMPORT_STEP_TITLES: Readonly<Record<SessionBalanceImportStep, string>> = {
  create: "Tạo lô đối soát",
  file: "Ngày hiệu lực & file",
  mapping: "Ánh xạ cột",
  review: "Kiểm tra dòng",
};

const PAGE_TITLE = "Nhập số dư buổi đầu kỳ";

/** What happens after "Tạo lô đối soát" (W3): stages in words, no role names. */
export const SESSION_BALANCE_CREATE_NEXT_STEPS = "Sau khi tạo lô: đối soát → phê duyệt → ghi sổ; mỗi bước ở trang lô.";

/** A write whose answer never arrived (W3): the batch may or may not exist. */
const UNKNOWN_RESULT = "Không rõ kết quả. Mở lại trang (hoặc lô) để kiểm tra trước khi thử lại.";

/** The review table shows at most this many rows (today's cap), with "Hiển thị {n}/{total} dòng". */
export const SESSION_BALANCE_REVIEW_ROW_CAP = 500;

/** The file step's limits, read from the parser's own constants (.xlsx only, one sheet). */
export const SESSION_BALANCE_IMPORT_LIMITS_TEXT = `Chỉ nhận .xlsx có đúng một trang tính, tối đa ${formatNumber(
  SESSION_BALANCE_IMPORT_MAX_FILE_BYTES / (1024 * 1024),
)} MB và ${formatNumber(SESSION_BALANCE_IMPORT_MAX_ROWS)} dòng dữ liệu.`;

/** Mapped rows shown on the mapping step before the server check. */
const MAPPING_PREVIEW_ROWS = 20;

const FIELD_LABELS: Readonly<Record<SessionBalanceImportFieldKey, string>> = Object.fromEntries(
  SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map((definition) => [definition.key, definition.label]),
) as Record<SessionBalanceImportFieldKey, string>;

export interface SessionBalanceImportPageProps {
  /** Newest batches first (the route loads at most 50). */
  batches?: SessionBalanceImportBatchListItem[];
  /** imports.session_balances.approve: the list says "Chờ bạn duyệt" and links "Xem & Phê duyệt". */
  canApprove?: boolean;
  /**
   * imports.session_balances: may run the wizard (dry-run, create a batch).
   * Defaults to true; without it the page shows the batch list only.
   */
  canImport?: boolean;
  currentUserId?: string | null;
  /** Replaces the real server actions (the /dev preview passes inert stubs). */
  actions?: SessionBalanceImportPageActions;
  /** Batch page link; previews keep it under /dev. */
  getBatchHref?: (batchId: string) => string;
  /** Default effective date (`YYYY-MM-DD`); the Vietnam business date when absent. */
  today?: string;
  /** Seeding for tests and previews: the step to open (clamped to what the seeded data allows). */
  initialStep?: SessionBalanceImportStep;
  initialEffectiveOn?: string;
  initialWorkbook?: SessionBalanceImportParsedWorkbook | null;
  /** Defaults to the automatic mapping of `initialWorkbook`. */
  initialMapping?: SessionBalanceImportColumnMapping;
  initialDryRun?: SessionBalanceImportDryRunResult | null;
}

/**
 * /imports/session-balances (design 17c): the import wizard in the shared
 * frame, four honest steps "Ngày hiệu lực & file" → "Ánh xạ cột" → "Kiểm tra
 * dòng" → "Tạo lô đối soát", one step body at a time. The batch list (newest
 * 50) is the first section of the first step's body; people without
 * imports.session_balances see the list only. Creating a batch is not gated
 * by row quality (the server stages every row; the batch page excludes rows):
 * the action says what happens next instead.
 */
export function SessionBalanceImportPage({
  batches = [],
  canApprove = false,
  canImport = true,
  currentUserId = null,
  getBatchHref = getSessionBalanceBatchHref,
  ...wizardProps
}: SessionBalanceImportPageProps = {}) {
  const list = (
    <SessionBalanceBatchList
      batches={batches}
      canApprove={canApprove}
      canImport={canImport}
      currentUserId={currentUserId}
      getBatchHref={getBatchHref}
    />
  );

  if (!canImport) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <PageHeader title={PAGE_TITLE}>
          <p className="mt-1 text-secondary text-text-muted">
            Tài khoản này xem và duyệt các lô số dư; không có quyền nhập số dư buổi học từ file.
          </p>
        </PageHeader>
        {list}
      </div>
    );
  }

  return (
    <SessionBalanceImportWizard
      {...wizardProps}
      getBatchHref={getBatchHref}
      list={batches.length > 0 ? list : null}
    />
  );
}

type WizardProps = Omit<SessionBalanceImportPageProps, "batches" | "canApprove" | "canImport" | "currentUserId" | "getBatchHref"> & {
  getBatchHref: (batchId: string) => string;
  list: ReactNode;
};

function clampStep(
  step: SessionBalanceImportStep,
  facts: { hasDryRun: boolean; hasWorkbook: boolean; mappingValid: boolean },
): SessionBalanceImportStep {
  if (step === "file" || !facts.hasWorkbook) return "file";
  if (step === "mapping" || !facts.mappingValid || !facts.hasDryRun) return "mapping";
  return step;
}

/** The action bar's disabled reason, wired to the primary through `reasonId` only while there is one. */
function stepReason(
  reason: string | null,
  reasonId: string,
): { reason: string; reasonId: string } | { reason?: undefined; reasonId?: undefined } {
  return reason ? { reason, reasonId } : {};
}

function displayCellValue(value: SessionBalanceImportCellValue | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/** Mapping issues in Vietnamese with the field's label; the module's own message for anything else. */
function describeMappingIssue(issue: SessionBalanceImportMappingIssue): string {
  const field = issue.fieldKey ? FIELD_LABELS[issue.fieldKey] : undefined;
  if (issue.code === "missing_required_field" && field) return `Chưa chọn cột cho trường bắt buộc “${field}”.`;
  if (issue.code === "duplicate_source_column" && issue.columnKey) {
    return `Cột ${issue.columnKey} đang được chọn cho nhiều trường; mỗi cột chỉ dùng cho một trường.`;
  }
  if (issue.code === "unknown_source_column" && issue.columnKey) return `Không tìm thấy cột ${issue.columnKey} trong file.`;
  return issue.message;
}

function SessionBalanceImportWizard({
  actions,
  getBatchHref,
  initialDryRun = null,
  initialEffectiveOn,
  initialMapping,
  initialStep = "file",
  initialWorkbook = null,
  list,
  today,
}: WizardProps) {
  const router = useRouter();
  const dryRun = actions?.dryRunSessionBalanceImport ?? dryRunSessionBalanceImportAction;
  const createBatch = actions?.createSessionBalanceImportBatch ?? createSessionBalanceImportBatchAction;
  const ids = {
    confirm: useId(),
    file: useId(),
    stepHeading: useId(),
    stepReason: useId(),
  };

  const [initialAutomatic] = useState(() =>
    initialWorkbook ? buildSessionBalanceImportAutomaticMapping(initialWorkbook.columns).mapping : {},
  );
  const [step, setStep] = useState<SessionBalanceImportStep>(initialStep);
  const [effectiveOn, setEffectiveOn] = useState<string>(() => initialEffectiveOn ?? today ?? getVietnamToday());
  const [workbook, setWorkbook] = useState<SessionBalanceImportParsedWorkbook | null>(initialWorkbook);
  const [mapping, setMapping] = useState<SessionBalanceImportColumnMapping>(() => initialMapping ?? initialAutomatic);
  const [autoMappedCount, setAutoMappedCount] = useState<number | null>(() =>
    initialWorkbook ? Object.keys(initialAutomatic).length : null,
  );
  const [dryRunResult, setDryRunResult] = useState<SessionBalanceImportDryRunResult | null>(initialDryRun);
  const [isReading, setIsReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isDryRunning, startDryRun] = useTransition();
  const [isCreating, startCreate] = useTransition();
  // Bumped by every input change that invalidates a check (a new or cleared file, the mapping,
  // the effective date) and by each check: an answer is applied only while its run is still the latest.
  const checkRun = useRef(0);

  const mappingValidation = useMemo(
    () => (workbook ? validateSessionBalanceImportColumnMapping(workbook.columns, mapping) : null),
    [mapping, workbook],
  );
  const mappedRows = useMemo(
    () => (workbook && mappingValidation?.isValid ? mapSessionBalanceImportWorkbookRows(workbook, mapping) : []),
    [mapping, mappingValidation?.isValid, workbook],
  );

  const currentStep = clampStep(step, {
    hasDryRun: dryRunResult !== null,
    hasWorkbook: workbook !== null,
    mappingValid: mappingValidation?.isValid ?? false,
  });
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const steps: StepperStep[] = STEP_ORDER.map((key, index) => ({
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    title: SESSION_BALANCE_IMPORT_STEP_TITLES[key],
  }));

  /** A new file (or a cleared one) invalidates every later step. */
  function clearFromFile(): void {
    checkRun.current += 1;
    setWorkbook(null);
    setMapping({});
    setAutoMappedCount(null);
    setDryRunResult(null);
    setFileError(null);
    setDryRunError(null);
    setReason("");
    setIsConfirmed(false);
    setCreateError(null);
    setStep("file");
  }

  async function handleFileSelected(file: File): Promise<void> {
    clearFromFile();
    setIsReading(true);
    try {
      // The parser checks the extension too: a dropped file skips the input's `accept`.
      const parsed = await parseSessionBalanceImportWorkbook(file);
      const automatic = buildSessionBalanceImportAutomaticMapping(parsed.columns);
      setWorkbook(parsed);
      setMapping(automatic.mapping);
      setAutoMappedCount(Object.keys(automatic.mapping).length);
    } catch (error) {
      setFileError(
        error instanceof SessionBalanceImportWorkbookError
          ? error.message
          : "Không đọc được file Excel. Kiểm tra lại định dạng file.",
      );
    } finally {
      setIsReading(false);
    }
  }

  async function handleTemplateDownload(): Promise<void> {
    setTemplateError(null);
    setIsTemplateDownloading(true);
    try {
      await downloadSessionBalanceImportTemplate();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Không tạo được file mẫu.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }

  function handleEffectiveOnChange(value: string): void {
    checkRun.current += 1;
    setEffectiveOn(value);
    // The check ran for another date: it no longer describes this batch.
    setDryRunResult(null);
    setIsConfirmed(false);
    setCreateError(null);
  }

  function handleMappingChange(fieldKey: SessionBalanceImportFieldKey, columnKey: string): void {
    checkRun.current += 1;
    // A changed mapping sends other values: the previous check is stale.
    setDryRunResult(null);
    setDryRunError(null);
    setIsConfirmed(false);
    setCreateError(null);
    setMapping((current) => ({ ...current, [fieldKey]: columnKey === "" ? null : columnKey }));
  }

  function handleDryRun(): void {
    if (!workbook || !mappingValidation?.isValid || mappedRows.length === 0 || !effectiveOn) return;
    const run = ++checkRun.current;
    setDryRunError(null);
    setDryRunResult(null);
    setCreateError(null);
    startDryRun(async () => {
      let result: Awaited<ReturnType<typeof dryRun>>;
      try {
        result = await dryRun({ effective_on: effectiveOn, rows: mappedRows });
      } catch {
        if (run !== checkRun.current) return;
        setDryRunError("Không kết nối được máy chủ để kiểm tra. Bước này không ghi dữ liệu; thử lại sau.");
        return;
      }
      // The file, the mapping or the date changed while the check ran: this answer is for other inputs.
      if (run !== checkRun.current) return;
      if (!result.ok) {
        setDryRunError(result.message);
        return;
      }
      setDryRunResult(result.data);
      // The confirmation belongs to one check, as in the other import wizards.
      setIsConfirmed(false);
      setStep("review");
    });
  }

  function handleCreateBatch(): void {
    if (!workbook || !dryRunResult || !reason.trim() || !isConfirmed || !effectiveOn) return;
    setCreateError(null);
    startCreate(async () => {
      let result: Awaited<ReturnType<typeof createBatch>>;
      try {
        result = await createBatch({
          effectiveOn,
          reason: reason.trim(),
          rows: mappedRows,
          sourceFilename: workbook.sourceFilename,
          sourceSha256: workbook.sourceSha256,
        });
      } catch {
        // The request may have reached the server: reload the list so a created batch shows up.
        setCreateError(UNKNOWN_RESULT);
        router.refresh();
        return;
      }
      if (!result.ok) {
        setCreateError(result.message);
        return;
      }
      router.push(getBatchHref(result.data.id));
    });
  }

  const summary = dryRunResult?.summary;
  const context = workbook ? `${workbook.sourceFilename} · ${formatNumber(workbook.rowCount)} dòng` : undefined;

  let body: ReactNode;
  let actionBar: ReactNode;

  if (currentStep === "file") {
    const reasonText = isReading ? "Đang đọc file." : !workbook ? "Chọn file Excel trước." : !effectiveOn ? "Chọn ngày hiệu lực trước." : null;
    body = (
      <>
        {list}
        <section
          aria-labelledby={ids.stepHeading}
          className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
        >
          <div className="border-b border-border-row px-5 py-4">
            <h2 className="text-section-title font-semibold text-text-strong" id={ids.stepHeading}>
              Ngày hiệu lực và file Excel
            </h2>
            <p className="mt-0.5 text-secondary text-text-muted">
              File được đọc ngay trên trình duyệt; máy chủ chỉ nhận các cột đã ánh xạ ở bước sau.
            </p>
          </div>
          <div className="p-5">
            <Field
              className="max-w-xs"
              hint="Áp dụng cho mọi bút toán sổ buổi ghi từ lô này."
              label="Ngày hiệu lực số dư"
              required
            >
              {(props) => (
                <Input
                  {...props}
                  className="tabular-nums"
                  onChange={(event) => handleEffectiveOnChange(event.target.value)}
                  type="date"
                  value={effectiveOn}
                />
              )}
            </Field>
          </div>
        </section>
        <ImportFileStep
          accept=".xlsx"
          error={fileError}
          file={workbook ? { name: workbook.sourceFilename, rows: workbook.rowCount, sha256: workbook.sourceSha256, sheet: workbook.sheetName } : null}
          inputId={ids.file}
          isReading={isReading}
          label="Chọn file Excel"
          limitsText={SESSION_BALANCE_IMPORT_LIMITS_TEXT}
          onFileSelected={(file) => void handleFileSelected(file)}
          onReset={clearFromFile}
          templateAction={
            <>
              <Button isLoading={isTemplateDownloading} onClick={() => void handleTemplateDownload()} size="sm" variant="secondary">
                Tải file mẫu (.xlsx)
              </Button>
              {templateError ? (
                <p className="text-caption text-danger" role="alert">
                  {templateError}
                </p>
              ) : (
                <p className="text-caption text-text-muted">Mẫu có các cột Mã học viên, Họ và tên học viên, Số dư buổi.</p>
              )}
            </>
          }
        />
      </>
    );
    actionBar = (
      <ImportActionBar
        {...stepReason(reasonText, ids.stepReason)}
        primary={
          <Button aria-describedby={reasonText ? ids.stepReason : undefined} disabled={Boolean(reasonText)} onClick={() => setStep("mapping")}>
            Tiếp tục: Ánh xạ cột
          </Button>
        }
        text={
          workbook
            ? `Đã đọc ${formatNumber(workbook.rowCount)} dòng. Bước tiếp: chọn cột cho từng trường.`
            : "Chọn ngày hiệu lực số dư và file Excel theo mẫu."
        }
      />
    );
  } else if (currentStep === "mapping" && workbook) {
    const issues = mappingValidation?.issues ?? [];
    const missing = new Set(mappingValidation?.missingRequiredFields ?? []);
    const previewRows = mappedRows.slice(0, MAPPING_PREVIEW_ROWS);
    const reasonText = !mappingValidation?.isValid
      ? "Chọn đủ cột cho các trường bắt buộc trước khi kiểm tra."
      : !effectiveOn
        ? "Chọn ngày hiệu lực ở bước 1 trước khi kiểm tra."
        : null;

    body = (
      <>
        <section
          aria-labelledby={ids.stepHeading}
          className="@container rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
        >
          <div className="border-b border-border-row px-5 py-4">
            <h2 className="text-section-title font-semibold text-text-strong" id={ids.stepHeading}>
              Ánh xạ cột trong file
            </h2>
            <p className="mt-0.5 text-secondary text-text-muted">Chọn cột của file cho từng trường; mỗi cột chỉ dùng cho một trường.</p>
          </div>
          <div className="grid gap-4 p-5">
            {autoMappedCount !== null ? (
              <ResultBanner
                description={
                  autoMappedCount > 0
                    ? "Kiểm tra lại trước khi chạy kiểm tra."
                    : "Chọn cột cho từng trường bên dưới."
                }
                title={
                  autoMappedCount > 0
                    ? `Đã tự khớp ${autoMappedCount}/${SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.length} trường theo tiêu đề cột.`
                    : "Không tự khớp được trường nào theo tiêu đề cột."
                }
                tone="info"
              />
            ) : null}
            <div className="grid gap-4 @min-[720px]:grid-cols-3">
              {SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map((definition) => (
                <Field
                  hint={definition.required ? undefined : "Tùy chọn"}
                  key={definition.key}
                  label={definition.label}
                  required={definition.required}
                >
                  {(props) => (
                    <Select
                      {...props}
                      aria-invalid={missing.has(definition.key) || undefined}
                      onChange={(event) => handleMappingChange(definition.key, event.target.value)}
                      value={mapping[definition.key] ?? ""}
                    >
                      <option value="">Không dùng cột nào</option>
                      {workbook.columns.map((column) => (
                        <option key={column.columnKey} value={column.columnKey}>
                          Cột {column.columnKey}
                          {column.sourceHeader ? `: ${column.sourceHeader}` : " (không có tiêu đề)"}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ))}
            </div>
            {issues.length > 0 ? (
              <ResultBanner title="Ánh xạ chưa xong." tone="error">
                <ul className="mt-1 list-disc pl-5">
                  {issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.fieldKey ?? ""}-${index}`}>{describeMappingIssue(issue)}</li>
                  ))}
                </ul>
              </ResultBanner>
            ) : null}
          </div>
        </section>

        {previewRows.length > 0 ? (
          <DataTableFrame
            body={previewRows.map((row, index) => (
              <TableRow key={row.row_number ?? index}>
                <TableCell className="text-text-muted" numeric>
                  {row.row_number ?? index + 2}
                </TableCell>
                <TableCell className="font-semibold text-text-strong">{displayCellValue(row.student_public_code)}</TableCell>
                <TableCell>{displayCellValue(row.source_student_name)}</TableCell>
                <TableCell numeric>{displayCellValue(row.source_balance)}</TableCell>
              </TableRow>
            ))}
            caption={`Xem trước ${formatNumber(previewRows.length)} dòng đầu theo ánh xạ`}
            footer={
              mappedRows.length > previewRows.length ? (
                <span className="tabular-nums">
                  Hiển thị {formatNumber(previewRows.length)}/{formatNumber(mappedRows.length)} dòng; máy chủ kiểm tra toàn bộ {formatNumber(mappedRows.length)} dòng.
                </span>
              ) : null
            }
            header={
              <tr>
                <TableHeaderCell className="w-[72px]" numeric>
                  Dòng
                </TableHeaderCell>
                <TableHeaderCell>Mã học viên</TableHeaderCell>
                <TableHeaderCell>Họ và tên học viên</TableHeaderCell>
                <TableHeaderCell numeric>Số dư buổi</TableHeaderCell>
              </tr>
            }
          />
        ) : null}

        {dryRunError ? <ResultBanner description={dryRunError} title="Chưa kiểm tra được." tone="error" /> : null}
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isDryRunning, label: SESSION_BALANCE_IMPORT_STEP_TITLES.file, onClick: () => setStep("file") }}
        {...stepReason(reasonText, ids.stepReason)}
        primary={
          <Button
            aria-describedby={reasonText ? ids.stepReason : undefined}
            disabled={Boolean(reasonText) || mappedRows.length === 0}
            isLoading={isDryRunning}
            onClick={handleDryRun}
          >
            {isDryRunning ? "Đang kiểm tra…" : `Kiểm tra ${formatNumber(mappedRows.length || workbook.rowCount)} dòng`}
          </Button>
        }
        text={`Máy chủ kiểm tra từng dòng với ngày hiệu lực ${formatIsoDate(effectiveOn)}; bước này chưa ghi dữ liệu.`}
      />
    );
  } else if (currentStep === "review" && dryRunResult && summary) {
    const hasFractional = dryRunResult.rows.some(
      (row) => row.validation_status === "review" && row.validation_code === "BALANCE_HAS_FRACTIONAL_PART",
    );
    const hasZero = dryRunResult.rows.some((row) => row.validation_status === "no_change");

    body = (
      <>
        <h2 className="sr-only" id={ids.stepHeading}>
          Kết quả kiểm tra
        </h2>
        <ImportSummaryStrip
          cells={[
            { label: "Tổng dòng", value: summary.total },
            { label: "Hợp lệ", tone: "success", value: summary.valid },
            { label: "Cần xem lại", tone: "warning", value: summary.review },
            { label: "Không hợp lệ", tone: "danger", value: summary.invalid },
            { label: "Không thay đổi", tone: "muted", value: summary.no_change },
          ]}
          label="Kết quả kiểm tra"
        />
        {hasFractional ? (
          <ResultBanner
            description="Sổ buổi chỉ ghi số nguyên: dòng có phần lẻ (ví dụ 7,5) ở trạng thái Cần xem lại, không được làm tròn và phải được loại khỏi lô ở bước đối soát."
            title="Có số dư lẻ."
            tone="warning"
          />
        ) : null}
        {hasZero ? (
          <ResultBanner
            description="Dòng có số dư bằng 0 là Không thay đổi: không tạo bút toán sổ buổi."
            title="Có số dư bằng 0."
            tone="info"
          />
        ) : null}
        <ImportReviewTable<SessionBalanceImportRowResult>
          caption={`Kết quả kiểm tra ${formatNumber(summary.total)} dòng`}
          cardTitle={(row) => `Dòng ${row.source_row_number} · ${row.student_public_code ?? "Thiếu mã học viên"}`}
          columns={reviewColumns}
          getRowIssue={(row) => getSessionBalanceRowIssue(row)}
          getRowKey={(row) => String(row.source_row_number)}
          getRowSeverity={(row) => getSessionBalanceRowSeverity(row.validation_status)}
          maxRows={SESSION_BALANCE_REVIEW_ROW_CAP}
          rows={dryRunResult.rows}
        />
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ label: SESSION_BALANCE_IMPORT_STEP_TITLES.mapping, onClick: () => setStep("mapping") }}
        primary={<Button onClick={() => setStep("create")}>Tiếp tục: Tạo lô đối soát</Button>}
        text={
          summary.invalid > 0
            ? `Còn ${formatNumber(summary.invalid)} dòng không hợp lệ: lô có dòng này không đối soát được. Nên sửa file Excel rồi chọn lại file.`
            : summary.review > 0
              ? `${formatNumber(summary.review)} dòng cần xem lại sẽ phải được loại khỏi lô ở bước đối soát.`
              : "Không còn dòng cần xử lý. Bước tiếp: tạo lô đối soát."
        }
      />
    );
  } else if (dryRunResult && summary && workbook) {
    const reasonText = !reason.trim() ? "Nhập lý do tạo lô." : !isConfirmed ? "Đánh dấu ô xác nhận." : null;

    body = (
      <section
        aria-labelledby={ids.stepHeading}
        className="@container rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
      >
        <div className="border-b border-border-row px-5 py-4">
          <h2 className="text-section-title font-semibold text-text-strong" id={ids.stepHeading}>
            Thông tin lô sẽ tạo
          </h2>
          <p className="mt-0.5 text-secondary text-text-muted">Lô ghi lại toàn bộ {formatNumber(summary.total)} dòng của file; chưa có bút toán nào ở bước này.</p>
        </div>
        <div className="grid gap-4 p-5">
          <dl className="m-0 grid gap-3 @min-[640px]:grid-cols-3">
            <CreateFact label="Ngày hiệu lực">
              <span className="tabular-nums">{formatIsoDate(effectiveOn)}</span>
            </CreateFact>
            <CreateFact label="SHA-256">
              <span className="font-mono text-secondary font-normal" title={workbook.sourceSha256}>
                {workbook.sourceSha256.slice(0, 12)}…
              </span>
            </CreateFact>
            <CreateFact label="Các dòng">
              <span className="tabular-nums">
                {formatNumber(summary.valid)} hợp lệ · {formatNumber(summary.review)} cần xem lại · {formatNumber(summary.invalid)} không hợp lệ ·{" "}
                {formatNumber(summary.no_change)} không thay đổi
              </span>
            </CreateFact>
          </dl>
          {summary.invalid > 0 ? (
            <ResultBanner
              description="Trang lô chỉ cho loại dòng cần xem lại; lô còn dòng không hợp lệ sẽ không đối soát được. Sửa file Excel rồi chọn lại file nếu cần."
              title={`Lô sẽ có ${formatNumber(summary.invalid)} dòng không hợp lệ.`}
              tone="warning"
            />
          ) : null}
          <Field className="max-w-2xl" hint="Ghi rõ mục đích, ví dụ: số dư buổi đầu kỳ của các lớp đang học." label="Lý do tạo lô" required>
            {(props) => <Textarea {...props} maxLength={2000} onChange={(event) => setReason(event.target.value)} value={reason} />}
          </Field>
          <label className="flex min-h-11 items-start gap-2.5 py-2 text-body text-text-strong md:min-h-10" htmlFor={ids.confirm}>
            <input
              checked={isConfirmed}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
              id={ids.confirm}
              onChange={(event) => setIsConfirmed(event.target.checked)}
              type="checkbox"
            />
            Tôi xác nhận kết quả kiểm tra ở bước trước là của đúng file nguồn này.
          </label>
          {createError ? <ResultBanner description={createError} title="Chưa tạo được lô." tone="error" /> : null}
        </div>
      </section>
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isCreating, label: SESSION_BALANCE_IMPORT_STEP_TITLES.review, onClick: () => setStep("review") }}
        {...stepReason(reasonText, ids.stepReason)}
        primary={
          <Button
            aria-describedby={reasonText ? ids.stepReason : undefined}
            disabled={Boolean(reasonText)}
            isLoading={isCreating}
            onClick={handleCreateBatch}
          >
            {isCreating ? "Đang tạo lô…" : "Tạo lô đối soát"}
          </Button>
        }
        text={SESSION_BALANCE_CREATE_NEXT_STEPS}
      />
    );
  }

  return (
    <ImportWizardFrame
      actionBar={actionBar}
      context={context}
      stepperLabel="Các bước nhập số dư buổi"
      steps={steps}
      title={PAGE_TITLE}
    >
      {body}
    </ImportWizardFrame>
  );
}

const reviewColumns: readonly ImportReviewColumn<SessionBalanceImportRowResult>[] = [
  {
    align: "right",
    header: "Dòng",
    hideInCard: true,
    key: "row",
    render: (row) => <span className="text-text-muted">{row.source_row_number}</span>,
    width: "64px",
  },
  {
    header: "Mã học viên",
    hideInCard: true,
    key: "code",
    render: (row) => <span className="whitespace-nowrap font-semibold text-text-strong">{row.student_public_code ?? "—"}</span>,
  },
  { header: "Họ tên nguồn", key: "name", render: (row) => row.source_student_name ?? "—" },
  { align: "right", header: "Số dư nguồn", key: "balance", render: (row) => formatSessionBalance(row.source_balance) },
  { align: "right", header: "Hiện tại", key: "before", render: (row) => formatSessionBalance(row.current_balance_before) },
  { align: "right", header: "Dự kiến sau", key: "after", render: (row) => formatSessionBalance(row.expected_balance_after) },
];

function CreateFact({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 text-body font-semibold text-text-strong">{children}</dd>
    </div>
  );
}
