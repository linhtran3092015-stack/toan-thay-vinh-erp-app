import {
  AUDIT_FILTER_OPTION_ROW_LIMIT,
  AUDIT_LOG_ROW_LIMIT,
  getActorDisplayName,
  getAuditActorOptionLabel,
  getNextCalendarDate,
  normalizeAuditFilters,
  sortUnique,
} from "@/features/audit/audit-log-models";
import type {
  AuditActor,
  AuditActorOption,
  AuditFilters,
  AuditLogEntry,
  AuditLogReadModel,
} from "@/features/audit/read-models";
import type { Json } from "@/types/database.generated";

/**
 * /dev/lists?view=audit fixtures: `audit_logs` rows in the database shape,
 * written the way the migrations' writers write them (student trigger =
 * whole rows via `to_jsonb`, `ops_alert_raised` with a null actor and the
 * alert title as reason, `class_session_auto_locked` under the session's
 * completer, rbac rows with `{ source: "settings" }` metadata, timekeeping
 * auto-end with a null actor). No writer sets `request_id` today, so every
 * fixture leaves it null. Times are on or before the preview clock
 * (16/10/2026 12:00 in Vietnam = 05:00 UTC), newest first.
 */

/** `audit_logs` row as PostgREST returns it (`data.ts` AUDIT_COLUMNS). */
export interface AuditPreviewRow {
  action: string;
  actor_user_id: string | null;
  entity_id: string | null;
  entity_type: string | null;
  id: string;
  metadata: Json;
  module: string;
  new_data: Json | null;
  occurred_at: string;
  old_data: Json | null;
  reason: string | null;
  request_id: string | null;
}

/** `profiles` rows the owner can read (RLS: own row or `staff.view`). */
export interface AuditPreviewProfile {
  display_name: string | null;
  email: string;
  id: string;
}

const id = (prefix: string, index: number) => `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;

export const auditPreviewActorIds = {
  accountant: id("a1000000", 3),
  admissions: id("a1000000", 21),
  owner: id("a1000000", 1),
  ta: id("a1000000", 7),
  /** An actor whose profile the read does not return (e.g. the profiles read failed): never "Hệ thống". */
  unreadable: id("a1000000", 99),
} as const;

export const auditPreviewProfiles: readonly AuditPreviewProfile[] = [
  { display_name: "Thầy Vinh", email: "vinh.owner@example.com", id: auditPreviewActorIds.owner },
  { display_name: "Chị Hạnh", email: "hanh.pham@example.com", id: auditPreviewActorIds.accountant },
  { display_name: "Cô Lan", email: "lan.nguyen@example.com", id: auditPreviewActorIds.ta },
  // No display name: the loader falls back to the e-mail's local part.
  { display_name: null, email: "minh.tuyensinh@example.com", id: auditPreviewActorIds.admissions },
];

const studentId = id("b2000000", 14);
const studentBefore = {
  birth_year: 2011,
  created_at: "2026-08-20T02:10:00+00:00",
  created_by: auditPreviewActorIds.owner,
  current_grade: 9,
  full_name: "Phạm Thu Hà",
  id: studentId,
  internal_notes: "Phụ huynh muốn nhận nhận xét qua Zalo nhóm.",
  learning_goal: "Ôn thi vào lớp 10 chuyên",
  learning_level: "A",
  lifecycle_status: "active",
  nickname: "Hà",
  official_start_date: "2026-09-05",
  province_city: "Hà Nội",
  public_code: "HS0142",
  registered_mode: "offline",
  updated_at: "2026-09-05T09:00:00+00:00",
  zalo_account_id: null,
  zalo_group_linked_at: "2026-09-06T03:00:00+00:00",
  zalo_group_linked_by: auditPreviewActorIds.ta,
  zalo_group_name_snapshot: "Toán 9A - Phụ huynh Thu Hà",
  zalo_group_thread_id: "7301245698123",
};

const sessionId = id("c3000000", 31);

const salaryAdvanceUnderReview = {
  amount_vnd: 1500000,
  approval_note: null,
  approved_at: null,
  approved_by: null,
  deducted_at: null,
  deduction_payroll_period_id: null,
  deduction_period_month: "2026-09-01",
  id: id("fb000000", 4),
  rejected_at: null,
  rejected_by: null,
  rejection_reason: null,
  request_note: "Tạm ứng học phí cho con.",
  requested_at: "2026-08-10T02:00:00+00:00",
  requested_by: auditPreviewActorIds.ta,
  review_note: "Đã kiểm tra công tháng 8.",
  reviewed_at: "2026-08-11T02:00:00+00:00",
  reviewed_by: auditPreviewActorIds.accountant,
  staff_id: auditPreviewActorIds.ta,
  status: "review",
};

const handWrittenRows: AuditPreviewRow[] = [
  {
    action: "ops_alert_raised",
    actor_user_id: null,
    entity_id: "ops.sepay_webhook_failed:2026-10-16 11:30",
    entity_type: "ops_alert",
    id: id("e5000000", 20),
    metadata: {
      code: "sepay_webhook_failed",
      message:
        "Có 2 webhook SePay bị lỗi trong 30 phút qua. Tiền có thể đã về nhưng chưa ghi nhận; kiểm tra Giao dịch SePay và đồng bộ lịch sử nếu cần.",
      recipients: 1,
    },
    module: "ops",
    new_data: null,
    occurred_at: "2026-10-16T04:41:12.418+00:00",
    old_data: null,
    reason: "2 webhook SePay xử lý lỗi",
    request_id: null,
  },
  {
    action: "sepay_tuition_manually_allocated",
    actor_user_id: auditPreviewActorIds.accountant,
    entity_id: id("f6000000", 8),
    entity_type: "sepay_transaction",
    id: id("e5000000", 19),
    metadata: {},
    module: "finance",
    new_data: {
      allocations: [
        {
          amount: 3200000,
          bonus: 0,
          guardian: id("b7000000", 22),
          price: 200000,
          request: id("f7000000", 3),
          sessions: 16,
          settle: true,
          student: studentId,
        },
      ],
      effective_on: "2026-10-16",
      total_allocated_vnd: 3200000,
    },
    occurred_at: "2026-10-16T03:20:05.120+00:00",
    old_data: { match_status: "unmatched" },
    reason: "Phụ huynh chuyển khoản thiếu nội dung, đã xác nhận qua điện thoại.",
    request_id: null,
  },
  {
    action: "student_updated",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: studentId,
    entity_type: "student",
    id: id("e5000000", 18),
    metadata: {},
    module: "students",
    new_data: { ...studentBefore, lifecycle_status: "reserved", updated_at: "2026-10-16T02:15:44.902+00:00" },
    occurred_at: "2026-10-16T02:15:44.902+00:00",
    old_data: studentBefore,
    reason: null,
    request_id: null,
  },
  {
    action: "class_session_auto_locked",
    actor_user_id: auditPreviewActorIds.ta,
    entity_id: sessionId,
    entity_type: "class_session",
    id: id("e5000000", 17),
    metadata: { auto_lock_after_days: 3, source: "auto_lock_worker" },
    module: "sessions",
    new_data: null,
    occurred_at: "2026-10-16T01:00:03.551+00:00",
    old_data: null,
    reason: "Tự động khóa sau 3 ngày",
    request_id: null,
  },
  {
    // 20:00 UTC on 15/10 is 03:00 on 16/10 in Vietnam: the row belongs to the 16/10 day.
    action: "ops_alert_raised",
    actor_user_id: null,
    entity_id: "ops.cron_job_failed:58213",
    entity_type: "ops_alert",
    id: id("e5000000", 21),
    metadata: {
      code: "cron_job_failed",
      message: "Lần chạy 58213 lúc 02:30 16/10: ERROR: canceling statement due to statement timeout",
      recipients: 1,
    },
    module: "ops",
    new_data: null,
    occurred_at: "2026-10-15T20:00:12.006+00:00",
    old_data: null,
    reason: "Tác vụ nền thất bại: student-care-worker",
    request_id: null,
  },
  {
    action: "time_entry_auto_ended",
    actor_user_id: null,
    entity_id: id("d4000000", 61),
    entity_type: "time_entry",
    id: id("e5000000", 16),
    metadata: { source: "timekeeping_auto_end" },
    module: "timekeeping",
    new_data: {
      auto_ended_at: "2026-10-15T15:45:00+00:00",
      check_in_at: "2026-10-15T10:52:31+00:00",
      check_in_mode: "onsite",
      id: id("d4000000", 61),
      staff_id: auditPreviewActorIds.ta,
      status: "auto_ended",
      work_date: "2026-10-15",
    },
    occurred_at: "2026-10-15T15:45:00.204+00:00",
    old_data: {
      auto_ended_at: null,
      check_in_at: "2026-10-15T10:52:31+00:00",
      check_in_mode: "onsite",
      id: id("d4000000", 61),
      staff_id: auditPreviewActorIds.ta,
      status: "open",
      work_date: "2026-10-15",
    },
    reason: null,
    request_id: null,
  },
  {
    action: "user_roles_replaced",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: auditPreviewActorIds.ta,
    entity_type: "profile",
    id: id("e5000000", 15),
    metadata: { source: "settings" },
    module: "rbac",
    new_data: { role_ids: [id("d3000000", 5)] },
    occurred_at: "2026-10-15T14:05:09.000+00:00",
    old_data: { role_ids: [id("d3000000", 5), id("d3000000", 3)] },
    reason: "Thu hồi quyền quản lý trợ lý sau khi bàn giao lớp 9A.",
    request_id: null,
  },
  {
    action: "account_invitation_created",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: id("e9000000", 4),
    entity_type: "account_invitation",
    id: id("e5000000", 14),
    metadata: { source: "settings" },
    module: "rbac",
    new_data: { email: "thao.do@example.com", role_ids: [id("d3000000", 5)], status: "pending" },
    occurred_at: "2026-10-15T10:30:00.000+00:00",
    old_data: null,
    reason: "Trợ giảng mới cho lớp 8B tháng 10.",
    request_id: null,
  },
  {
    action: "system_setting_updated",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: "session_auto_lock_days",
    entity_type: "system_setting",
    id: id("e5000000", 13),
    metadata: {},
    module: "settings",
    new_data: 3,
    occurred_at: "2026-10-15T08:12:40.000+00:00",
    old_data: 7,
    reason: null,
    request_id: null,
  },
  {
    action: "guardian_updated",
    actor_user_id: auditPreviewActorIds.unreadable,
    entity_id: id("b7000000", 22),
    entity_type: "guardian",
    id: id("e5000000", 12),
    metadata: {},
    module: "students",
    new_data: {
      created_at: "2026-08-20T02:10:00+00:00",
      created_by: auditPreviewActorIds.owner,
      email: null,
      full_name: "Phạm Văn Toàn",
      id: id("b7000000", 22),
      normalized_phone: "84966778899",
      notes: "Gọi sau 19h.",
      phone: "0966 778 899",
      updated_at: "2026-10-15T03:00:00+00:00",
      zalo: "0966778899",
    },
    occurred_at: "2026-10-15T03:00:00.000+00:00",
    old_data: {
      created_at: "2026-08-20T02:10:00+00:00",
      created_by: auditPreviewActorIds.owner,
      email: null,
      full_name: "Phạm Văn Toàn",
      id: id("b7000000", 22),
      normalized_phone: "84966778899",
      notes: null,
      phone: "0966 778 899",
      updated_at: "2026-08-20T02:10:00+00:00",
      zalo: "0966778899",
    },
    reason: null,
    request_id: null,
  },
  {
    action: "crm_case_status_changed",
    actor_user_id: auditPreviewActorIds.admissions,
    entity_id: id("c8000000", 5),
    entity_type: "crm_case",
    id: id("e5000000", 11),
    metadata: {},
    module: "crm",
    new_data: { status: "trial_booked", student_id: null },
    occurred_at: "2026-10-14T13:20:00.000+00:00",
    old_data: { status: "new", student_id: null },
    reason: "Phụ huynh đồng ý học thử thứ 7.",
    request_id: null,
  },
  {
    action: "session_attendance_marked",
    actor_user_id: auditPreviewActorIds.ta,
    entity_id: id("c9000000", 140),
    entity_type: "session_attendance",
    id: id("e5000000", 10),
    metadata: { class_session_id: sessionId, source: "authenticated_user", student_id: studentId },
    module: "attendance",
    new_data: {
      actual_learning_mode: "offline",
      attendance_status: "present",
      class_session_id: sessionId,
      id: id("c9000000", 140),
      is_late_update: false,
      marked_by: auditPreviewActorIds.ta,
      notes: null,
      student_id: studentId,
    },
    occurred_at: "2026-10-13T11:05:31.000+00:00",
    old_data: null,
    reason: null,
    request_id: null,
  },
  {
    action: "payment_request_cancelled",
    actor_user_id: auditPreviewActorIds.accountant,
    entity_id: id("f7000000", 2),
    entity_type: "student_payment_request",
    id: id("e5000000", 9),
    metadata: {},
    module: "finance",
    new_data: { status: "cancelled" },
    occurred_at: "2026-10-12T09:41:00.000+00:00",
    old_data: { expected_amount_vnd: 4800000, status: "pending" },
    reason:
      "Phụ huynh đổi sang gói 24 buổi nên hủy phiếu 12 buổi đã tạo hôm thứ 2, phiếu mới đã gửi qua Zalo nhóm lớp kèm mã chuyển khoản mới.",
    request_id: null,
  },
  {
    action: "payroll_period_reopened",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: id("f8000000", 9),
    entity_type: "payroll_period",
    id: id("e5000000", 8),
    metadata: { period_month: "2026-09-01", previous_status: "approved", reason: "Bổ sung 2 buổi chấm bài của Cô Lan." },
    module: "payroll",
    new_data: null,
    occurred_at: "2026-10-10T02:00:00.000+00:00",
    old_data: null,
    reason: null,
    request_id: null,
  },
  {
    action: "student_import_committed",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: id("fa000000", 3),
    entity_type: "student_import_batch",
    id: id("e5000000", 7),
    metadata: { guardian_created_count: 38, row_count: 40, source_filename: "Danhsachimport.xlsx", student_count: 40 },
    module: "imports",
    new_data: null,
    occurred_at: "2026-10-08T07:30:00.000+00:00",
    old_data: null,
    reason: null,
    request_id: null,
  },
  {
    action: "student_created",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: studentId,
    entity_type: "student",
    id: id("e5000000", 6),
    metadata: {},
    module: "students",
    new_data: { ...studentBefore, internal_notes: null, lifecycle_status: "waiting_class", official_start_date: null, updated_at: "2026-08-20T02:10:00+00:00", zalo_group_linked_at: null, zalo_group_linked_by: null, zalo_group_name_snapshot: null, zalo_group_thread_id: null },
    occurred_at: "2026-08-20T02:10:00.000+00:00",
    old_data: null,
    reason: null,
    request_id: null,
  },
  {
    action: "salary_advance_approved",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: id("fb000000", 4),
    entity_type: "salary_advance",
    id: id("e5000000", 5),
    metadata: { source: "salary_advance_workflow" },
    module: "advances",
    new_data: { ...salaryAdvanceUnderReview, approval_note: "Duyệt, trừ vào lương tháng 9.", approved_at: "2026-08-12T03:00:00+00:00", approved_by: auditPreviewActorIds.owner, status: "approved" },
    occurred_at: "2026-08-12T03:00:00.000+00:00",
    old_data: salaryAdvanceUnderReview,
    reason: "Duyệt, trừ vào lương tháng 9.",
    request_id: null,
  },
  {
    action: "role_permission_granted",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: `${id("d3000000", 4)}:${id("d5000000", 37)}`,
    entity_type: "role_permission",
    id: id("e5000000", 4),
    metadata: { source: "authenticated_user" },
    module: "rbac",
    new_data: {
      granted_at: "2026-08-02T08:00:00+00:00",
      granted_by: auditPreviewActorIds.owner,
      permission_id: id("d5000000", 37),
      role_id: id("d3000000", 4),
    },
    occurred_at: "2026-08-02T08:00:00.000+00:00",
    old_data: null,
    reason: "Kế toán xử lý phiếu học phí.",
    request_id: null,
  },
  {
    action: "staff_rate_version_created",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: id("fc000000", 2),
    entity_type: "staff_rate_version",
    id: id("e5000000", 3),
    metadata: { source: "database" },
    module: "staff",
    new_data: {
      created_at: "2026-07-28T10:00:00+00:00",
      created_by: auditPreviewActorIds.owner,
      effective_from: "2026-08-01",
      id: id("fc000000", 2),
      note: "Đơn giá trợ giảng năm học mới.",
      offline_hourly_rate_vnd: 60000,
      online_hourly_rate_vnd: 50000,
      staff_id: auditPreviewActorIds.ta,
    },
    occurred_at: "2026-07-28T10:00:00.000+00:00",
    old_data: null,
    reason: null,
    request_id: null,
  },
  {
    action: "automation_configured",
    actor_user_id: auditPreviewActorIds.owner,
    entity_id: "true",
    entity_type: "student_care_settings",
    id: id("e5000000", 2),
    metadata: {},
    module: "student_care",
    new_data: { enabled: true, op: "configure", request_id: id("fd000000", 1) },
    occurred_at: "2026-09-17T09:00:00.000+00:00",
    old_data: null,
    reason: null,
    request_id: null,
  },
];

/** The hand-written rows (state=normal), newest first. */
export const auditPreviewRows: readonly AuditPreviewRow[] = [...handWrittenRows].sort(compareRows);

/** `occurred_at desc, id desc`, the loader's order. */
function compareRows(left: AuditPreviewRow, right: AuditPreviewRow): number {
  const byTime = Date.parse(right.occurred_at) - Date.parse(left.occurred_at);
  if (byTime !== 0) return byTime;
  return right.id < left.id ? -1 : right.id > left.id ? 1 : 0;
}

/** state=capped: the exact count the header shows (1.240 rows), the newest 100 of them listed. */
export const AUDIT_PREVIEW_CAPPED_TOTAL = 1240;

/**
 * Older routine rows behind the hand-written ones: attendance marks by the TA
 * and timekeeping check-ins / auto-ends (null actor), one every 50 minutes
 * going back from 12/10.
 */
function generateOlderRows(count: number): AuditPreviewRow[] {
  const start = Date.parse("2026-10-12T08:00:00.000Z");

  return Array.from({ length: count }, (_, index): AuditPreviewRow => {
    const occurredAt = new Date(start - index * 50 * 60 * 1000).toISOString().replace("Z", "+00:00");
    const rowId = id("e6000000", index + 1);
    const kind = index % 3;

    if (kind === 0) {
      const attendanceId = id("ca000000", index + 1);
      return {
        action: "session_attendance_marked",
        actor_user_id: auditPreviewActorIds.ta,
        entity_id: attendanceId,
        entity_type: "session_attendance",
        id: rowId,
        metadata: { class_session_id: id("c3000000", 100 + (index % 40)), source: "authenticated_user", student_id: id("b2000000", 100 + (index % 60)) },
        module: "attendance",
        new_data: { attendance_status: index % 9 === 0 ? "absent" : "present", id: attendanceId },
        occurred_at: occurredAt,
        old_data: null,
        reason: null,
        request_id: null,
      };
    }

    const entryId = id("d4000000", 1000 + index);
    const autoEnded = kind === 2;
    return {
      action: autoEnded ? "time_entry_auto_ended" : "time_entry_checked_in",
      actor_user_id: autoEnded ? null : auditPreviewActorIds.ta,
      entity_id: entryId,
      entity_type: "time_entry",
      id: rowId,
      metadata: { source: autoEnded ? "timekeeping_auto_end" : "timekeeping_entry_workflow" },
      module: "timekeeping",
      new_data: { id: entryId, status: autoEnded ? "auto_ended" : "open" },
      occurred_at: occurredAt,
      old_data: autoEnded ? { id: entryId, status: "open" } : null,
      reason: null,
      request_id: null,
    };
  });
}

export const cappedAuditPreviewRows: readonly AuditPreviewRow[] = [
  ...auditPreviewRows,
  ...generateOlderRows(AUDIT_PREVIEW_CAPPED_TOTAL - auditPreviewRows.length),
].sort(compareRows);

/** `occurred_at >= {day}T00:00:00+07:00` as the loader writes it. */
function vietnamDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00+07:00`);
}

/**
 * Fixture copy of `getAuditLogsResult` (data.ts): the loader's own
 * `normalizeAuditFilters` and actor option label, exact `eq` filters,
 * Vietnam-day bounds, `occurred_at desc, id desc`, the 100-row cap with an
 * exact count, options from the newest 1.000 rows (unfiltered), and actors
 * from both reads joined to the readable profiles (`auditPreviewProfiles`).
 */
export function runAuditPreviewQuery(
  rows: readonly AuditPreviewRow[],
  input: Partial<AuditFilters>,
): AuditLogReadModel {
  const filters = normalizeAuditFilters(input);

  const ordered = [...rows].sort(compareRows);
  const matching = ordered.filter((row) => {
    const occurredAt = Date.parse(row.occurred_at);
    return (
      (!filters.module || row.module === filters.module) &&
      (!filters.action || row.action === filters.action) &&
      (!filters.entityType || row.entity_type === filters.entityType) &&
      (!filters.entityId || row.entity_id === filters.entityId) &&
      (!filters.actorId || row.actor_user_id === filters.actorId) &&
      (!filters.fromDate || occurredAt >= vietnamDayStart(filters.fromDate)) &&
      (!filters.toDate || occurredAt < vietnamDayStart(getNextCalendarDate(filters.toDate)))
    );
  });
  const shown = matching.slice(0, AUDIT_LOG_ROW_LIMIT);
  const catalog = ordered.slice(0, AUDIT_FILTER_OPTION_ROW_LIMIT);

  const actorIds = [
    ...new Set(
      [...shown, ...catalog]
        .map((row) => row.actor_user_id)
        .filter((actorId): actorId is string => Boolean(actorId)),
    ),
  ];
  const actorsById = new Map<string, AuditActor>();
  for (const profile of auditPreviewProfiles) {
    if (!actorIds.includes(profile.id)) continue;
    actorsById.set(profile.id, {
      displayName: getActorDisplayName(profile.display_name, profile.email),
      email: profile.email,
      id: profile.id,
    });
  }

  const actorOptions: AuditActorOption[] = actorIds
    .map((actorId) => {
      const actor = actorsById.get(actorId);
      return { id: actorId, label: getAuditActorOptionLabel(actorId, actor) };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "vi"));

  const entries: AuditLogEntry[] = shown.map((row) => ({
    action: row.action,
    actor: row.actor_user_id ? actorsById.get(row.actor_user_id) ?? null : null,
    actorUserId: row.actor_user_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    metadata: row.metadata,
    module: row.module,
    newData: row.new_data,
    occurredAt: row.occurred_at,
    oldData: row.old_data,
    reason: row.reason,
    requestId: row.request_id,
  }));

  return {
    entries,
    filters,
    options: {
      actions: sortUnique(catalog.map((row) => row.action)),
      actors: actorOptions,
      entityTypes: sortUnique(catalog.map((row) => row.entity_type)),
      modules: sortUnique(catalog.map((row) => row.module)),
    },
    totalCount: matching.length,
  };
}
