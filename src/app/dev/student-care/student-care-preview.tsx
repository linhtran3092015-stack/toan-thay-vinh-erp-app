"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import { CareDetailView } from "@/features/student-care/components/care-detail-view";
import { CareQueueView } from "@/features/student-care/components/care-queue-view";
import type { CareDashboard, CareDetail, CareStudents } from "@/features/student-care/models";
import type { StudentCareActionOverrides } from "@/features/student-care/student-care-action-overrides";
import type { CareFilter, CareTab } from "@/features/student-care/student-care-url-state";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type StudentCarePreviewView = "list" | "detail";
export type StudentCarePreviewState = "normal" | "stale" | "paused" | "empty" | "error";
export type StudentCarePreviewRole = "handler" | "manager" | "owner";

const STUB = "Bản xem trước không ghi dữ liệu.";

/**
 * Inert stand-in for mutateCare, the only student-care server action. The
 * preview runs on localhost where .env.local may point at production, so no
 * claim, contact, completion, exception, assignment or configuration may
 * reach it: each answers with the stub message.
 */
export const previewStudentCareActions: Required<StudentCareActionOverrides> = {
  mutateCare: async () => ({ message: STUB, ok: false }),
};

/** 13/10/2026 14:05 in Vietnam: "chạy thành công 14:02 (3 phút trước)". */
export const PREVIEW_NOW = Date.parse("2026-10-13T07:05:00Z");

const USERS = {
  khoi: "d3000000-0000-4000-8000-000000000002",
  thao: "d3000000-0000-4000-8000-000000000001",
  vinh: "d3000000-0000-4000-8000-000000000003",
} as const;

const basePermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "notifications.view",
  "students.view",
  "coaching.view",
  "student_care.view",
  "student_care.handle",
];

const rolePermissions: Record<StudentCarePreviewRole, readonly PermissionCode[]> = {
  /** Trợ lý: views and handles care tasks. */
  handler: basePermissions,
  /** Quản lý trợ giảng: also assigns tasks and records exceptions. */
  manager: [...basePermissions, "student_care.assign"],
  /** Chủ trung tâm: also turns the generator on and off. */
  owner: DATABASE_PERMISSION_CODES,
};

const roleUsers: Record<StudentCarePreviewRole, { id: string; name: string }> = {
  handler: { id: USERS.thao, name: "Đặng Phương Thảo" },
  manager: { id: USERS.khoi, name: "Hoàng Minh Khôi" },
  owner: { id: USERS.vinh, name: "Nguyễn Văn Vinh" },
};

const assignees: CareDashboard["assignees"] = [
  { id: USERS.thao, name: "Đặng Phương Thảo", open_tasks: 5 },
  { id: USERS.khoi, name: "Hoàng Minh Khôi", open_tasks: 2 },
  { id: USERS.vinh, name: "Nguyễn Văn Vinh", open_tasks: 0 },
];

function session(id: number, date: string, status: string | null, score: number | null) {
  return {
    attendance_status: status,
    class_name: "Toán 9A tối 2-4-6",
    session_date: date,
    session_id: `d5000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    start_time: "19:30:00",
    test_score: score,
  };
}

type Row = CareDashboard["rows"][number];

function row(overrides: Partial<Row> & Pick<Row, "full_name" | "id" | "kind" | "public_code" | "status">): Row {
  return {
    claim_due_at: null,
    completed_at: null,
    contact_due_at: null,
    detected_at: "2026-10-12T14:53:00Z",
    due_at: null,
    evidence: {},
    evidence_current: true,
    first_contact_at: null,
    lifecycle_status: "active",
    next_followup_at: null,
    outcome: null,
    overdue: false,
    owner_id: USERS.thao,
    owner_name: "Đặng Phương Thảo",
    period_month: null,
    student_id: overrides.id.replace(/^d1/, "d2"),
    version: 1,
    ...overrides,
  };
}

const streakEvidence = { absence_streak: [session(13, "2026-10-07", "unexcused_absence", null), session(14, "2026-10-12", "unexcused_absence", null)] };

const rows: Row[] = [
  row({ claim_due_at: "2026-10-13T05:05:00Z", contact_due_at: "2026-10-14T14:53:00Z", evidence: streakEvidence, full_name: "Trần Gia Bảo", id: "d1000000-0000-4000-8000-000000000131", kind: "alert", overdue: true, owner_id: null, owner_name: null, public_code: "TTV-00131", status: "open" }),
  row({ claim_due_at: "2026-10-13T14:53:00Z", contact_due_at: "2026-10-14T14:53:00Z", evidence: { low_test_streak: [session(23, "2026-10-07", "present", 5.5), session(24, "2026-10-12", "present", 4)] }, full_name: "Bùi Quang Minh", id: "d1000000-0000-4000-8000-000000000117", kind: "alert", public_code: "TTV-00117", status: "in_progress", version: 2 }),
  row({ contact_due_at: "2026-10-12T05:05:00Z", detected_at: "2026-10-10T10:10:00Z", evidence: { absence_month: [session(31, "2026-10-02", "excused_absence", null), session(32, "2026-10-06", "unexcused_absence", null), session(33, "2026-10-09", "unexcused_absence", null)] }, full_name: "Mai Phương Linh", id: "d1000000-0000-4000-8000-000000000212", kind: "alert", overdue: true, public_code: "TTV-00212", status: "open" }),
  row({ detected_at: "2026-10-10T08:24:00Z", full_name: "Nguyễn Minh Anh", id: "d1000000-0000-4000-8000-000000000123", kind: "followup", next_followup_at: "2026-10-18T02:00:00Z", public_code: "TTV-00123", status: "following_up" }),
  row({ contact_due_at: "2026-10-20T16:59:00Z", detected_at: "2026-09-30T17:05:00Z", due_at: "2026-10-31T16:59:00Z", full_name: "Lý Nhật Quang", id: "d1000000-0000-4000-8000-000000000088", kind: "monthly", lifecycle_status: "resumed", owner_id: null, owner_name: null, period_month: "2026-10-01", public_code: "TTV-00088", status: "open" }),
  row({ completed_at: "2026-10-07T03:00:00Z", contact_due_at: "2026-10-07T14:40:00Z", detected_at: "2026-10-05T14:40:00Z", evidence: { low_test_streak: [session(41, "2026-09-30", "present", 5), session(42, "2026-10-03", "present", 5.5)] }, evidence_current: false, first_contact_at: "2026-10-06T03:00:00Z", full_name: "Hồ Anh Khoa", id: "d1000000-0000-4000-8000-000000000176", kind: "alert", owner_id: USERS.vinh, owner_name: "Nguyễn Văn Vinh", public_code: "TTV-00176", status: "completed" }),
  row({ completed_at: "2026-10-08T03:00:00Z", detected_at: "2026-09-30T17:05:00Z", due_at: "2026-10-31T16:59:00Z", first_contact_at: "2026-10-08T02:00:00Z", full_name: "Đỗ Khánh Linh", id: "d1000000-0000-4000-8000-000000000156", kind: "monthly", period_month: "2026-10-01", public_code: "TTV-00156", status: "completed" }),
  row({ completed_at: "2026-10-03T03:00:00Z", detected_at: "2026-09-30T17:05:00Z", due_at: "2026-10-31T16:59:00Z", full_name: "Ngô Tuấn Kiệt", id: "d1000000-0000-4000-8000-000000000171", kind: "monthly", lifecycle_status: "reserved", outcome: "Bảo lưu đến tháng 12", period_month: "2026-10-01", public_code: "TTV-00171", status: "cancelled" }),
];

/** The error state has no dashboard at all (`dashboardFor` returns null). */
const settingsFor: Record<Exclude<StudentCarePreviewState, "error">, CareDashboard["settings"]> = {
  empty: { enabled: true, last_error: null, last_reconcile_at: "2026-10-12T23:00:00Z", last_success_at: "2026-10-13T07:02:00Z" },
  normal: { enabled: true, last_error: null, last_reconcile_at: "2026-10-12T23:00:00Z", last_success_at: "2026-10-13T07:02:00Z" },
  paused: { enabled: false, last_error: null, last_reconcile_at: "2026-10-12T23:00:00Z", last_success_at: "2026-10-13T05:00:00Z" },
  stale: { enabled: true, last_error: "statement timeout khi đánh giá 3 học sinh", last_reconcile_at: "2026-10-12T23:00:00Z", last_success_at: "2026-10-13T06:45:00Z" },
};

function filterRows(all: Row[], filter: CareFilter, userId: string): Row[] {
  const search = filter.search?.toLocaleLowerCase("vi");
  return all.filter((item) =>
    (!filter.kind || item.kind === filter.kind)
    && (!filter.status || (filter.status === "unassigned" ? item.owner_id === null && item.status !== "completed" && item.status !== "cancelled" : item.status === filter.status))
    && (filter.overdue !== "true" || item.overdue)
    && (filter.mine !== "true" || item.owner_id === userId)
    && (!search || item.full_name.toLocaleLowerCase("vi").includes(search) || item.public_code.toLocaleLowerCase("vi").includes(search)));
}

function dashboardFor(state: StudentCarePreviewState, filter: CareFilter, userId: string): CareDashboard | null {
  if (state === "error") return null;
  const all = state === "empty" ? [] : rows;
  const shown = filterRows(all, filter, userId);
  return {
    assignees,
    month: filter.month ?? "2026-10-01",
    page: 1,
    queue: state === "stale" ? { failed: 0, pending: 4 } : { failed: 0, pending: 0 },
    rows: shown,
    settings: settingsFor[state],
    summary: state === "empty"
      ? { monthly_cancelled: 0, monthly_completed: 0, monthly_on_time: 0, monthly_total: 0, open_alerts: 0, overdue: 0, unassigned: 0 }
      : { monthly_cancelled: 4, monthly_completed: 212, monthly_on_time: 198, monthly_total: 312, open_alerts: 9, overdue: 3, unassigned: 4 },
    total: state === "empty" ? 0 : shown.length === rows.length ? 115 : shown.length,
  };
}

const studentRows: CareStudents["rows"] = [
  { full_name: "Bùi Quang Minh", id: "d2000000-0000-4000-8000-000000000117", lifecycle_status: "active", owner_id: USERS.thao, owner_name: "Đặng Phương Thảo", public_code: "TTV-00117" },
  { full_name: "Lý Nhật Quang", id: "d2000000-0000-4000-8000-000000000088", lifecycle_status: "resumed", owner_id: null, owner_name: null, public_code: "TTV-00088" },
  { full_name: "Trần Gia Bảo", id: "d2000000-0000-4000-8000-000000000131", lifecycle_status: "active", owner_id: USERS.khoi, owner_name: "Hoàng Minh Khôi", public_code: "TTV-00131" },
];
const inactiveRows: CareStudents["rows"] = [
  { full_name: "Ngô Tuấn Kiệt", id: "d2000000-0000-4000-8000-000000000171", lifecycle_status: "reserved", owner_id: USERS.thao, owner_name: "Đặng Phương Thảo", public_code: "TTV-00171" },
  { full_name: "Phan Thu Hà", id: "d2000000-0000-4000-8000-000000000204", lifecycle_status: "waiting_class", owner_id: null, owner_name: null, public_code: "TTV-00204" },
];

function studentsFor(state: StudentCarePreviewState, tab: CareTab): CareStudents | null {
  if (tab === "tasks" || state === "error") return null;
  const list = state === "empty" ? [] : tab === "inactive" ? inactiveRows : studentRows;
  return { rows: list, total: list.length };
}

const detailTask = rows[0];

function detailFor(state: StudentCarePreviewState): CareDetail | null {
  if (state === "error") return null;
  const quiet = state === "empty" || state === "paused";
  return {
    assignees,
    assignment: { owner_id: USERS.thao },
    available_coaching: quiet ? [] : [{ campaign_name: "Theo sát HS lớp 9 (mở 20/09)", id: "d6000000-0000-4000-8000-000000000001" }],
    coaching: [],
    contacts: [],
    events: quiet
      ? []
      : [
          { actor_name: "Đặng Phương Thảo", event_type: "contact", id: "d4000000-0000-4000-8000-000000000003", occurred_at: "2026-10-13T02:15:00Z", payload: { channel: "phone", next_followup_at: "2026-10-14T12:00:00Z", note: "Máy bận, nhắn Zalo", recipient: "guardian", success: false }, task_id: detailTask.id },
          { actor_name: "Đặng Phương Thảo", event_type: "claim", id: "d4000000-0000-4000-8000-000000000002", occurred_at: "2026-10-13T01:10:00Z", payload: {}, task_id: detailTask.id },
          { actor_name: null, event_type: "signals_updated", id: "d4000000-0000-4000-8000-000000000001", occurred_at: "2026-10-12T14:53:00Z", payload: { evidence: streakEvidence, source: "system" }, task_id: detailTask.id },
        ],
    student: { full_name: detailTask.full_name, id: detailTask.student_id, lifecycle_status: "active", public_code: detailTask.public_code },
    task: {
      claim_due_at: detailTask.claim_due_at,
      completed_at: null,
      contact_due_at: detailTask.contact_due_at,
      detected_at: detailTask.detected_at,
      due_at: null,
      evidence: detailTask.evidence,
      evidence_current: state !== "stale",
      first_contact_at: quiet ? null : "2026-10-13T02:15:00Z",
      id: detailTask.id,
      kind: "alert",
      next_followup_at: quiet ? null : "2026-10-14T12:00:00Z",
      outcome: null,
      owner_id: quiet ? null : USERS.thao,
      period_month: null,
      status: quiet ? "open" : "following_up",
      student_id: detailTask.student_id,
      version: quiet ? 1 : 3,
    },
  };
}

export function StudentCarePreview({
  filter,
  role,
  state,
  tab,
  view,
}: {
  filter: CareFilter;
  role: StudentCarePreviewRole;
  state: StudentCarePreviewState;
  tab: CareTab;
  view: StudentCarePreviewView;
}) {
  const permissions = rolePermissions[role];
  const can = (code: PermissionCode) => permissions.includes(code);
  const user = roleUsers[role];
  const detail = view === "detail" ? detailFor(state) : null;

  return (
    <AppShell
      authUser={{ displayName: user.name, email: "preview@example.com", id: "dev-user", initials: user.name.split(" ").map((part) => part[0]).slice(-2).join("") }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={view === "list" ? "/student-care" : `/student-care/${detailTask.id}`}
      unreadNotificationCount={3}
    >
      {view === "list" ? (
        <CareQueueView
          actions={previewStudentCareActions}
          canAssign={can("student_care.assign")}
          canConfigure={can("student_care.configure")}
          canHandle={can("student_care.handle")}
          data={dashboardFor(state, filter, user.id)}
          filter={filter}
          now={PREVIEW_NOW}
          students={studentsFor(state, tab)}
          tab={tab}
        />
      ) : detail ? (
        <CareDetailView
          actions={previewStudentCareActions}
          canAssign={can("student_care.assign")}
          canHandle={can("student_care.handle")}
          data={detail}
          listHref="/dev/student-care?view=list"
          userId={user.id}
        />
      ) : (
        <ErrorState description="Không tải được công việc chăm sóc. Vui lòng thử lại." />
      )}
    </AppShell>
  );
}
