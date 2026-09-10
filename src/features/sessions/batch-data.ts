import "server-only";

import type { SessionLearningMode } from "@/features/sessions/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BatchClassOption,
  BatchScheduleOption,
  ExistingSessionSnapshot,
} from "./batch-calculation";

export * from "./batch-calculation";

export interface BatchSessionContextData {
  classes: BatchClassOption[];
  schedules: BatchScheduleOption[];
  existingSessions: ExistingSessionSnapshot[];
  existingSessionCount: number;
  targetClassId: string | null;
}

export async function getBatchSessionCreationContext(
  targetClassId?: string,
): Promise<{ ok: true; data: BatchSessionContextData } | { ok: false; error: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Fetch active classes
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, code, name, grade, level, default_learning_mode, academic_year_id")
      .eq("status", "active")
      .order("code", { ascending: true });

    if (classError) {
      return { ok: false, error: "Không thể tải danh sách lớp học đang hoạt động." };
    }

    const classes: BatchClassOption[] = (classData ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      grade: c.grade,
      level: c.level,
      defaultLearningMode: c.default_learning_mode as SessionLearningMode,
      academicYearId: c.academic_year_id,
    }));

    const selectedClassId = targetClassId || (classes.length > 0 ? classes[0].id : null);

    if (!selectedClassId) {
      return {
        ok: true,
        data: {
          classes: [],
          schedules: [],
          existingSessions: [],
          existingSessionCount: 0,
          targetClassId: null,
        },
      };
    }

    // 2. Fetch active schedule templates for selected class
    const [schedulesRes, sessionsCountRes, existingSessionsRes] = await Promise.all([
      supabase
        .from("class_schedule_templates")
        .select(`
          id,
          class_id,
          weekday,
          start_time,
          end_time,
          learning_mode,
          room_name,
          meeting_url,
          component_code,
          effective_from,
          effective_to
        `)
        .eq("class_id", selectedClassId)
        .eq("is_active", true)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true }),

      supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("class_id", selectedClassId)
        .neq("status", "cancelled"),

      supabase
        .from("class_sessions")
        .select("session_date, start_time, end_time, schedule_template_id")
        .eq("class_id", selectedClassId)
        .neq("status", "cancelled")
        .order("session_date", { ascending: false })
        .limit(300),
    ]);

    if (schedulesRes.error) {
      return { ok: false, error: "Không thể tải lịch học cố định của lớp." };
    }

    const schedules: BatchScheduleOption[] = (schedulesRes.data ?? []).map((s) => ({
      id: s.id,
      classId: s.class_id,
      weekday: s.weekday,
      startTime: s.start_time,
      endTime: s.end_time,
      learningMode: s.learning_mode as SessionLearningMode,
      roomName: s.room_name,
      meetingUrl: s.meeting_url,
      componentCode: s.component_code,
      effectiveFrom: s.effective_from,
      effectiveTo: s.effective_to,
    }));

    const existingSessions: ExistingSessionSnapshot[] = (existingSessionsRes.data ?? []).map((e) => ({
      sessionDate: e.session_date,
      startTime: e.start_time,
      endTime: e.end_time,
      scheduleTemplateId: e.schedule_template_id,
    }));

    return {
      ok: true,
      data: {
        classes,
        schedules,
        existingSessions,
        existingSessionCount: sessionsCountRes.count ?? 0,
        targetClassId: selectedClassId,
      },
    };
  } catch {
    return { ok: false, error: "Không thể kết nối tới cơ sở dữ liệu." };
  }
}
