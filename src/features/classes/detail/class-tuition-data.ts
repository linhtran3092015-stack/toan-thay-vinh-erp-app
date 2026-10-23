import "server-only";

import {
  buildSessionWindowFilter,
  fetchChunked,
  fetchPaged,
  getSessionClassIds,
  loadClassEnrollments,
  type SupabaseClient,
} from "@/features/classes/detail/class-detail-data";
import type {
  ClassTuitionPeriodOption,
  ClassTuitionRow,
  ClassTuitionView,
} from "@/features/classes/detail/class-tuition-models";
import { resolveReissueChains } from "@/features/tuition/reissue-chains";
import { compareStudentNames } from "@/lib/student-order";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Periods offered in the tab's picker, newest first: two school years of monthly periods. */
export const CLASS_TUITION_PERIOD_LIMIT = 24;

const PERIOD_COLUMNS = "id, name, starts_on, ends_on, due_on, status";

function toPeriodOption(row: { due_on: string | null; ends_on: string; id: string; name: string; starts_on: string; status: string }): ClassTuitionPeriodOption {
  return {
    dueOn: row.due_on,
    endsOn: row.ends_on,
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    status: row.status === "locked" ? "locked" : "draft",
  };
}

export async function getClassTuitionPeriods(): Promise<ClassTuitionPeriodOption[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tuition_collection_periods")
      .select(PERIOD_COLUMNS)
      .order("starts_on", { ascending: false })
      .limit(CLASS_TUITION_PERIOD_LIMIT);

    if (error) return null;

    return (data ?? []).map(toPeriodOption);
  } catch {
    return null;
  }
}

interface ClassStudent {
  fullName: string;
  publicCode: string | null;
}

/** Everyone ever enrolled in the class: a student who left mid-period was still billed for it. */
async function loadClassStudents(supabase: SupabaseClient, classId: string): Promise<Map<string, ClassStudent> | null> {
  const rows = await loadClassEnrollments(supabase, classId);
  return rows ? new Map(rows.map((row) => [row.studentId, { fullName: row.fullName, publicCode: row.publicCode }])) : null;
}

/**
 * Ids of the class's sessions, component sessions inside their link windows
 * included. Not bounded by the period: a locked item line keeps billing a
 * session that was rescheduled out of the period afterwards.
 */
async function loadClassSessionIds(supabase: SupabaseClient, classId: string): Promise<Set<string> | null> {
  const links = await getSessionClassIds(supabase, classId);
  if (!links) return null;

  const windowFilter = buildSessionWindowFilter(classId, links.windows);
  if (!windowFilter) return null;

  const rows = await fetchPaged<{ id: string }>((from, to) => {
    let query = supabase
      .from("class_sessions")
      .select("id")
      .in("class_id", links.classIds);
    if (links.windows.size > 0) query = query.or(windowFilter);
    return query.order("id", { ascending: true }).range(from, to);
  });

  return rows ? new Set(rows.map((row) => row.id)) : null;
}

type PaymentRequestRelation = { expected_amount_vnd: number | string; paid_amount_vnd: number | string; status: string };

interface ItemQueryRow {
  id: string;
  lines: Array<{ amount_vnd: number | string; class_session_id: string | null; line_kind: string; payable_session_count: number }> | null;
  payable_amount_vnd: number | string;
  payment_request?: PaymentRequestRelation | PaymentRequestRelation[] | null;
  reissued_from_item_id: string | null;
  student_id: string;
}

async function loadLockedRows(
  supabase: SupabaseClient,
  period: ClassTuitionPeriodOption,
  students: Map<string, ClassStudent>,
  sessionIds: Set<string>,
  canViewPayments: boolean,
): Promise<ClassTuitionRow[] | null> {
  const select = [
    "id",
    "student_id",
    "reissued_from_item_id",
    "payable_amount_vnd",
    "lines:tuition_collection_item_lines!tuition_collection_item_lines_item_id_fkey ( line_kind, class_session_id, payable_session_count, amount_vnd )",
    canViewPayments
      ? "payment_request:student_payment_requests!tuition_collection_items_payment_request_id_fkey ( status, expected_amount_vnd, paid_amount_vnd )"
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  const items = await fetchChunked([...students.keys()], (ids) =>
    fetchPaged<ItemQueryRow>((from, to) =>
      supabase
        .from("tuition_collection_items")
        .select(select)
        .eq("period_id", period.id)
        .in("student_id", ids)
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: ItemQueryRow[] | null; error: unknown }>,
    ),
  );

  if (!items) return null;

  const rows: ClassTuitionRow[] = [];

  for (const { current, original } of resolveReissueChains(items)) {
    const student = students.get(current.student_id);
    const lines = original.lines ?? [];
    const classLines = lines.filter((line) => line.line_kind === "session" && line.class_session_id && sessionIds.has(line.class_session_id));

    // Billed only for other classes in this period: not this class's row.
    if (!student || classLines.length === 0) continue;

    const request = Array.isArray(current.payment_request) ? current.payment_request[0] ?? null : current.payment_request ?? null;

    rows.push({
      amountVnd: classLines.reduce((sum, line) => sum + Number(line.amount_vnd), 0),
      blockers: [],
      fullName: student.fullName,
      includesOtherCharges: classLines.length < lines.length,
      itemAmountVnd: Number(current.payable_amount_vnd),
      openingBalanceSessions: null,
      payment: request
        ? { expectedVnd: Number(request.expected_amount_vnd), paidVnd: Number(request.paid_amount_vnd), status: request.status }
        : null,
      publicCode: student.publicCode,
      reissued: current.id !== original.id,
      sessions: classLines.reduce((sum, line) => sum + line.payable_session_count, 0),
      studentId: current.student_id,
    });
  }

  return rows.sort((a, b) => compareStudentNames(a.fullName, b.fullName));
}

interface PreviewQueryRow {
  blocker_code: string | null;
  acquisition_source_id: string | null;
  opening_balance_sessions: number | string | null;
  student_id: string;
  unit_price_vnd: number | string | null;
}

/**
 * A draft period has no items yet: the same preview the period page shows,
 * narrowed to rows whose enrolment class is this class (composite parents
 * included: their students' component sessions carry the parent's class id).
 */
function loadDraftPreview(supabase: SupabaseClient, classId: string, period: ClassTuitionPeriodOption): Promise<PreviewQueryRow[] | null> {
  return fetchPaged<PreviewQueryRow>((from, to) =>
    supabase
      .rpc("preview_tuition_collection_period", { p_period_id: period.id })
      .eq("class_id", classId)
      .order("student_id")
      .order("class_session_id")
      .range(from, to) as unknown as PromiseLike<{ data: PreviewQueryRow[] | null; error: unknown }>,
  );
}

function toDraftRows(preview: readonly PreviewQueryRow[], students: Map<string, ClassStudent>): ClassTuitionRow[] {
  const byStudent = new Map<string, ClassTuitionRow>();

  for (const line of preview) {
    const student = students.get(line.student_id);
    const row =
      byStudent.get(line.student_id) ??
      ({
        amountVnd: 0,
        blockers: [],
        fullName: student?.fullName ?? "Học sinh",
        includesOtherCharges: false,
        itemAmountVnd: null,
        openingBalanceSessions: Number(line.opening_balance_sessions ?? 0),
        payment: null,
        publicCode: student?.publicCode ?? null,
        reissued: false,
        sessions: 0,
        studentId: line.student_id,
      } satisfies ClassTuitionRow);

    row.sessions += 1;
    row.amountVnd += Number(line.unit_price_vnd ?? 0);
    // Same blockers as the period page's readiness check (summarizeTuitionPreview).
    const codes = [
      line.unit_price_vnd === null ? "MISSING_EFFECTIVE_TUITION_RATE" : null,
      line.acquisition_source_id ? null : "MISSING_ACQUISITION_SOURCE",
      line.blocker_code,
    ];
    for (const code of codes) if (code && !row.blockers.includes(code)) row.blockers.push(code);
    byStudent.set(line.student_id, row);
  }

  return [...byStudent.values()].sort((a, b) => compareStudentNames(a.fullName, b.fullName));
}

/**
 * One period of the class's tuition. The caller checks CLASS_TUITION_PERMISSIONS
 * (sessions.view tells this class's lines apart on a locked period, students.view
 * names the students). `null` = a read failed.
 */
export async function getClassTuitionView(
  classId: string,
  period: ClassTuitionPeriodOption,
  options: { canViewPayments: boolean },
): Promise<ClassTuitionView | null> {
  try {
    const supabase = await createSupabaseServerClient();

    let rows: ClassTuitionRow[] | null;

    if (period.status === "locked") {
      // The items read needs the student ids; the class's sessions do not.
      const [students, sessionIds] = await Promise.all([loadClassStudents(supabase, classId), loadClassSessionIds(supabase, classId)]);
      rows = students && sessionIds ? await loadLockedRows(supabase, period, students, sessionIds, options.canViewPayments) : null;
    } else {
      const [students, preview] = await Promise.all([loadClassStudents(supabase, classId), loadDraftPreview(supabase, classId, period)]);
      rows = students && preview ? toDraftRows(preview, students) : null;
    }

    if (!rows) return null;

    return { paymentsVisible: period.status === "locked" && options.canViewPayments, period, rows };
  } catch {
    return null;
  }
}

/** One period by id, for the action that switches periods; `null` when missing or unreadable. */
export async function getClassTuitionPeriod(periodId: string): Promise<ClassTuitionPeriodOption | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tuition_collection_periods")
      .select(PERIOD_COLUMNS)
      .eq("id", periodId)
      .maybeSingle();

    if (error || !data) return null;

    return toPeriodOption(data);
  } catch {
    return null;
  }
}
