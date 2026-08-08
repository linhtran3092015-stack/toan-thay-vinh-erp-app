import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SessionBalanceImportBatchDetail,
  SessionBalanceImportBatchRecord,
  SessionBalanceImportRowRecord,
  SessionBalanceUserProfile,
} from "@/features/imports/session-balances/types";

export async function getSessionBalanceImportBatchDetail(
  batchId: string,
): Promise<SessionBalanceImportBatchDetail | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: batchData, error: batchError } = await supabase
      .from("session_balance_import_batches")
      .select("*")
      .eq("id", batchId)
      .maybeSingle();

    if (batchError || !batchData) {
      return null;
    }

    const { data: rowsData, error: rowsError } = await supabase
      .from("session_balance_import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .order("source_row_number", { ascending: true });

    if (rowsError) {
      return null;
    }

    const profileIds = new Set<string>();
    if (batchData.created_by) profileIds.add(batchData.created_by);
    if (batchData.reconciled_by) profileIds.add(batchData.reconciled_by);
    if (batchData.approved_by) profileIds.add(batchData.approved_by);
    if (batchData.posted_by) profileIds.add(batchData.posted_by);

    const profiles: Record<string, SessionBalanceUserProfile> = {};

    if (profileIds.size > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", Array.from(profileIds));

      if (profilesData) {
        for (const p of profilesData) {
          profiles[p.id] = {
            email: p.email,
            full_name: p.display_name,
          };
        }
      }
    }

    const batchRecord: SessionBalanceImportBatchRecord = {
      approved_at: batchData.approved_at,
      approved_by: batchData.approved_by,
      created_at: batchData.created_at,
      created_by: batchData.created_by,
      effective_on: batchData.effective_on,
      excluded_count: batchData.excluded_count,
      id: batchData.id,
      invalid_count: batchData.invalid_count,
      metadata: (batchData.metadata as Record<string, unknown>) ?? {},
      no_change_count: batchData.no_change_count,
      posted_at: batchData.posted_at,
      posted_by: batchData.posted_by,
      posted_count: batchData.posted_count,
      reason: batchData.reason,
      reconciled_at: batchData.reconciled_at,
      reconciled_by: batchData.reconciled_by,
      review_count: batchData.review_count,
      row_count: batchData.row_count,
      source_filename: batchData.source_filename,
      source_sha256: batchData.source_sha256,
      status: batchData.status as SessionBalanceImportBatchRecord["status"],
      valid_count: batchData.valid_count,
    };

    const rowRecords: SessionBalanceImportRowRecord[] = (rowsData ?? []).map(
      (r) => ({
        batch_id: r.batch_id,
        created_at: r.created_at,
        current_balance_before: r.current_balance_before,
        delta_sessions: r.delta_sessions,
        excluded_reason: r.excluded_reason,
        expected_balance_after: r.expected_balance_after,
        id: r.id,
        ledger_entry_id: r.ledger_entry_id,
        source_balance: Number(r.source_balance),
        source_row_number: r.source_row_number,
        source_student_name: r.source_student_name,
        student_enrollment_id: r.student_enrollment_id,
        student_id: r.student_id,
        student_public_code: r.student_public_code,
        validation_code: r.validation_code,
        validation_message: r.validation_message,
        validation_status: r.validation_status as SessionBalanceImportRowRecord["validation_status"],
      }),
    );

    return {
      batch: batchRecord,
      profiles,
      rows: rowRecords,
    };
  } catch {
    return null;
  }
}
