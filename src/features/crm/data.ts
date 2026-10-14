import { getVietnamToday } from "@/lib/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isCrmSaleOwnerId, sanitizeCrmSearchTerm } from "./crm-directory-url-state";
import {
  CRM_CASE_STATUSES,
  CRM_HIDDEN_NEW_SALE_OWNER_NAME,
  getCrmSaleOwnerName,
  getNextScheduledTrialDate,
} from "./crm-presentation";
import type {
  CrmCaseDetailReadModel,
  CrmDirectoryOverview,
  CrmLeadItemReadModel,
  CrmStatusCounts,
  LeadSourceOption,
  SaleOwnerOption,
} from "./read-models";

export interface CrmDirectoryFilters {
  expectedGrade?: number | null;
  leadSourceCode?: string | null;
  saleOwnerId?: string | null;
  search?: string | null;
  status?: string | null;
}

export interface CrmDirectoryResult {
  /** True when the directory query failed (distinguishes an error from an empty result). */
  failed?: boolean;
  items: CrmLeadItemReadModel[];
  totalCount: number;
}

function getCrmSearchFilter(search: string): string | null {
  const cleaned = sanitizeCrmSearchTerm(search);
  if (!cleaned) return null;
  const term = `%${cleaned}%`;
  return `full_name.ilike.${term},public_code.ilike.${term},guardian_phone.ilike.${term},guardian_full_name.ilike.${term}`;
}

/** Sale filter as a profile id; anything else (a hand-edited URL) is ignored rather than failing the query. */
function getCrmSaleOwnerFilter(saleOwnerId: string | null | undefined): string | null {
  return isCrmSaleOwnerId(saleOwnerId) ? saleOwnerId : null;
}

export async function getCrmLeadDirectory(
  filters: CrmDirectoryFilters = {},
): Promise<CrmDirectoryResult> {
  const supabase = await createSupabaseServerClient();
  const leadSourceRelation = filters.leadSourceCode
    ? "lead_source:crm_lead_sources!inner(name, code)"
    : "lead_source:crm_lead_sources(name, code)";

  let query = supabase
    .from("crm_cases")
    .select(
      `
      id,
      public_code,
      full_name,
      birth_year,
      expected_grade,
      expected_level,
      expected_mode,
      guardian_phone,
      guardian_full_name,
      status,
      status_changed_at,
      drop_reason,
      created_at,
      sale_owner_id,
      student_id,
      ${leadSourceRelation},
      sale_owner:profiles!crm_cases_sale_owner_id_fkey(display_name),
      trial_bookings:crm_trial_bookings(trial_date, status)
    `,
      { count: "exact" },
    );

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.expectedGrade) {
    query = query.eq("expected_grade", filters.expectedGrade);
  }

  const saleOwnerId = getCrmSaleOwnerFilter(filters.saleOwnerId);
  if (saleOwnerId) {
    query = query.eq("sale_owner_id", saleOwnerId);
  }

  if (filters.leadSourceCode) {
    query = query.eq("lead_source.code", filters.leadSourceCode);
  }

  const searchFilter = filters.search ? getCrmSearchFilter(filters.search) : null;
  if (searchFilter) {
    query = query.or(searchFilter);
  }

  query = query.order("created_at", { ascending: false }).limit(100);

  const { data, count, error } = await query;

  if (error || !data) {
    return { failed: true, items: [], totalCount: 0 };
  }

  const items: CrmLeadItemReadModel[] = data.map((row) => ({
    birthYear: row.birth_year,
    createdAt: row.created_at,
    expectedGrade: row.expected_grade,
    expectedLevel: row.expected_level,
    expectedMode: row.expected_mode,
    fullName: row.full_name,
    guardianFullName: row.guardian_full_name,
    guardianPhone: row.guardian_phone,
    id: row.id,
    leadSourceName: (row.lead_source as unknown as { name: string } | null)?.name ?? "Không xác định",
    publicCode: row.public_code,
    saleOwnerId: row.sale_owner_id,
    saleOwnerName: getCrmSaleOwnerName(row.sale_owner_id, (row.sale_owner as unknown as { display_name: string } | null)?.display_name),
    status: row.status as CrmLeadItemReadModel["status"],
    statusChangedAt: row.status_changed_at ?? null,
    dropReason: row.drop_reason ?? null,
    nextTrialDate: getNextScheduledTrialDate(row.trial_bookings as { status: string | null; trial_date: string | null }[] | null | undefined),
    studentId: row.student_id,
  }));

  return { items, totalCount: count ?? items.length };
}

/**
 * Lead counts per status for the quick filter chips. They respect every
 * directory filter except the status itself, so each chip says how many
 * leads choosing it would show. One head-count query per status (no rows
 * transferred); `null` when any count fails, so the chips never show a
 * partial picture.
 */
export async function getCrmStatusCounts(
  filters: Omit<CrmDirectoryFilters, "status"> = {},
): Promise<CrmStatusCounts | null> {
  const supabase = await createSupabaseServerClient();
  const columns: string = filters.leadSourceCode
    ? "id, lead_source:crm_lead_sources!inner(code)"
    : "id";

  const saleOwnerId = getCrmSaleOwnerFilter(filters.saleOwnerId);
  const searchFilter = filters.search ? getCrmSearchFilter(filters.search) : null;

  const counts = await Promise.all(
    CRM_CASE_STATUSES.map(async (status) => {
      let query = supabase
        .from("crm_cases")
        .select(columns, { count: "exact", head: true })
        .eq("status", status);

      if (filters.expectedGrade) query = query.eq("expected_grade", filters.expectedGrade);
      if (saleOwnerId) query = query.eq("sale_owner_id", saleOwnerId);
      if (filters.leadSourceCode) query = query.eq("lead_source.code", filters.leadSourceCode);
      if (searchFilter) query = query.or(searchFilter);

      const { count, error } = await query;
      return error || count === null ? null : count;
    }),
  );

  if (counts.some((count) => count === null)) return null;

  return Object.fromEntries(
    CRM_CASE_STATUSES.map((status, index) => [status, counts[index] as number]),
  ) as CrmStatusCounts;
}

/**
 * Header context of the lead list: leads created this Vietnam month and leads
 * waiting for enrollment confirmation, centre-wide (not narrowed by filters).
 */
export async function getCrmDirectoryOverview(now: Date = new Date()): Promise<CrmDirectoryOverview> {
  const supabase = await createSupabaseServerClient();
  const [year, month] = getVietnamToday(now).split("-");
  const monthStart = `${year}-${month}-01T00:00:00+07:00`;

  const [newLeads, pending] = await Promise.all([
    supabase.from("crm_cases").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("crm_cases").select("id", { count: "exact", head: true }).eq("status", "pending_enrollment_confirmation"),
  ]);

  return {
    monthLabel: `${month}/${year}`,
    newLeadsThisMonth: newLeads.error ? null : newLeads.count ?? null,
    pendingConfirmation: pending.error ? null : pending.count ?? null,
  };
}

export async function getCrmCaseDetail(
  caseId: string,
): Promise<CrmCaseDetailReadModel | null> {
  const supabase = await createSupabaseServerClient();

  const { data: caseRow, error: caseError } = await supabase
    .from("crm_cases")
    .select(
      `
      *,
      lead_source:crm_lead_sources(code, name),
      sale_owner:profiles!crm_cases_sale_owner_id_fkey(display_name)
    `,
    )
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseRow) {
    return null;
  }

  // Fetch trial bookings
  const { data: trialRows } = await supabase
    .from("crm_trial_bookings")
    .select("*")
    .eq("crm_case_id", caseId)
    .order("created_at", { ascending: false });

  // Fetch assignment history
  const { data: historyRows } = await supabase
    .from("crm_lead_assignment_history")
    .select(
      `
      id,
      assignment_method,
      reason,
      created_at,
      previous_sale_owner_id,
      prev_sale:profiles!crm_lead_assignment_history_previous_sale_owner_id_fkey(display_name),
      new_sale:profiles!crm_lead_assignment_history_new_sale_owner_id_fkey(display_name),
      assigner:profiles!crm_lead_assignment_history_assigned_by_fkey(display_name)
    `,
    )
    .eq("crm_case_id", caseId)
    .order("created_at", { ascending: false });

  // Working notes and follow-ups (RPC resolves author names).
  const { data: noteRows } = await supabase.rpc("get_crm_case_notes", { p_crm_case_id: caseId });

  // Fetch checklist
  const { data: checklistRow } = await supabase
    .from("student_enrollment_checklists")
    .select(
      `
      *,
      completer:profiles!student_enrollment_checklists_completed_by_fkey(display_name)
    `,
    )
    .eq("crm_case_id", caseId)
    .maybeSingle();

  return {
    assignmentHistory: (historyRows ?? []).map((h) => ({
      assignedByName: (h.assigner as unknown as { display_name: string } | null)?.display_name ?? null,
      assignmentMethod: h.assignment_method,
      createdAt: h.created_at,
      id: h.id,
      newSaleOwnerName: (h.new_sale as unknown as { display_name: string } | null)?.display_name ?? CRM_HIDDEN_NEW_SALE_OWNER_NAME,
      previousSaleOwnerId: h.previous_sale_owner_id ?? null,
      previousSaleOwnerName: (h.prev_sale as unknown as { display_name: string } | null)?.display_name ?? null,
      reason: h.reason,
    })),
    birthYear: caseRow.birth_year,
    caseNotes: (noteRows ?? []).map((n) => ({
      createdAt: n.created_at,
      createdBy: n.created_by,
      createdByName: n.created_by_name,
      followUpAt: n.follow_up_at,
      followUpDoneAt: n.follow_up_done_at,
      followUpDoneByName: n.follow_up_done_by_name,
      id: n.note_id,
      note: n.note,
    })),
    checklist: checklistRow
      ? {
          completedAt: checklistRow.completed_at,
          completedByName: (checklistRow.completer as unknown as { display_name: string } | null)?.display_name ?? null,
          id: checklistRow.id,
          isFullyCompleted: checklistRow.is_fully_completed,
          item1PaymentReceived: checklistRow.item_1_payment_received,
          item2SourceConfirmed: checklistRow.item_2_source_confirmed,
          item3SaleConfirmed: checklistRow.item_3_sale_confirmed,
          item4ClassSelected: checklistRow.item_4_class_selected,
          item5ModeConfirmed: checklistRow.item_5_mode_confirmed,
          item6FeeConfirmed: checklistRow.item_6_fee_confirmed,
          item7AssistantSessionsConfirmed: checklistRow.item_7_assistant_sessions_confirmed,
          item8AccountantTransactionConfirmed: checklistRow.item_8_accountant_transaction_confirmed,
          item9OfficialStartDateEntered: checklistRow.item_9_official_start_date_entered,
          item10CommunicationGroupReady: checklistRow.item_10_communication_group_ready,
        }
      : null,
    createdAt: caseRow.created_at,
    discountNotes: caseRow.discount_notes,
    dropReason: caseRow.drop_reason,
    droppedAt: caseRow.dropped_at,
    expectedGrade: caseRow.expected_grade,
    expectedLevel: caseRow.expected_level,
    expectedMode: caseRow.expected_mode,
    expectedOfficialStartDate: caseRow.expected_official_start_date,
    expectedTuitionFeeVnd: caseRow.expected_tuition_fee_vnd,
    fullName: caseRow.full_name,
    guardianFullName: caseRow.guardian_full_name,
    guardianId: caseRow.guardian_id,
    guardianPhone: caseRow.guardian_phone,
    guardianRelationship: caseRow.guardian_relationship,
    id: caseRow.id,
    leadSourceCode: (caseRow.lead_source as unknown as { code: string } | null)?.code ?? "",
    leadSourceName: (caseRow.lead_source as unknown as { name: string } | null)?.name ?? "Không xác định",
    nickname: caseRow.nickname,
    notes: caseRow.notes,
    provinceCity: caseRow.province_city,
    publicCode: caseRow.public_code,
    saleOwnerId: caseRow.sale_owner_id,
    saleOwnerName: getCrmSaleOwnerName(caseRow.sale_owner_id, (caseRow.sale_owner as unknown as { display_name: string } | null)?.display_name),
    status: caseRow.status as CrmCaseDetailReadModel["status"],
    statusChangedAt: caseRow.status_changed_at ?? null,
    studentId: caseRow.student_id,
    trialBookings: (trialRows ?? []).map((t) => ({
      classSessionId: t.class_session_id,
      createdAt: t.created_at,
      id: t.id,
      learningMode: t.learning_mode,
      resultRecordedAt: t.result_recorded_at ?? null,
      saleNotes: t.sale_notes,
      status: t.status,
      teacherFeedback: t.teacher_feedback,
      trialDate: t.trial_date,
    })),
  };
}

export async function getLeadSources(): Promise<LeadSourceOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("crm_lead_sources")
    .select("id, code, name, group_code")
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((row) => ({
    code: row.code,
    groupCode: row.group_code,
    id: row.id,
    name: row.name,
  }));
}

export async function getSaleOwners(): Promise<SaleOwnerOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("employment_status", "active")
    .order("display_name");

  return (data ?? []).map((row) => ({
    fullName: row.display_name ?? "Không có tên",
    id: row.id,
  }));
}
