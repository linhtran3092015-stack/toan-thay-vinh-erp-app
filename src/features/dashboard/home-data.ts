import "server-only";

import {
  fetchChunked,
  fetchPaged,
  getLockedSessionRosters,
  loadOpenRosters,
  OPEN_ROSTER_LIMIT,
  type SupabaseClient,
} from "@/features/classes/detail/class-detail-data";
import {
  ABSENCE_STATUSES,
  findNextClassSession,
  hasSessionEnded,
  tallyClassSessionAttendance,
  type AttendanceEntry,
  type RosterEntry,
} from "@/features/classes/detail/class-detail-models";
import { resolveReissueChains } from "@/features/classes/detail/class-tuition-data";
import { getCachedCurrentAuthUser } from "@/features/auth/current-user";
import {
  computeTuitionProgress,
  failedFeed,
  findMissingResults,
  forbiddenFeed,
  fromSection,
  getDashboardFeedAccess,
  getDashboardLayout,
  getWeekRange,
  pickCurrentTuitionPeriod,
  readyFeed,
  summarizeMyMonth,
  type AwaitingLockSessions,
  type DashboardFeed,
  type DashboardHomeReadModel,
  type DashboardSessionRow,
  type MissingResultItem,
  type MyMonthTimekeeping,
  type SepayBacklog,
  type TimekeepingToday,
  type TuitionProgress,
  type UnmarkedSessions,
  type WeekAttendance,
} from "@/features/dashboard/home-models";
import type { RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";
import { SEPAY_REVIEW_MATCH_STATUSES } from "@/features/finance/sepay-transaction-url-state";
import type { SessionStatus } from "@/features/sessions/read-models";
import { getUnlockedSessionQueueResult, type UnlockedSessionQueueResult } from "@/features/sessions/unlocked-sessions-data";
import { getCareDashboard } from "@/features/student-care/data";
import {
  getAttendanceVerificationPolicy,
  getCachedMyTimekeepingEntries,
  getMyMonthlyTimekeepingEntries,
} from "@/features/timekeeping/data";
import { addDays, getVietnamTime, getVietnamToday } from "@/lib/datetime";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Sessions read for today's schedule; a centre runs far fewer in one day. */
export const TODAY_SESSION_LIMIT = 80;
/** Scheduled or in-progress sessions read for the overdue "chưa điểm danh" count; more shows as "200+". */
export const OVERDUE_OPEN_LIMIT = 200;
/** Completed unlocked sessions read from the lock queue. */
export const UNLOCKED_QUEUE_LIMIT = 200;
/** Requests summed for the SePay backlog total; more marks the total as partial. */
export const SEPAY_BACKLOG_LIMIT = 500;
/** Tuition periods considered when picking the current one (newest first). */
const TUITION_PERIOD_LIMIT = 24;

const sessionStatuses: readonly SessionStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];


type ExecutiveSections = Pick<RoleAwareDashboardReadModel, "attention" | "receivablesAging" | "studentStatus">;

interface SessionQueryRow {
  class: { code: string; name: string } | { code: string; name: string }[] | null;
  class_id: string;
  end_time: string;
  id: string;
  learning_mode: string;
  locked_at: string | null;
  room_name: string | null;
  session_date: string;
  start_time: string;
  status: string;
}

const SESSION_COLUMNS = `
  id,
  class_id,
  session_date,
  start_time,
  end_time,
  learning_mode,
  room_name,
  status,
  locked_at,
  class:classes!class_sessions_class_id_fkey ( code, name )
`;

function embeddedClass(row: SessionQueryRow): { code: string; name: string } | null {
  return Array.isArray(row.class) ? row.class[0] ?? null : row.class;
}

/**
 * A session whose class did not come back (classes RLS needs classes.view,
 * which seeded roles other than owner may lack) would silently vanish; the
 * feed reports a failure instead of a false "no sessions" or "no backlog".
 */
function hasHiddenClass(rows: readonly SessionQueryRow[]): boolean {
  return rows.some((row) => embeddedClass(row) === null);
}

function toSessionRow(row: SessionQueryRow): DashboardSessionRow | null {
  const klass = embeddedClass(row);
  if (!klass || !(sessionStatuses as readonly string[]).includes(row.status)) return null;

  return {
    attendance: null,
    classCode: klass.code,
    classId: row.class_id,
    className: klass.name,
    endTime: row.end_time,
    id: row.id,
    learningMode: row.learning_mode,
    lockedAt: row.locked_at,
    roomName: row.room_name,
    rosterCount: null,
    sessionDate: row.session_date,
    startTime: row.start_time,
    status: row.status as SessionStatus,
  };
}

/**
 * Feed guard: a thrown read is a failed feed, never a page error. Every
 * failure is logged with the feed name so a block stuck on "Chưa tải được"
 * leaves a server trail.
 */
async function guard<T>(feed: string, load: () => Promise<DashboardFeed<T>>): Promise<DashboardFeed<T>> {
  try {
    const result = await load();
    if (result.status === "unavailable" && result.reason === "failed") console.error("DASHBOARD_FEED_FAILED", feed);
    return result;
  } catch (error) {
    console.error("DASHBOARD_FEED_FAILED", feed, error instanceof Error ? error.message : "unknown");
    return failedFeed;
  }
}

async function loadAttendance(supabase: SupabaseClient, sessionIds: readonly string[]): Promise<AttendanceEntry[] | null> {
  if (sessionIds.length === 0) return [];
  return fetchChunked(sessionIds, (ids) =>
    fetchPaged<AttendanceEntry>((from, to) =>
      supabase
        .from("session_attendance")
        .select("class_session_id, student_id, attendance_status")
        .in("class_session_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );
}

/**
 * Rosters and attendance tallies for a handful of sessions. Open sessions use
 * the per-session roster RPC (first OPEN_ROSTER_LIMIT by start time); locked
 * ones read their roster off the attendance, as on the class page. Without
 * attendance.view the roster size is still filled for open sessions.
 */
async function fillRosters(supabase: SupabaseClient, rows: DashboardSessionRow[], canViewAttendance: boolean): Promise<DashboardSessionRow[]> {
  const active = rows.filter((row) => row.status !== "cancelled");
  const openIds = active.filter((row) => !row.lockedAt).map((row) => row.id).slice(0, OPEN_ROSTER_LIMIT);
  const lockedIds = new Set(active.filter((row) => row.lockedAt).map((row) => row.id));

  const [open, attendance] = await Promise.all([
    openIds.length > 0 ? loadOpenRosters(supabase, openIds) : Promise.resolve({ entries: [], failedIds: new Set<string>() }),
    canViewAttendance ? loadAttendance(supabase, active.map((row) => row.id)) : Promise.resolve(null),
  ]);

  const rosters: RosterEntry[] = [...open.entries, ...(attendance ? getLockedSessionRosters(lockedIds, attendance) : [])];
  const resolved = new Set([...openIds.filter((id) => !open.failedIds.has(id)), ...(attendance ? lockedIds : [])]);
  const rosterSize = new Map<string, number>();
  for (const entry of rosters) rosterSize.set(entry.class_session_id, (rosterSize.get(entry.class_session_id) ?? 0) + 1);
  const tallies = attendance ? tallyClassSessionAttendance(rosters, attendance) : null;

  return rows.map((row) => {
    if (!resolved.has(row.id)) return row;
    const rosterCount = rosterSize.get(row.id) ?? 0;
    return {
      ...row,
      attendance: tallies ? tallies.get(row.id) ?? { absent: 0, additional: 0, present: 0, unmarked: 0 } : null,
      rosterCount,
    };
  });
}

type TodaySessions = { rows: DashboardSessionRow[]; truncated: boolean };

/** Today's session rows without rosters; fillRosters adds those separately. */
async function readTodaySessions(supabase: SupabaseClient, today: string): Promise<DashboardFeed<TodaySessions>> {
  const { data, error } = await supabase
    .from("class_sessions")
    .select(SESSION_COLUMNS)
    .eq("session_date", today)
    .order("start_time", { ascending: true })
    .limit(TODAY_SESSION_LIMIT + 1);

  if (error) return failedFeed;

  const raw = (data ?? []) as unknown as SessionQueryRow[];
  if (hasHiddenClass(raw)) return failedFeed;
  const rows = raw
    .slice(0, TODAY_SESSION_LIMIT)
    .map(toSessionRow)
    .filter((row): row is DashboardSessionRow => row !== null);

  return readyFeed({ rows, truncated: raw.length > TODAY_SESSION_LIMIT });
}

async function loadUpcomingSession(supabase: SupabaseClient, today: string, canViewAttendance: boolean): Promise<DashboardFeed<DashboardSessionRow | null>> {
  const { data, error } = await supabase
    .from("class_sessions")
    .select(SESSION_COLUMNS)
    .eq("status", "scheduled")
    .gt("session_date", today)
    .lte("session_date", addDays(today, 7))
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1);

  if (error) return failedFeed;

  const raw = (data ?? []) as unknown as SessionQueryRow[];
  if (hasHiddenClass(raw)) return failedFeed;
  const row = raw.map(toSessionRow).find((item) => item !== null) ?? null;
  if (!row) return readyFeed(null);

  const [filled] = await fillRosters(supabase, [row], canViewAttendance);
  return readyFeed(filled);
}

/**
 * Completed unlocked sessions with every roster student marked: only the lock
 * is left. Sessions still missing marks are counted by loadUnmarked instead;
 * an empty roster is left out because the lock RPC refuses it
 * (SESSION_HAS_NO_ELIGIBLE_ROSTER).
 */
async function loadAwaitingLock(queue: Promise<UnlockedSessionQueueResult>): Promise<DashboardFeed<AwaitingLockSessions>> {
  const result = await queue;
  if (!result.ok) return failedFeed;
  return readyFeed({
    count: result.data.items.filter((item) => item.missingAttendanceCount === 0 && item.rosterCount > 0).length,
    truncated: result.data.items.length >= UNLOCKED_QUEUE_LIMIT,
  });
}

/**
 * Sessions whose attendance is overdue: still scheduled after their end time
 * (nobody started them, so nobody could mark), started but never completed
 * after their end time (they never reach the lock queue or auto-lock), plus
 * completed unlocked sessions with roster students left unmarked (from the
 * lock queue).
 */
async function loadUnmarked(
  supabase: SupabaseClient,
  queue: Promise<UnlockedSessionQueueResult>,
  today: string,
  nowTime: string,
): Promise<DashboardFeed<UnmarkedSessions>> {
  const [overdueOpen, queueResult] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(SESSION_COLUMNS)
      .in("status", ["scheduled", "in_progress"])
      .lte("session_date", today)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(OVERDUE_OPEN_LIMIT + 1),
    queue,
  ]);

  if (overdueOpen.error || !queueResult.ok) return failedFeed;

  const raw = (overdueOpen.data ?? []) as unknown as SessionQueryRow[];
  if (hasHiddenClass(raw)) return failedFeed;
  // A session completed between the two reads is in both; the queue entry wins.
  const queuedIds = new Set(queueResult.data.items.map((item) => item.id));
  const overdue = raw
    .slice(0, OVERDUE_OPEN_LIMIT)
    .map(toSessionRow)
    .filter((row): row is DashboardSessionRow => row !== null && !queuedIds.has(row.id) && hasSessionEnded(row, today, nowTime));

  return readyFeed({
    items: [
      ...overdue.map((row) => ({
        classCode: row.classCode,
        className: row.className,
        id: row.id,
        reason: row.status === "in_progress" ? ("not_completed" as const) : ("not_started" as const),
        recorded: null,
        roster: null,
        sessionDate: row.sessionDate,
        startTime: row.startTime,
      })),
      ...queueResult.data.items
        .filter((item) => item.missingAttendanceCount > 0)
        .map((item) => ({
          classCode: item.classCode,
          className: item.className,
          id: item.id,
          reason: "incomplete" as const,
          recorded: Math.max(0, item.rosterCount - item.missingAttendanceCount),
          roster: item.rosterCount,
          sessionDate: item.sessionDate,
          startTime: item.startTime,
        })),
    ],
    truncated: raw.length > OVERDUE_OPEN_LIMIT || queueResult.data.items.length >= UNLOCKED_QUEUE_LIMIT,
  });
}

async function loadMissingResults(
  supabase: SupabaseClient,
  queue: Promise<UnlockedSessionQueueResult>,
): Promise<DashboardFeed<MissingResultItem[]>> {
  const queueResult = await queue;
  if (!queueResult.ok) return failedFeed;

  const sessions = queueResult.data.items.map((item) => ({
    classCode: item.classCode,
    className: item.className,
    id: item.id,
    sessionDate: item.sessionDate,
    startTime: item.startTime,
  }));
  const ids = sessions.map((session) => session.id);
  if (ids.length === 0) return readyFeed([]);

  const [attendance, results] = await Promise.all([
    loadAttendance(supabase, ids),
    fetchChunked(ids, (chunk) =>
      fetchPaged<{ class_session_id: string; student_id: string }>((from, to) =>
        supabase
          .from("session_results")
          .select("class_session_id, student_id")
          .in("class_session_id", chunk)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ),
  ]);

  if (!attendance || !results) return failedFeed;

  // Oldest first, like the lock queue.
  return readyFeed(findMissingResults(sessions, attendance, results));
}

async function loadSepayBacklog(supabase: SupabaseClient): Promise<DashboardFeed<SepayBacklog>> {
  const { count, data, error } = await supabase
    .from("sepay_transactions")
    .select("amount_vnd, transaction_at", { count: "exact" })
    .in("match_status", [...SEPAY_REVIEW_MATCH_STATUSES])
    .eq("transfer_type", "in")
    .order("transaction_at", { ascending: true })
    .limit(SEPAY_BACKLOG_LIMIT);

  if (error) return failedFeed;

  const rows = (data ?? []) as Array<{ amount_vnd: number | string; transaction_at: string }>;
  const total = count ?? rows.length;

  return readyFeed({
    count: total,
    oldestAt: rows[0]?.transaction_at ?? null,
    totalIsPartial: total > rows.length,
    totalVnd: rows.reduce((sum, row) => sum + Number(row.amount_vnd), 0),
  });
}

type PaymentRequestRelation = { expected_amount_vnd: number | string; paid_amount_vnd: number | string; status: string };

interface TuitionItemQueryRow {
  id: string;
  payable_amount_vnd: number | string;
  payment_request: PaymentRequestRelation | PaymentRequestRelation[] | null;
  reissued_from_item_id: string | null;
  student_id: string;
}

async function loadTuitionProgress(supabase: SupabaseClient, today: string): Promise<DashboardFeed<TuitionProgress | null>> {
  const { data, error } = await supabase
    .from("tuition_collection_periods")
    .select("id, name, starts_on, ends_on, due_on, status")
    .order("starts_on", { ascending: false })
    .limit(TUITION_PERIOD_LIMIT);

  if (error) return failedFeed;

  const periods = (data ?? []).map((row) => ({
    dueOn: row.due_on as string | null,
    endsOn: row.ends_on as string,
    id: row.id as string,
    name: row.name as string,
    startsOn: row.starts_on as string,
    status: row.status === "locked" ? ("locked" as const) : ("draft" as const),
  }));
  const period = pickCurrentTuitionPeriod(periods, today);

  if (!period) return readyFeed(null);
  // A draft period has no items or requests yet: the panel says so.
  if (period.status === "draft") return readyFeed(computeTuitionProgress(period, [], today));

  const items = await fetchPaged<TuitionItemQueryRow>((from, to) =>
    supabase
      .from("tuition_collection_items")
      .select(
        "id, student_id, reissued_from_item_id, payable_amount_vnd, payment_request:student_payment_requests!tuition_collection_items_payment_request_id_fkey ( status, expected_amount_vnd, paid_amount_vnd )",
      )
      .eq("period_id", period.id)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: TuitionItemQueryRow[] | null; error: unknown }>,
  );

  if (!items) return failedFeed;

  // A reissued item replaces the original: only the current one carries the live request.
  const requests = resolveReissueChains(items.map((item) => ({ ...item, lines: null }))).flatMap(({ current }) => {
    const request = Array.isArray(current.payment_request) ? current.payment_request[0] ?? null : current.payment_request ?? null;
    return request ? [{ expectedVnd: Number(request.expected_amount_vnd), paidVnd: Number(request.paid_amount_vnd), status: request.status }] : [];
  });

  return readyFeed(computeTuitionProgress(period, requests, today));
}

/** `YYYY-MM-DD` Vietnam midnight as a timestamp filter value. */
function vietnamDayStart(date: string): string {
  return `${date}T00:00:00+07:00`;
}

async function countCreatedSince(supabase: SupabaseClient, table: "students" | "crm_cases", since: string): Promise<DashboardFeed<number>> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).gte("created_at", vietnamDayStart(since));
  return error ? failedFeed : readyFeed(count ?? 0);
}

/**
 * Present vs absence marks on this week's started or completed sessions,
 * counted in the database (no rows transferred, no session cap).
 */
async function loadWeekAttendance(supabase: SupabaseClient, weekStart: string, today: string): Promise<DashboardFeed<WeekAttendance>> {
  const count = (statuses: readonly string[]) =>
    supabase
      .from("session_attendance")
      .select("id, session:class_sessions!inner(session_date, status)", { count: "exact", head: true })
      .in("attendance_status", [...statuses])
      .gte("session.session_date", weekStart)
      .lte("session.session_date", today)
      .in("session.status", ["in_progress", "completed"]);

  const [present, absent] = await Promise.all([count(["present"]), count(ABSENCE_STATUSES)]);
  if (present.error || absent.error) return failedFeed;

  return readyFeed({ absent: absent.count ?? 0, present: present.count ?? 0 });
}

async function countMyDueFollowUps(supabase: SupabaseClient, today: string): Promise<DashboardFeed<number>> {
  // Request-cached: the app shell already resolved the user for this render.
  const auth = await getCachedCurrentAuthUser();
  if (!auth.ok) return failedFeed;
  const { count, error } = await supabase
    .from("crm_case_notes")
    .select("id, crm_cases!inner(sale_owner_id, status)", { count: "exact", head: true })
    .is("follow_up_done_at", null)
    .lte("follow_up_at", today)
    .eq("crm_cases.sale_owner_id", auth.user.id)
    .not("crm_cases.status", "in", "(converted,dropped)");
  return error ? failedFeed : readyFeed(count ?? 0);
}

async function loadMyCareOverdue(): Promise<DashboardFeed<number>> {
  const dashboard = await getCareDashboard({ mine: "true", overdue: "true" });
  return dashboard ? readyFeed(dashboard.total) : failedFeed;
}

async function loadTimekeepingToday(today: string): Promise<DashboardFeed<TimekeepingToday>> {
  const [entries, policy] = await Promise.all([getCachedMyTimekeepingEntries(), getAttendanceVerificationPolicy().catch(() => null)]);
  if (!entries.ok) return failedFeed;
  const open = entries.entries.find((entry) => entry.status === "open") ?? null;
  const checkOuts = entries.entries
    .filter((entry) => entry.workDate === today && entry.checkOutAt !== null)
    .map((entry) => entry.checkOutAt as string)
    .sort();
  return readyFeed({
    lastCheckOutAt: open ? null : checkOuts.at(-1) ?? null,
    openEntry: open ? { checkInAt: open.checkInAt, checkInMode: open.checkInMode, id: open.id, workShiftName: open.workShiftName } : null,
    policy: policy?.ok ? policy.policy : null,
  });
}

async function loadMyMonth(today: string): Promise<DashboardFeed<MyMonthTimekeeping>> {
  const [year, month] = today.split("-").map(Number);
  const result = await getMyMonthlyTimekeepingEntries(month, year);
  return result.ok ? readyFeed(summarizeMyMonth(result.entries, today.slice(0, 7))) : failedFeed;
}

/**
 * Home dashboard read model (design 02). Every feed loads and fails on its
 * own; a feed the viewer may not read (or that its layout does not show) is
 * `forbidden` and is never queried. Executive figures (attention counts,
 * receivable aging, student status) come from the executive RPC the page
 * already loads, so they are not read twice.
 */
export async function getDashboardHomeReadModel(
  permissions: readonly PermissionCode[],
  /** The executive read model, or its pending promise so both loads run together; `null` = it failed. */
  executive: ExecutiveSections | null | Promise<ExecutiveSections | null>,
  now: Date = new Date(),
): Promise<DashboardHomeReadModel> {
  const today = getVietnamToday(now);
  const nowTime = getVietnamTime(now);
  const { weekEnd, weekStart } = getWeekRange(today);
  const layout = getDashboardLayout(permissions);
  const access = getDashboardFeedAccess(permissions);
  const canViewAttendance = permissions.includes("attendance.view");

  const supabase = await createSupabaseServerClient();

  // Shared by the unmarked, missing-results and awaiting-lock feeds; read once.
  const queue =
    access.unmarked || access.missingResults || access.awaitingLock
      ? getUnlockedSessionQueueResult(UNLOCKED_QUEUE_LIMIT).catch(() => ({ error: "", ok: false }) as const)
      : null;

  // Attached now so a rejection never goes unhandled while the feeds load.
  const sectionsPromise = Promise.resolve(executive).catch(() => null);

  const todayRowsPromise: Promise<DashboardFeed<TodaySessions>> = access.todaySessions ? guard("today-sessions", () => readTodaySessions(supabase, today)) : Promise.resolve(forbiddenFeed);
  const todaySessionsPromise: Promise<DashboardFeed<TodaySessions>> = todayRowsPromise.then((feed) =>
    feed.status === "ready" ? guard("today-rosters", async () => readyFeed({ ...feed.value, rows: await fillRosters(supabase, feed.value.rows, canViewAttendance) })) : feed,
  );
  // The next session of the week is only needed when today has none left. It
  // starts off today's rows, alongside their roster reads, not after every feed.
  const upcomingPromise: Promise<DashboardFeed<DashboardSessionRow | null>> = todayRowsPromise.then((todayFeed) => {
    if (!access.todaySessions) return forbiddenFeed;
    if (todayFeed.status !== "ready" || findNextClassSession(todayFeed.value.rows, today, nowTime) !== null) return readyFeed(null);
    return guard("upcoming-session", () => loadUpcomingSession(supabase, today, canViewAttendance));
  });

  const [
    awaitingLock,
    todaySessions,
    upcomingSession,
    unmarked,
    missingResults,
    sepay,
    tuition,
    crmFollowUps,
    careOverdue,
    newStudents,
    newLeads,
    weekAttendance,
    timekeeping,
    myMonth,
  ] = await Promise.all([
    access.awaitingLock && queue ? guard("awaiting-lock", () => loadAwaitingLock(queue)) : forbiddenFeed,
    todaySessionsPromise,
    upcomingPromise,
    access.unmarked && queue ? guard("unmarked", () => loadUnmarked(supabase, queue, today, nowTime)) : forbiddenFeed,
    access.missingResults && queue ? guard("missing-results", () => loadMissingResults(supabase, queue)) : forbiddenFeed,
    access.sepay ? guard("sepay", () => loadSepayBacklog(supabase)) : forbiddenFeed,
    access.tuition ? guard("tuition", () => loadTuitionProgress(supabase, today)) : forbiddenFeed,
    access.crmFollowUps ? guard("crm-follow-ups", () => countMyDueFollowUps(supabase, today)) : forbiddenFeed,
    access.careOverdue ? guard("care-overdue", loadMyCareOverdue) : forbiddenFeed,
    access.newStudents ? guard("new-students", () => countCreatedSince(supabase, "students", weekStart)) : forbiddenFeed,
    access.newLeads ? guard("new-leads", () => countCreatedSince(supabase, "crm_cases", weekStart)) : forbiddenFeed,
    access.weekAttendance ? guard("week-attendance", () => loadWeekAttendance(supabase, weekStart, today)) : forbiddenFeed,
    access.timekeeping ? guard("timekeeping", () => loadTimekeepingToday(today)) : forbiddenFeed,
    access.myMonth ? guard("my-month", () => loadMyMonth(today)) : forbiddenFeed,
  ]);

  // A failed executive read fails its three feeds, not the whole home.
  const sections = await sectionsPromise;

  return {
    awaitingLock,
    careOverdue,
    crmFollowUps,
    executive: sections
      ? {
          attention: fromSection(sections.attention),
          receivablesAging: fromSection(sections.receivablesAging),
          studentStatus: fromSection(sections.studentStatus),
        }
      : { attention: failedFeed, receivablesAging: failedFeed, studentStatus: failedFeed },
    layout,
    missingResults,
    myMonth,
    newLeads,
    newStudents,
    nowTime,
    permissions,
    sepay,
    timekeeping,
    today,
    todaySessions,
    tuition,
    unmarked,
    upcomingSession,
    weekAttendance,
    weekEnd,
    weekStart,
  };
}
