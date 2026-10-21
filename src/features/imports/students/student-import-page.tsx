"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import type { StepperStep } from "@/components/patterns/stepper";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ImportActionBar } from "@/features/imports/components/import-action-bar";
import { ImportFileStep } from "@/features/imports/components/import-file-step";
import { ImportReviewTable, type ImportReviewColumn, type ImportRowSeverity } from "@/features/imports/components/import-review-table";
import { ImportSummaryStrip } from "@/features/imports/components/import-summary-strip";
import { ImportWizardFrame } from "@/features/imports/components/import-wizard-frame";
import { commitStudentImportRowsAction, validateStudentImportRowsAction } from "@/features/imports/students/actions";
import { STUDENT_IMPORT_FIELD_DEFINITIONS } from "@/features/imports/students/fields";
import {
  buildStudentImportAutomaticMapping,
  mapStudentImportWorkbookRows,
  validateStudentImportColumnMapping,
} from "@/features/imports/students/mapping";
import type { StudentImportActionOverrides } from "@/features/imports/students/student-import-action-overrides";
import {
  getStudentImportCommitGate,
  StudentImportCommitPanel,
  StudentImportCommitResultView,
  type StudentImportCommitError,
} from "@/features/imports/students/student-import-commit-panel";
import { downloadStudentImportTemplate } from "@/features/imports/students/template-browser";
import type {
  StudentImportCellValue,
  StudentImportColumnMapping,
  StudentImportCommitResult,
  StudentImportFieldKey,
  StudentImportMappingIssue,
  StudentImportParsedWorkbook,
  StudentImportRowInput,
  StudentImportValidationResult,
  StudentImportValidationRow,
} from "@/features/imports/students/types";
import {
  parseStudentImportWorkbook,
  STUDENT_IMPORT_MAX_FILE_BYTES,
  STUDENT_IMPORT_MAX_ROWS,
  StudentImportWorkbookError,
} from "@/features/imports/students/workbook";
import { formatNumber } from "@/lib/format";
import { permissionLabel } from "@/lib/permissions/labels";

/** The four real steps of the student import (W1): all client-side until the commit. */
export type StudentImportStep = "file" | "mapping" | "review" | "confirm";

const STEPS: ReadonlyArray<{ key: StudentImportStep; title: string }> = [
  { key: "file", title: "Tải mẫu & chọn file" },
  { key: "mapping", title: "Ánh xạ cột" },
  { key: "review", title: "Kiểm tra dòng" },
  { key: "confirm", title: "Xác nhận nhập" },
];

/** Warning wording (W3): the only student warning is a reused guardian. */
const WARNING_MESSAGES: Readonly<Record<string, string>> = {
  GUARDIAN_WILL_BE_REUSED: "Phụ huynh đã có trong hệ thống và sẽ được dùng lại.",
};

const FIELD_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  STUDENT_IMPORT_FIELD_DEFINITIONS.map((definition) => [definition.key, definition.label]),
);

/** The file step's limits, read from the parser's own constants. */
const LIMITS_TEXT = `Chỉ nhận .xlsx, tối đa ${formatNumber(
  STUDENT_IMPORT_MAX_FILE_BYTES / (1024 * 1024),
)} MB, đúng một trang tính và tối đa ${formatNumber(STUDENT_IMPORT_MAX_ROWS)} dòng dữ liệu.`;

/** The template's column count, from the field list the template is built from. */
const TEMPLATE_HINT = `Mẫu có đủ ${formatNumber(STUDENT_IMPORT_FIELD_DEFINITIONS.length)} cột; cột có dấu * là bắt buộc.`;

export interface StudentImportPageProps {
  canCreateStudents: boolean;
  /** Replacements for the server actions (the /dev preview's inert stubs); defaults to the real actions. */
  actions?: StudentImportActionOverrides;
  /** Step to open on; clamped to the data available (a step never shows without what it needs). */
  initialStep?: StudentImportStep;
  /** A workbook already read (tests and previews open later steps without choosing a file). */
  initialWorkbook?: StudentImportParsedWorkbook;
  /** Column mapping to start from; defaults to the automatic mapping of `initialWorkbook`. */
  initialMapping?: StudentImportColumnMapping;
  /** A dry-run result already returned by `validateStudentImportRowsAction`. */
  initialDryRun?: StudentImportValidationResult;
  /** A commit already done: the wizard opens on its result. */
  initialCommitResult?: StudentImportCommitResult;
  /** Where the result links go (the /dev preview keeps them under /dev). */
  resultLinks?: { studentList: string; auditLog: string };
}

const DEFAULT_RESULT_LINKS = { auditLog: "/audit", studentList: "/students" } as const;

/** The action bar's disabled reason (shown under the bar, wired to the primary), or nothing. */
function barReason(
  reason: string | null | undefined,
  reasonId: string,
): { reason: string; reasonId: string } | { reason?: undefined; reasonId?: undefined } {
  return reason ? { reason, reasonId } : {};
}

function cellText(value: StudentImportCellValue | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function describeAutomaticMapping(workbook: StudentImportParsedWorkbook): string {
  const automatic = buildStudentImportAutomaticMapping(workbook.columns);
  const parts: string[] = [];
  if (automatic.ambiguousFields.length > 0) {
    parts.push(`${formatNumber(automatic.ambiguousFields.length)} trường có tiêu đề mơ hồ cần chọn tay`);
  }
  if (automatic.unmatchedColumns.length > 0) {
    parts.push(`${formatNumber(automatic.unmatchedColumns.length)} cột trong file chưa dùng`);
  }
  return parts.length > 0 ? `${parts.join(". ")}.` : "Đã tự khớp mọi cột theo tiêu đề.";
}

/** Mapping problems in words, naming fields by their labels (the mapping module's own messages use field keys). */
function describeMappingIssue(issue: StudentImportMappingIssue, mapping: StudentImportColumnMapping): string {
  const field = issue.fieldKey ? `"${FIELD_LABELS[issue.fieldKey] ?? issue.fieldKey}"` : "";
  switch (issue.code) {
    case "missing_required_field":
      return `Chưa chọn cột cho trường bắt buộc ${field}.`;
    case "unknown_source_column":
      return `Không tìm thấy cột ${issue.columnKey ?? ""} trong file cho trường ${field}.`;
    case "duplicate_source_column": {
      const other = Object.entries(mapping).find(
        ([key, column]) => key !== issue.fieldKey && typeof column === "string" && column.trim() === issue.columnKey,
      );
      const otherLabel = other ? `"${FIELD_LABELS[other[0]] ?? other[0]}"` : "trường khác";
      return `Cột ${issue.columnKey ?? ""} đang được chọn cho cả ${otherLabel} và ${field}.`;
    }
    default:
      return issue.message;
  }
}

/** Short per-field text under a select (the full sentence is in the summary banner). */
function fieldIssueText(issue: StudentImportMappingIssue): string {
  if (issue.code === "missing_required_field") return "Chưa chọn cột.";
  if (issue.code === "duplicate_source_column") return "Cột này đang dùng cho trường khác.";
  if (issue.code === "unknown_source_column") return "Không tìm thấy cột này trong file.";
  return issue.message;
}

function getRowSeverity(row: StudentImportValidationRow): ImportRowSeverity {
  // An exact duplicate is an error row (the server marks it invalid; commit refuses it).
  if (row.status === "invalid" || row.exact_student_duplicate) return "error";
  if (row.status === "warning") return "warning";
  return "valid";
}

function getRowIssue(row: StudentImportValidationRow): string | null {
  const messages = [
    ...row.errors.map((issue) => issue.message),
    ...row.warnings.map((issue) => (Object.hasOwn(WARNING_MESSAGES, issue.code) ? WARNING_MESSAGES[issue.code] : issue.message)),
  ];
  return messages.length > 0 ? messages.join(" · ") : null;
}

function resolveStep(
  step: StudentImportStep,
  data: { workbook: StudentImportParsedWorkbook | null; validation: StudentImportValidationResult | null },
): StudentImportStep {
  if ((step === "review" || step === "confirm") && data.validation) return step;
  if (step !== "file" && data.workbook) return "mapping";
  return "file";
}

/**
 * /imports/students (design 17c): a four-step wizard in one frame. Choose the
 * file (parsed in the browser) → map the columns → the server's dry-run of
 * every row → confirm and commit everything in one transaction. One step body
 * at a time; going back keeps the file and the mapping, while a new file or a
 * mapping change drops the dry-run and anything after it. Rows are never
 * edited or dropped in the app: the fix is in the Excel file.
 */
export function StudentImportPage({
  actions,
  canCreateStudents,
  initialCommitResult,
  initialDryRun,
  initialMapping,
  initialStep,
  initialWorkbook,
  resultLinks = DEFAULT_RESULT_LINKS,
}: StudentImportPageProps) {
  const validateRows = actions?.validateStudentImportRows ?? validateStudentImportRowsAction;
  const commitRows = actions?.commitStudentImportRows ?? commitStudentImportRowsAction;

  const [step, setStep] = useState<StudentImportStep>(
    initialStep ?? (initialCommitResult ? "confirm" : initialDryRun ? "review" : initialWorkbook ? "mapping" : "file"),
  );
  const [workbook, setWorkbook] = useState<StudentImportParsedWorkbook | null>(initialWorkbook ?? null);
  const [mapping, setMapping] = useState<StudentImportColumnMapping>(
    () => initialMapping ?? (initialWorkbook ? buildStudentImportAutomaticMapping(initialWorkbook.columns).mapping : {}),
  );
  const [validation, setValidation] = useState<StudentImportValidationResult | null>(initialDryRun ?? null);
  const [commitResult, setCommitResult] = useState<StudentImportCommitResult | null>(initialCommitResult ?? null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [commitError, setCommitError] = useState<StudentImportCommitError | null>(null);

  const [isValidating, startValidating] = useTransition();
  const [isCommitting, startCommitting] = useTransition();
  const primaryReasonId = useId();
  // Bumped by every input change that invalidates a check (a new or cleared file, a mapping change)
  // and by each check: a dry-run answer is applied only while its run is still the latest.
  const checkRun = useRef(0);

  const mappingValidation = useMemo(
    () => (workbook ? validateStudentImportColumnMapping(workbook.columns, mapping) : null),
    [mapping, workbook],
  );
  const mappedRows = useMemo<StudentImportRowInput[]>(
    () => (workbook && mappingValidation?.isValid ? mapStudentImportWorkbookRows(workbook, mapping) : []),
    [mapping, mappingValidation?.isValid, workbook],
  );
  const mappedRowsByNumber = useMemo(
    () => new Map(mappedRows.map((row) => [Number(row.row_number), row])),
    [mappedRows],
  );

  const currentStep: StudentImportStep = commitResult ? "confirm" : resolveStep(step, { validation, workbook });
  const currentIndex = STEPS.findIndex((item) => item.key === currentStep);
  const steps: StepperStep[] = STEPS.map((item, index) => ({
    state: commitResult || index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    title: item.title,
  }));

  function clearCommitState() {
    setReason("");
    setConfirmed(false);
    setCommitError(null);
  }

  /** A new file (or none): every later step is dropped. */
  function clearFile() {
    checkRun.current += 1;
    setWorkbook(null);
    setMapping({});
    setValidation(null);
    setCommitResult(null);
    setFileError(null);
    setValidateError(null);
    clearCommitState();
  }

  function resetToFile() {
    clearFile();
    setStep("file");
  }

  async function handleFileSelected(file: File) {
    clearFile();
    setStep("file");
    setIsReading(true);
    try {
      const parsed = await parseStudentImportWorkbook(file);
      setWorkbook(parsed);
      setMapping(buildStudentImportAutomaticMapping(parsed.columns).mapping);
    } catch (error) {
      setFileError(
        error instanceof StudentImportWorkbookError ? error.message : "Không thể đọc file Excel. Hãy kiểm tra lại file và thử lại.",
      );
    } finally {
      setIsReading(false);
    }
  }

  async function handleTemplateDownload() {
    setTemplateError(null);
    setIsTemplateDownloading(true);
    try {
      await downloadStudentImportTemplate();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Không thể tạo file mẫu import học viên.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }

  /** A mapping change drops the dry-run and the commit step (today's stale rule). */
  function updateMapping(fieldKey: StudentImportFieldKey, columnKey: string) {
    checkRun.current += 1;
    setMapping((current) => ({ ...current, [fieldKey]: columnKey.length > 0 ? columnKey : null }));
    setValidation(null);
    setValidateError(null);
    clearCommitState();
  }

  function handleValidate() {
    if (!workbook || !mappingValidation?.isValid) return;
    const rows = mapStudentImportWorkbookRows(workbook, mapping);
    const run = ++checkRun.current;
    setValidateError(null);
    startValidating(async () => {
      try {
        const result = await validateRows({ rows });
        // The file or the mapping changed while the check ran: this answer is for other rows.
        if (run !== checkRun.current) return;
        if (!result.ok) {
          setValidateError(result.message);
          return;
        }
        setValidation(result.data);
        clearCommitState();
        setStep("review");
      } catch {
        if (run !== checkRun.current) return;
        setValidateError("Không kết nối được tới máy chủ. Kiểm tra kết nối rồi thử lại; bước này không ghi dữ liệu.");
      }
    });
  }

  const gate = validation
    ? getStudentImportCommitGate({
        canCreateStudents,
        confirmed,
        isCommitted: commitResult !== null,
        isPending: isCommitting,
        mappedRowCount: mappedRows.length,
        reason,
        validation,
      })
    : null;

  function handleCommit() {
    if (!validation || !workbook || !gate?.canCommit) return;
    setCommitError(null);
    startCommitting(async () => {
      try {
        const result = await commitRows({
          reason: reason.trim(),
          rows: mappedRows,
          sourceFilename: workbook.sourceFilename,
          sourceSha256: workbook.sourceSha256,
        });
        if (!result.ok) {
          setCommitError({ kind: "error", message: result.message });
          return;
        }
        setCommitResult(result.data);
        setConfirmed(false);
      } catch {
        // The request may or may not have reached the server: say so, never "chưa ghi".
        setCommitError({ kind: "unknown" });
      }
    });
  }

  const context = workbook ? `${workbook.sourceFilename} · ${formatNumber(workbook.rowCount)} dòng` : undefined;

  let body: ReactNode;
  let actionBar: ReactNode;

  if (commitResult) {
    body = (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <StudentImportCommitResultView result={commitResult} />
        <div>
          <Button className="max-md:h-11" onClick={resetToFile} variant="secondary">
            Nhập file khác
          </Button>
        </div>
      </div>
    );
    actionBar = (
      <ImportActionBar
        primary={
          <>
            <Link className={getButtonClassName({ variant: "secondary" })} href={resultLinks.auditLog}>
              Xem nhật ký thao tác
            </Link>
            <Link className={getButtonClassName({ variant: "primary" })} href={resultLinks.studentList}>
              Mở danh sách học viên
            </Link>
          </>
        }
        text="Đã ghi xong. Hồ sơ mới có trong danh sách học viên."
      />
    );
  } else if (currentStep === "file") {
    body = (
      <>
        {!canCreateStudents ? (
          <ResultBanner
            description={`Tài khoản này đọc file và kiểm tra dòng được, nhưng chưa có quyền ${permissionLabel("students.create")} nên bước Xác nhận nhập sẽ không ghi được.`}
            title="Chỉ kiểm tra được, chưa nhập được."
            tone="warning"
          />
        ) : null}
        <ImportFileStep
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          error={fileError}
          file={
            workbook
              ? { name: workbook.sourceFilename, rows: workbook.rowCount, sha256: workbook.sourceSha256, sheet: workbook.sheetName }
              : null
          }
          inputId="student-import-file"
          isReading={isReading}
          label="Chọn file Excel"
          limitsText={LIMITS_TEXT}
          onFileSelected={handleFileSelected}
          onReset={workbook ? resetToFile : undefined}
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
      </>
    );
    actionBar = (
      <ImportActionBar
        primary={
          <Button aria-describedby={workbook ? undefined : primaryReasonId} disabled={!workbook || isReading} onClick={() => setStep("mapping")}>
            Tiếp: Ánh xạ cột
          </Button>
        }
        {...barReason(workbook ? null : isReading ? "Đang đọc file." : "Chọn file Excel trước.", primaryReasonId)}
        text={
          workbook
            ? `Đã đọc ${formatNumber(workbook.rowCount)} dòng từ trang tính ${workbook.sheetName}. Bước sau chọn cột cho từng trường.`
            : "File được đọc ngay trong trình duyệt; chưa có gì gửi lên máy chủ."
        }
      />
    );
  } else if (currentStep === "mapping" && workbook && mappingValidation) {
    const issuesByField = new Map<string, StudentImportMappingIssue>();
    for (const issue of mappingValidation.issues) {
      if (issue.fieldKey && !issuesByField.has(issue.fieldKey)) issuesByField.set(issue.fieldKey, issue);
    }
    const issueCount = mappingValidation.issues.length;

    body = (
      <>
        <ResultBanner description={describeAutomaticMapping(workbook)} title="Ánh xạ tự động theo tiêu đề cột." tone="info" />
        {!mappingValidation.isValid ? (
          <ResultBanner title={`Ánh xạ cột chưa hợp lệ: còn ${formatNumber(issueCount)} lỗi.`} tone="error">
            <ul className="mt-1 grid list-disc gap-0.5 pl-5">
              {mappingValidation.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.fieldKey ?? issue.columnKey ?? index}`}>{describeMappingIssue(issue, mapping)}</li>
              ))}
            </ul>
          </ResultBanner>
        ) : null}

        <section
          aria-labelledby="student-import-mapping-title"
          className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
        >
          <div className="border-b border-border-row px-5 py-4">
            <h2 className="text-section-title font-semibold text-text-strong" id="student-import-mapping-title">
              Chọn cột cho từng trường
            </h2>
            <p className="mt-0.5 text-secondary text-text-muted">Trường có dấu * là bắt buộc. Cột trong file ghi theo chữ cái và tiêu đề.</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {STUDENT_IMPORT_FIELD_DEFINITIONS.map((definition) => {
              const issue = issuesByField.get(definition.key);
              const selectId = `student-import-map-${definition.key}`;
              const issueId = `${selectId}-issue`;
              return (
                <div className="grid content-start gap-1.5" key={definition.key}>
                  <Label htmlFor={selectId} required={definition.required}>
                    {definition.label}
                  </Label>
                  <Select
                    aria-describedby={issue ? issueId : undefined}
                    aria-invalid={issue ? true : undefined}
                    id={selectId}
                    onChange={(event) => updateMapping(definition.key, event.target.value)}
                    value={mapping[definition.key] ?? ""}
                  >
                    <option value="">Không dùng</option>
                    {workbook.columns.map((column) => (
                      <option key={column.columnKey} value={column.columnKey}>
                        {column.columnKey} · {column.sourceHeader ?? "Không có tiêu đề"}
                      </option>
                    ))}
                  </Select>
                  {issue ? (
                    <p className="text-caption font-medium text-danger" id={issueId}>
                      {fieldIssueText(issue)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {mappingValidation.isValid ? <MappedRowsPreview rows={mappedRows} /> : null}

        {validateError ? <ResultBanner description={validateError} title="Chưa kiểm tra được." tone="error" /> : null}
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isValidating, label: "Tải mẫu & chọn file", onClick: () => setStep("file") }}
        primary={
          validation ? (
            // This mapping was already checked (a mapping change drops the result): move on without a second call.
            <Button onClick={() => setStep("review")}>Tiếp: Kiểm tra dòng</Button>
          ) : (
            <Button
              aria-describedby={mappingValidation.isValid ? undefined : primaryReasonId}
              disabled={!mappingValidation.isValid}
              isLoading={isValidating}
              onClick={handleValidate}
            >
              {`Kiểm tra ${formatNumber(workbook.rowCount)} dòng`}
            </Button>
          )
        }
        {...barReason(validation || mappingValidation.isValid ? null : "Chọn cột cho mọi trường bắt buộc trước khi kiểm tra.", primaryReasonId)}
        text={
          validation
            ? "Đã kiểm tra với ánh xạ này. Đổi cột nào thì phải kiểm tra lại."
            : mappingValidation.isValid
              ? "Máy chủ kiểm tra từng dòng; bước này chỉ đọc, chưa tạo học sinh hay phụ huynh nào."
              : `Còn ${formatNumber(issueCount)} lỗi ánh xạ cột.`
        }
      />
    );
  } else if (currentStep === "review" && validation) {
    const hasErrors = validation.invalid_count > 0;
    body = (
      <>
        <ImportSummaryStrip
          cells={[
            { label: "Tổng dòng", value: validation.row_count },
            { label: "Hợp lệ", tone: "success", value: validation.valid_count },
            { label: "Cảnh báo (vẫn nhập được)", tone: "warning", value: validation.warning_count },
            { label: "Lỗi (phải sửa trong file)", tone: "danger", value: validation.invalid_count },
          ]}
          label="Kết quả kiểm tra"
        />
        <StudentReviewTable mappedRowsByNumber={mappedRowsByNumber} validation={validation} />
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ label: "Ánh xạ cột", onClick: () => setStep("mapping") }}
        primary={
          <Button aria-describedby={hasErrors ? primaryReasonId : undefined} disabled={hasErrors} onClick={() => setStep("confirm")}>
            Tiếp: Xác nhận nhập
          </Button>
        }
        {...barReason(hasErrors ? "Bật khi không còn dòng lỗi." : null, primaryReasonId)}
        text={
          hasErrors
            ? `Còn ${formatNumber(validation.invalid_count)} dòng lỗi. Sửa file Excel rồi chọn lại file; ứng dụng không sửa hay bỏ dòng.`
            : validation.warning_count > 0
              ? `Không còn dòng lỗi. ${formatNumber(validation.warning_count)} dòng cảnh báo vẫn nhập được.`
              : "Không còn dòng lỗi."
        }
      />
    );
  } else if (validation && gate) {
    const reusedGuardianCount = validation.rows.filter((row) => row.guardian_reused).length;
    body = (
      <StudentImportCommitPanel
        confirmed={confirmed}
        error={commitError}
        gate={gate}
        inputsDisabled={isCommitting || validation.invalid_count > 0 || !canCreateStudents}
        onConfirmedChange={(value) => {
          setConfirmed(value);
          setCommitError(null);
        }}
        onReasonChange={(value) => {
          setReason(value);
          setCommitError(null);
        }}
        reason={reason}
        reusedGuardianCount={reusedGuardianCount}
        validation={validation}
      />
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isCommitting, label: "Kiểm tra dòng", onClick: () => setStep("review") }}
        primary={
          <Button
            aria-describedby={gate.reason ? primaryReasonId : undefined}
            disabled={!gate.canCommit}
            isLoading={isCommitting}
            onClick={handleCommit}
          >
            {isCommitting ? "Đang nhập…" : `Xác nhận nhập ${formatNumber(validation.row_count)} học sinh`}
          </Button>
        }
        {...barReason(gate.reason, primaryReasonId)}
        text="Bấm xác nhận là ghi dữ liệu thật: tạo hồ sơ học sinh và phụ huynh."
      />
    );
  }

  return (
    <ImportWizardFrame actionBar={actionBar} context={context} stepperLabel="Các bước nhập học sinh" steps={steps} title="Nhập học sinh từ file">
      {body}
    </ImportWizardFrame>
  );
}

/** First five mapped rows, so the mapping can be checked before the dry-run. */
function MappedRowsPreview({ rows }: { rows: readonly StudentImportRowInput[] }) {
  const preview = rows.slice(0, 5);
  return (
    <DataTableFrame
      body={preview.map((row) => (
        <TableRow key={String(row.row_number)}>
          <TableCell className="text-text-muted tabular-nums">{cellText(row.row_number)}</TableCell>
          <TableCell className="font-semibold text-text-strong">{cellText(row.student_full_name)}</TableCell>
          <TableCell className="tabular-nums">{cellText(row.birth_year)}</TableCell>
          <TableCell className="tabular-nums">{cellText(row.current_grade)}</TableCell>
          <TableCell>{cellText(row.guardian_full_name)}</TableCell>
          <TableCell className="tabular-nums">{cellText(row.guardian_phone)}</TableCell>
          <TableCell>{cellText(row.guardian_relationship)}</TableCell>
        </TableRow>
      ))}
      caption="Xem trước các dòng đầu sau khi ánh xạ"
      footer={
        <span className="tabular-nums">
          Hiển thị {formatNumber(preview.length)}/{formatNumber(rows.length)} dòng đầu sau khi ánh xạ
        </span>
      }
      header={
        <tr>
          <TableHeaderCell style={{ width: "60px" }}>Dòng</TableHeaderCell>
          <TableHeaderCell>Họ tên</TableHeaderCell>
          <TableHeaderCell>Năm sinh</TableHeaderCell>
          <TableHeaderCell>Khối</TableHeaderCell>
          <TableHeaderCell>Phụ huynh</TableHeaderCell>
          <TableHeaderCell>SĐT</TableHeaderCell>
          <TableHeaderCell>Quan hệ</TableHeaderCell>
        </tr>
      }
      tableClassName="min-w-[760px]"
    />
  );
}

/**
 * Every dry-run row (no display cap; the file holds at most 500), errors
 * first under "Cần xem". A value the server could not normalise (e.g. a
 * five-digit year) falls back to what the file had, so the error is visible.
 */
function StudentReviewTable({
  mappedRowsByNumber,
  validation,
}: {
  mappedRowsByNumber: ReadonlyMap<number, StudentImportRowInput>;
  validation: StudentImportValidationResult;
}) {
  function value(row: StudentImportValidationRow, key: StudentImportFieldKey & keyof StudentImportValidationRow["normalized_data"]) {
    const normalized = row.normalized_data[key];
    if (normalized !== null && normalized !== undefined && normalized !== "") return String(normalized);
    return cellText(mappedRowsByNumber.get(row.row_number)?.[key]);
  }

  const columns: ImportReviewColumn<StudentImportValidationRow>[] = [
    {
      header: "Dòng",
      hideInCard: true,
      key: "row",
      render: (row) => <span className="text-text-muted tabular-nums">{row.row_number}</span>,
      width: "60px",
    },
    {
      header: "Họ tên",
      hideInCard: true,
      key: "name",
      render: (row) => <span className="font-semibold text-text-strong">{value(row, "student_full_name")}</span>,
      width: "180px",
    },
    { header: "Năm sinh", key: "birth", render: (row) => <span className="tabular-nums">{value(row, "birth_year")}</span>, width: "90px" },
    { header: "Khối", key: "grade", render: (row) => <span className="tabular-nums">{value(row, "current_grade")}</span>, width: "70px" },
    { header: "Phụ huynh", key: "guardian", render: (row) => value(row, "guardian_full_name"), width: "160px" },
    { header: "SĐT", key: "phone", render: (row) => <span className="tabular-nums">{value(row, "guardian_phone")}</span>, width: "130px" },
    { header: "Quan hệ", key: "relationship", render: (row) => value(row, "guardian_relationship"), width: "100px" },
  ];

  return (
    <ImportReviewTable
      caption={`Kết quả kiểm tra ${formatNumber(validation.row_count)} dòng`}
      cardTitle={(row) => `Dòng ${row.row_number} · ${value(row, "student_full_name")}`}
      columns={columns}
      getRowIssue={getRowIssue}
      getRowKey={(row) => String(row.row_number)}
      getRowSeverity={getRowSeverity}
      rows={validation.rows}
    />
  );
}
