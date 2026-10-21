"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";

import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import type { StepperStep } from "@/components/patterns/stepper";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select } from "@/components/ui/field";
import { ImportActionBar } from "@/features/imports/components/import-action-bar";
import { ImportFileStep } from "@/features/imports/components/import-file-step";
import { formatImportTimestamp, labelFrom } from "@/features/imports/components/import-labels";
import { ImportReviewTable, type ImportReviewColumn, type ImportRowSeverity } from "@/features/imports/components/import-review-table";
import { ImportSummaryStrip } from "@/features/imports/components/import-summary-strip";
import { ImportWizardFrame } from "@/features/imports/components/import-wizard-frame";
import { formatIsoDate } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

import {
  commitStudentEnrollmentImportBatchAction,
  createStudentEnrollmentImportBatchAction,
  dryRunStudentEnrollmentImportAction,
} from "./actions";
import type { EnrollmentImportActionOverrides } from "./enrollment-import-action-overrides";
import { ENROLLMENT_IMPORT_FIELDS } from "./fields";
import { downloadEnrollmentImportTemplate } from "./template-browser";
import type { EnrollmentImportDryRunResult, EnrollmentImportDryRunRow } from "./types";
import {
  ENROLLMENT_IMPORT_MAX_FILE_BYTES,
  ENROLLMENT_IMPORT_MAX_ROWS,
  EnrollmentWorkbookError,
  parseEnrollmentWorkbook,
  type ParsedEnrollmentWorkbook,
} from "./workbook";

/**
 * The enrollment import's real stages (W1): the column mapping is automatic
 * (by header, shown read-only in step 1 and marked done), so it is never the
 * current step.
 */
export type EnrollmentImportStep = "file" | "review" | "batch" | "commit";

const STEPS: ReadonlyArray<{ key: EnrollmentImportStep | "mapping"; title: string; description?: string }> = [
  { key: "file", title: "Chọn năm học & file" },
  { description: "Tự khớp theo tiêu đề cột", key: "mapping", title: "Ánh xạ cột" },
  { key: "review", title: "Kiểm tra dòng" },
  { key: "batch", title: "Tạo lô" },
  { key: "commit", title: "Xác nhận ghi danh" },
];

/**
 * The only academic year offered today (hard-coded; TODOS "Năm học
 * "2026-2027" viết cứng trong nhập lớp và nhập ghi danh").
 */
const ACADEMIC_YEAR_OPTIONS = ["2026-2027"] as const;

const BATCH_STATUS_LABELS: Readonly<Record<string, string>> = {
  committed: "Đã ghi danh",
  ready_to_commit: "Sẵn sàng xác nhận",
  rejected: "Bị từ chối",
};

const BATCH_STATUS_TONES: Readonly<Record<string, BadgeTone>> = {
  committed: "success",
  ready_to_commit: "info",
  rejected: "danger",
};

const MODE_LABELS: Readonly<Record<string, string>> = {
  offline: "Tại lớp",
  online: "Trực tuyến",
};

/** The file step's limits, read from the parser's own constants. */
const LIMITS_TEXT = `Chỉ nhận .xlsx có trang tính "Enrollments", tối đa ${formatNumber(
  ENROLLMENT_IMPORT_MAX_FILE_BYTES / (1024 * 1024),
)} MB và ${formatNumber(ENROLLMENT_IMPORT_MAX_ROWS)} dòng dữ liệu.`;

/** Counts the required fields, so "cột bắt buộc" stays true if an optional column is ever added. */
const TEMPLATE_HINT = `Mẫu có ${formatNumber(
  ENROLLMENT_IMPORT_FIELDS.filter((field) => field.required).length,
)} cột bắt buộc: mã học sinh, mã lớp, hình thức, hiệu lực từ.`;

/** A read error that is not the parser's own (e.g. the hash failed): no raw technical message. */
const FILE_READ_FAILED = "Không thể đọc file Excel. Hãy kiểm tra lại file và thử lại.";

/**
 * A commit whose answer never arrived. Retrying in place is safe: the commit
 * RPC refuses a batch that is no longer ready_to_commit (already committed)
 * and says so; reopening the page would lose the batch id instead.
 */
const COMMIT_UNKNOWN_RESULT = "Bấm xác nhận lại: máy chủ không ghi hai lần và sẽ báo nếu lần trước đã ghi xong.";

interface EnrollmentImportBatchInfo {
  id?: string;
  status?: string;
  row_count?: number;
  new_count?: number;
  matching_count?: number;
}

export interface EnrollmentImportCommitResult {
  batch_id: string;
  status: string;
  committed_new_count: number;
  reused_matching_count: number;
  committed_at: string;
}

export interface EnrollmentImportFileSeed {
  name: string;
  sha256: string;
  workbook: ParsedEnrollmentWorkbook;
}

export interface EnrollmentImportPageProps {
  /** A batch already created (the wizard opens on "Xác nhận ghi danh"). */
  initialBatch?: EnrollmentImportBatchInfo;
  /** A dry-run already returned (the wizard opens on "Kiểm tra dòng" unless a batch is given). */
  initialDryRun?: EnrollmentImportDryRunResult;
  /** A file already read: name, SHA-256 and the parsed workbook. */
  initialFile?: EnrollmentImportFileSeed;
  /** A commit already done: the wizard opens on its result. */
  initialCommitResult?: EnrollmentImportCommitResult;
  /** Step to open on; clamped to the data available. */
  initialStep?: EnrollmentImportStep;
  /** Replacements for the server actions (the /dev preview's inert stubs); defaults to the real actions. */
  actions?: EnrollmentImportActionOverrides;
}

type ActionError = { kind: "error"; message: string } | { kind: "unknown" };

/** The action bar's disabled reason (shown under the bar, wired to the primary), or nothing. */
function barReason(
  reason: string | null | undefined,
  reasonId: string,
): { reason: string; reasonId: string } | { reason?: undefined; reasonId?: undefined } {
  return reason ? { reason, reasonId } : {};
}

function toCount(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? count : undefined;
}

/** The created batch row as the create-batch RPC returns it (an untyped record). */
function toBatchInfo(batch: Record<string, unknown> | undefined): EnrollmentImportBatchInfo {
  return {
    id: typeof batch?.id === "string" ? batch.id : undefined,
    matching_count: toCount(batch?.matching_count),
    new_count: toCount(batch?.new_count),
    row_count: toCount(batch?.row_count),
    status: typeof batch?.status === "string" ? batch.status : undefined,
  };
}

async function computeSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function batchStatusTone(status: string | undefined): BadgeTone {
  return status && Object.hasOwn(BATCH_STATUS_TONES, status) ? BATCH_STATUS_TONES[status] : "neutral";
}

function batchStatusLabel(status: string | undefined): string {
  return labelFrom(BATCH_STATUS_LABELS, status, (code) => (code ? `Trạng thái chưa hỗ trợ: ${code}` : "Chưa rõ trạng thái"));
}

function getRowSeverity(row: EnrollmentImportDryRunRow): ImportRowSeverity {
  if (row.classification === "new") return "valid";
  if (row.classification === "existing_matching") return "neutral";
  if (row.classification === "existing_conflict" || row.classification === "invalid") return "error";
  return "warning";
}

function getRowIssue(row: EnrollmentImportDryRunRow): string {
  switch (row.classification) {
    case "new":
      return "Ghi danh mới";
    case "existing_matching":
      return "Đã có ghi danh khớp; dùng lại";
    case "existing_conflict":
      return `Xung đột: ${row.validation_message ?? "khác ghi danh đang có."}`;
    case "invalid":
      return `Không hợp lệ: ${row.validation_message ?? "kiểm tra lại dòng này."}`;
    default:
      return `Phân loại chưa hỗ trợ: ${String(row.classification)}`;
  }
}

/** One condition line: met/unmet label and the reason the action is unavailable. */
interface Check {
  ok: boolean;
  met: string;
  unmet: string;
  why: string;
}

function toConditions(checks: readonly Check[]): GuardedCondition[] {
  return checks.map((check) => ({ label: check.ok ? check.met : check.unmet, state: check.ok ? "met" : "unmet" }));
}

/**
 * /imports/enrollments (design 17c): a five-step wizard in one frame. Choose
 * the year and the file (parsed in the browser; the column mapping is matched
 * by header and shown read-only) → the dry-run of every row → create a
 * staging batch (nothing enrolled yet) → type the phrase and commit the batch
 * in one transaction. One step body at a time; a new file drops everything
 * after it and a year change marks the dry-run stale. The commit needs a batch
 * created here: there is no fallback batch.
 */
export function EnrollmentImportPage({
  actions,
  initialBatch,
  initialCommitResult,
  initialDryRun,
  initialFile,
  initialStep,
}: EnrollmentImportPageProps = {}) {
  const dryRunAction = actions?.dryRunStudentEnrollmentImport ?? dryRunStudentEnrollmentImportAction;
  const createBatchAction = actions?.createStudentEnrollmentImportBatch ?? createStudentEnrollmentImportBatchAction;
  const commitBatchAction = actions?.commitStudentEnrollmentImportBatch ?? commitStudentEnrollmentImportBatchAction;

  const [step, setStep] = useState<EnrollmentImportStep>(
    initialStep ?? (initialCommitResult || initialBatch ? "commit" : initialDryRun ? "review" : "file"),
  );
  const [academicYearCode, setAcademicYearCode] = useState<string>(initialDryRun?.academic_year_code ?? ACADEMIC_YEAR_OPTIONS[0]);
  const [fileFacts, setFileFacts] = useState<{ name: string; sha256: string } | null>(
    initialFile ? { name: initialFile.name, sha256: initialFile.sha256 } : null,
  );
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedEnrollmentWorkbook | null>(initialFile?.workbook ?? null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);

  const [dryRunResult, setDryRunResult] = useState<EnrollmentImportDryRunResult | null>(initialDryRun ?? null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const [createBatchResult, setCreateBatchResult] = useState<EnrollmentImportBatchInfo | null>(initialBatch ?? null);
  const [createBatchError, setCreateBatchError] = useState<ActionError | null>(null);
  const [batchReason, setBatchReason] = useState(`Nhập ghi danh học sinh năm học ${academicYearCode}`);
  const [batchConfirmed, setBatchConfirmed] = useState(false);

  const [commitResult, setCommitResult] = useState<EnrollmentImportCommitResult | null>(initialCommitResult ?? null);
  const [commitError, setCommitError] = useState<ActionError | null>(null);
  const [commitConfirmInput, setCommitConfirmInput] = useState("");
  const [commitReasonInput, setCommitReasonInput] = useState("");

  const [isDryRunPending, startDryRun] = useTransition();
  const [isCreatePending, startCreate] = useTransition();
  const [isCommitPending, startCommit] = useTransition();
  const primaryReasonId = useId();
  const phraseHintId = useId();
  const phraseInputId = useId();
  const reasonHintId = useId();
  const commitReasonId = useId();
  // Bumped by every input change that invalidates a check (a new or cleared file, a year change)
  // and by each check: a dry-run or create-batch answer is applied only while its run is still the latest.
  const checkRun = useRef(0);

  const effectiveNewCount = createBatchResult?.new_count ?? dryRunResult?.new_count ?? 0;
  const effectiveMatchingCount = createBatchResult?.matching_count ?? dryRunResult?.matching_count ?? 0;
  const effectiveTotalCommitCount = effectiveNewCount + effectiveMatchingCount;
  const expectedConfirmationPhrase = `GHI DANH ${effectiveTotalCommitCount}`;
  const defaultCommitReason = `Xác nhận ghi danh năm học ${academicYearCode}: ${effectiveNewCount} mới, ${effectiveMatchingCount} dùng lại`;
  const activeCommitReason = commitReasonInput.trim() || defaultCommitReason;
  const conflictCount = dryRunResult?.conflict_count ?? 0;
  const invalidCount = dryRunResult?.invalid_count ?? 0;
  const isPending = isDryRunPending || isCreatePending || isCommitPending;

  // A step never shows without what it needs: commit needs a created batch, the batch step a dry-run (or a batch), review a dry-run.
  const currentStep: EnrollmentImportStep =
    step === "commit" && createBatchResult
      ? "commit"
      : (step === "commit" || step === "batch") && (dryRunResult || createBatchResult)
        ? "batch"
        : step !== "file" && dryRunResult
          ? "review"
          : "file";
  const currentIndex = STEPS.findIndex((item) => item.key === currentStep);
  const steps: StepperStep[] = STEPS.map((item, index) => {
    if (commitResult) return { description: item.description, state: "done", title: item.title };
    if (item.key === "mapping") {
      // Matched automatically when the file is read: done once a file (or a later stage) exists.
      const mapped = parsedWorkbook !== null || currentIndex > index;
      return { description: item.description, state: mapped ? "done" : "upcoming", title: item.title };
    }
    return {
      description: item.description,
      state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
      title: item.title,
    };
  });

  function clearAfterFile() {
    setDryRunResult(null);
    setDryRunError(null);
    setIsStale(false);
    setCreateBatchResult(null);
    setCreateBatchError(null);
    setBatchConfirmed(false);
    setCommitResult(null);
    setCommitError(null);
    setCommitConfirmInput("");
    setCommitReasonInput("");
  }

  function resetFile() {
    checkRun.current += 1;
    setFileFacts(null);
    setParsedWorkbook(null);
    setParseError(null);
    clearAfterFile();
    setStep("file");
  }

  async function handleFileSelected(selected: File) {
    resetFile();
    // A dropped file skips the input's `accept`: check the extension here.
    if (!/\.xlsx$/i.test(selected.name.trim())) {
      setParseError("Chỉ nhận file .xlsx.");
      return;
    }
    setIsReading(true);
    try {
      const sha256 = await computeSha256(selected);
      const parsed = await parseEnrollmentWorkbook(selected);
      setFileFacts({ name: selected.name, sha256 });
      setParsedWorkbook(parsed);
    } catch (error) {
      setParseError(error instanceof EnrollmentWorkbookError ? error.message : FILE_READ_FAILED);
    } finally {
      setIsReading(false);
    }
  }

  async function handleTemplateDownload() {
    setTemplateError(null);
    setIsTemplateDownloading(true);
    try {
      await downloadEnrollmentImportTemplate();
    } catch {
      setTemplateError("Không tạo được file mẫu. Thử lại sau.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }

  function handleYearChange(nextYear: string) {
    checkRun.current += 1;
    setAcademicYearCode(nextYear);
    if (dryRunResult) setIsStale(true);
  }

  function handleRunDryRun() {
    if (!parsedWorkbook || !academicYearCode) return;
    const run = ++checkRun.current;
    setDryRunError(null);
    startDryRun(async () => {
      try {
        const response = await dryRunAction(academicYearCode, parsedWorkbook.rows);
        // The file or the year changed while the check ran: this answer is for other inputs.
        if (run !== checkRun.current) return;
        if (!response.success || !response.data) {
          setDryRunError(response.error || "Kiểm tra thất bại.");
          return;
        }
        clearAfterFile();
        setDryRunResult(response.data);
        setStep("review");
      } catch {
        if (run !== checkRun.current) return;
        setDryRunError("Không kết nối được tới máy chủ. Kiểm tra kết nối rồi thử lại; bước này không ghi dữ liệu.");
      }
    });
  }

  const batchChecks: Check[] = [
    {
      met: fileFacts ? `Đã chọn file ${fileFacts.name}` : "Đã chọn file",
      ok: fileFacts !== null && parsedWorkbook !== null,
      unmet: "Chưa có file đang chọn",
      why: "Chọn lại file Excel ở bước 1.",
    },
    {
      met: "0 dòng xung đột",
      ok: conflictCount === 0,
      unmet: `Còn ${formatNumber(conflictCount)} dòng xung đột`,
      why: "Bật khi không còn dòng xung đột hoặc không hợp lệ.",
    },
    {
      met: "0 dòng không hợp lệ",
      ok: invalidCount === 0,
      unmet: `Còn ${formatNumber(invalidCount)} dòng không hợp lệ`,
      why: "Bật khi không còn dòng xung đột hoặc không hợp lệ.",
    },
    {
      met: "Kết quả kiểm tra còn mới",
      ok: !isStale,
      unmet: "Năm học đã đổi sau lần kiểm tra",
      why: "Kiểm tra lại các dòng ở bước 1.",
    },
    {
      met: "Đã nhập lý do tạo lô",
      ok: batchReason.trim().length > 0,
      unmet: "Chưa nhập lý do tạo lô",
      why: "Nhập lý do tạo lô.",
    },
    {
      met: "Đã đánh dấu xác nhận",
      ok: batchConfirmed,
      unmet: "Chưa đánh dấu xác nhận",
      why: "Đánh dấu ô xác nhận trước khi tạo lô.",
    },
  ];
  const firstBatchBlocker = batchChecks.find((check) => !check.ok);
  const canCreateBatch = Boolean(dryRunResult) && !firstBatchBlocker && !createBatchResult && !isPending;

  function handleCreateBatch() {
    if (!canCreateBatch || !fileFacts || !parsedWorkbook || !dryRunResult) return;
    // Not a new check: the batch belongs to the current one, so a file reset or a year change drops its answer.
    const run = checkRun.current;
    setCreateBatchError(null);
    startCreate(async () => {
      try {
        const response = await createBatchAction(
          fileFacts.name,
          fileFacts.sha256,
          batchReason,
          academicYearCode,
          parsedWorkbook.rows,
        );
        if (run !== checkRun.current) return;
        if (!response.success || !response.data) {
          setCreateBatchError({ kind: "error", message: response.error || "Tạo lô thất bại." });
          return;
        }
        setCreateBatchResult(toBatchInfo(response.data.batch));
        setStep("commit");
      } catch {
        if (run !== checkRun.current) return;
        setCreateBatchError({ kind: "unknown" });
      }
    });
  }

  const batchStatus = createBatchResult?.status;
  const commitChecks: Check[] = [
    {
      met: "Đã tạo lô",
      ok: Boolean(createBatchResult?.id),
      unmet: createBatchResult ? "Lô vừa tạo không có mã lô" : "Chưa tạo lô",
      why: createBatchResult ? "Mở lại trang rồi tạo lô lại." : "Tạo lô ở bước trước.",
    },
    {
      met: "Lô sẵn sàng xác nhận",
      ok: batchStatus === undefined || batchStatus === "ready_to_commit",
      unmet: `Lô đang ở trạng thái ${batchStatusLabel(batchStatus)}`,
      why: "Chỉ xác nhận được lô sẵn sàng xác nhận.",
    },
    {
      met: "Kết quả kiểm tra còn mới",
      ok: !isStale,
      unmet: "Năm học đã đổi sau lần kiểm tra",
      why: "Kiểm tra lại các dòng ở bước 1.",
    },
    {
      met: "0 dòng xung đột",
      ok: conflictCount === 0,
      unmet: `Còn ${formatNumber(conflictCount)} dòng xung đột`,
      why: "Bật khi không còn dòng xung đột.",
    },
    {
      met: "Có dòng để ghi danh",
      ok: effectiveTotalCommitCount > 0,
      unmet: "Không có dòng nào để ghi danh",
      why: "Lô không có dòng nào để ghi danh.",
    },
    {
      met: "Đã gõ đúng cụm xác nhận",
      ok: commitConfirmInput.trim() === expectedConfirmationPhrase,
      unmet: "Chưa gõ đúng cụm xác nhận",
      why: "Gõ đúng cụm xác nhận để bật nút.",
    },
  ];
  const firstCommitBlocker = commitChecks.find((check) => !check.ok);
  const canCommitBatch = !firstCommitBlocker && activeCommitReason.length > 0 && !commitResult && !isPending;

  function handleCommitBatch() {
    const targetBatchId = createBatchResult?.id;
    // No created batch, no commit: there is no fallback batch id.
    if (!canCommitBatch || !targetBatchId) return;
    setCommitError(null);
    startCommit(async () => {
      try {
        const response = await commitBatchAction(targetBatchId, activeCommitReason);
        if (!response.success || !response.data) {
          setCommitError({ kind: "error", message: response.error || "Ghi danh thất bại." });
          return;
        }
        setCommitResult(response.data);
      } catch {
        setCommitError({ kind: "unknown" });
      }
    });
  }

  const context = fileFacts && parsedWorkbook ? `${fileFacts.name} · ${formatNumber(parsedWorkbook.totalRows)} dòng` : undefined;

  let body: ReactNode;
  let actionBar: ReactNode;

  if (commitResult) {
    const total = commitResult.committed_new_count + commitResult.reused_matching_count;
    body = (
      <>
        <ResultBanner
          description="Toàn bộ lô được ghi trong một lần. Học sinh giữ trạng thái hiện tại; đổi trạng thái ở hồ sơ học sinh nếu cần."
          title={`Đã ghi danh ${formatNumber(total)} học sinh.`}
          tone="success"
        />
        <ImportSummaryStrip
          cells={[
            { label: "Ghi danh mới đã tạo", tone: "success", value: commitResult.committed_new_count },
            { label: "Ghi danh đã có, dùng lại", value: commitResult.reused_matching_count },
          ]}
          label="Kết quả ghi danh"
        />
        <dl className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] sm:grid-cols-2">
          <Fact label="Thời điểm ghi">{formatImportTimestamp(commitResult.committed_at)}</Fact>
          <Fact label="Trạng thái lô">{batchStatusLabel(commitResult.status)}</Fact>
        </dl>
      </>
    );
    actionBar = (
      <ImportActionBar
        primary={<Button onClick={resetFile}>Nhập file khác</Button>}
        text="Đã ghi xong. Nhập ghi danh không có trang lô riêng: kết quả nằm ở đây."
      />
    );
  } else if (currentStep === "file") {
    const canGoOn = dryRunResult !== null && !isStale;
    body = (
      <>
        <div className="rounded-lg border border-border-subtle bg-surface-base px-5 py-4 shadow-[var(--panel-shadow)]">
          <Field
            className="max-w-sm"
            hint="Mã lớp trong file được kiểm tra trong năm học này."
            label="Năm học"
            required
          >
            {(controlProps) => (
              <Select {...controlProps} disabled={isPending} onChange={(event) => handleYearChange(event.target.value)} value={academicYearCode}>
                {ACADEMIC_YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <ImportFileStep
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          error={parseError}
          file={
            fileFacts && parsedWorkbook
              ? { name: fileFacts.name, rows: parsedWorkbook.totalRows, sha256: fileFacts.sha256, sheet: parsedWorkbook.sheetName }
              : null
          }
          inputId="enrollment-import-file"
          isReading={isReading}
          label="Chọn file Excel"
          limitsText={LIMITS_TEXT}
          onFileSelected={handleFileSelected}
          onReset={fileFacts ? resetFile : undefined}
          templateAction={
            <>
              <Button isLoading={isTemplateDownloading} onClick={handleTemplateDownload} size="sm" variant="secondary">
                Tải file mẫu .xlsx
              </Button>
              <span className="text-secondary text-text-muted">{TEMPLATE_HINT}</span>
              {templateError ? (
                <span className="text-secondary font-medium text-danger" role="alert">
                  {templateError}
                </span>
              ) : null}
            </>
          }
        />

        {parsedWorkbook ? (
          <section
            aria-labelledby="enrollment-import-mapping-title"
            className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
          >
            <div className="border-b border-border-row px-5 py-4">
              <h2 className="text-section-title font-semibold text-text-strong" id="enrollment-import-mapping-title">
                Ánh xạ cột
              </h2>
              <p className="mt-0.5 text-secondary text-text-muted">Tự khớp theo tiêu đề cột; muốn đổi thì sửa tiêu đề trong file Excel.</p>
            </div>
            <dl className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
              {ENROLLMENT_IMPORT_FIELDS.map((field) => (
                <Fact key={field.key} label={field.label}>
                  {parsedWorkbook.mapping[field.key] ? `Cột "${parsedWorkbook.mapping[field.key]}"` : "Chưa khớp"}
                </Fact>
              ))}
            </dl>
          </section>
        ) : null}

        {isStale ? (
          <ResultBanner
            description={`Kiểm tra lại các dòng với năm học ${academicYearCode} trước khi tạo lô.`}
            title="Năm học đã đổi sau lần kiểm tra gần nhất."
            tone="warning"
          />
        ) : null}
        {dryRunError ? <ResultBanner description={dryRunError} title="Chưa kiểm tra được." tone="error" /> : null}
      </>
    );
    actionBar = (
      <ImportActionBar
        primary={
          canGoOn ? (
            <Button onClick={() => setStep("review")}>Tiếp: Kiểm tra dòng</Button>
          ) : (
            <Button
              aria-describedby={parsedWorkbook ? undefined : primaryReasonId}
              disabled={!parsedWorkbook || isReading}
              isLoading={isDryRunPending}
              onClick={handleRunDryRun}
            >
              {parsedWorkbook ? `Kiểm tra ${formatNumber(parsedWorkbook.totalRows)} dòng` : "Kiểm tra dòng"}
            </Button>
          )
        }
        {...barReason(canGoOn || parsedWorkbook ? null : isReading ? "Đang đọc file." : "Chọn file Excel trước.", primaryReasonId)}
        text="Kiểm tra chỉ đọc dữ liệu; chưa ghi danh học sinh nào."
      />
    );
  } else if (currentStep === "review" && dryRunResult) {
    const problemCount = conflictCount + invalidCount;
    const reviewBlocked = problemCount > 0 || isStale;
    body = (
      <>
        <ImportSummaryStrip
          cells={[
            { label: "Tổng dòng", value: dryRunResult.row_count },
            { label: "Ghi danh mới", tone: "success", value: dryRunResult.new_count },
            { label: "Đã có, dùng lại", tone: "muted", value: dryRunResult.matching_count },
            { label: "Xung đột (phải sửa trong file)", tone: "danger", value: dryRunResult.conflict_count },
            { label: "Không hợp lệ (phải sửa trong file)", tone: "danger", value: dryRunResult.invalid_count },
          ]}
          label={`Kết quả kiểm tra năm học ${dryRunResult.academic_year_code}`}
        />
        <EnrollmentReviewTable dryRun={dryRunResult} />
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ label: "Chọn năm học & file", onClick: () => setStep("file") }}
        primary={
          <Button aria-describedby={reviewBlocked ? primaryReasonId : undefined} disabled={reviewBlocked} onClick={() => setStep("batch")}>
            Tiếp: Tạo lô
          </Button>
        }
        {...barReason(reviewBlocked ? (isStale ? "Năm học đã đổi; kiểm tra lại ở bước 1." : "Bật khi không còn dòng xung đột hoặc không hợp lệ.") : null, primaryReasonId)}
        text={
          problemCount > 0
            ? `Còn ${formatNumber(problemCount)} dòng xung đột hoặc không hợp lệ. Sửa file Excel rồi chọn lại file.`
            : "Không còn dòng phải sửa. Tạo lô để giữ kết quả này; chưa ghi danh học sinh nào."
        }
      />
    );
  } else if (currentStep === "batch") {
    const rowCount = createBatchResult?.row_count ?? dryRunResult?.row_count ?? 0;
    if (createBatchResult) {
      body = (
        <>
          <ResultBanner description="Lô chờ xác nhận ở bước sau; chưa ghi danh học sinh nào." title="Đã tạo lô." tone="success" />
          <dl className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Trạng thái lô">{batchStatusLabel(createBatchResult.status)}</Fact>
            <Fact label="Số dòng">{formatNumber(rowCount)}</Fact>
            <Fact label="Mới">{formatNumber(effectiveNewCount)}</Fact>
            <Fact label="Dùng lại">{formatNumber(effectiveMatchingCount)}</Fact>
          </dl>
        </>
      );
      actionBar = (
        <ImportActionBar
          back={{ label: "Kiểm tra dòng", onClick: () => setStep("review") }}
          primary={<Button onClick={() => setStep("commit")}>Tiếp: Xác nhận ghi danh</Button>}
          text="Lô đã tạo. Bước sau gõ cụm xác nhận để ghi danh."
        />
      );
    } else {
      body = (
        <GuardedActionPanel
          conditions={toConditions(batchChecks)}
          consequence={
            <>
              Tạo một lô chờ xác nhận cho <strong>{formatNumber(rowCount)} dòng</strong> của năm học {academicYearCode}. Bước này chưa ghi
              danh học sinh nào; mỗi file chỉ tạo lô được một lần.
            </>
          }
          result={createBatchError ? <ActionErrorBanner error={createBatchError} title="Chưa tạo lô." /> : null}
          title="Tạo lô ghi danh"
          titleId="enrollment-import-batch-title"
        >
          <div className="mt-4 grid max-w-[720px] gap-4">
            <Field label="Lý do tạo lô" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  disabled={isPending}
                  onChange={(event) => {
                    setBatchReason(event.target.value);
                    setCreateBatchError(null);
                  }}
                  value={batchReason}
                />
              )}
            </Field>
            <label className="flex min-h-11 items-start gap-3 rounded-md border border-border-subtle bg-surface-sunken px-4 py-3 text-body text-text-default">
              <input
                checked={batchConfirmed}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
                disabled={isPending}
                onChange={(event) => {
                  setBatchConfirmed(event.target.checked);
                  setCreateBatchError(null);
                }}
                type="checkbox"
              />
              <span>Tôi đã xem kết quả kiểm tra và muốn tạo lô cho {formatNumber(rowCount)} dòng (chưa ghi danh học sinh nào).</span>
            </label>
          </div>
        </GuardedActionPanel>
      );
      actionBar = (
        <ImportActionBar
          back={{ disabled: isPending, label: "Kiểm tra dòng", onClick: () => setStep("review") }}
          primary={
            <Button
              aria-describedby={firstBatchBlocker && !isCreatePending ? primaryReasonId : undefined}
              disabled={!canCreateBatch}
              isLoading={isCreatePending}
              onClick={handleCreateBatch}
            >
              {isCreatePending ? "Đang tạo lô…" : `Tạo lô ${formatNumber(rowCount)} dòng`}
            </Button>
          }
          {...barReason(isCreatePending ? null : firstBatchBlocker?.why, primaryReasonId)}
          text="Tạo lô chỉ lưu kết quả kiểm tra để xác nhận; chưa ghi danh ai."
        />
      );
    }
  } else if (currentStep === "commit" && createBatchResult) {
    body = (
      <GuardedActionPanel
        badge={<Badge tone={batchStatusTone(batchStatus)}>{batchStatusLabel(batchStatus)}</Badge>}
        conditions={toConditions(commitChecks)}
        consequence={
          <>
            Ghi danh <strong>{formatNumber(effectiveTotalCommitCount)} học sinh</strong> vào lớp trong một lần; nếu máy chủ từ chối thì không ghi dòng nào.
            Bước này không đổi trạng thái học sinh.
          </>
        }
        result={
          commitError ? <ActionErrorBanner error={commitError} title="Chưa ghi danh." unknownDescription={COMMIT_UNKNOWN_RESULT} /> : null
        }
        title="Xác nhận ghi danh"
        titleId="enrollment-import-commit-title"
      >
        <p className="mt-3 text-body text-text-default tabular-nums [&_strong]:font-semibold">
          Ghi danh mới: <strong>{effectiveNewCount}</strong> · Dùng lại: <strong>{effectiveMatchingCount}</strong>
        </p>
        <div className="mt-4 grid max-w-[720px] gap-4 md:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Label htmlFor={commitReasonId}>Lý do xác nhận</Label>
            <Input
              aria-describedby={reasonHintId}
              disabled={isPending}
              id={commitReasonId}
              onChange={(event) => {
                setCommitReasonInput(event.target.value);
                setCommitError(null);
              }}
              value={commitReasonInput}
            />
            <p className="text-caption text-text-muted" id={reasonHintId}>
              Để trống thì dùng: {defaultCommitReason}
            </p>
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor={phraseInputId} required>
              Gõ cụm xác nhận
            </Label>
            <Input
              aria-describedby={phraseHintId}
              autoComplete="off"
              className="font-mono"
              disabled={isPending}
              id={phraseInputId}
              onChange={(event) => {
                setCommitConfirmInput(event.target.value);
                setCommitError(null);
              }}
              spellCheck={false}
              value={commitConfirmInput}
            />
            <p className="text-caption text-text-muted" id={phraseHintId}>
              Gõ đúng <code className="rounded-sm bg-surface-sunken px-1 font-mono font-semibold text-text-strong">{expectedConfirmationPhrase}</code>{" "}
              (chữ in hoa).
            </p>
          </div>
        </div>
      </GuardedActionPanel>
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isPending, label: "Tạo lô", onClick: () => setStep("batch") }}
        primary={
          <Button
            aria-describedby={firstCommitBlocker && !isCommitPending ? primaryReasonId : undefined}
            disabled={!canCommitBatch}
            isLoading={isCommitPending}
            onClick={handleCommitBatch}
          >
            {isCommitPending ? "Đang ghi danh…" : `XÁC NHẬN COMMIT GHI DANH ${effectiveTotalCommitCount} HỌC VIÊN`}
          </Button>
        }
        {...barReason(isCommitPending ? null : firstCommitBlocker?.why, primaryReasonId)}
        text="Bấm xác nhận là ghi danh thật vào lớp."
      />
    );
  }

  return (
    <ImportWizardFrame actionBar={actionBar} context={context} stepperLabel="Các bước nhập ghi danh" steps={steps} title="Nhập ghi danh từ file">
      {body}
    </ImportWizardFrame>
  );
}

function ActionErrorBanner({
  error,
  title,
  unknownDescription = "Mở lại trang để kiểm tra trước khi thử lại.",
}: {
  error: ActionError;
  title: string;
  /** What to do when the answer was lost; each write says what is safe for it. */
  unknownDescription?: string;
}) {
  if (error.kind === "unknown") {
    return <ResultBanner description={unknownDescription} title="Không rõ kết quả." tone="conflict" />;
  }
  return <ResultBanner description={error.message} title={title} tone="error" />;
}

function Fact({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-semibold text-text-strong">{children}</dd>
    </div>
  );
}

/** Every dry-run row (at most 1,000), conflicts and invalid rows first under "Cần xem"; replaces the old status select. */
function EnrollmentReviewTable({ dryRun }: { dryRun: EnrollmentImportDryRunResult }) {
  const columns: ImportReviewColumn<EnrollmentImportDryRunRow>[] = [
    {
      header: "Dòng",
      hideInCard: true,
      key: "row",
      render: (row) => <span className="text-text-muted tabular-nums">{row.source_row}</span>,
      width: "60px",
    },
    {
      header: "Mã học sinh",
      hideInCard: true,
      key: "student",
      render: (row) => <span className="whitespace-nowrap font-semibold text-text-strong tabular-nums">{row.student_public_code || "—"}</span>,
      width: "160px",
    },
    { header: "Mã lớp", key: "class", render: (row) => row.class_code || "—", width: "120px" },
    {
      header: "Hình thức",
      key: "mode",
      render: (row) => labelFrom(MODE_LABELS, row.registered_mode, (code) => code || "—"),
      width: "120px",
    },
    {
      header: "Hiệu lực từ",
      key: "from",
      render: (row) => <span className="tabular-nums">{formatIsoDate(row.effective_from)}</span>,
      width: "120px",
    },
  ];

  return (
    <ImportReviewTable
      caption={`Kết quả kiểm tra ${formatNumber(dryRun.row_count)} dòng`}
      cardTitle={(row) => `Dòng ${row.source_row} · ${row.student_public_code || "—"}`}
      columns={columns}
      getRowIssue={getRowIssue}
      getRowKey={(row) => String(row.source_row)}
      getRowSeverity={getRowSeverity}
      rows={dryRun.rows}
    />
  );
}
