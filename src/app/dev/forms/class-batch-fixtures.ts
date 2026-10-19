import type { ClassManagementActionState, ClassWriteFields } from "@/features/classes/forms/class-action-types";
import type { AcademicYearManagementItem, ClassDetailReadModel } from "@/features/classes/read-models";
import type { BatchClassOption, BatchScheduleOption, ExistingSessionSnapshot } from "@/features/sessions/batch-calculation";
import type { BatchWorkspaceInitialSettings } from "@/features/sessions/components/batch-session-create-workspace";

import type { BatchFormsPreviewState } from "./forms-preview-params";

/*
 * Fixtures of the /dev/forms class form and batch previews (design 17b) on
 * the fixed clock FORMS_PREVIEW_TODAY = 2026-10-19 (a Monday). Shapes are the
 * loaders' own: open academic years only, active classes only, active
 * templates, non-cancelled existing sessions (the batch loader never returns
 * cancelled ones, so none appear here).
 */

// ---------------------------------------------------------------- class form

const classCounts = { active: 0, archived: 0, closed: 0, draft: 0, total: 0 };

/** Open years as /classes/new passes them (draft + active), the current one first. */
export const PREVIEW_ACADEMIC_YEARS: AcademicYearManagementItem[] = [
  {
    classCounts: { ...classCounts, active: 18, draft: 2, total: 20 },
    code: "2026-2027",
    endsOn: "2027-05-31",
    id: "ay-preview-2026",
    isCurrent: true,
    name: "Năm học 2026–2027",
    startsOn: "2026-08-15",
    status: "active",
  },
  {
    classCounts,
    code: "2027-2028",
    endsOn: "2028-05-31",
    id: "ay-preview-2027",
    isCurrent: false,
    name: "Năm học 2027–2028",
    startsOn: "2027-08-15",
    status: "draft",
  },
];

/**
 * The class /classes/cls-preview/edit loads: a draft class, so the "Lịch tuần"
 * steps never link into the live batch tool from the preview.
 */
export const PREVIEW_CLASS_DETAIL: ClassDetailReadModel = {
  academicYear: PREVIEW_ACADEMIC_YEARS[0],
  activeScheduleCount: 0,
  activeStudentCount: null,
  classinUrl: null,
  code: "6B1",
  componentClasses: [],
  defaultLearningMode: "offline",
  grade: 6,
  id: "cls-preview",
  level: "B",
  name: "Toán 6B chiều thứ 3 – thứ 6",
  notes: "Lớp mở thêm cho học sinh khối 6 học buổi chiều.",
  schedules: [],
  status: "draft",
  weeklySessionCount: 2,
};

/** `state=error` on /classes/new: a code the server's validation rejects, answered field by field. */
export const PREVIEW_CLASS_CREATE_ERROR: { state: ClassManagementActionState; values: Partial<ClassWriteFields> } = {
  state: {
    fieldErrors: { code: ["Mã lớp chỉ gồm chữ in hoa, số và các dấu . _ -."] },
    message: "Vui lòng kiểm tra lại thông tin lớp học.",
    status: "error",
  },
  values: { code: "6B 2", defaultLearningMode: "offline", grade: 6, level: "B", name: "Toán 6B tối thứ 2 – thứ 5" },
};

/** `state=error` on the edit form: the database refuses an identity change of a class already in use. */
export const PREVIEW_CLASS_EDIT_ERROR: { reason: string; state: ClassManagementActionState; values: Partial<ClassWriteFields> } = {
  reason: "Chuyển lớp sang khối 7 theo đề nghị của phụ huynh.",
  state: {
    message: "Không thể đổi năm học, mã lớp, khối hoặc trình độ sau khi lớp đã được sử dụng.",
    status: "error",
  },
  values: { grade: 7 },
};

// --------------------------------------------------------------------- batch

export const PREVIEW_BATCH_CLASSES: BatchClassOption[] = [
  { academicYearId: "ay-preview-2026", code: "6B1", defaultLearningMode: "offline", grade: 6, id: "cls-6b1", level: "B", name: "Toán 6B chiều thứ 3 – thứ 6" },
  { academicYearId: "ay-preview-2026", code: "9A2", defaultLearningMode: "hybrid", grade: 9, id: "cls-9a2", level: "A", name: "Toán 9A2 ôn thi vào 10" },
  { academicYearId: "ay-preview-2026", code: "12LT", defaultLearningMode: "online", grade: 12, id: "cls-12lt", level: "CLC", name: "Luyện thi THPT 12" },
];

function template(
  classId: string,
  id: string,
  weekday: number,
  times: [string, string],
  extra: Partial<BatchScheduleOption> = {},
): BatchScheduleOption {
  return {
    classId,
    componentCode: null,
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    endTime: `${times[1]}:00`,
    id,
    learningMode: "offline",
    meetingUrl: null,
    roomName: null,
    startTime: `${times[0]}:00`,
    weekday,
    ...extra,
  };
}

const schedulesByClass: Record<string, BatchScheduleOption[]> = {
  "cls-12lt": [1, 3, 5, 7].map((weekday) =>
    template("cls-12lt", `tpl-12lt-${weekday}`, weekday, ["19:00", "21:00"], { learningMode: "online", meetingUrl: "https://classin.example/12lt" }),
  ),
  "cls-6b1": [
    template("cls-6b1", "tpl-6b1-tue", 2, ["17:30", "19:30"], { roomName: "P.102" }),
    // Imported with a later start: Friday sessions before 26/10 fall outside its window.
    template("cls-6b1", "tpl-6b1-fri", 5, ["17:30", "19:30"], { effectiveFrom: "2026-10-26", roomName: "P.102" }),
  ],
  "cls-9a2": [
    template("cls-9a2", "tpl-9a2-mon", 1, ["18:00", "19:30"], { learningMode: "hybrid", roomName: "P.201" }),
    template("cls-9a2", "tpl-9a2-thu", 4, ["18:00", "19:30"], { learningMode: "hybrid", roomName: "P.201" }),
  ],
};

function session(sessionDate: string, startTime: string, endTime: string, scheduleTemplateId: string | null): ExistingSessionSnapshot {
  return { endTime: `${endTime}:00`, scheduleTemplateId, sessionDate, startTime: `${startTime}:00` };
}

const tuesdays6b1 = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"];

const existingByClass: Record<string, ExistingSessionSnapshot[]> = {
  "cls-12lt": ["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-11", "2026-10-12", "2026-10-14", "2026-10-16", "2026-10-18"].map((date, index) =>
    session(date, "19:00", "21:00", `tpl-12lt-${[1, 3, 5, 7][index % 4]}`),
  ),
  "cls-6b1": [
    ...tuesdays6b1.map((date) => session(date, "17:30", "19:30", "tpl-6b1-tue")),
    // Created ahead of time: the batch shows these Tuesdays as "đã có".
    session("2026-11-03", "17:30", "19:30", "tpl-6b1-tue"),
    session("2026-12-08", "17:30", "19:30", "tpl-6b1-tue"),
  ],
  "cls-9a2": ["2026-10-01", "2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15"].map((date) =>
    session(date, "18:00", "19:30", date === "2026-10-05" || date === "2026-10-12" ? "tpl-9a2-mon" : "tpl-9a2-thu"),
  ),
};

/** The loader's answer for one class (`getBatchSessionCreationContext`). */
export function getPreviewBatchContext(classId: string) {
  const existingSessions = [...(existingByClass[classId] ?? [])].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  return {
    classes: PREVIEW_BATCH_CLASSES,
    existingSessionCount: existingSessions.length,
    existingSessions,
    schedules: schedulesByClass[classId] ?? [],
  };
}

/** The class and starting form of each batch preview state. */
export const PREVIEW_BATCH_STATES: Record<BatchFormsPreviewState, { classId: string; settings?: BatchWorkspaceInitialSettings }> = {
  // Count mode from today: one out-of-window Friday, one Tuesday already created.
  default: { classId: "cls-6b1" },
  // Teachers' Day and New Year's Day fall on the class's Friday slot.
  holidays: {
    classId: "cls-6b1",
    settings: { endDate: "2027-01-31", holidays: ["2026-11-20", "2027-01-01"], rangeMode: "date_range", startDate: "2026-11-02" },
  },
  // Four evenings a week until the end of the year: more than one request may carry.
  capped: { classId: "cls-12lt", settings: { endDate: "2027-04-30", rangeMode: "date_range" } },
  // Every template unticked: nothing to preview.
  empty: { classId: "cls-6b1", settings: { selectedTemplateIds: [] } },
};
