"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { ImportActionBar } from "@/features/imports/components/import-action-bar";
import { ImportFileStep } from "@/features/imports/components/import-file-step";
import { formatIsoWeekday } from "@/features/imports/components/import-labels";
import { ImportSummaryStrip, type ImportSummaryCell } from "@/features/imports/components/import-summary-strip";
import { ImportWizardFrame } from "@/features/imports/components/import-wizard-frame";
import { formatIsoDate } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

import { createClassScheduleImportBatchAction, dryRunClassScheduleImportAction } from "./actions";
import type { ClassScheduleImportActionOverrides } from "./class-schedule-import-action-overrides";
import {
  blockingRowsReason,
  buildClassImportSteps,
  buildSummaryCells,
  CLASS_IMPORT_STEPPER_LABEL,
  CLASS_IMPORT_STEP_TITLES,
  countBlockingRows,
  type ScheduleReviewRow,
} from "./class-schedule-import-presentation";
import { ClassScheduleRowsTabs } from "./class-schedule-import-rows";
import { CLASS_IMPORT_FIELDS, SCHEDULE_IMPORT_FIELDS } from "./fields";
import { autoMapClassesSheet, autoMapSchedulesSheet, validateClassesMapping, validateSchedulesMapping } from "./mapping";
import { downloadClassScheduleImportTemplate } from "./template-browser";
import type {
  ClassImportColumnMapping,
  ClassImportRowInput,
  ClassScheduleImportMappingValidation,
  ClassScheduleImportParsedSheet,
  ClassScheduleImportParsedWorkbook,
  DryRunClassScheduleImportResult,
  ScheduleImportColumnMapping,
  ScheduleImportRowInput,
} from "./types";
import {
  CLASS_IMPORT_MAX_ROWS,
  CLASS_SCHEDULE_IMPORT_MAX_FILE_BYTES,
  parseClassScheduleImportWorkbook,
  parseDateValue,
  parseTimeValue,
  parseWeekdayValue,
  SCHEDULE_IMPORT_MAX_ROWS,
} from "./workbook";

/** Wizard steps on this page; the fifth ("Xác nhận nhập") is on the batch page. */
export type ClassScheduleImportStep = "file" | "mapping" | "review" | "batch";

const STEP_ORDER: readonly ClassScheduleImportStep[] = ["file", "mapping", "review", "batch"];

/**
 * Year code used when the Classes sheet has no "Mã năm học" value.
 * TODO(owner, TODOS O8): hard-coded today; it should come from the open
 * academic years. Kept as is (presentation-only step) and said plainly.
 */
const FALLBACK_ACADEMIC_YEAR_CODE = "2026-2027";

/** Rows of each sheet shown under its mapping (raw file values). */
const MAPPING_PREVIEW_ROWS = { classes: 20, schedules: 30 } as const;

const UNASSIGNED = "unassigned";

/**
 * A batch creation whose answer never arrived. Retrying in place is safe: the
 * create action looks the file up by SHA-256 first and answers with the batch
 * already made from it, which this page links.
 */
const CREATE_UNKNOWN_RESULT = "Không rõ kết quả. Bấm “Tạo lô” lại: nếu lô đã được tạo, trang sẽ hiện link mở lô đó.";

/** The file step's limits, read from the parser's own constants. */
const LIMITS_TEXT = `File Excel (.xlsx) có hai sheet “Classes” (lớp học) và “Schedules” (lịch học); tối đa ${formatNumber(
  CLASS_SCHEDULE_IMPORT_MAX_FILE_BYTES / (1024 * 1024),
)} MB, ${formatNumber(CLASS_IMPORT_MAX_ROWS)} lớp và ${formatNumber(SCHEDULE_IMPORT_MAX_ROWS)} lịch học. File được đọc ngay trên trình duyệt.`;

interface LastDryRunState {
  academicYearCode: string;
  classesCount: number;
  classesMapping: ClassImportColumnMapping;
  schedulesCount: number;
  schedulesMapping: ScheduleImportColumnMapping;
  sha256: string;
}

interface PreparedClassInputs {
  academicYearCode: string;
  /** False when no row has a "Mã năm học" value and the fallback year is used. */
  yearFromFile: boolean;
  rows: ClassImportRowInput[];
}

function prepareClassInputs(workbook: ClassScheduleImportParsedWorkbook | null, classesMapping: ClassImportColumnMapping): PreparedClassInputs {
  if (!workbook) return { academicYearCode: "", rows: [], yearFromFile: false };

  let targetYearCode = "";
  const rows: ClassImportRowInput[] = workbook.classesSheet.rows.map((row) => {
    const yearCodeVal = classesMapping.academic_year_code ? String(row.values[classesMapping.academic_year_code] ?? "").trim() : "";
    if (yearCodeVal && !targetYearCode) {
      targetYearCode = yearCodeVal;
    }

    return {
      academic_year_code: yearCodeVal,
      class_code: classesMapping.class_code ? String(row.values[classesMapping.class_code] ?? "").trim() : "",
      class_name: classesMapping.class_name ? String(row.values[classesMapping.class_name] ?? "").trim() : "",
      default_learning_mode: classesMapping.default_learning_mode
        ? String(row.values[classesMapping.default_learning_mode] ?? "").trim().toLowerCase()
        : "hybrid",
      grade: classesMapping.grade ? Number(row.values[classesMapping.grade]) : undefined,
      level: classesMapping.level ? String(row.values[classesMapping.level] ?? "").trim().toUpperCase() : "",
      source_row_number: row.rowNumber,
      status: classesMapping.status ? String(row.values[classesMapping.status] ?? "").trim().toLowerCase() : "active",
      weekly_session_count: classesMapping.weekly_session_count ? Number(row.values[classesMapping.weekly_session_count]) : 2,
    };
  });

  return { academicYearCode: targetYearCode || FALLBACK_ACADEMIC_YEAR_CODE, rows, yearFromFile: targetYearCode !== "" };
}

interface PreparedScheduleInputs {
  /** Rows sent to the dry-run and the batch. */
  rows: ScheduleImportRowInput[];
  /**
   * Rows whose weekday could not be read, as invalid check rows. They stay out
   * of the payload (the actions' schema refuses the whole request over one bad
   * weekday) and the check adds them back, so they block the batch instead of
   * becoming Monday.
   */
  unreadableWeekdayRows: ScheduleReviewRow[];
}

/** The check as the review shows it: the server's answer plus the rows held back for an unreadable weekday. */
type CheckedResult = Omit<DryRunClassScheduleImportResult, "schedule_rows"> & { schedule_rows: ScheduleReviewRow[] };

function unreadableWeekdayMessage(raw: unknown): string {
  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  return text ? `Không đọc được thứ trong tuần: “${text}”.` : "Không đọc được thứ trong tuần: ô để trống.";
}

function prepareScheduleInputs(
  workbook: ClassScheduleImportParsedWorkbook | null,
  schedulesMapping: ScheduleImportColumnMapping,
): PreparedScheduleInputs {
  const prepared: PreparedScheduleInputs = { rows: [], unreadableWeekdayRows: [] };
  if (!workbook) return prepared;

  for (const row of workbook.schedulesSheet.rows) {
    const rawWeekday = schedulesMapping.weekday ? row.values[schedulesMapping.weekday] : null;
    const parsedWeekday = parseWeekdayValue(rawWeekday);

    const rawStartTime = schedulesMapping.start_time ? row.values[schedulesMapping.start_time] : null;
    const parsedStartTime = parseTimeValue(rawStartTime) || String(rawStartTime || "");

    const rawEndTime = schedulesMapping.end_time ? row.values[schedulesMapping.end_time] : null;
    const parsedEndTime = parseTimeValue(rawEndTime) || String(rawEndTime || "");

    const rawFrom = schedulesMapping.effective_from ? row.values[schedulesMapping.effective_from] : null;
    const parsedFrom = parseDateValue(rawFrom) || String(rawFrom || "");

    const rawTo = schedulesMapping.effective_to ? row.values[schedulesMapping.effective_to] : null;
    const parsedTo = parseDateValue(rawTo);

    const input = {
      class_code: schedulesMapping.class_code ? String(row.values[schedulesMapping.class_code] ?? "").trim() : "",
      component_code: schedulesMapping.component_code ? String(row.values[schedulesMapping.component_code] ?? "").trim() : "",
      effective_from: parsedFrom,
      effective_to: parsedTo,
      end_time: parsedEndTime,
      learning_mode: schedulesMapping.learning_mode
        ? String(row.values[schedulesMapping.learning_mode] ?? "").trim().toLowerCase()
        : "hybrid",
      meeting_url: schedulesMapping.meeting_url ? String(row.values[schedulesMapping.meeting_url] ?? "").trim() : null,
      room_name: schedulesMapping.room_name ? String(row.values[schedulesMapping.room_name] ?? "").trim() : null,
      source_row_number: row.rowNumber,
      start_time: parsedStartTime,
    };

    if (parsedWeekday === null) {
      prepared.unreadableWeekdayRows.push({
        ...input,
        classification: "invalid",
        validation_message: unreadableWeekdayMessage(rawWeekday),
        weekday: null,
      });
    } else {
      prepared.rows.push({ ...input, weekday: parsedWeekday });
    }
  }

  return prepared;
}

/** The server's check with the rows it never saw (unreadable weekday) added back as invalid rows, in file order. */
function withUnreadableWeekdayRows(
  result: DryRunClassScheduleImportResult,
  unreadableRows: readonly ScheduleReviewRow[],
): CheckedResult {
  if (unreadableRows.length === 0) return result;
  return {
    ...result,
    schedule_rows: [...result.schedule_rows, ...unreadableRows].sort((a, b) => a.source_row_number - b.source_row_number),
    schedule_summary: {
      ...result.schedule_summary,
      invalid: result.schedule_summary.invalid + unreadableRows.length,
      total: result.schedule_summary.total + unreadableRows.length,
    },
  };
}

function snapshotDryRunState(
  workbook: ClassScheduleImportParsedWorkbook,
  classesMapping: ClassImportColumnMapping,
  schedulesMapping: ScheduleImportColumnMapping,
): LastDryRunState {
  const classInputs = prepareClassInputs(workbook, classesMapping);
  return {
    academicYearCode: classInputs.academicYearCode,
    classesCount: classInputs.rows.length,
    classesMapping: { ...classesMapping },
    schedulesCount: prepareScheduleInputs(workbook, schedulesMapping).rows.length,
    schedulesMapping: { ...schedulesMapping },
    sha256: workbook.sourceSha256,
  };
}

/** The action bar's reason line under the bar, or none (its props come in pairs). */
function reasonProps(reason: string | undefined, reasonId: string): { reason: string; reasonId: string } | { reason?: undefined; reasonId?: undefined } {
  return reason ? { reason, reasonId } : {};
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface ClassScheduleImportPageProps {
  /** Defaults to the real server actions; the /dev/imports preview passes inert stubs. */
  actions?: Pick<ClassScheduleImportActionOverrides, "createClassScheduleImportBatch" | "dryRunClassScheduleImport">;
  /** Where a created (or already existing) batch opens; the preview keeps it under /dev. */
  batchHref?: (batchId: string) => string;
  /** Opens a later step (tests, previews); falls back to the furthest step the seeded data allows. */
  initialStep?: ClassScheduleImportStep;
  /** A workbook already read (tests, previews); columns are auto-mapped as after a real read. */
  initialWorkbook?: ClassScheduleImportParsedWorkbook | null;
  /**
   * A dry-run result for `initialWorkbook` as auto-mapped (not stale): the server's answer for the rows
   * sent, so rows held back for an unreadable weekday are added to it as after a real check.
   */
  initialDryRun?: DryRunClassScheduleImportResult | null;
}

const defaultBatchHref = (batchId: string) => `/imports/classes/${batchId}`;

/**
 * /imports/classes (design 17c): the class & schedule import wizard in one
 * frame — "Tải mẫu & chọn file" → "Ánh xạ cột" (the two sheets in tabs) →
 * "Kiểm tra dòng" (server dry-run, writes nothing) → "Tạo lô" (stages the file
 * as a batch) → "Xác nhận nhập" on the batch page. One step body at a time;
 * going back keeps the file and the mapping; changing them makes the last
 * check stale ("Chạy lại kiểm tra"). No in-app row edits: the fix is in the
 * Excel file.
 */
export function ClassScheduleImportPage({
  actions,
  batchHref = defaultBatchHref,
  initialDryRun = null,
  initialStep,
  initialWorkbook = null,
}: ClassScheduleImportPageProps) {
  const dryRunClassScheduleImport = actions?.dryRunClassScheduleImport ?? dryRunClassScheduleImportAction;
  const createClassScheduleImportBatch = actions?.createClassScheduleImportBatch ?? createClassScheduleImportBatchAction;
  const router = useRouter();
  const ids = useId();
  const [isDownloading, setIsDownloading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isPendingDryRun, startTransitionDryRun] = useTransition();
  const [isPendingBatch, startTransitionBatch] = useTransition();
  // Bumped by every input change that invalidates a check (a new or cleared file, either mapping)
  // and by each check: a dry-run answer is applied only while its run is still the latest.
  const checkRun = useRef(0);

  const [workbook, setWorkbook] = useState<ClassScheduleImportParsedWorkbook | null>(initialWorkbook);
  const [fileError, setFileError] = useState<string | null>(null);

  const [classesMapping, setClassesMapping] = useState<ClassImportColumnMapping>(() =>
    initialWorkbook ? autoMapClassesSheet(initialWorkbook.classesSheet).mapping : {},
  );
  const [schedulesMapping, setSchedulesMapping] = useState<ScheduleImportColumnMapping>(() =>
    initialWorkbook ? autoMapSchedulesSheet(initialWorkbook.schedulesSheet).mapping : {},
  );
  const [mappingTab, setMappingTab] = useState<"classes" | "schedules">("classes");

  const [dryRunResult, setDryRunResult] = useState<CheckedResult | null>(() =>
    initialWorkbook && initialDryRun
      ? withUnreadableWeekdayRows(initialDryRun, prepareScheduleInputs(initialWorkbook, schedulesMapping).unreadableWeekdayRows)
      : null,
  );
  const [lastDryRunState, setLastDryRunState] = useState<LastDryRunState | null>(() =>
    initialWorkbook && initialDryRun ? snapshotDryRunState(initialWorkbook, classesMapping, schedulesMapping) : null,
  );
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [existingBatchId, setExistingBatchId] = useState<string | null>(null);

  const [chosenStep, setStep] = useState<ClassScheduleImportStep>(
    () => initialStep ?? (initialWorkbook && initialDryRun ? "review" : initialWorkbook ? "mapping" : "file"),
  );
  // A step whose data is missing falls back to the furthest one available: every
  // later step needs the file, and the review and the batch need a result too.
  const step: ClassScheduleImportStep = !workbook
    ? "file"
    : (chosenStep === "review" || chosenStep === "batch") && !dryRunResult
      ? "mapping"
      : chosenStep;
  const stepIndex = STEP_ORDER.indexOf(step);

  const classesMappingValidation = useMemo(() => validateClassesMapping(classesMapping), [classesMapping]);
  const schedulesMappingValidation = useMemo(() => validateSchedulesMapping(schedulesMapping), [schedulesMapping]);
  const isMappingValid = classesMappingValidation.isValid && schedulesMappingValidation.isValid;
  const mappingIssueCount = classesMappingValidation.issues.length + schedulesMappingValidation.issues.length;

  const preparedClassInputs = useMemo(() => prepareClassInputs(workbook, classesMapping), [workbook, classesMapping]);
  const preparedScheduleInputs = useMemo(() => prepareScheduleInputs(workbook, schedulesMapping), [workbook, schedulesMapping]);

  // Same rule as before the redesign: the last check is stale once the file,
  // the year, the row counts or either mapping differ from what it checked.
  const isStale = useMemo(() => {
    if (!lastDryRunState || !workbook) return false;
    if (lastDryRunState.sha256 !== workbook.sourceSha256) return true;
    if (lastDryRunState.academicYearCode !== preparedClassInputs.academicYearCode) return true;
    if (lastDryRunState.classesCount !== preparedClassInputs.rows.length) return true;
    if (lastDryRunState.schedulesCount !== preparedScheduleInputs.rows.length) return true;
    if (JSON.stringify(lastDryRunState.classesMapping) !== JSON.stringify(classesMapping)) return true;
    if (JSON.stringify(lastDryRunState.schedulesMapping) !== JSON.stringify(schedulesMapping)) return true;
    return false;
  }, [lastDryRunState, workbook, preparedClassInputs, preparedScheduleInputs, classesMapping, schedulesMapping]);

  const blockingCount = dryRunResult ? countBlockingRows(dryRunResult.class_summary, dryRunResult.schedule_summary) : 0;
  const trimmedReason = reason.trim();

  async function handleDownloadTemplate() {
    setTemplateError(null);
    try {
      setIsDownloading(true);
      await downloadClassScheduleImportTemplate();
    } catch (error) {
      setTemplateError(`Không tải được file mẫu: ${errorText(error)}`);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleFileSelected(file: File) {
    checkRun.current += 1;
    setFileError(null);
    setDryRunError(null);
    setCreateError(null);
    setExistingBatchId(null);
    setDryRunResult(null);
    setLastDryRunState(null);
    setConfirmationChecked(false);
    setIsReading(true);

    try {
      const parsed = await parseClassScheduleImportWorkbook(file);
      setWorkbook(parsed);
      setClassesMapping(autoMapClassesSheet(parsed.classesSheet).mapping);
      setSchedulesMapping(autoMapSchedulesSheet(parsed.schedulesSheet).mapping);
      setMappingTab("classes");
      setStep("mapping");
    } catch (error) {
      setFileError(errorText(error));
      setWorkbook(null);
    } finally {
      setIsReading(false);
    }
  }

  function handleReset() {
    checkRun.current += 1;
    setWorkbook(null);
    setFileError(null);
    setDryRunError(null);
    setCreateError(null);
    setExistingBatchId(null);
    setClassesMapping({});
    setSchedulesMapping({});
    setDryRunResult(null);
    setLastDryRunState(null);
    setConfirmationChecked(false);
    setStep("file");
  }

  /**
   * A mapping change makes the last check stale (see isStale), drops an answer still in flight and
   * clears the last check's error, which was about the mapping before the change.
   */
  function handleClassesMappingChange(key: keyof ClassImportColumnMapping, value: string | null) {
    checkRun.current += 1;
    setDryRunError(null);
    setClassesMapping((previous) => ({ ...previous, [key]: value }));
  }

  function handleSchedulesMappingChange(key: keyof ScheduleImportColumnMapping, value: string | null) {
    checkRun.current += 1;
    setDryRunError(null);
    setSchedulesMapping((previous) => ({ ...previous, [key]: value }));
  }

  function handleRunDryRun() {
    if (!isMappingValid || !workbook) return;

    setDryRunError(null);
    setCreateError(null);
    setExistingBatchId(null);
    // A previous (stale) result is kept until the new one arrives: the stale
    // gate keeps it from reaching "Tạo lô", and a failed re-run leaves it stale.

    const classInputs = preparedClassInputs;
    const scheduleInputs = preparedScheduleInputs;
    if (scheduleInputs.rows.length === 0 && scheduleInputs.unreadableWeekdayRows.length > 0) {
      // No schedule row left to send (the server needs at least one): most likely the wrong column for "Thứ".
      setDryRunError(
        `Không đọc được thứ trong tuần ở cả ${formatNumber(scheduleInputs.unreadableWeekdayRows.length)} dòng lịch học. Kiểm tra cột chọn cho “Thứ” ở sheet Schedules, hoặc sửa file Excel rồi chọn lại file.`,
      );
      return;
    }
    const checkedState: LastDryRunState = {
      academicYearCode: classInputs.academicYearCode,
      classesCount: classInputs.rows.length,
      classesMapping: { ...classesMapping },
      schedulesCount: scheduleInputs.rows.length,
      schedulesMapping: { ...schedulesMapping },
      sha256: workbook.sourceSha256,
    };
    const run = ++checkRun.current;

    startTransitionDryRun(async () => {
      let res: Awaited<ReturnType<typeof dryRunClassScheduleImport>>;
      try {
        res = await dryRunClassScheduleImport({
          academic_year_code: classInputs.academicYearCode,
          classes: classInputs.rows,
          schedules: scheduleInputs.rows,
        });
      } catch {
        if (run !== checkRun.current) return;
        setDryRunError("Không kết nối được máy chủ để kiểm tra. Bước này chưa ghi gì: kiểm tra mạng rồi thử lại.");
        return;
      }

      // The file or a mapping changed while the check ran: this answer is for other rows.
      if (run !== checkRun.current) return;
      if (!res.ok) {
        setDryRunError(res.message);
        return;
      }
      setDryRunResult(withUnreadableWeekdayRows(res.data, scheduleInputs.unreadableWeekdayRows));
      setLastDryRunState(checkedState);
      setConfirmationChecked(false);
      setStep("review");
    });
  }

  function handleCreateBatch() {
    // Rows with an unreadable weekday are not in the payload. blockingCount already counts them (every
    // check result includes them as invalid rows); this guard only keeps a later change from staging a batch without them.
    const hasUnreadableWeekday = preparedScheduleInputs.unreadableWeekdayRows.length > 0;
    if (!workbook || !dryRunResult || isStale || blockingCount > 0 || hasUnreadableWeekday || !confirmationChecked || !trimmedReason) return;

    setCreateError(null);
    setExistingBatchId(null);

    startTransitionBatch(async () => {
      let res: Awaited<ReturnType<typeof createClassScheduleImportBatch>>;
      try {
        res = await createClassScheduleImportBatch({
          academic_year_code: preparedClassInputs.academicYearCode,
          classes: preparedClassInputs.rows,
          explicit_confirmation: true,
          reason: trimmedReason,
          schedules: preparedScheduleInputs.rows,
          source_filename: workbook.sourceFilename,
          source_sha256: workbook.sourceSha256,
        });
      } catch {
        setCreateError(CREATE_UNKNOWN_RESULT);
        return;
      }

      if (!res.ok) {
        setCreateError(res.message);
        if (res.existingBatchId) setExistingBatchId(res.existingBatchId);
        return;
      }
      router.push(batchHref(res.data.id));
    });
  }

  const context = workbook
    ? `${workbook.sourceFilename} · ${formatNumber(workbook.classesSheet.rowCount)} lớp · ${formatNumber(workbook.schedulesSheet.rowCount)} lịch học`
    : undefined;


  let body: ReactNode;
  let actionBar: ReactNode;

  if (step === "file") {
    const fileReasonId = `${ids}-file-reason`;
    const fileReason = isReading ? "Đang đọc file." : workbook ? undefined : "Chọn file Excel trước.";
    body = (
      <ImportFileStep
        accept=".xlsx,.xls"
        error={fileError}
        file={
          workbook
            ? {
                name: workbook.sourceFilename,
                rows: workbook.classesSheet.rowCount + workbook.schedulesSheet.rowCount,
                sha256: workbook.sourceSha256,
                sheet: `${workbook.classesSheet.sheetName} · ${workbook.schedulesSheet.sheetName}`,
              }
            : null
        }
        inputId="class-import-file"
        isReading={isReading}
        label="Chọn file Excel"
        limitsText={LIMITS_TEXT}
        onFileSelected={(file) => void handleFileSelected(file)}
        onReset={workbook ? handleReset : undefined}
        templateAction={
          <>
            <Button disabled={isDownloading} isLoading={isDownloading} onClick={() => void handleDownloadTemplate()} variant="secondary">
              {isDownloading ? "Đang tải mẫu…" : "Tải file mẫu (.xlsx)"}
            </Button>
            <span className="text-secondary text-text-muted">Mẫu có sẵn hai sheet và tiêu đề cột.</span>
            {templateError ? (
              <p className="basis-full text-secondary font-medium text-danger" role="alert">
                {templateError}
              </p>
            ) : null}
          </>
        }
      />
    );
    actionBar = (
      <ImportActionBar
        primary={
          <Button aria-describedby={fileReason ? fileReasonId : undefined} disabled={Boolean(fileReason)} onClick={() => setStep("mapping")}>
            Tiếp tục: Ánh xạ cột
          </Button>
        }
        {...reasonProps(fileReason, fileReasonId)}
        text="Hệ thống đọc file trên trình duyệt; chưa gửi dữ liệu nào lên máy chủ."
      />
    );
  } else if (step === "mapping" && workbook) {
    const mappingReasonId = `${ids}-mapping-reason`;
    const primaryLabel = !dryRunResult ? "Kiểm tra dòng" : isStale ? "Chạy lại kiểm tra" : "Tiếp tục: Kiểm tra dòng";
    const mappingReason = !isMappingValid ? `Sửa ánh xạ cột: còn ${formatNumber(mappingIssueCount)} vấn đề.` : undefined;
    body = (
      <>
        <section aria-labelledby={`${ids}-mapping-title`} className="grid min-w-0 gap-4 rounded-lg border border-border-subtle bg-surface-base p-5 shadow-[var(--panel-shadow)]">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={`${ids}-mapping-title`}>
              Ánh xạ cột
            </h2>
            <p className="mt-1 text-secondary text-text-muted">
              Cột được ghép tự động theo tiêu đề của file mẫu; chọn lại cột nếu tiêu đề khác. Trường có dấu * là bắt buộc.
            </p>
          </div>
          <p className="text-body text-text-default">
            {preparedClassInputs.yearFromFile ? (
              <>
                Năm học của lô: <strong className="font-semibold">{preparedClassInputs.academicYearCode}</strong>, lấy từ cột “Mã năm học” (dòng
                đầu tiên có giá trị).
              </>
            ) : (
              <>
                Cột “Mã năm học” chưa có giá trị nên lô dùng năm học mặc định{" "}
                <strong className="font-semibold">{FALLBACK_ACADEMIC_YEAR_CODE}</strong> (đặt cố định trong ứng dụng).
              </>
            )}
          </p>
          <Tabs
            id={`${ids}-mapping-tabs`}
            items={[
              { count: workbook.classesSheet.rowCount, label: "Sheet Classes", value: "classes" },
              { count: workbook.schedulesSheet.rowCount, label: "Sheet Schedules", value: "schedules" },
            ]}
            label="Sheet cần ánh xạ"
            onValueChange={(value) => setMappingTab(value === "schedules" ? "schedules" : "classes")}
            value={mappingTab}
          />
          <TabPanel activeValue={mappingTab} className="grid min-w-0 gap-4" tabsId={`${ids}-mapping-tabs`} value="classes">
            {mappingTab === "classes" ? (
              <SheetMapping
                fields={CLASS_IMPORT_FIELDS}
                mapping={classesMapping}
                onChange={handleClassesMappingChange}
                previewRows={MAPPING_PREVIEW_ROWS.classes}
                sheet={workbook.classesSheet}
                sheetLabel="Classes"
                validation={classesMappingValidation}
              />
            ) : null}
          </TabPanel>
          <TabPanel activeValue={mappingTab} className="grid min-w-0 gap-4" tabsId={`${ids}-mapping-tabs`} value="schedules">
            {mappingTab === "schedules" ? (
              <SheetMapping
                fields={SCHEDULE_IMPORT_FIELDS}
                mapping={schedulesMapping}
                onChange={handleSchedulesMappingChange}
                previewRows={MAPPING_PREVIEW_ROWS.schedules}
                sheet={workbook.schedulesSheet}
                sheetLabel="Schedules"
                validation={schedulesMappingValidation}
              />
            ) : null}
          </TabPanel>
        </section>
        {!isMappingValid ? (
          <ResultBanner
            description={`Sheet Classes: ${formatNumber(classesMappingValidation.issues.length)} · Sheet Schedules: ${formatNumber(schedulesMappingValidation.issues.length)}. Mở từng sheet để xem chi tiết.`}
            title={`Ánh xạ còn ${formatNumber(mappingIssueCount)} vấn đề.`}
            tone="warning"
          />
        ) : null}
        {isStale ? (
          <ResultBanner
            description="File, năm học hoặc ánh xạ cột đã đổi sau lần kiểm tra gần nhất. Bấm “Chạy lại kiểm tra” trước khi tạo lô."
            title="Kết quả kiểm tra trước không còn đúng."
            tone="warning"
          />
        ) : null}
        {dryRunError ? <ResultBanner description={dryRunError} title="Không kiểm tra được dữ liệu." tone="error" /> : null}
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isPendingDryRun, label: CLASS_IMPORT_STEP_TITLES[0], onClick: () => setStep("file") }}
        primary={
          <Button
            aria-describedby={mappingReason ? mappingReasonId : undefined}
            disabled={!isMappingValid || isPendingDryRun}
            isLoading={isPendingDryRun}
            onClick={() => (dryRunResult && !isStale ? setStep("review") : handleRunDryRun())}
          >
            {isPendingDryRun ? "Đang kiểm tra…" : primaryLabel}
          </Button>
        }
        {...reasonProps(mappingReason, mappingReasonId)}
        text="“Kiểm tra dòng” gửi các dòng đã ánh xạ lên máy chủ để đối chiếu với lớp và lịch học hiện có; bước này chưa ghi gì."
      />
    );
  } else if (step === "review" && dryRunResult) {
    const reviewReasonId = `${ids}-review-reason`;
    const reviewReason =
      blockingCount > 0 ? blockingRowsReason(blockingCount) : isStale ? "Kết quả kiểm tra đã cũ. Chạy lại kiểm tra trước khi tạo lô." : undefined;
    const { class_summary: classSummary, schedule_summary: scheduleSummary } = dryRunResult;
    body = (
      <>
        <p className="text-body text-text-default">
          Năm học đối soát: <strong className="font-semibold">{dryRunResult.academic_year.code}</strong>
          {dryRunResult.academic_year.name ? ` (${dryRunResult.academic_year.name})` : null}
        </p>
        <SummaryBlock cells={buildSummaryCells(classSummary)} title="Lớp học (sheet Classes)" />
        <SummaryBlock cells={buildSummaryCells(scheduleSummary)} title="Lịch học (sheet Schedules)" />
        <ClassScheduleRowsTabs
          captions={{
            classes: `Kết quả kiểm tra ${formatNumber(dryRunResult.class_rows.length)} dòng lớp học`,
            schedules: `Kết quả kiểm tra ${formatNumber(dryRunResult.schedule_rows.length)} dòng lịch học`,
          }}
          classRows={dryRunResult.class_rows}
          id={`${ids}-review-tabs`}
          scheduleRows={dryRunResult.schedule_rows}
        />
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ label: CLASS_IMPORT_STEP_TITLES[1], onClick: () => setStep("mapping") }}
        primary={
          <Button aria-describedby={reviewReason ? reviewReasonId : undefined} disabled={Boolean(reviewReason)} onClick={() => setStep("batch")}>
            Tiếp tục: Tạo lô
          </Button>
        }
        {...reasonProps(reviewReason, reviewReasonId)}
        text={
          blockingCount > 0
            ? `Còn ${formatNumber(blockingCount)} dòng xung đột hoặc không hợp lệ. Ứng dụng không sửa hay bỏ dòng: sửa file Excel rồi chọn lại file.`
            : `Không còn dòng chặn: lô sẽ tạo ${formatNumber(classSummary.new)} lớp và ${formatNumber(scheduleSummary.new)} lịch học mới; ${formatNumber(classSummary.existing_matching)} lớp và ${formatNumber(scheduleSummary.existing_matching)} lịch học đã có và khớp được dùng lại.`
        }
      />
    );
  } else if (step === "batch" && dryRunResult && workbook) {
    const createReason =
      blockingCount > 0
        ? blockingRowsReason(blockingCount)
        : isStale
          ? "Kết quả kiểm tra đã cũ. Chạy lại kiểm tra trước khi tạo lô."
          : !trimmedReason
            ? "Nhập lý do tạo lô."
            : !confirmationChecked
              ? "Đánh dấu ô xác nhận."
              : undefined;
    const conditions: GuardedCondition[] = [
      blockingCount > 0
        ? { label: `Còn ${formatNumber(blockingCount)} dòng xung đột hoặc không hợp lệ`, state: "unmet" }
        : { label: "Không còn dòng xung đột hoặc không hợp lệ", state: "met" },
      ...(isStale ? [{ label: "Kết quả kiểm tra khớp file và ánh xạ hiện tại", state: "unmet" as const }] : []),
      trimmedReason ? { label: "Đã nhập lý do", state: "met" } : { label: "Chưa nhập lý do", state: "unmet" },
      confirmationChecked ? { label: "Đã đánh dấu xác nhận", state: "met" } : { label: "Chưa đánh dấu xác nhận", state: "unmet" },
    ];
    body = (
      <>
        <GuardedActionPanel
          action={
            <Button
              className="max-md:h-11"
              disabled={Boolean(createReason) || isPendingBatch}
              disabledReason={createReason}
              isLoading={isPendingBatch}
              onClick={handleCreateBatch}
            >
              {isPendingBatch ? "Đang tạo lô…" : "Tạo lô"}
            </Button>
          }
          conditions={conditions}
          consequence={
            <>
              Lưu {formatNumber(preparedClassInputs.rows.length)} dòng lớp và {formatNumber(preparedScheduleInputs.rows.length)} dòng lịch học của file{" "}
              <strong>{workbook.sourceFilename}</strong> (năm học {preparedClassInputs.academicYearCode}) thành một lô chờ xác nhận.{" "}
              <strong>Chưa tạo lớp hay lịch học nào</strong>: việc đó ở bước “Xác nhận nhập” trên trang lô. Mỗi file chỉ tạo được một lô.
            </>
          }
          result={
            createError ? (
              <ResultBanner
                action={
                  existingBatchId ? (
                    <Link href={batchHref(existingBatchId)}>Mở lô đã tạo từ file này</Link>
                  ) : undefined
                }
                title={createError}
                tone="error"
              />
            ) : undefined
          }
          title="Tạo lô nhập"
          titleId={`${ids}-batch-title`}
        >
          <div className="mt-4 grid max-w-[640px] gap-4">
            <Field hint="Lưu cùng lô và hiện ở trang lô." label="Lý do tạo lô" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: Nhập lớp và lịch học đầu năm học"
                  value={reason}
                />
              )}
            </Field>
            <label className="flex min-h-11 items-start gap-2.5 py-2 text-body text-text-strong md:min-h-10" htmlFor={`${ids}-batch-confirm`}>
              <input
                checked={confirmationChecked}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
                id={`${ids}-batch-confirm`}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
                type="checkbox"
              />
              <span>Tôi đã xem kết quả kiểm tra và muốn lưu file này thành lô chờ xác nhận.</span>
            </label>
          </div>
        </GuardedActionPanel>
      </>
    );
    actionBar = (
      <ImportActionBar
        back={{ disabled: isPendingBatch, label: CLASS_IMPORT_STEP_TITLES[2], onClick: () => setStep("review") }}
        primary={null}
        text="Tạo lô xong, trang lô mở ra để xác nhận nhập (bước 5): lớp và lịch học chỉ được tạo ở bước đó."
      />
    );
  }

  return (
    <ImportWizardFrame
      actionBar={actionBar}
      context={context}
      stepperLabel={CLASS_IMPORT_STEPPER_LABEL}
      steps={buildClassImportSteps(stepIndex)}
      title="Nhập lớp & lịch học từ file"
    >
      {body}
    </ImportWizardFrame>
  );
}

function SummaryBlock({ cells, title }: { cells: readonly ImportSummaryCell[]; title: string }) {
  return (
    <section className="grid min-w-0 gap-2">
      <h2 className="text-body font-semibold text-text-strong">{title}</h2>
      <ImportSummaryStrip cells={cells} label={`Tổng quan ${title}`} />
    </section>
  );
}

interface SheetMappingField<Key extends string> {
  key: Key;
  label: string;
  required: boolean;
}

/** One sheet's mapping: a select per target field, the sheet's issues, then its first rows as read. */
function SheetMapping<Key extends string>({
  fields,
  mapping,
  onChange,
  previewRows,
  sheet,
  sheetLabel,
  validation,
}: {
  fields: readonly SheetMappingField<Key>[];
  mapping: Partial<Record<Key, string | null>>;
  onChange: (key: Key, value: string | null) => void;
  previewRows: number;
  sheet: ClassScheduleImportParsedSheet;
  sheetLabel: string;
  validation: ClassScheduleImportMappingValidation;
}) {
  const shownRows = sheet.rows.slice(0, previewRows);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <Field key={field.key} label={field.label} required={field.required}>
            {(controlProps) => (
              <Select
                {...controlProps}
                onChange={(event) => onChange(field.key, event.target.value === UNASSIGNED ? null : event.target.value)}
                value={mapping[field.key] || UNASSIGNED}
              >
                <option value={UNASSIGNED}>{field.required ? "Chưa chọn cột" : "Không dùng"}</option>
                {sheet.columns.map((column) => (
                  <option key={column.columnKey} value={column.columnKey}>
                    Cột {column.columnKey} · {column.sourceHeader || "chưa có tiêu đề"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
      </div>

      {validation.issues.length > 0 ? (
        <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-body text-warning-ink" role="status">
          <p className="font-semibold">
            Sheet {sheetLabel} còn {formatNumber(validation.issues.length)} vấn đề ánh xạ:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {validation.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.fieldKey ?? issue.columnKey ?? index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-secondary text-text-muted">Sheet {sheetLabel}: đã ánh xạ đủ trường bắt buộc.</p>
      )}

      <DataTableFrame
        body={shownRows.map((row) => (
          <TableRow key={row.rowNumber}>
            <TableCell className="text-text-muted" numeric>
              {row.rowNumber}
            </TableCell>
            {fields.map((field) => {
              const columnKey = mapping[field.key];
              const raw = columnKey ? row.values[columnKey] : null;
              return (
                <TableCell className="whitespace-nowrap" key={field.key}>
                  {formatPreviewCell(field.key, raw)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        caption={`${formatNumber(shownRows.length)} dòng đầu của sheet ${sheetLabel} theo ánh xạ hiện tại`}
        footer={
          <span className="tabular-nums">
            Hiển thị {formatNumber(shownRows.length)}/{formatNumber(sheet.rowCount)} dòng của sheet {sheetLabel}
          </span>
        }
        header={
          <tr>
            <TableHeaderCell numeric>Dòng</TableHeaderCell>
            {fields.map((field) => (
              <TableHeaderCell key={field.key}>{field.label}</TableHeaderCell>
            ))}
          </tr>
        }
      />
    </>
  );
}

/** A raw cell under its target field: weekday in words, times and dates parsed as the payload will be. */
function formatPreviewCell(fieldKey: string, raw: string | number | boolean | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (fieldKey === "weekday") {
    const weekday = parseWeekdayValue(raw);
    return weekday ? formatIsoWeekday(weekday) : `Không rõ thứ (${String(raw)})`;
  }
  if (fieldKey === "start_time" || fieldKey === "end_time") return parseTimeValue(raw)?.slice(0, 5) ?? String(raw);
  if (fieldKey === "effective_from" || fieldKey === "effective_to") {
    const date = parseDateValue(raw);
    return date ? formatIsoDate(date) : String(raw);
  }
  return String(raw);
}
