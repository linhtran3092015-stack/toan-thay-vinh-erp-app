import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StudentLedgerEntryReadModel {
  balanceAfter: number;
  createdAt: string;
  deltaSessions: number;
  effectiveOn: string;
  entryType: string;
  id: string;
  note: string;
  referenceCode: string | null;
  unitPriceVnd: number | null;
}

export interface StudentLedgerAlertReadModel {
  alertType: string;
  balanceSessions: number;
  description: string;
  severity: "warning" | "danger";
  title: string;
}

export interface StudentLedgerReadModel {
  alerts: StudentLedgerAlertReadModel[];
  balanceSessions: number;
  entries: StudentLedgerEntryReadModel[];
  latestEntryAt: string | null;
  ledgerEntryCount: number;
  totalCreditSessions: number;
  totalDebitSessions: number;
}

export const DB_LEDGER_ENTRY_TYPE_LABELS: Record<string, string> = {
  annual_carryover: "Kết chuyển năm",
  bonus_credit: "Tặng buổi",
  manual_adjustment: "Điều chỉnh thủ công",
  payment_credit: "Nạp học phí",
  refund_debit: "Hoàn phí / Trừ buổi",
  session_charge: "Trừ buổi học",
  session_reversal: "Hoàn buổi học",
  transfer_in: "Chuyển buổi đến",
  transfer_out: "Chuyển buổi đi",
};

export function formatLedgerEntryType(entryType: string): string {
  return DB_LEDGER_ENTRY_TYPE_LABELS[entryType] ?? entryType;
}

export async function getStudentLedgerSummary(
  studentId: string,
): Promise<StudentLedgerReadModel | null> {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch balance aggregate
  const { data: balanceData, error: balanceError } = await supabase
    .from("student_session_balances")
    .select(
      "student_id, balance_sessions, total_credit_sessions, total_debit_sessions, ledger_entry_count, latest_entry_at",
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (balanceError) {
    return null;
  }

  // 2. Fetch balance alerts
  const { data: alertData, error: alertError } = await supabase
    .from("student_session_balance_alerts")
    .select("alert_type, severity, title, description, balance_sessions")
    .eq("student_id", studentId);

  if (alertError) {
    return null;
  }

  // 3. Fetch running balance entries (top 50)
  const { data: entryData, error: entryError } = await supabase
    .from("student_session_ledger_running_balances")
    .select(
      "id, effective_on, created_at, entry_type, delta_sessions, balance_after, reference_code, note, unit_price_vnd",
    )
    .eq("student_id", studentId)
    .order("effective_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (entryError) {
    return null;
  }

  const alerts: StudentLedgerAlertReadModel[] = (alertData ?? []).map((row) => ({
    alertType: row.alert_type ?? "balance_alert",
    balanceSessions: row.balance_sessions ?? 0,
    description: row.description ?? "",
    severity: row.severity === "danger" ? "danger" : "warning",
    title: row.title ?? "Cảnh báo số dư",
  }));

  const entries: StudentLedgerEntryReadModel[] = (entryData ?? []).map((row) => ({
    balanceAfter: row.balance_after ?? 0,
    createdAt: row.created_at ?? "",
    deltaSessions: row.delta_sessions ?? 0,
    effectiveOn: row.effective_on ?? "",
    entryType: row.entry_type ?? "",
    id: row.id ?? "",
    note: row.note ?? "",
    referenceCode: row.reference_code ?? null,
    unitPriceVnd: row.unit_price_vnd ?? null,
  }));

  return {
    alerts,
    balanceSessions: balanceData?.balance_sessions ?? 0,
    entries,
    latestEntryAt: balanceData?.latest_entry_at ?? null,
    ledgerEntryCount: balanceData?.ledger_entry_count ?? 0,
    totalCreditSessions: balanceData?.total_credit_sessions ?? 0,
    totalDebitSessions: balanceData?.total_debit_sessions ?? 0,
  };
}
