import "server-only";

import { getSessionDirectory } from "@/features/sessions/data";
import { getUnlockedSessionQueueResult } from "@/features/sessions/unlocked-sessions-data";
import { getCachedUnreadNotificationCountResult } from "@/features/notifications/data";
import { getAttendanceVerificationPolicy, getCachedMyTimekeepingEntries } from "@/features/timekeeping/data";
import type { AttendanceVerificationPolicy, TimekeepingMyEntry } from "@/features/timekeeping/types";
import { getVietnamToday } from "@/lib/datetime";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TodaySessionItem {
  classCode: string;
  className: string;
  endTime: string;
  id: string;
  lockedAt: string | null;
  startTime: string;
  status: string;
}

export interface DashboardTodayReadModel {
  attendancePolicy: AttendanceVerificationPolicy | null;
  canCheckTimekeeping: boolean;
  /** `YYYY-MM-01` of the current month, for the live payroll estimate. */
  currentMonth: string;
  openEntry: Pick<TimekeepingMyEntry, "checkInAt" | "checkInMode" | "id" | "workShiftName"> | null;
  pending: {
    crmFollowUps: number | null;
    unlockedSessions: number | null;
    unreadNotifications: number | null;
  };
  showPayrollEstimate: boolean;
  today: string;
  /** Null when the user cannot view sessions. */
  todaySessions: TodaySessionItem[] | null;
}

/** Everything a staff member needs at a glance: shift, today's sessions, pending work, estimate. */
export async function getDashboardTodayReadModel(
  permissions: readonly PermissionCode[],
): Promise<DashboardTodayReadModel> {
  const has = (code: PermissionCode) => permissions.includes(code);
  const today = getVietnamToday();
  const currentMonth = `${today.slice(0, 7)}-01`;
  const canCheckTimekeeping = has("timekeeping.check");

  const [entries, policy, sessions, queue, unread, followUps] = await Promise.all([
    canCheckTimekeeping ? getCachedMyTimekeepingEntries().catch(() => null) : Promise.resolve(null),
    canCheckTimekeeping ? getAttendanceVerificationPolicy().catch(() => null) : Promise.resolve(null),
    has("sessions.view")
      ? getSessionDirectory({ dateFrom: today, dateTo: today, limit: 50 }).catch(() => null)
      : Promise.resolve(null),
    has("sessions.lock") ? getUnlockedSessionQueueResult(200).catch(() => null) : Promise.resolve(null),
    has("notifications.view") ? getCachedUnreadNotificationCountResult().catch(() => null) : Promise.resolve(null),
    has("crm.update") ? countMyDueFollowUps(today).catch(() => null) : Promise.resolve(null),
  ]);

  const openEntry = entries?.ok ? entries.entries.find((entry) => entry.status === "open") ?? null : null;

  return {
    attendancePolicy: policy?.ok ? policy.policy : null,
    canCheckTimekeeping,
    currentMonth,
    openEntry: openEntry
      ? { checkInAt: openEntry.checkInAt, checkInMode: openEntry.checkInMode, id: openEntry.id, workShiftName: openEntry.workShiftName }
      : null,
    pending: {
      crmFollowUps: followUps,
      unlockedSessions: queue?.ok ? queue.data.items.length : null,
      unreadNotifications: unread?.ok ? unread.data : null,
    },
    showPayrollEstimate: has("payroll.view"),
    today,
    todaySessions: sessions?.ok
      ? [...sessions.sessions]
          .sort((left, right) => left.startTime.localeCompare(right.startTime))
          .map((session) => ({
            classCode: session.classCode,
            className: session.className,
            endTime: session.endTime,
            id: session.id,
            lockedAt: session.lockedAt,
            startTime: session.startTime,
            status: session.status,
          }))
      : null,
  };
}

async function countMyDueFollowUps(today: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { count, error } = await supabase
    .from("crm_case_notes")
    .select("id, crm_cases!inner(sale_owner_id, status)", { count: "exact", head: true })
    .is("follow_up_done_at", null)
    .lte("follow_up_at", today)
    .eq("crm_cases.sale_owner_id", auth.user.id)
    .not("crm_cases.status", "in", "(converted,dropped)");
  return error ? null : (count ?? 0);
}
