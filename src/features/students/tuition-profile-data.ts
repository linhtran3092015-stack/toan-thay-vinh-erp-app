import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StudentTuitionProfile {
  currentRateVnd: number | null;
  rateHistory: Array<{ createdAt: string; effectiveFrom: string; reason: string; unitPriceVnd: number }>;
  sourceName: string | null;
  sources: Array<{ id: string; name: string }>;
  sourceHistory: Array<{ assignedAt:string; reason:string }>;
}

export async function getStudentTuitionProfile(studentId: string): Promise<StudentTuitionProfile> {
  const supabase = await createSupabaseServerClient();
  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) => todayParts.find((part) => part.type === type)?.value ?? "";
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const [{ data: rates }, { data: assignments }, { data: sources }, { data: sourceHistory }] = await Promise.all([
    supabase.from("student_tuition_rate_versions").select("effective_from, unit_price_vnd, reason, created_at").eq("student_id", studentId).order("effective_from", { ascending: false }),
    supabase.from("student_acquisition_source_assignments").select("lead_source_id, is_current, assigned_at").eq("student_id", studentId).eq("is_current", true).maybeSingle(),
    supabase.from("crm_lead_sources").select("id, name").order("name"),
    supabase.from("student_acquisition_source_assignments").select("assigned_at,reason").eq("student_id",studentId).order("assigned_at",{ascending:false}),
  ]);
  let sourceName: string | null = null;
  if (assignments?.lead_source_id) {
    const { data } = await supabase.from("crm_lead_sources").select("name").eq("id", assignments.lead_source_id).maybeSingle();
    sourceName = data?.name ?? null;
  }
  if (!sourceName) {
    const { data: crmCase } = await supabase.from("crm_cases").select("lead_source_id").eq("student_id", studentId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (crmCase?.lead_source_id) { const { data } = await supabase.from("crm_lead_sources").select("name").eq("id", crmCase.lead_source_id).maybeSingle(); sourceName = data?.name ?? null; }
  }
  const history = (rates ?? []).map((rate) => ({ createdAt: rate.created_at, effectiveFrom: rate.effective_from, reason: rate.reason, unitPriceVnd: Number(rate.unit_price_vnd) }));
  const currentRate = history.find((rate) => rate.effectiveFrom <= today) ?? null;
  return { currentRateVnd: currentRate?.unitPriceVnd ?? null, rateHistory: history, sourceName, sources: (sources ?? []).map((source) => ({ id: source.id, name: source.name })), sourceHistory:(sourceHistory??[]).map(x=>({assignedAt:x.assigned_at,reason:x.reason})) };
}
