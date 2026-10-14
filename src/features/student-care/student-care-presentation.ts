import type { BadgeTone } from "@/components/ui/badge";
import { attendanceStatusLabels, attendanceStatusTones } from "@/features/sessions/components/attendance-status-group";
import { studentStatusMeta } from "@/features/students/student-filters";
import { VIETNAM_TIME_ZONE } from "@/lib/datetime";
import type { StudentLifecycleStatus } from "@/types/domain";

import { careKindLabels, careRuleLabels, evidenceSchema, type CareDashboard, type CareDetail } from "./models";

/** Page title = the /student-care label in navigation.ts. */
export const CARE_PAGE_TITLE = "Chăm sóc học sinh";

/** A task (or the "unassigned" status filter / chip) without an owner. */
export const CARE_UNASSIGNED_LABEL = "Chưa giao";

/**
 * Why contact, schedule, Coaching, completion and the exception are not
 * offered on an unowned task: mutate_student_care rejects them with
 * STUDENT_CARE_CLAIM_FIRST until someone claims or is assigned the task.
 */
export const CARE_OWNER_REQUIRED_REASON = "Nhận hoặc giao việc trước khi ghi liên hệ / ngoại lệ.";

export type CareTaskRow = CareDashboard["rows"][number];
export type CareTask = CareDetail["task"];
export type CareTaskStatus = CareTask["status"];
export type CareEvidenceRow = {
  attendance_status: string | null;
  class_name: string;
  session_date: string;
  session_id: string;
  start_time: string;
  test_score: number | null;
};

/** Status → badge tone (design 13a): open neutral, in_progress info, following_up warning, completed success, cancelled neutral. */
export const careStatusTones: Record<CareTaskStatus, BadgeTone> = {
  cancelled: "neutral",
  completed: "success",
  following_up: "warning",
  in_progress: "info",
  open: "neutral",
};

/** Rule keys written by `student_care_calculate`, in display order. */
const RULE_ORDER = ["absence_streak", "absence_month", "low_test_streak"] as const;

const shortDateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
});

const timeOnly = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
});

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: VIETNAM_TIME_ZONE });

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** `12/10 21:53` in Vietnam time; "—" when missing. */
export function formatCareShortDateTime(value: string | null | undefined): string {
  const time = parse(value);
  if (time === null) return "—";
  const parts = Object.fromEntries(shortDateTime.formatToParts(new Date(time)).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`;
}

/** `14:02` when the timestamp falls on `now`'s Vietnam day, else `12/10 14:02`. */
export function formatCareClock(value: string | null | undefined, now: number): string {
  const time = parse(value);
  if (time === null) return "chưa có";
  return dayKey.format(new Date(time)) === dayKey.format(new Date(now))
    ? timeOnly.format(new Date(time))
    : formatCareShortDateTime(value);
}

/** "n phút/giờ/ngày" from a positive duration. */
function durationText(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
}

/** "vừa xong" · "3 phút trước" · "2 giờ trước" · "4 ngày trước". */
export function formatCareRelative(value: string | null | undefined, now: number): string | null {
  const time = parse(value);
  if (time === null) return null;
  const elapsed = Math.max(0, now - time);
  return elapsed < 60_000 ? "vừa xong" : `${durationText(elapsed)} trước`;
}

/** `2026-10-07` → `07/10`. */
function dayMonth(isoDate: string): string {
  const [, month = "", day = ""] = isoDate.split("-");
  return `${day}/${month}`;
}

/** The contact deadline shown in the queue: the promised follow-up, else the first-contact due, else the period due. */
export function getCareDueAt(row: Pick<CareTask, "contact_due_at" | "due_at" | "next_followup_at">): string | null {
  return row.next_followup_at ?? row.contact_due_at ?? row.due_at;
}


/**
 * "Quá hạn 2 giờ" / "Quá hạn 1 ngày" for an overdue row, measured from the
 * shown deadline (`getCareDueAt`). When that deadline is still ahead but the
 * dashboard marked the row overdue (the claim deadline passed while unowned),
 * it measures from the earliest deadline the dashboard's rule has passed;
 * "Quá hạn" alone when no deadline is in the past (clock skew).
 */
export function formatCareOverdue(
  row: Pick<CareTask, "claim_due_at" | "contact_due_at" | "due_at" | "first_contact_at" | "next_followup_at" | "owner_id">,
  now: number,
): string {
  const shown = parse(getCareDueAt(row));
  if (shown !== null && shown < now) return `Quá hạn ${durationText(now - shown)}`;
  const candidates = [
    row.owner_id === null ? row.claim_due_at : null,
    row.first_contact_at === null ? row.contact_due_at : null,
    row.due_at,
    row.next_followup_at,
  ]
    .map(parse)
    .filter((time): time is number => time !== null && time < now);
  return candidates.length ? `Quá hạn ${durationText(now - Math.min(...candidates))}` : "Quá hạn";
}

/** Evidence rows grouped by known rule key (unknown keys keep their raw key); `null` when unreadable. */
export function getCareEvidenceGroups(evidence: Record<string, unknown>): { rule: string; label: string; rows: CareEvidenceRow[] }[] | null {
  const parsed = evidenceSchema.safeParse(evidence);
  if (!parsed.success) return null;
  return Object.entries(parsed.data)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([rule, rows]) => ({ label: careRuleLabels[rule] ?? rule, rows, rule }));
}

function rank(rule: string): number {
  const index = (RULE_ORDER as readonly string[]).indexOf(rule);
  return index === -1 ? RULE_ORDER.length : index;
}

/** Rule labels of an alert in display order ("Vắng 2 buổi liên tiếp · Hai bài…"). */
export function getCareRuleLabels(evidence: Record<string, unknown>): string[] {
  return Object.keys(evidence)
    .filter((key) => key in careRuleLabels)
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => careRuleLabels[key]);
}

/**
 * Short evidence for one rule (design 13a): absences as their dates plus the
 * kind of absence, the month rule as "3 buổi T10", low scores in vi-VN
 * decimals "5,5 · 4,0".
 */
export function summarizeCareEvidence(rule: string, rows: CareEvidenceRow[]): string {
  if (rows.length === 0) return "";
  if (rule === "low_test_streak") return rows.map((row) => formatCareScore(row.test_score)).join(" · ");
  if (rule === "absence_month") return `${rows.length} buổi T${Number(rows[rows.length - 1].session_date.slice(5, 7))}`;
  const statuses = new Set(rows.map((row) => row.attendance_status));
  const kind = statuses.size === 1 && statuses.has("unexcused_absence")
    ? " không phép"
    : statuses.size === 1 && statuses.has("excused_absence") ? " có phép" : "";
  return `${rows.map((row) => dayMonth(row.session_date)).join(", ")}${kind}`;
}

/**
 * The "Dấu hiệu (bằng chứng)" cell: one line per rule for an alert
 * ("Vắng 2 buổi liên tiếp" + "07/10, 12/10 không phép"); the kind for monthly
 * ("Coaching tháng 10" + "chưa có liên hệ" while open) and follow-up rows.
 */
export function getCareSignalLines(row: Pick<CareTask, "evidence" | "first_contact_at" | "kind" | "period_month" | "status">): { label: string; detail: string }[] {
  if (row.kind === "alert") {
    const groups = getCareEvidenceGroups(row.evidence);
    if (!groups) return getCareRuleLabels(row.evidence).map((label) => ({ detail: "", label }));
    return groups.map((group) => ({ detail: summarizeCareEvidence(group.rule, group.rows), label: group.label }));
  }
  const open = row.status !== "completed" && row.status !== "cancelled";
  if (row.kind === "monthly") {
    const month = row.period_month ? ` ${Number(row.period_month.slice(5, 7))}` : "";
    return [{ detail: open && !row.first_contact_at ? "chưa có liên hệ" : "", label: `${careKindLabels.monthly}${month}` }];
  }
  return [{ detail: "", label: careKindLabels.followup }];
}

/** Attendance badge for an evidence row; `null` attendance has no badge. */
export function getCareAttendanceBadge(status: string | null): { label: string; tone: BadgeTone } | null {
  if (!status) return null;
  const known = status as keyof typeof attendanceStatusLabels;
  return attendanceStatusLabels[known]
    ? { label: attendanceStatusLabels[known], tone: attendanceStatusTones[known] }
    : { label: status, tone: "neutral" };
}

const scoreFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 1 });

/** 0–10 score with a vi-VN decimal comma and at least one decimal ("4,0", "5,5", "6,25"); "—" when missing. */
export function formatCareScore(value: number | null): string {
  return value === null ? "—" : scoreFormatter.format(value);
}

export function getCareLifecycleLabel(status: string): string {
  return studentStatusMeta[status as StudentLifecycleStatus]?.label ?? status;
}

export function isCareTaskClosed(status: CareTaskStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Who can do what on one task. Every command needs student_care.handle
 * (mutateCare and mutate_student_care check it first); reassigning and the
 * exception also need student_care.assign. Contact, schedule, Coaching,
 * completion and the exception need an owner (the RPC answers
 * STUDENT_CARE_CLAIM_FIRST otherwise): `needsOwner` says to claim or assign
 * first, which stay available.
 */
export function getCareTaskAbilities({
  canAssign,
  canHandle,
  task,
  userId,
}: {
  canAssign: boolean;
  canHandle: boolean;
  task: Pick<CareTask, "owner_id" | "status">;
  userId: string;
}) {
  const closed = isCareTaskClosed(task.status);
  const owned = task.owner_id !== null;
  return {
    canCancel: canHandle && canAssign && !closed && owned,
    canClaim: !closed && canHandle && task.status === "open" && (task.owner_id === null || task.owner_id === userId),
    canEdit: canHandle && !closed && owned && (canAssign || task.owner_id === userId),
    canReassign: canHandle && canAssign && !closed,
    closed,
    needsOwner: !closed && !owned,
  };
}

type CareEventLike = Pick<CareDetail["events"][number], "event_type" | "id" | "occurred_at" | "payload" | "task_id">;
type CareOwnerTask = Pick<CareTask, "completed_at" | "detected_at" | "id" | "kind" | "owner_id">;

/**
 * How the current owner got the task, for the header's "(nhận …)" /
 * "(được giao …)": the latest owner-changing event, or null when it does not
 * name the current owner (then the header shows no date).
 *
 * mutate_student_care (20260917101000_student_care_workflows.sql) logs
 * `claim` and `assign` on the task, and `assign_student` with task_id NULL
 * while it moves every open monthly/followup task of the student to the new
 * owner; each event's payload.owner_id is the command's owner_id (the
 * assignee; null for a claim, whose owner is the actor). So assign_student
 * counts only for a monthly/followup task, between its creation
 * (detected_at) and its end, and an assign / assign_student counts only when
 * its payload owner is task.owner_id.
 */
export function getCareOwnerEvent(events: CareEventLike[], task: CareOwnerTask): { at: string; kind: "claim" | "assign" } | null {
  if (!task.owner_id) return null;
  const followsStudent = task.kind === "monthly" || task.kind === "followup";
  const created = Date.parse(task.detected_at);
  const ended = task.completed_at ? Date.parse(task.completed_at) : Number.POSITIVE_INFINITY;
  const latest = events
    .filter((event) => {
      if (event.task_id === task.id) return event.event_type === "claim" || event.event_type === "assign";
      if (!followsStudent || event.task_id !== null || event.event_type !== "assign_student") return false;
      const at = Date.parse(event.occurred_at);
      return at >= created && at <= ended;
    })
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || b.id.localeCompare(a.id))[0];
  if (!latest) return null;
  const owner = typeof latest.payload.owner_id === "string" ? latest.payload.owner_id : null;
  if (latest.event_type === "claim") return owner === null || owner === task.owner_id ? { at: latest.occurred_at, kind: "claim" } : null;
  return owner === task.owner_id ? { at: latest.occurred_at, kind: "assign" } : null;
}

/** One control per queue row: claim an unowned, unstarted task when allowed; otherwise open it. */
export function getCareRowAction(row: Pick<CareTask, "owner_id" | "status">, canHandle: boolean): "claim" | "open" {
  return row.status === "open" && row.owner_id === null && canHandle ? "claim" : "open";
}
