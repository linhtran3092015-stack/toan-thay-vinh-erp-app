import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CrmCaseDetailReadModel,
  CrmLeadItemReadModel,
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
  items: CrmLeadItemReadModel[];
  totalCount: number;
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
      created_at,
      sale_owner_id,
      student_id,
      ${leadSourceRelation},
      sale_owner:profiles!crm_cases_sale_owner_id_fkey(display_name)
    `,
      { count: "exact" },
    );

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.expectedGrade) {
    query = query.eq("expected_grade", filters.expectedGrade);
  }

  if (filters.saleOwnerId) {
    query = query.eq("sale_owner_id", filters.saleOwnerId);
  }

  if (filters.leadSourceCode) {
    query = query.eq("lead_source.code", filters.leadSourceCode);
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `full_name.ilike.${term},public_code.ilike.${term},guardian_phone.ilike.${term},guardian_full_name.ilike.${term}`,
    );
  }

  query = query.order("created_at", { ascending: false }).limit(100);

  const { data, count, error } = await query;

  if (error || !data) {
    return { items: [], totalCount: 0 };
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
    saleOwnerName: (row.sale_owner as unknown as { display_name: string } | null)?.display_name ?? "Chưa phân công",
    status: row.status as CrmLeadItemReadModel["status"],
    studentId: row.student_id,
  }));

  return { items, totalCount: count ?? items.length };
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
      prev_sale:profiles!crm_lead_assignment_history_previous_sale_owner_id_fkey(display_name),
      new_sale:profiles!crm_lead_assignment_history_new_sale_owner_id_fkey(display_name),
      assigner:profiles!crm_lead_assignment_history_assigned_by_fkey(display_name)
    `,
    )
    .eq("crm_case_id", caseId)
    .order("created_at", { ascending: false });

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
      newSaleOwnerName: (h.new_sale as unknown as { display_name: string } | null)?.display_name ?? "Chưa rõ",
      previousSaleOwnerName: (h.prev_sale as unknown as { display_name: string } | null)?.display_name ?? null,
      reason: h.reason,
    })),
    birthYear: caseRow.birth_year,
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
    saleOwnerName: (caseRow.sale_owner as unknown as { display_name: string } | null)?.display_name ?? "Chưa phân công",
    status: caseRow.status as CrmCaseDetailReadModel["status"],
    studentId: caseRow.student_id,
    trialBookings: (trialRows ?? []).map((t) => ({
      classSessionId: t.class_session_id,
      createdAt: t.created_at,
      id: t.id,
      learningMode: t.learning_mode,
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
