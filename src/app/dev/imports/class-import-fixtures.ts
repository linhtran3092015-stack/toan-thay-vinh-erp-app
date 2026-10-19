import type {
  ClassScheduleImportBatchDetail,
  ClassScheduleImportBatchRecord,
  ClassScheduleImportCellValue,
  ClassScheduleImportParsedSheet,
  ClassScheduleImportParsedWorkbook,
  ClassScheduleImportRowClassification,
  ClassScheduleImportSummaryCount,
  DryRunClassResultRow,
  DryRunClassScheduleImportResult,
  DryRunScheduleResultRow,
} from "@/features/imports/classes/types";

import type { ClassBatchImportsPreviewState } from "./imports-preview-params";

/*
 * Fixtures of /dev/imports `view=classes` and `view=class-batch` (design
 * 17c) on the fixed clock 2026-10-19: one workbook read in the browser (with
 * and without broken rows), the matching dry-run results, and a batch in each
 * status. Ids are fixed fake uuids; nothing here comes from a database.
 */

const YEAR = { code: "2026-2027", id: "a7000000-0000-4000-8000-000000002627", name: "Năm học 2026-2027", status: "active" };
const OWNER_ID = "d0000000-0000-4000-8000-000000000001";
const SHA_CLEAN = "5f2c9a7e1b4d3c6a8e0f9b2d4c6a8e1f3b5d7c9a0e2f4b6d8c1a3e5f7b9d0c2a";
const SHA_WITH_ERRORS = "9e1d3c5b7a9f0e2d4c6b8a1f3e5d7c9b0a2f4e6d8c1b3a5f7e9d0c2b4a6f8e1d";
const EXISTING_CLASS_IDS: Readonly<Record<string, string>> = {
  "10A1": "c1a55000-0000-4000-8000-000000000010",
  "9A1": "c1a55000-0000-4000-8000-000000000009",
};

type ClassSeed = {
  code: string;
  name: string;
  grade: number;
  level: string;
  weekly: number;
  mode: string;
  status: string;
  classification: ClassScheduleImportRowClassification;
  message: string;
};

type ScheduleSeed = {
  classCode: string;
  component: string;
  weekday: number;
  start: string;
  end: string;
  mode: string;
  room: string | null;
  url: string | null;
  from: string;
  classification: ClassScheduleImportRowClassification;
  message: string;
};

const CLASS_SEEDS: readonly ClassSeed[] = [
  { classification: "new", code: "6A1", grade: 6, level: "A", message: "Sẽ tạo mới lớp học 6A1.", mode: "hybrid", name: "Toán 6 Nâng cao A1", status: "active", weekly: 2 },
  { classification: "new", code: "6A2", grade: 6, level: "B", message: "Sẽ tạo mới lớp học 6A2.", mode: "offline", name: "Toán 6 Cơ bản A2", status: "active", weekly: 2 },
  { classification: "new", code: "7A1", grade: 7, level: "A", message: "Sẽ tạo mới lớp học 7A1.", mode: "hybrid", name: "Toán 7 Nâng cao A1", status: "active", weekly: 3 },
  { classification: "new", code: "8A1", grade: 8, level: "A", message: "Sẽ tạo mới lớp học 8A1.", mode: "online", name: "Toán 8 Trực tuyến", status: "draft", weekly: 2 },
  {
    classification: "existing_matching",
    code: "9A1",
    grade: 9,
    level: "A",
    message: "Lớp học 9A1 đã tồn tại và khớp dữ liệu.",
    mode: "hybrid",
    name: "Toán 9 Ôn thi vào 10",
    status: "active",
    weekly: 3,
  },
  {
    classification: "existing_matching",
    code: "10A1",
    grade: 10,
    level: "A",
    message: "Lớp học 10A1 đã tồn tại và khớp dữ liệu.",
    mode: "hybrid",
    name: "Toán 10 Nâng cao",
    status: "active",
    weekly: 2,
  },
];

const SCHEDULE_SEEDS: readonly ScheduleSeed[] = [
  { classCode: "6A1", classification: "new", component: "MAIN", end: "19:30", from: "2026-11-02", message: "Sẽ tạo mới lịch học.", mode: "hybrid", room: "P.201", start: "18:00", url: null, weekday: 2 },
  { classCode: "6A1", classification: "new", component: "MAIN", end: "19:30", from: "2026-11-02", message: "Sẽ tạo mới lịch học.", mode: "hybrid", room: "P.201", start: "18:00", url: null, weekday: 5 },
  { classCode: "6A2", classification: "new", component: "MAIN", end: "19:00", from: "2026-11-02", message: "Sẽ tạo mới lịch học.", mode: "offline", room: "P.102", start: "17:30", url: null, weekday: 1 },
  { classCode: "6A2", classification: "new", component: "MAIN", end: "19:00", from: "2026-11-02", message: "Sẽ tạo mới lịch học.", mode: "offline", room: "P.102", start: "17:30", url: null, weekday: 4 },
  { classCode: "7A1", classification: "new", component: "MAIN", end: "21:00", from: "2026-11-02", message: "Sẽ tạo mới lịch học.", mode: "hybrid", room: "P.203", start: "19:30", url: null, weekday: 3 },
  { classCode: "7A1", classification: "new", component: "MAIN", end: "09:30", from: "2026-11-02", message: "Sẽ tạo mới lịch học.", mode: "hybrid", room: "P.203", start: "08:00", url: null, weekday: 6 },
  { classCode: "7A1", classification: "new", component: "LUYEN_DE", end: "09:30", from: "2026-11-08", message: "Sẽ tạo mới lịch học.", mode: "hybrid", room: "P.203", start: "08:00", url: null, weekday: 7 },
  {
    classCode: "8A1",
    classification: "new",
    component: "MAIN",
    end: "21:00",
    from: "2026-11-03",
    message: "Sẽ tạo mới lịch học.",
    mode: "online",
    room: null,
    start: "19:30",
    url: "https://classin.example/8a1",
    weekday: 2,
  },
  { classCode: "9A1", classification: "existing_matching", component: "MAIN", end: "19:30", from: "2026-09-07", message: "Lịch học đã tồn tại và khớp dữ liệu.", mode: "hybrid", room: "P.301", start: "18:00", url: null, weekday: 1 },
  { classCode: "10A1", classification: "existing_matching", component: "MAIN", end: "21:00", from: "2026-09-07", message: "Lịch học đã tồn tại và khớp dữ liệu.", mode: "hybrid", room: "P.302", start: "19:30", url: null, weekday: 3 },
];

/** The broken file: 10A1 differs from the class on record, 6A1 is listed twice, and one schedule slot repeats. */
function withErrors() {
  const classes: ClassSeed[] = CLASS_SEEDS.map((seed) =>
    seed.code === "10A1"
      ? {
          ...seed,
          classification: "existing_conflict",
          level: "B",
          message: "Lớp học 10A1 đã tồn tại nhưng khác dữ liệu trong file (trình độ). Không thể đè dữ liệu tự động.",
        }
      : seed,
  );
  classes.push({
    classification: "invalid",
    code: "6A1",
    grade: 6,
    level: "A",
    message: "Mã lớp 6A1 bị lặp lại trong file Excel.",
    mode: "hybrid",
    name: "Toán 6 Nâng cao A1 (lặp)",
    status: "active",
    weekly: 2,
  });
  const schedules: ScheduleSeed[] = SCHEDULE_SEEDS.map((seed) =>
    seed.classCode === "10A1"
      ? {
          ...seed,
          classification: "existing_conflict",
          end: "21:30",
          message: "Lịch học của lớp 10A1 cùng thành phần và thứ đã tồn tại với giờ học khác. Không thể đè dữ liệu tự động.",
        }
      : seed,
  );
  schedules.push({
    classCode: "6A2",
    classification: "invalid",
    component: "MAIN",
    end: "19:00",
    from: "2026-11-02",
    message: "Lịch học của lớp 6A2 (thành phần MAIN, cùng thứ) bị lặp lại trong file Excel.",
    mode: "offline",
    room: "P.102",
    start: "17:30",
    url: null,
    weekday: 1,
  });
  return { classes, schedules };
}

function sheet(sheetName: string, headers: readonly string[], rows: readonly ClassScheduleImportCellValue[][]): ClassScheduleImportParsedSheet {
  const columns = headers.map((header, index) => ({
    columnIndex: index + 1,
    columnKey: String.fromCharCode(65 + index),
    sourceHeader: header,
  }));
  return {
    columns,
    rowCount: rows.length,
    rows: rows.map((cells, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(columns.map((column, cellIndex) => [column.columnKey, cells[cellIndex] ?? null])),
    })),
    sheetName,
  };
}

const CLASS_HEADERS = ["Mã năm học *", "Mã lớp *", "Tên lớp *", "Khối *", "Trình độ *", "Số buổi / tuần *", "Hình thức mặc định *", "Trạng thái *"];
const SCHEDULE_HEADERS = [
  "Mã lớp *",
  "Mã thành phần *",
  "Thứ *",
  "Giờ bắt đầu *",
  "Giờ kết thúc *",
  "Hình thức *",
  "Phòng học",
  "Link học",
  "Hiệu lực từ *",
  "Hiệu lực đến",
];

function workbook(classes: readonly ClassSeed[], schedules: readonly ScheduleSeed[], filename: string, sha256: string): ClassScheduleImportParsedWorkbook {
  return {
    classesSheet: sheet(
      "Classes",
      CLASS_HEADERS,
      classes.map((seed) => [YEAR.code, seed.code, seed.name, seed.grade, seed.level, seed.weekly, seed.mode, seed.status]),
    ),
    schedulesSheet: sheet(
      "Schedules",
      SCHEDULE_HEADERS,
      schedules.map((seed) => [seed.classCode, seed.component, seed.weekday, seed.start, seed.end, seed.mode, seed.room, seed.url, seed.from, null]),
    ),
    sourceFilename: filename,
    sourceSha256: sha256,
  };
}

function summarize(rows: readonly { classification: ClassScheduleImportRowClassification }[]): ClassScheduleImportSummaryCount {
  const count = (classification: ClassScheduleImportRowClassification) => rows.filter((row) => row.classification === classification).length;
  return {
    existing_conflict: count("existing_conflict"),
    existing_matching: count("existing_matching"),
    invalid: count("invalid"),
    new: count("new"),
    total: rows.length,
  };
}

function classResultRows(classes: readonly ClassSeed[]): DryRunClassResultRow[] {
  return classes.map((seed, index) => ({
    academic_year_code: YEAR.code,
    class_code: seed.code,
    class_name: seed.name,
    classification: seed.classification,
    default_learning_mode: seed.mode,
    grade: seed.grade,
    level: seed.level,
    resolved_academic_year_id: YEAR.id,
    resolved_class_id: seed.classification === "invalid" ? null : (EXISTING_CLASS_IDS[seed.code] ?? null),
    source_row_number: index + 2,
    status: seed.status,
    validation_code:
      seed.classification === "new"
        ? "CLASS_NEW"
        : seed.classification === "existing_matching"
          ? "CLASS_EXISTING_MATCHING"
          : seed.classification === "existing_conflict"
            ? "CLASS_EXISTING_CONFLICT"
            : "DUPLICATE_CLASS_CODE_IN_FILE",
    validation_message: seed.message,
    weekly_session_count: seed.weekly,
  }));
}

function scheduleResultRows(schedules: readonly ScheduleSeed[]): DryRunScheduleResultRow[] {
  return schedules.map((seed, index) => ({
    class_code: seed.classCode,
    classification: seed.classification,
    component_code: seed.component,
    effective_from: seed.from,
    effective_to: null,
    end_time: `${seed.end}:00`,
    learning_mode: seed.mode,
    meeting_url: seed.url,
    resolved_class_id: EXISTING_CLASS_IDS[seed.classCode] ?? null,
    resolved_schedule_template_id: seed.classification === "existing_matching" ? `5c4ed000-0000-4000-8000-0000000000${10 + index}` : null,
    room_name: seed.room,
    source_row_number: index + 2,
    start_time: `${seed.start}:00`,
    validation_code:
      seed.classification === "new"
        ? "SCHEDULE_NEW"
        : seed.classification === "existing_matching"
          ? "SCHEDULE_EXISTING_MATCHING"
          : seed.classification === "existing_conflict"
            ? "SCHEDULE_EXISTING_CONFLICT"
            : "DUPLICATE_SCHEDULE_SLOT_IN_FILE",
    validation_message: seed.message,
    weekday: seed.weekday,
  }));
}

function dryRun(classes: readonly ClassSeed[], schedules: readonly ScheduleSeed[]): DryRunClassScheduleImportResult {
  const classRows = classResultRows(classes);
  const scheduleRows = scheduleResultRows(schedules);
  return {
    academic_year: YEAR,
    class_rows: classRows,
    class_summary: summarize(classRows),
    schedule_rows: scheduleRows,
    schedule_summary: summarize(scheduleRows),
  };
}

const broken = withErrors();

/** The clean file, as `parseClassScheduleImportWorkbook` would return it. */
export const CLASS_IMPORT_PREVIEW_WORKBOOK = workbook(CLASS_SEEDS, SCHEDULE_SEEDS, "lop-lich-hoc-2026-2027.xlsx", SHA_CLEAN);
/** The same file with a duplicate class code, a changed class and a repeated slot. */
export const CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS = workbook(broken.classes, broken.schedules, "lop-lich-hoc-2026-2027-ban-cu.xlsx", SHA_WITH_ERRORS);
/** Dry-run of the clean file: 4 + 8 new, 2 + 2 already there and matching. */
export const CLASS_IMPORT_PREVIEW_DRY_RUN = dryRun(CLASS_SEEDS, SCHEDULE_SEEDS);
/** Dry-run of the broken file: 1 conflict + 1 invalid in each sheet. */
export const CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS = dryRun(broken.classes, broken.schedules);

/** Fixed id of the preview batch (never a real batch). */
export const CLASS_IMPORT_PREVIEW_BATCH_ID = "b7c40000-0000-4000-8000-000000000001";

function batchRecord(result: DryRunClassScheduleImportResult, overrides: Partial<ClassScheduleImportBatchRecord>): ClassScheduleImportBatchRecord {
  const blocked = result.class_summary.existing_conflict + result.class_summary.invalid + result.schedule_summary.existing_conflict + result.schedule_summary.invalid;
  return {
    academic_year_code: YEAR.code,
    academic_year_id: YEAR.id,
    class_conflict_count: result.class_summary.existing_conflict,
    class_invalid_count: result.class_summary.invalid,
    class_matching_count: result.class_summary.existing_matching,
    class_new_count: result.class_summary.new,
    class_row_count: result.class_summary.total,
    committed_at: null,
    committed_by: null,
    // 09:40 on 19/10/2026 in Vietnam.
    created_at: "2026-10-19T02:40:00.000Z",
    created_by: OWNER_ID,
    id: CLASS_IMPORT_PREVIEW_BATCH_ID,
    metadata: {},
    reason: "Nhập lớp và lịch học đầu năm học 2026-2027",
    schedule_conflict_count: result.schedule_summary.existing_conflict,
    schedule_invalid_count: result.schedule_summary.invalid,
    schedule_matching_count: result.schedule_summary.existing_matching,
    schedule_new_count: result.schedule_summary.new,
    schedule_row_count: result.schedule_summary.total,
    source_filename: blocked > 0 ? CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS.sourceFilename : CLASS_IMPORT_PREVIEW_WORKBOOK.sourceFilename,
    source_sha256: blocked > 0 ? SHA_WITH_ERRORS : SHA_CLEAN,
    status: blocked > 0 ? "previewed" : "ready_to_commit",
    ...overrides,
  };
}

function batchDetail(result: DryRunClassScheduleImportResult, committed: boolean): ClassScheduleImportBatchDetail {
  const batch = batchRecord(
    result,
    committed
      ? // 10:15 on 19/10/2026 in Vietnam.
        { committed_at: "2026-10-19T03:15:00.000Z", committed_by: OWNER_ID, status: "committed" }
      : {},
  );
  return {
    batch,
    classRows: result.class_rows.map((row, index) => ({
      ...row,
      batch_id: batch.id,
      classification: committed ? "committed" : row.classification,
      created_at: batch.created_at,
      id: `c1a5e000-0000-4000-8000-0000000000${10 + index}`,
      resolved_class_id: committed ? (row.resolved_class_id ?? `c1a55000-0000-4000-8000-0000000001${10 + index}`) : row.resolved_class_id,
    })),
    scheduleRows: result.schedule_rows.map((row, index) => ({
      ...row,
      batch_id: batch.id,
      classification: committed ? "committed" : row.classification,
      created_at: batch.created_at,
      id: `5c4e0000-0000-4000-8000-0000000000${10 + index}`,
    })),
  };
}

/** `ready` = ready_to_commit (clean file), `committed` = after the commit, `previewed` = the broken file's batch. */
export function getClassBatchPreviewDetail(state: ClassBatchImportsPreviewState): ClassScheduleImportBatchDetail {
  if (state === "committed") return batchDetail(CLASS_IMPORT_PREVIEW_DRY_RUN, true);
  if (state === "previewed") return batchDetail(CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS, false);
  return batchDetail(CLASS_IMPORT_PREVIEW_DRY_RUN, false);
}
