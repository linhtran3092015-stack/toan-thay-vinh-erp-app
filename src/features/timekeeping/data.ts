import "server-only";

import { cache } from "react";
import { z } from "zod";

import type {
  AttendanceVerificationConfigResult,
  AttendanceVerificationPolicyResult,
  TimekeepingAdjustmentApprovalQueueResult,
  TimekeepingAdjustmentRequestsResult,
  TimekeepingAdjustableEntriesResult,
  TimekeepingDayEntriesResult,
  TimekeepingEntriesError,
  TimekeepingEntriesErrorCode,
  TimekeepingMonthlyEntriesResult,
  TimekeepingCenterMonthlyOverviewResult,
  TimekeepingMyEntriesResult,
  TimekeepingScheduleError,
  TimekeepingScheduleErrorCode,
  TimekeepingScheduleResult,
  TimekeepingStaffOptionsResult,
  TimekeepingWorkShiftsResult,
} from "@/features/timekeeping/types";
import { resolveScheduleWeek, weeklyScheduleResponseSchema } from "@/features/timekeeping/weekly-schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const attendancePolicySchema = z.object({
  exception_review_enabled: z.boolean().optional(),
  attendance_radius_m: z.number().int().positive().optional().default(100),
  center_name: z.string().optional().default("Trung tâm"),
  configured: z.boolean(),
  continuous_gps_tracking_required: z.boolean().optional().default(false),
  gps_max_accuracy_m: z.number().int().positive().optional().default(100),
  gps_required_for_offline: z.literal(true).optional().default(true),
  wifi_required_for_offline: z.boolean().optional().default(false),
});

const attendanceConfigSchema = attendancePolicySchema.extend({
  center_latitude: z.number().nullable().optional().default(null),
  center_longitude: z.number().nullable().optional().default(null),
  updated_at: z.string().nullable().optional().default(null),
  wifi_networks: z.array(z.object({
    bssid: z.string(),
    id: z.string().uuid().optional(),
    ssid: z.string(),
  })).optional().default([]),
});

type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;

const defaultAttendancePolicy = {
  attendanceRadiusM: 100,
  centerName: "Trung tâm",
  configured: false,
  continuousGpsTrackingRequired: false,
  gpsMaxAccuracyM: 100,
  gpsRequiredForOffline: true as const,
  wifiRequiredForOffline: false,
};

function mapAttendancePolicy(data: z.infer<typeof attendancePolicySchema>) {
  return {
    ...(data.exception_review_enabled === undefined ? {} : { exceptionReviewEnabled: data.exception_review_enabled }),
    attendanceRadiusM: data.attendance_radius_m,
    centerName: data.center_name,
    configured: data.configured,
    continuousGpsTrackingRequired: data.continuous_gps_tracking_required,
    gpsMaxAccuracyM: data.gps_max_accuracy_m,
    gpsRequiredForOffline: true as const,
    wifiRequiredForOffline: data.wifi_required_for_offline,
  };
}

export async function getAttendanceVerificationPolicy(): Promise<AttendanceVerificationPolicyResult> {
  const supabase = await createSupabaseServerClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const { data, error } = await rpc("get_attendance_verification_policy");
  const parsed = attendancePolicySchema.safeParse(data);

  if (error?.code === "PGRST202" || error?.message.includes("get_attendance_verification_policy")) {
    return { ok: true, policy: defaultAttendancePolicy };
  }

  if (error || !parsed.success) {
    return {
      ok: false,
      error: {
        code: "verification_policy_query_failed",
        message: "Không thể tải điều kiện xác minh chấm công.",
      },
    };
  }

  return { ok: true, policy: mapAttendancePolicy(parsed.data) };
}

export async function getAttendanceVerificationConfig(): Promise<AttendanceVerificationConfigResult> {
  const supabase = await createSupabaseServerClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const { data, error } = await rpc("get_attendance_verification_config");
  const parsed = attendanceConfigSchema.safeParse(data);

  if (error || !parsed.success) {
    console.error("Attendance verification config query failed", {
      databaseCode: error?.code ?? null,
      databaseMessage: error?.message ?? null,
      validationIssues: parsed.success
        ? []
        : parsed.error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path.join("."),
          })),
    });
    return {
      ok: false,
      error: {
        code: "verification_config_query_failed",
        message: "Không thể tải cấu hình GPS và Wi-Fi của Trung tâm.",
      },
    };
  }

  return {
    ok: true,
    config: {
      ...mapAttendancePolicy(parsed.data),
      centerLatitude: parsed.data.center_latitude,
      centerLongitude: parsed.data.center_longitude,
      updatedAt: parsed.data.updated_at,
      wifiNetworks: parsed.data.wifi_networks,
    },
  };
}

function createScheduleError(
  code: TimekeepingScheduleErrorCode,
): TimekeepingScheduleError {
  const messages: Record<TimekeepingScheduleErrorCode, string> = {
    schedule_query_failed: "Không thể tải lịch phân công của tuần đã chọn.",
  };

  return {
    code,
    message: messages[code],
  };
}

function createWorkShiftError(): TimekeepingScheduleError {
  return {
    code: "schedule_query_failed",
    message: "Không thể tải danh mục ca làm.",
  };
}

function createStaffOptionsError(): TimekeepingScheduleError {
  return {
    code: "schedule_query_failed",
    message: "Không thể tải danh sách nhân sự đang làm việc.",
  };
}

function createEntriesError(
  code: TimekeepingEntriesErrorCode,
): TimekeepingEntriesError {
  const messages: Record<TimekeepingEntriesErrorCode, string> = {
    adjustable_entries_query_failed:
      "Không thể tải các lượt chấm công có thể điều chỉnh.",
    adjustment_approval_queue_query_failed:
      "Không thể tải hàng chờ duyệt điều chỉnh công.",
    day_entries_query_failed: "Không thể tải chấm công trong ngày.",
    my_adjustment_requests_query_failed:
      "Không thể tải lịch sử yêu cầu điều chỉnh công.",
    my_entries_query_failed: "Không thể tải dữ liệu chấm công của bạn.",
    monthly_entries_query_failed: "Không thể tải bảng công theo tháng.",
    center_monthly_overview_failed: "Không thể tải bảng công toàn trung tâm theo tháng.",
  };

  return { code, message: messages[code] };
}

export async function getTimekeepingSchedule(weekStart = resolveScheduleWeek(undefined)): Promise<TimekeepingScheduleResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_weekly_shift_schedule", { p_week_start: weekStart });
    const parsed = weeklyScheduleResponseSchema.safeParse(data);
    if (error || !parsed.success) return { ok: false, error: createScheduleError("schedule_query_failed") };
    return {
      ok: true,
      entries: parsed.data.map((entry) => ({
        assignmentId: entry.assignment_id, breakMinutes: entry.break_minutes,
        crossesMidnight: entry.crosses_midnight, effectiveFrom: entry.effective_from,
        effectiveTo: entry.effective_to, endTime: entry.end_time,
        staffDisplayName: entry.staff_display_name, staffEmployeeCode: entry.staff_employee_code,
        staffEmploymentStatus: entry.staff_employment_status, staffId: entry.staff_id,
        startTime: entry.start_time, weekday: entry.weekday, workShiftCode: entry.work_shift_code,
        workShiftId: entry.work_shift_id, workShiftName: entry.work_shift_name,
        workDate: entry.work_date, weekStart: entry.week_start, updatedAt: entry.updated_at,
        isActive: entry.is_active, isLocked: entry.is_locked,
      })),
    };
  } catch {
    return { ok: false, error: createScheduleError("schedule_query_failed") };
  }
}

export async function getTimekeepingWorkShifts(): Promise<TimekeepingWorkShiftsResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_shifts")
    .select(
      "id, code, name, start_time, end_time, crosses_midnight, break_minutes, is_active, notes",
    )
    .order("is_active", { ascending: false })
    .order("start_time", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: createWorkShiftError(),
    };
  }

  return {
    ok: true,
    workShifts: data.map((shift) => ({
      breakMinutes: shift.break_minutes,
      code: shift.code,
      crossesMidnight: shift.crosses_midnight,
      endTime: shift.end_time,
      id: shift.id,
      isActive: shift.is_active,
      name: shift.name,
      notes: shift.notes,
      startTime: shift.start_time,
    })),
  };
}

export async function getTimekeepingStaffOptions(): Promise<TimekeepingStaffOptionsResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_timekeeping_staff_options");

  if (error) {
    return {
      ok: false,
      error: createStaffOptionsError(),
    };
  }

  return {
    ok: true,
    staffOptions: data.map((staff) => ({
      displayName: staff.staff_display_name,
      employeeCode: staff.staff_employee_code,
      id: staff.staff_id,
    })),
  };
}

export async function getMyTimekeepingEntries(): Promise<TimekeepingMyEntriesResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_timekeeping_entries");

  if (error) {
    return { ok: false, error: createEntriesError("my_entries_query_failed") };
  }

  return {
    ok: true,
    entries: data.map((entry) => ({
      autoEndedAt: entry.auto_ended_at,
      checkInAt: entry.check_in_at,
      checkInMode: entry.check_in_mode as "online" | "offline",
      checkOutAt: entry.check_out_at,
      checkOutMode: entry.check_out_mode as "online" | "offline" | "auto_end" | null,
      clockOutReason: (entry as Record<string, unknown>).clock_out_reason as "manual" | "left_geofence" | "location_lost" | "daily_cutoff" | null,
      hasCheckInGpsEvidence: entry.has_check_in_gps_evidence,
      hasCheckInWifiEvidence: entry.has_check_in_wifi_evidence,
      hasCheckOutGpsEvidence: entry.has_check_out_gps_evidence,
      hasCheckOutWifiEvidence: entry.has_check_out_wifi_evidence,
      id: entry.entry_id,
      isUnscheduled: Boolean((entry as Record<string, unknown>).is_unscheduled),
      lastLocationAt: ((entry as Record<string, unknown>).last_location_at as string) || null,
      scheduledEndTime: entry.scheduled_end_time,
      scheduledStartTime: entry.scheduled_start_time,
      status: entry.entry_status as "open" | "checked_out" | "auto_ended",
      workDate: entry.work_date,
      workShiftCode: entry.work_shift_code,
      workShiftName: entry.work_shift_name,
    })),
  };
}

export const getCachedMyTimekeepingEntries = cache(getMyTimekeepingEntries);

export async function getTimekeepingDayEntries(): Promise<TimekeepingDayEntriesResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_timekeeping_day_entries");

  if (error) {
    return { ok: false, error: createEntriesError("day_entries_query_failed") };
  }

  return {
    ok: true,
    entries: data.map((entry) => ({
      autoEndedAt: entry.auto_ended_at,
      checkInAt: entry.check_in_at,
      checkInMode: entry.check_in_mode as "online" | "offline",
      checkOutAt: entry.check_out_at,
      checkOutMode: entry.check_out_mode as "online" | "offline" | "auto_end" | null,
      hasCheckInGpsEvidence: entry.has_check_in_gps_evidence,
      hasCheckInWifiEvidence: entry.has_check_in_wifi_evidence,
      hasCheckOutGpsEvidence: entry.has_check_out_gps_evidence,
      hasCheckOutWifiEvidence: entry.has_check_out_wifi_evidence,
      id: entry.entry_id,
      scheduledEndTime: entry.scheduled_end_time,
      scheduledStartTime: entry.scheduled_start_time,
      staffDisplayName: entry.staff_display_name,
      staffEmployeeCode: entry.staff_employee_code,
      staffId: entry.staff_id,
      status: entry.entry_status as "open" | "checked_out" | "auto_ended",
      workDate: entry.work_date,
      workShiftCode: entry.work_shift_code,
      workShiftName: entry.work_shift_name,
    })),
  };
}

export async function getMyTimekeepingAdjustableEntries(): Promise<TimekeepingAdjustableEntriesResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_timekeeping_adjustable_entries");

  if (error) {
    return { ok: false, error: createEntriesError("adjustable_entries_query_failed") };
  }

  return {
    ok: true,
    entries: data.map((entry) => ({
      adjustmentStatus: entry.adjustment_status as "pending" | "approved" | "rejected" | null,
      checkInAt: entry.check_in_at,
      checkInMode: entry.check_in_mode as "online" | "offline",
      checkOutAt: entry.check_out_at,
      checkOutMode: entry.check_out_mode as "online" | "offline" | "auto_end",
      id: entry.time_entry_id,
      status: entry.entry_status as "checked_out" | "auto_ended",
      workDate: entry.work_date,
      workShiftCode: entry.work_shift_code,
      workShiftName: entry.work_shift_name,
    })),
  };
}

export async function getMyTimeEntryAdjustmentRequests(): Promise<TimekeepingAdjustmentRequestsResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_time_entry_adjustment_requests");

  if (error) {
    return {
      ok: false,
      error: createEntriesError("my_adjustment_requests_query_failed"),
    };
  }

  return {
    ok: true,
    requests: data.map((request) => ({
      createdAt: request.created_at,
      decisionReason: request.decision_reason || null,
      id: request.request_id,
      originalCheckInAt: request.original_check_in_at,
      originalCheckInMode: request.original_check_in_mode as "online" | "offline",
      originalCheckOutAt: request.original_check_out_at,
      originalCheckOutMode: request.original_check_out_mode as "online" | "offline" | "auto_end",
      requestReason: request.request_reason,
      requestedCheckInAt: request.requested_check_in_at,
      requestedCheckInMode: request.requested_check_in_mode as "online" | "offline",
      requestedCheckOutAt: request.requested_check_out_at,
      requestedCheckOutMode: request.requested_check_out_mode as "online" | "offline",
      reviewedAt: request.reviewed_at || null,
      reviewerDisplayName: request.reviewer_display_name || null,
      status: request.request_status as "pending" | "approved" | "rejected",
      timeEntryId: request.time_entry_id,
      workDate: request.work_date,
    })),
  };
}

export async function getTimeEntryAdjustmentApprovalQueue(): Promise<TimekeepingAdjustmentApprovalQueueResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "get_time_entry_adjustment_approval_queue",
  );

  if (error) {
    return {
      ok: false,
      error: createEntriesError("adjustment_approval_queue_query_failed"),
    };
  }

  return {
    ok: true,
    requests: data.map((request) => ({
      createdAt: request.created_at,
      id: request.request_id,
      originalCheckInAt: request.original_check_in_at,
      originalCheckInMode: request.original_check_in_mode as "online" | "offline",
      originalCheckOutAt: request.original_check_out_at,
      originalCheckOutMode: request.original_check_out_mode as "online" | "offline" | "auto_end",
      requestReason: request.request_reason,
      requestedCheckInAt: request.requested_check_in_at,
      requestedCheckInMode: request.requested_check_in_mode as "online" | "offline",
      requestedCheckOutAt: request.requested_check_out_at,
      requestedCheckOutMode: request.requested_check_out_mode as "online" | "offline",
      requesterDisplayName: request.requester_display_name || null,
      requesterEmployeeCode: request.requester_employee_code || null,
      requesterId: request.requester_id,
      timeEntryId: request.time_entry_id,
      workDate: request.work_date,
    })),
  };
}

export async function getMyMonthlyTimekeepingEntries(
  month: number,
  year: number,
): Promise<TimekeepingMonthlyEntriesResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_my_monthly_timekeeping_entries", {
      p_month: month,
      p_year: year,
    });

    if (error) {
      return { ok: false, error: createEntriesError("monthly_entries_query_failed") };
    }

    return {
      ok: true,
      entries: data.map((entry) => ({
        adjustedCheckInAt: entry.adjusted_check_in_at,
        adjustedCheckOutAt: entry.adjusted_check_out_at,
        adjustmentStatus: entry.adjustment_status as "pending" | "approved" | "rejected" | "none",
        autoEndedAt: entry.auto_ended_at,
        checkInAt: entry.check_in_at,
        checkInMode: entry.check_in_mode as "online" | "offline",
        checkOutAt: entry.check_out_at,
        checkOutMode: entry.check_out_mode as "online" | "offline" | "auto_end" | null,
        clockOutReason: entry.clock_out_reason as "manual" | "left_geofence" | "location_lost" | "daily_cutoff" | null,
        hasCheckInGpsEvidence: entry.has_check_in_gps_evidence,
        hasCheckInWifiEvidence: entry.has_check_in_wifi_evidence,
        hasCheckOutGpsEvidence: entry.has_check_out_gps_evidence,
        hasCheckOutWifiEvidence: entry.has_check_out_wifi_evidence,
        id: entry.entry_id,
        isUnscheduled: entry.is_unscheduled,
        status: entry.entry_status as "open" | "checked_out" | "auto_ended",
        totalMinutes: entry.total_minutes,
        workDate: entry.work_date,
        workShiftCode: entry.work_shift_code,
        workShiftName: entry.work_shift_name,
      })),
    };
  } catch {
    return { ok: false, error: createEntriesError("monthly_entries_query_failed") };
  }
}

export async function getCenterMonthlyTimekeepingOverview(
  month: number,
  year: number,
): Promise<TimekeepingCenterMonthlyOverviewResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_center_monthly_timekeeping_overview", {
      p_month: month,
      p_year: year,
    });

    if (error) {
      return { ok: false, error: createEntriesError("center_monthly_overview_failed") };
    }

    return {
      ok: true,
      overview: data.map((row) => ({
        autoEndedCount: row.auto_ended_count,
        pendingAdjustmentCount: row.pending_adjustment_count,
        primaryRoleName: row.primary_role_name,
        staffDisplayName: row.staff_display_name,
        staffEmployeeCode: row.staff_employee_code,
        staffId: row.staff_id,
        totalEntries: row.total_entries,
        totalHours: Number(row.total_hours),
        totalWorkDays: row.total_work_days,
      })),
    };
  } catch {
    return { ok: false, error: createEntriesError("center_monthly_overview_failed") };
  }
}

export async function getStaffMonthlyTimekeepingEntries(
  staffId: string,
  month: number,
  year: number,
): Promise<TimekeepingMonthlyEntriesResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_staff_monthly_timekeeping_entries", {
      p_month: month,
      p_staff_id: staffId,
      p_year: year,
    });

    if (error) {
      return { ok: false, error: createEntriesError("monthly_entries_query_failed") };
    }

    return {
      ok: true,
      entries: data.map((entry) => ({
        adjustedCheckInAt: entry.adjusted_check_in_at,
        adjustedCheckOutAt: entry.adjusted_check_out_at,
        adjustmentStatus: entry.adjustment_status as "pending" | "approved" | "rejected" | "none",
        autoEndedAt: entry.auto_ended_at,
        checkInAt: entry.check_in_at,
        checkInMode: entry.check_in_mode as "online" | "offline",
        checkOutAt: entry.check_out_at,
        checkOutMode: entry.check_out_mode as "online" | "offline" | "auto_end" | null,
        clockOutReason: entry.clock_out_reason as "manual" | "left_geofence" | "location_lost" | "daily_cutoff" | null,
        hasCheckInGpsEvidence: entry.has_check_in_gps_evidence,
        hasCheckInWifiEvidence: entry.has_check_in_wifi_evidence,
        hasCheckOutGpsEvidence: entry.has_check_out_gps_evidence,
        hasCheckOutWifiEvidence: entry.has_check_out_wifi_evidence,
        id: entry.entry_id,
        isUnscheduled: entry.is_unscheduled,
        status: entry.entry_status as "open" | "checked_out" | "auto_ended",
        totalMinutes: entry.total_minutes,
        workDate: entry.work_date,
        workShiftCode: entry.work_shift_code,
        workShiftName: entry.work_shift_name,
      })),
    };
  } catch {
    return { ok: false, error: createEntriesError("monthly_entries_query_failed") };
  }
}
