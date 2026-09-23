import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TuitionPeriodListItem {
  dueOn: string | null;
  endsOn: string;
  id: string;
  name: string;
  startsOn: string;
  status: "draft" | "locked";
}

export interface TuitionPreviewRow {
  acquisitionSourceId: string | null;
  blockerCode: string | null;
  classId: string | null;
  classSessionId: string;
  enrollmentId: string | null;
  openingBalanceSessions: number;
  sessionDate: string;
  sessionKind: string;
  studentId: string;
  unitPriceVnd: number | null;
}

export interface TuitionSystemBlocker {
  code: "MISSING_RECEIPT_TEMPLATE" | "MISSING_RENEWAL_RECEIVING_ACCOUNT" | "AMBIGUOUS_RENEWAL_RECEIVING_ACCOUNT" | "PREVIEW_UNAVAILABLE";
  message: string;
}

interface TuitionPreviewDbRow {
  acquisition_source_id: string | null;
  blocker_code: string | null;
  class_id: string | null;
  class_session_id: string;
  enrollment_id: string | null;
  opening_balance_sessions: number;
  session_date: string;
  session_kind: string;
  student_id: string;
  unit_price_vnd: number | null;
}

export async function getTuitionPeriods(): Promise<TuitionPeriodListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tuition_collection_periods")
    .select("id, name, starts_on, ends_on, due_on, status")
    .order("starts_on", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => ({
    dueOn: row.due_on,
    endsOn: row.ends_on,
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    status: row.status === "locked" ? "locked" : "draft",
  }));
}

export async function getTuitionPeriodPreview(
  periodId: string,
): Promise<TuitionPreviewRow[]> {
  const supabase = await createSupabaseServerClient();
  // A period can contain thousands of student/session rows. PostgREST caps
  // each response; stable paging is required even when every row is blocked.
  const rows: TuitionPreviewDbRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.rpc("preview_tuition_collection_period", {
      p_period_id: periodId,
    }).order("student_id").order("class_session_id").range(offset, offset + pageSize - 1);
    if (error || !data) throw new Error("TUITION_PREVIEW_UNAVAILABLE");
    rows.push(...data as TuitionPreviewDbRow[]);
    if (data.length < pageSize) break;
  }
  return rows.map((row) => ({
    openingBalanceSessions: Number(row.opening_balance_sessions ?? 0),
    acquisitionSourceId: row.acquisition_source_id ?? null,
    blockerCode: row.blocker_code ?? null,
    classId: row.class_id ?? null,
    classSessionId: row.class_session_id,
    enrollmentId: row.enrollment_id ?? null,
    sessionDate: row.session_date,
    sessionKind: row.session_kind,
    studentId: row.student_id,
    unitPriceVnd: Number(row.unit_price_vnd ?? 0) || null,
  }));
}

/** Never turn a failed preview into an apparently ready, zero-student period. */
export async function getTuitionPeriodReadiness(period: TuitionPeriodListItem) {
  const [preview, blockers] = await Promise.allSettled([
    getTuitionPeriodPreview(period.id),
    getTuitionPeriodSystemBlockers(period),
  ]);
  const systemBlockers: TuitionSystemBlocker[] = blockers.status === "fulfilled" ? blockers.value : [];
  if (preview.status === "rejected" || blockers.status === "rejected") {
    systemBlockers.push({ code: "PREVIEW_UNAVAILABLE", message: "Không tải được đầy đủ dữ liệu kỳ thu. Vui lòng tải lại trước khi khóa kỳ." });
  }
  return { rows: preview.status === "fulfilled" ? preview.value : [], systemBlockers };
}

export interface TuitionStudentDetail {
  id: string;
  fullName: string;
  publicCode: string;
}

export interface TuitionLeadSourceItem {
  id: string;
  code: string;
  name: string;
}

export async function getTuitionLeadSources(): Promise<TuitionLeadSourceItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("crm_lead_sources")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name");
  if (error) return [];
  return data ?? [];
}

export async function getTuitionStudentDetails(studentIds: string[]): Promise<Record<string, TuitionStudentDetail>> {
  const supabase = await createSupabaseServerClient();
  const details: Record<string, TuitionStudentDetail> = {};
  const uniqueIds = [...new Set(studentIds)];
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const { data, error } = await supabase.from("students").select("id, full_name, public_code")
      .in("id", uniqueIds.slice(offset, offset + 200));
    if (error) continue;
    for (const student of data ?? []) {
      details[student.id] = { id: student.id, fullName: student.full_name, publicCode: student.public_code };
    }
  }
  return details;
}

export async function getTuitionStudentLabels(studentIds: string[]): Promise<Record<string, string>> {
  const details = await getTuitionStudentDetails(studentIds);
  const labels: Record<string, string> = {};
  for (const [id, info] of Object.entries(details)) {
    labels[id] = `${info.fullName} (${info.publicCode})`;
  }
  return labels;
}

/** System blockers have no individual student row, but must be visible before lock. */
export async function getTuitionPeriodSystemBlockers(period: TuitionPeriodListItem): Promise<TuitionSystemBlocker[]> {
  const supabase = await createSupabaseServerClient();
  const [{ count: accountCount, error: accountError }, { count: templateCount, error: templateError }] = await Promise.all([
    supabase.from("sepay_receiving_account_versions").select("id", { count: "exact", head: true }).eq("purpose", "renewal").eq("status", "active").lte("effective_from", period.endsOn).or(`effective_to.is.null,effective_to.gte.${period.endsOn}`),
    supabase.from("tuition_receipt_template_versions").select("id", { count: "exact", head: true }),
  ]);
  const blockers: TuitionSystemBlocker[] = [];
  if (templateError || !templateCount) blockers.push({ code: "MISSING_RECEIPT_TEMPLATE", message: "Chưa có mẫu Phiếu học phí đã xuất bản." });
  if (accountError || !accountCount) blockers.push({ code: "MISSING_RENEWAL_RECEIVING_ACCOUNT", message: "Chưa cấu hình tài khoản nhận học phí tái phí." });
  if (!accountError && (accountCount ?? 0) > 1) blockers.push({ code: "AMBIGUOUS_RENEWAL_RECEIVING_ACCOUNT", message: "Có nhiều tài khoản nhận học phí tái phí cùng hiệu lực." });
  return blockers;
}

export interface TuitionLockedItem { amountVnd:number; className:string; id:string; payableSessions:number; studentName:string; studentGrade:number; studentId:string; status:string; transferCode:string|null; }
export async function getTuitionLockedItems(periodId:string):Promise<TuitionLockedItem[]>{const s=await createSupabaseServerClient();const {data,error}=await s.from("tuition_collection_items").select("id,payable_amount_vnd,payable_sessions,status,student_id,student_snapshot,payment_contract_snapshot").eq("period_id",periodId).order("created_at");if(error)return [];return (data??[]).map(x=>{const st=x.student_snapshot as {full_name?:string;current_grade?:number;class_name?:string}; const p=x.payment_contract_snapshot as {transfer_code?:string}; return {id:x.id,amountVnd:Number(x.payable_amount_vnd),payableSessions:x.payable_sessions,studentId:x.student_id,studentName:st.full_name??"Học viên",studentGrade:st.current_grade??0,className:st.class_name??"Lớp snapshot",status:x.status,transferCode:p.transfer_code??null}})}
