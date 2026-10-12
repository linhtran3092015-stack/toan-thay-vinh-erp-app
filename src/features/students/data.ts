import "server-only";

import type {
  StudentClassReadModel,
  StudentDataError,
  StudentDataErrorCode,
  StudentDetailResult,
  StudentDirectoryItem,
  StudentDirectoryResult,
  StudentEnrollmentReadModel,
  StudentGuardianReadModel,
  StudentLearningLevel,
  StudentRegisteredMode,
  StudentScheduleReadModel,
} from "@/features/students/read-models";
import {
  STUDENT_ATTENDANCE_WINDOW_DAYS,
  summarizeDirectoryAttendance,
  summarizeDirectoryDebt,
  type DirectoryAttendanceRow,
  type DirectoryPaymentRequestRow,
  type StudentDirectoryMetricColumn,
  type StudentDirectoryMetrics,
} from "@/features/students/student-directory-metrics";
import { addDays, getVietnamToday } from "@/lib/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import type { StudentLifecycleStatus } from "@/types/domain";

type StudentRow =
  Database["public"]["Tables"]["students"]["Row"];
type GuardianRow =
  Database["public"]["Tables"]["guardians"]["Row"];
type StudentGuardianRow =
  Database["public"]["Tables"]["student_guardians"]["Row"];
type EnrollmentRow =
  Database["public"]["Tables"]["student_enrollments"]["Row"];
type ClassRow =
  Database["public"]["Tables"]["classes"]["Row"];
type ScheduleRow =
  Database["public"]["Tables"]["class_schedule_templates"]["Row"];

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

interface StudentReadOptions {
  includeClasses: boolean;
  includeGuardians: boolean;
}

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

const PAGE_SIZE = 500;

const lifecycleStatuses: readonly StudentLifecycleStatus[] = [
  "active",
  "completed",
  "interested",
  "pending_enrollment_confirmation",
  "reserved",
  "resumed",
  "trial_booked",
  "trial_completed",
  "waiting_class",
];

function createDataError(
  code: StudentDataErrorCode,
): StudentDataError {
  const messages: Record<StudentDataErrorCode, string> = {
    classes_query_failed:
      "Không thể tải thông tin lớp học của học viên.",
    enrollments_query_failed:
      "Không thể tải lịch sử xếp lớp của học viên.",
    guardian_links_query_failed:
      "Không thể tải liên kết phụ huynh của học viên.",
    guardians_query_failed:
      "Không thể tải thông tin phụ huynh.",
    invalid_student_data:
      "Dữ liệu học viên có trạng thái không hợp lệ.",
    schedules_query_failed:
      "Không thể tải lịch học của lớp chính.",
    student_not_found:
      "Không tìm thấy hồ sơ học viên.",
    students_query_failed:
      "Không thể tải danh sách học viên.",
  };

  return {
    code,
    message: messages[code],
  };
}

async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const result = await fetchPage(
      from,
      from + PAGE_SIZE - 1,
    );

    if (result.error) {
      return {
        data: null,
        error: result.error,
      };
    }

    const pageRows = result.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return {
        data: rows,
        error: null,
      };
    }

    from += PAGE_SIZE;
  }
}

function normalizeLifecycleStatus(
  value: string,
): StudentLifecycleStatus | null {
  return lifecycleStatuses.includes(
    value as StudentLifecycleStatus,
  )
    ? (value as StudentLifecycleStatus)
    : null;
}

function normalizeLearningLevel(
  value: string | null,
): StudentLearningLevel | null {
  if (value === "A" || value === "B" || value === "CLC") {
    return value;
  }

  return null;
}

function normalizeRegisteredMode(
  value: string | null,
): StudentRegisteredMode | null {
  if (value === "online" || value === "offline") {
    return value;
  }

  return null;
}

function mapClass(
  row: ClassRow | undefined,
): StudentClassReadModel | null {
  if (!row) {
    return null;
  }

  const level = normalizeLearningLevel(row.level);

  if (!level) {
    return null;
  }

  return {
    code: row.code,
    defaultLearningMode: row.default_learning_mode,
    grade: row.grade,
    id: row.id,
    level,
    name: row.name,
    status: row.status,
  };
}

function mapEnrollment(
  row: EnrollmentRow,
  classesById: ReadonlyMap<string, ClassRow>,
): StudentEnrollmentReadModel {
  const registeredMode =
    normalizeRegisteredMode(row.registered_mode);

  if (!registeredMode) {
    throw new Error("INVALID_ENROLLMENT_REGISTERED_MODE");
  }

  return {
    classInfo: mapClass(classesById.get(row.class_id)),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    endReason: row.end_reason,
    id: row.id,
    registeredMode,
    startReason: row.start_reason,
    status: row.status,
    transitionKind: row.transition_kind,
  };
}

function mapGuardian(
  link: StudentGuardianRow,
  guardian: GuardianRow,
): StudentGuardianReadModel {
  return {
    email: guardian.email,
    fullName: guardian.full_name,
    id: guardian.id,
    isPrimary: link.is_primary,
    notes: guardian.notes,
    phone: guardian.phone,
    relationship: link.relationship,
    zalo: guardian.zalo,
  };
}

function mapSchedule(
  row: ScheduleRow,
): StudentScheduleReadModel {
  return {
    componentCode: row.component_code,
    effectiveFrom: row.effective_from,
    endTime: row.end_time,
    id: row.id,
    learningMode: row.learning_mode,
    meetingUrl: row.meeting_url,
    roomName: row.room_name,
    startTime: row.start_time,
    weekday: row.weekday,
  };
}

function sortGuardianLinks(
  left: StudentGuardianRow,
  right: StudentGuardianRow,
): number {
  if (left.is_primary !== right.is_primary) {
    return left.is_primary ? -1 : 1;
  }

  return left.linked_at.localeCompare(right.linked_at);
}

async function getDirectorySupportingRows(
  supabase: SupabaseServerClient,
  options: StudentReadOptions,
) {
  const enrollmentsResult = options.includeClasses
    ? await fetchAllPages<EnrollmentRow>((from, to) =>
        supabase
          .from("student_enrollments")
          .select(
            "id, student_id, class_id, registered_mode, transition_kind, status, effective_from, effective_to, start_reason, end_reason, created_at, updated_at, started_by, ended_by, supersedes_enrollment_id",
          )
          .eq("status", "active")
          .is("effective_to", null)
          .range(from, to),
      )
    : { data: [], error: null };

  if (enrollmentsResult.error) {
    return {
      ok: false as const,
      error: createDataError("enrollments_query_failed"),
    };
  }

  const classesResult = options.includeClasses
    ? await fetchAllPages<ClassRow>((from, to) =>
        supabase
          .from("classes")
          .select(
            "id, code, name, grade, level, default_learning_mode, status, academic_year_id, classin_url, notes, weekly_session_count, created_at, created_by, updated_at",
          )
          .range(from, to),
      )
    : { data: [], error: null };

  if (classesResult.error) {
    return {
      ok: false as const,
      error: createDataError("classes_query_failed"),
    };
  }

  const guardianLinksResult = options.includeGuardians
    ? await fetchAllPages<StudentGuardianRow>((from, to) =>
        supabase
          .from("student_guardians")
          .select(
            "id, student_id, guardian_id, relationship, is_primary, linked_at, linked_by, ended_at, ended_by, end_reason, created_at, updated_at",
          )
          .is("ended_at", null)
          .range(from, to),
      )
    : { data: [], error: null };

  if (guardianLinksResult.error) {
    return {
      ok: false as const,
      error: createDataError("guardian_links_query_failed"),
    };
  }

  const guardiansResult = options.includeGuardians
    ? await fetchAllPages<GuardianRow>((from, to) =>
        supabase
          .from("guardians")
          .select(
            "id, full_name, phone, normalized_phone, zalo, email, notes, created_at, created_by, updated_at",
          )
          .range(from, to),
      )
    : { data: [], error: null };

  if (guardiansResult.error) {
    return {
      ok: false as const,
      error: createDataError("guardians_query_failed"),
    };
  }

  return {
    ok: true as const,
    classes: classesResult.data ?? [],
    enrollments: enrollmentsResult.data ?? [],
    guardianLinks: guardianLinksResult.data ?? [],
    guardians: guardiansResult.data ?? [],
  };
}

export async function getStudentDirectory(
  options: StudentReadOptions,
): Promise<StudentDirectoryResult> {
  const supabase = await createSupabaseServerClient();

  const studentsResult = await fetchAllPages<StudentRow>(
    (from, to) =>
      supabase
        .from("students")
        .select(
          "id, public_code, full_name, nickname, birth_year, current_grade, province_city, learning_level, registered_mode, learning_goal, lifecycle_status, official_start_date, internal_notes, created_at, created_by, updated_at, zalo_group_thread_id, zalo_account_id, zalo_group_name_snapshot, zalo_group_linked_at, zalo_group_linked_by",
        )
        .order("full_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
  );

  if (studentsResult.error) {
    return {
      ok: false,
      error: createDataError("students_query_failed"),
    };
  }

  const supportingRows = await getDirectorySupportingRows(
    supabase,
    options,
  );

  if (!supportingRows.ok) {
    return supportingRows;
  }

  const classesById = new Map(
    supportingRows.classes.map((row) => [row.id, row]),
  );

  const enrollmentByStudentId = new Map<string, EnrollmentRow>();

  for (const enrollment of supportingRows.enrollments) {
    enrollmentByStudentId.set(
      enrollment.student_id,
      enrollment,
    );
  }

  const guardiansById = new Map(
    supportingRows.guardians.map((row) => [row.id, row]),
  );

  const guardianLinksByStudentId = new Map<
    string,
    StudentGuardianRow[]
  >();

  for (const link of supportingRows.guardianLinks) {
    const links =
      guardianLinksByStudentId.get(link.student_id) ?? [];

    links.push(link);
    guardianLinksByStudentId.set(link.student_id, links);
  }

  const students: StudentDirectoryItem[] = [];

  try {
    for (const student of studentsResult.data ?? []) {
      const lifecycleStatus = normalizeLifecycleStatus(
        student.lifecycle_status,
      );

      if (!lifecycleStatus) {
        return {
          ok: false,
          error: createDataError("invalid_student_data"),
        };
      }

      const enrollment =
        enrollmentByStudentId.get(student.id) ?? null;

      const links = (
        guardianLinksByStudentId.get(student.id) ?? []
      ).sort(sortGuardianLinks);

      const primaryLink = links[0] ?? null;
      const primaryGuardianRow = primaryLink
        ? guardiansById.get(primaryLink.guardian_id)
        : undefined;

      students.push({
        activeEnrollment: enrollment
          ? mapEnrollment(enrollment, classesById)
          : null,
        birthYear: student.birth_year,
        currentGrade: student.current_grade,
        fullName: student.full_name,
        id: student.id,
        learningLevel: normalizeLearningLevel(
          student.learning_level,
        ),
        lifecycleStatus,
        nickname: student.nickname,
        primaryGuardian:
          primaryLink && primaryGuardianRow
            ? mapGuardian(primaryLink, primaryGuardianRow)
            : null,
        publicCode: student.public_code,
        registeredMode: normalizeRegisteredMode(
          student.registered_mode,
        ),
      });
    }
  } catch {
    return {
      ok: false,
      error: createDataError("invalid_student_data"),
    };
  }

  return {
    ok: true,
    students,
  };
}

interface StudentDirectoryMetricsOptions {
  /** attendance.view and sessions.view: the window filters on the session date. */
  includeAttendance: boolean;
  /** session_ledger.view */
  includeBalance: boolean;
  /** payments.view */
  includeDebt: boolean;
}

/**
 * Offset pages can shift when rows are inserted mid-read (attendance is marked and
 * payment requests change during class hours), so a row may come back twice.
 */
function uniqueById<Row extends { id: string }>(rows: Row[]): Row[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function loadMetricColumn<Row, T>(
  enabled: boolean,
  fetchRows: () => Promise<PageResult<Row>>,
  summarize: (rows: Row[]) => Record<string, T>,
): Promise<StudentDirectoryMetricColumn<T>> {
  if (!enabled) {
    return { reason: "forbidden", status: "unavailable" };
  }

  try {
    const result = await fetchRows();

    if (result.error) {
      return { reason: "failed", status: "unavailable" };
    }

    return { byStudentId: summarize(result.data ?? []), status: "ready" };
  } catch {
    return { reason: "failed", status: "unavailable" };
  }
}

/**
 * Directory columns for every student at once, from existing read models only:
 * the ledger balance view, open payment requests and recent attendance. Each
 * column loads and fails on its own; the directory itself never waits on them
 * to decide whether it can render.
 */
export async function getStudentDirectoryMetrics(
  options: StudentDirectoryMetricsOptions,
): Promise<StudentDirectoryMetrics> {
  const supabase = await createSupabaseServerClient();
  const today = getVietnamToday();
  const windowStart = addDays(today, 1 - STUDENT_ATTENDANCE_WINDOW_DAYS);

  const [attendanceRate, balanceSessions, outstandingVnd] = await Promise.all([
    loadMetricColumn(
      options.includeAttendance,
      () =>
        fetchAllPages<DirectoryAttendanceRow & { id: string }>((from, to) =>
          supabase
            .from("session_attendance")
            .select("id, student_id, attendance_status, session:class_sessions!inner(session_date)")
            .gte("session.session_date", windowStart)
            .lte("session.session_date", today)
            .order("id", { ascending: true })
            .range(from, to),
        ),
      (rows) => summarizeDirectoryAttendance(uniqueById(rows)),
    ),
    loadMetricColumn(
      options.includeBalance,
      () =>
        fetchAllPages<{ balance_sessions: number | null; student_id: string | null }>((from, to) =>
          supabase
            .from("student_session_balances")
            .select("student_id, balance_sessions")
            .order("student_id", { ascending: true })
            .range(from, to),
        ),
      (rows) => {
        const balances: Record<string, number> = {};

        for (const row of rows) {
          if (row.student_id) balances[row.student_id] = Number(row.balance_sessions ?? 0);
        }

        return balances;
      },
    ),
    loadMetricColumn(
      options.includeDebt,
      () =>
        fetchAllPages<DirectoryPaymentRequestRow & { id: string }>((from, to) =>
          supabase
            .from("student_payment_requests")
            .select("id, student_id, expected_amount_vnd, paid_amount_vnd, status, created_at")
            .in("status", ["pending", "partially_paid"])
            .order("id", { ascending: true })
            .range(from, to),
        ),
      (rows) => summarizeDirectoryDebt(uniqueById(rows)),
    ),
  ]);

  return { attendanceRate, balanceSessions, outstandingVnd };
}

export async function getStudentDetail(
  studentId: string,
  options: StudentReadOptions,
): Promise<StudentDetailResult> {
  const supabase = await createSupabaseServerClient();

  const { data: student, error: studentError } =
    await supabase
      .from("students")
      .select(
        "id, public_code, full_name, nickname, birth_year, current_grade, province_city, learning_level, registered_mode, learning_goal, lifecycle_status, official_start_date, internal_notes, created_at, created_by, updated_at, zalo_group_thread_id, zalo_account_id, zalo_group_name_snapshot, zalo_group_linked_at, zalo_group_linked_by",
      )
      .eq("id", studentId)
      .maybeSingle();

  if (studentError) {
    return {
      ok: false,
      error: createDataError("students_query_failed"),
    };
  }

  if (!student) {
    return {
      ok: false,
      error: createDataError("student_not_found"),
    };
  }

  const lifecycleStatus = normalizeLifecycleStatus(
    student.lifecycle_status,
  );

  if (!lifecycleStatus) {
    return {
      ok: false,
      error: createDataError("invalid_student_data"),
    };
  }

  const enrollmentResult = options.includeClasses
    ? await supabase
        .from("student_enrollments")
        .select(
          "id, student_id, class_id, registered_mode, transition_kind, status, effective_from, effective_to, start_reason, end_reason, created_at, updated_at, started_by, ended_by, supersedes_enrollment_id",
        )
        .eq("student_id", studentId)
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (enrollmentResult.error) {
    return {
      ok: false,
      error: createDataError("enrollments_query_failed"),
    };
  }

  const enrollmentRows = enrollmentResult.data ?? [];
  const classIds = Array.from(
    new Set(enrollmentRows.map((row) => row.class_id)),
  );

  const classResult =
    options.includeClasses && classIds.length > 0
      ? await supabase
          .from("classes")
          .select(
            "id, code, name, grade, level, default_learning_mode, status, academic_year_id, classin_url, notes, weekly_session_count, created_at, created_by, updated_at",
          )
          .in("id", classIds)
      : { data: [], error: null };

  if (classResult.error) {
    return {
      ok: false,
      error: createDataError("classes_query_failed"),
    };
  }

  const classesById = new Map(
    (classResult.data ?? []).map((row) => [row.id, row]),
  );

  let enrollmentHistory: StudentEnrollmentReadModel[];

  try {
    enrollmentHistory = enrollmentRows.map((row) =>
      mapEnrollment(row, classesById),
    );
  } catch {
    return {
      ok: false,
      error: createDataError("invalid_student_data"),
    };
  }

  const activeEnrollment =
    enrollmentHistory.find(
      (row) =>
        row.status === "active" &&
        row.effectiveTo === null,
    ) ?? null;

  const activeClassId =
    enrollmentRows.find(
      (row) =>
        row.status === "active" &&
        row.effective_to === null,
    )?.class_id ?? null;

  const scheduleResult =
    options.includeClasses && activeClassId
      ? await supabase
          .from("class_schedule_templates")
          .select(
            "id, class_id, component_code, weekday, start_time, end_time, learning_mode, room_name, meeting_url, effective_from, effective_to, is_active, supersedes_schedule_template_id, ended_by, end_reason, created_at, created_by, updated_at",
          )
          .eq("class_id", activeClassId)
          .eq("is_active", true)
          .order("weekday", { ascending: true })
          .order("start_time", { ascending: true })
      : { data: [], error: null };

  if (scheduleResult.error) {
    return {
      ok: false,
      error: createDataError("schedules_query_failed"),
    };
  }

  const guardianLinksResult = options.includeGuardians
    ? await supabase
        .from("student_guardians")
        .select(
          "id, student_id, guardian_id, relationship, is_primary, linked_at, linked_by, ended_at, ended_by, end_reason, created_at, updated_at",
        )
        .eq("student_id", studentId)
        .is("ended_at", null)
        .order("is_primary", { ascending: false })
        .order("linked_at", { ascending: true })
    : { data: [], error: null };

  if (guardianLinksResult.error) {
    return {
      ok: false,
      error: createDataError("guardian_links_query_failed"),
    };
  }

  const guardianLinks =
    guardianLinksResult.data ?? [];

  const guardianIds = guardianLinks.map(
    (link) => link.guardian_id,
  );

  const guardiansResult =
    options.includeGuardians && guardianIds.length > 0
      ? await supabase
          .from("guardians")
          .select(
            "id, full_name, phone, normalized_phone, zalo, email, notes, created_at, created_by, updated_at",
          )
          .in("id", guardianIds)
      : { data: [], error: null };

  if (guardiansResult.error) {
    return {
      ok: false,
      error: createDataError("guardians_query_failed"),
    };
  }

  const guardiansById = new Map(
    (guardiansResult.data ?? []).map((row) => [row.id, row]),
  );

  const guardians = guardianLinks
    .map((link) => {
      const guardian = guardiansById.get(link.guardian_id);

      return guardian
        ? mapGuardian(link, guardian)
        : null;
    })
    .filter(
      (
        guardian,
      ): guardian is StudentGuardianReadModel =>
        guardian !== null,
    );

  const activeSchedules: StudentScheduleReadModel[] = (
    scheduleResult.data ?? []
  ).map(mapSchedule);

  return {
    ok: true,
    detail: {
      activeEnrollment,
      activeSchedules,
      birthYear: student.birth_year,
      currentGrade: student.current_grade,
      enrollmentHistory,
      fullName: student.full_name,
      guardians,
      id: student.id,
      internalNotes: student.internal_notes,
      learningGoal: student.learning_goal,
      learningLevel: normalizeLearningLevel(
        student.learning_level,
      ),
      lifecycleStatus,
      nickname: student.nickname,
      officialStartDate: student.official_start_date,
      primaryGuardian: guardians[0] ?? null,
      provinceCity: student.province_city,
      publicCode: student.public_code,
      registeredMode: normalizeRegisteredMode(
        student.registered_mode,
      ),
    },
  };
}
