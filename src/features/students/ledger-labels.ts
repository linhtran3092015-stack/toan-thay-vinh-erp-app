/** Ledger entry labels shared by server loaders and client cards (no server imports). */
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
  return Object.hasOwn(DB_LEDGER_ENTRY_TYPE_LABELS, entryType)
    ? DB_LEDGER_ENTRY_TYPE_LABELS[entryType]
    : `Loại phát sinh chưa hỗ trợ: ${entryType}`;
}
