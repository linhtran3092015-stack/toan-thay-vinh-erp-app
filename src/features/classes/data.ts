import "server-only";

import type {
  AcademicYearReadModel,
  ClassDataError,
  ClassDataErrorCode,
  ClassDetailResult,
  ClassDirectoryItem,
  ClassDirectoryResult,
  ClassLearningLevel,
  ClassLearningMode,
  ClassComponentRef,
  ClassScheduleReadModel,
} from "@/features/classes/read-models";
import { getVietnamToday } from "@/lib/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type AcademicYearRow =
  Database["public"]["Tables"]["academic_years"]["Row"];
type ClassRow =
  Database["public"]["Tables"]["classes"]["Row"];
type ScheduleRow =
  Database["public"]["Tables"]["class_schedule_templates"]["Row"];
type EnrollmentRow =
  Database["public"]["Tables"]["student_enrollments"]["Row"];

interface ClassReadOptions {
  includeStudentCounts: boolean;
}

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

const PAGE_SIZE = 500;

function createClassDataError(
  code: ClassDataErrorCode,
): ClassDataError {
  const messages: Record<ClassDataErrorCode, string> = {
    academic_years_query_failed:
      "Không thể tải thông tin năm học.",
    class_not_found:
      "Không tìm thấy lớp học.",
    classes_query_failed:
      "Không thể tải danh sách lớp học.",
    component_links_query_failed:
      "Không thể tải các lớp thành phần của lớp ghép.",
    enrollments_query_failed:
      "Không thể tải số lượng học viên của lớp.",
    invalid_class_data:
      "Dữ liệu lớp học có giá trị không hợp lệ.",
    schedules_query_failed:
      "Không thể tải lịch học của lớp.",
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
  ) => Promise<PageResult<T>>,
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

function normalizeLevel(
  value: string,
): ClassLearningLevel | null {
  if (value === "A" || value === "B" || value === "CLC") {
    return value;
  }

  return null;
}

function normalizeMode(
  value: string,
): ClassLearningMode | null {
  if (
    value === "hybrid" ||
    value === "offline" ||
    value === "online"
  ) {
    return value;
  }

  return null;
}

function mapAcademicYear(
  row: AcademicYearRow | undefined,
): AcademicYearReadModel | null {
  if (!row) {
    return null;
  }

  return {
    code: row.code,
    endsOn: row.ends_on,
    id: row.id,
    isCurrent: row.is_current,
    name: row.name,
    startsOn: row.starts_on,
    status: row.status,
  };
}

function mapSchedule(
  row: ScheduleRow,
): ClassScheduleReadModel {
  const learningMode = normalizeMode(row.learning_mode);

  if (!learningMode) {
    throw new Error("INVALID_SCHEDULE_LEARNING_MODE");
  }

  return {
    componentCode: row.component_code,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    endReason: row.end_reason,
    endTime: row.end_time,
    id: row.id,
    isActive: row.is_active,
    learningMode,
    meetingUrl: row.meeting_url,
    roomName: row.room_name,
    startTime: row.start_time,
    weekday: row.weekday,
  };
}

function mapClass(
  row: ClassRow,
  academicYearsById: ReadonlyMap<
    string,
    AcademicYearRow
  >,
  activeScheduleCount: number,
  activeStudentCount: number | null,
): ClassDirectoryItem {
  const level = normalizeLevel(row.level);
  const defaultLearningMode = normalizeMode(
    row.default_learning_mode,
  );

  if (!level || !defaultLearningMode) {
    throw new Error("INVALID_CLASS_DATA");
  }

  return {
    academicYear: mapAcademicYear(
      academicYearsById.get(row.academic_year_id),
    ),
    activeScheduleCount,
    activeStudentCount,
    code: row.code,
    defaultLearningMode,
    grade: row.grade,
    id: row.id,
    level,
    name: row.name,
    notes: row.notes,
    status: row.status,
    weeklySessionCount: row.weekly_session_count,
  };
}

export async function getClassDirectory(
  options: ClassReadOptions,
): Promise<ClassDirectoryResult> {
  const supabase = await createSupabaseServerClient();

  const [
    classesResult,
    academicYearsResult,
    schedulesResult,
  ] = await Promise.all([
    fetchAllPages<ClassRow>(async (from, to) =>
      supabase
        .from("classes")
        .select("*")
        .order("grade", { ascending: true })
        .order("code", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<AcademicYearRow>(async (from, to) =>
      supabase
        .from("academic_years")
        .select("*")
        .order("starts_on", { ascending: false })
        .range(from, to),
    ),
    fetchAllPages<ScheduleRow>(async (from, to) =>
      supabase
        .from("class_schedule_templates")
        .select("*")
        .eq("is_active", true)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (classesResult.error) {
    return {
      ok: false,
      error: createClassDataError(
        "classes_query_failed",
      ),
    };
  }

  if (academicYearsResult.error) {
    return {
      ok: false,
      error: createClassDataError(
        "academic_years_query_failed",
      ),
    };
  }

  if (schedulesResult.error) {
    return {
      ok: false,
      error: createClassDataError(
        "schedules_query_failed",
      ),
    };
  }

  let enrollmentsResult: PageResult<EnrollmentRow> = {
    data: [],
    error: null,
  };

  if (options.includeStudentCounts) {
    enrollmentsResult =
      await fetchAllPages<EnrollmentRow>(
        async (from, to) =>
          supabase
            .from("student_enrollments")
            .select("*")
            .eq("status", "active")
            .is("effective_to", null)
            .range(from, to),
      );

    if (enrollmentsResult.error) {
      return {
        ok: false,
        error: createClassDataError(
          "enrollments_query_failed",
        ),
      };
    }
  }

  const academicYearsById = new Map(
    (academicYearsResult.data ?? []).map((row) => [
      row.id,
      row,
    ]),
  );

  const scheduleCountByClassId = new Map<
    string,
    number
  >();

  for (const schedule of schedulesResult.data ?? []) {
    scheduleCountByClassId.set(
      schedule.class_id,
      (scheduleCountByClassId.get(schedule.class_id) ??
        0) + 1,
    );
  }

  const studentCountByClassId = new Map<string, number>();

  for (const enrollment of enrollmentsResult.data ?? []) {
    studentCountByClassId.set(
      enrollment.class_id,
      (studentCountByClassId.get(enrollment.class_id) ??
        0) + 1,
    );
  }

  try {
    const classes = (classesResult.data ?? []).map(
      (classRow) =>
        mapClass(
          classRow,
          academicYearsById,
          scheduleCountByClassId.get(classRow.id) ?? 0,
          options.includeStudentCounts
            ? studentCountByClassId.get(classRow.id) ?? 0
            : null,
        ),
    );

    return {
      ok: true,
      classes,
    };
  } catch {
    return {
      ok: false,
      error: createClassDataError(
        "invalid_class_data",
      ),
    };
  }
}

export async function getClassDetail(
  classId: string,
  options: ClassReadOptions,
): Promise<ClassDetailResult> {
  const supabase = await createSupabaseServerClient();

  const { data: classRow, error: classError } =
    await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .maybeSingle();

  if (classError) {
    return {
      ok: false,
      error: createClassDataError(
        "classes_query_failed",
      ),
    };
  }

  if (!classRow) {
    return {
      ok: false,
      error: createClassDataError("class_not_found"),
    };
  }

  const today = getVietnamToday();
  const [academicYearResult, schedulesResult, componentLinksResult] =
    await Promise.all([
      supabase
        .from("academic_years")
        .select("*")
        .eq("id", classRow.academic_year_id)
        .maybeSingle(),
      supabase
        .from("class_schedule_templates")
        .select("*")
        .eq("class_id", classId)
        .order("is_active", { ascending: false })
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true }),
      // Links not ended before today; those starting later are dropped below
      // (a composite parent cannot hold its own sessions while a link covers
      // the session date, so a future link does not make the class composite yet).
      supabase
        .from("class_component_links")
        .select("component_order, effective_from, component:classes!class_component_links_component_class_id_fkey(id, code, name)")
        .eq("parent_class_id", classId)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("component_order", { ascending: true }),
    ]);

  if (academicYearResult.error) {
    return {
      ok: false,
      error: createClassDataError(
        "academic_years_query_failed",
      ),
    };
  }

  if (schedulesResult.error) {
    return {
      ok: false,
      error: createClassDataError(
        "schedules_query_failed",
      ),
    };
  }

  if (componentLinksResult.error) {
    return {
      ok: false,
      error: createClassDataError(
        "component_links_query_failed",
      ),
    };
  }

  let activeStudentCount: number | null = null;

  if (options.includeStudentCounts) {
    const { count, error } = await supabase
      .from("student_enrollments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("class_id", classId)
      .eq("status", "active")
      .is("effective_to", null);

    if (error) {
      return {
        ok: false,
        error: createClassDataError(
          "enrollments_query_failed",
        ),
      };
    }

    activeStudentCount = count ?? 0;
  }

  try {
    const academicYearsById = new Map<
      string,
      AcademicYearRow
    >();

    if (academicYearResult.data) {
      academicYearsById.set(
        academicYearResult.data.id,
        academicYearResult.data,
      );
    }

    const schedules = (
      schedulesResult.data ?? []
    ).map(mapSchedule);

    const baseClass = mapClass(
      classRow,
      academicYearsById,
      schedules.filter((schedule) => schedule.isActive)
        .length,
      activeStudentCount,
    );

    return {
      ok: true,
      detail: {
        ...baseClass,
        classinUrl: classRow.classin_url,
        componentClasses: mapComponentClasses(
          (componentLinksResult.data ?? []).filter((link) => link.effective_from <= today),
        ),
        schedules,
      },
    };
  } catch {
    return {
      ok: false,
      error: createClassDataError(
        "invalid_class_data",
      ),
    };
  }
}

type ComponentLinkRow = {
  component: { code: string; id: string; name: string } | { code: string; id: string; name: string }[] | null;
};

/** One entry per component class, in component order; a class linked twice (consecutive periods) appears once. */
function mapComponentClasses(rows: readonly ComponentLinkRow[]): ClassComponentRef[] {
  const byId = new Map<string, ClassComponentRef>();

  for (const row of rows) {
    const component = Array.isArray(row.component) ? row.component[0] : row.component;

    if (component && !byId.has(component.id)) {
      byId.set(component.id, { code: component.code, id: component.id, name: component.name });
    }
  }

  return [...byId.values()];
}
