import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const suggestionRowSchema = z.object({
  transaction_id: z.string().uuid(),
  transaction_at: z.string(),
  amount_vnd: z.number(),
  transfer_content: z.string().nullable(),
  account_purpose: z.string(),
  match_status: z.string(),
  student_id: z.string().uuid(),
  student_name: z.string(),
  student_code: z.string(),
  birth_year: z.number(),
  current_grade: z.number(),
  guardian_name: z.string(),
  guardian_phone: z.string(),
  unit_price_vnd: z.number().nullable(),
  suggested_sessions: z.number().nullable(),
  pending_request_id: z.string().uuid().nullable(),
  confidence: z.enum(["high", "medium"]),
  match_reasons: z.array(z.string()),
  candidate_rank: z.number(),
  candidate_count: z.number(),
});

export type SuggestionConfidence = "high" | "medium";

export interface AllocationSuggestionCandidate {
  birthYear: number;
  candidateRank: number;
  confidence: SuggestionConfidence;
  currentGrade: number;
  guardianName: string;
  guardianPhone: string;
  matchReasons: readonly string[];
  pendingRequestId: string | null;
  studentCode: string;
  studentId: string;
  studentName: string;
  suggestedSessions: number | null;
  unitPriceVnd: number | null;
}

export interface AllocationSuggestion {
  accountPurpose: "new_enrollment" | "renewal";
  amountVnd: number;
  candidateCount: number;
  candidates: readonly AllocationSuggestionCandidate[];
  transactionAt: string;
  transactionId: string;
  transferContent: string;
}

export type AllocationSuggestionsResult =
  | { data: readonly AllocationSuggestion[]; ok: true }
  | { error: string; ok: false };

/** Unmatched inbound SePay transfers with the students they most likely belong to. */
export async function getSepayAllocationSuggestionsResult(): Promise<AllocationSuggestionsResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("suggest_sepay_allocation_matches", { p_limit: 300 });

    if (error) {
      return { error: "Không tải được gợi ý khớp giao dịch.", ok: false };
    }

    const parsed = z.array(suggestionRowSchema).safeParse(data ?? []);
    if (!parsed.success) {
      return { error: "Dữ liệu gợi ý không đúng định dạng.", ok: false };
    }

    const byTransaction = new Map<string, AllocationSuggestion>();
    for (const row of parsed.data) {
      const purpose = row.account_purpose === "new_enrollment" ? "new_enrollment" : "renewal";
      const entry = byTransaction.get(row.transaction_id) ?? {
        accountPurpose: purpose,
        amountVnd: row.amount_vnd,
        candidateCount: row.candidate_count,
        candidates: [],
        transactionAt: row.transaction_at,
        transactionId: row.transaction_id,
        transferContent: row.transfer_content ?? "",
      };
      entry.candidates = [
        ...entry.candidates,
        {
          birthYear: row.birth_year,
          candidateRank: row.candidate_rank,
          confidence: row.confidence,
          currentGrade: row.current_grade,
          guardianName: row.guardian_name,
          guardianPhone: row.guardian_phone,
          matchReasons: row.match_reasons,
          pendingRequestId: row.pending_request_id,
          studentCode: row.student_code,
          studentId: row.student_id,
          studentName: row.student_name,
          suggestedSessions: row.suggested_sessions,
          unitPriceVnd: row.unit_price_vnd,
        },
      ];
      byTransaction.set(row.transaction_id, entry);
    }

    return { data: Array.from(byTransaction.values()), ok: true };
  } catch {
    return { error: "Không kết nối được hệ thống tài chính.", ok: false };
  }
}
