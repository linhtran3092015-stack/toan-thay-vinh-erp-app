import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";
import { SESSION_LEDGER_ENTRY_LIMIT } from "@/features/finance/session-ledger-models";
import { addDays } from "@/lib/datetime";

/*
 * Center session ledger rows as the writers in the migrations produce them
 * (rules map §B.2/§B.3), newest first by `created_at` like the loader:
 * - session_charge (session lock, regular/makeup only): -1, no unit price
 *   (null → 0 in the read model), no reference, unaccented machine note,
 *   `effective_on` = session date, a `class_session_id`.
 * - payment_credit / bonus_credit (SePay auto-match, manual history match, manual
 *   allocation): `PAY-YYMMDD-…` request code or `ALLOC-<tx uuid>`; the bonus
 *   row has no unit price; `effective_on` = Vietnam bank date.
 * - session_reversal: +1, unit price copied from the charge (null), no reference,
 *   the typed reason as note, the charge's class session.
 * - manual_adjustment: opening-balance import (`OPENING-BALANCE-…`, no price) and
 *   SePay allocation reversal (`REV-<tx uuid>`, price copied, "Đảo phân bổ SePay: …").
 * - one type the UI does not know yet (the DB check allows only the nine labelled
 *   types; this row stands for a type added before the UI learns it).
 * Times are UTC; the page shows them in Vietnam time (+7).
 */

const students = [
  ["student-0", "TTV-00100", "Nguyễn Minh Anh"],
  ["student-1", "TTV-00107", "Trần Gia Bảo"],
  ["student-2", "TTV-00114", "Lê Hoàng Nam"],
  ["student-3", "TTV-00121", "Phạm Thu Hà"],
  ["student-4", "TTV-00128", "Vũ Đức Huy"],
  ["student-5", "TTV-00135", "Đỗ Khánh Linh"],
  ["student-6", "TTV-00142", "Bùi Quang Minh"],
  ["student-7", "TTV-00149", "Tôn Nữ Hoàng Bảo Ngọc"],
] as const;

const REGULAR_CHARGE = "Tru 1 buoi cho buoi hoc (regular)";
const MAKEUP_CHARGE = "Tru 1 buoi cho buoi hoc (makeup)";
const AUTO_CREDIT = "Nap hoc phi tu dong qua SePay (VCB)";
const AUTO_BONUS = "Tang buoi hoc kem goi nap SePay";
const HISTORY_CREDIT = "Nạp học phí từ giao dịch lịch sử SePay đã đối soát";
const HISTORY_BONUS = "Tặng buổi học kèm giao dịch lịch sử SePay đã đối soát";
const OPENING_BALANCE = "Số dư buổi đầu kỳ từ import dữ liệu";

/** One SePay transaction: allocated by hand on 13/10, reversed on 15/10. */
const MISALLOCATED_TX = "5b0e2c4a-91d7-4f3e-8a62-0c9d1e7b3f58";

// [created at (UTC), effective on, entry type, student, delta, unit price (0 = null), reference, note, class session]
type LedgerRow = [string, string, string, number, number, number, string | null, string, string | null];

const recentRows: LedgerRow[] = [
  // Fri 16/10 10:20: SePay auto-match of a 12-session request + its 2 bonus sessions (one transaction, one timestamp).
  ["2026-10-16T03:20:00Z", "2026-10-16", "payment_credit", 0, 12, 150_000, "PAY-261014-7C2E91A04B3D", AUTO_CREDIT, null],
  ["2026-10-16T03:20:00Z", "2026-10-16", "bonus_credit", 0, 2, 0, "PAY-261014-7C2E91A04B3D", AUTO_BONUS, null],
  // Thu 15/10 18:05: lock of Toán 8B chiều 3-5-7 (present and absent students are both charged).
  ["2026-10-15T11:05:00Z", "2026-10-15", "session_charge", 3, -1, 0, null, REGULAR_CHARGE, "ses-8b-2026-10-15"],
  ["2026-10-15T11:05:00Z", "2026-10-15", "session_charge", 4, -1, 0, null, REGULAR_CHARGE, "ses-8b-2026-10-15"],
  ["2026-10-15T11:05:00Z", "2026-10-15", "session_charge", 5, -1, 0, null, REGULAR_CHARGE, "ses-8b-2026-10-15"],
  ["2026-10-15T11:05:00Z", "2026-10-15", "session_charge", 6, -1, 0, null, REGULAR_CHARGE, "ses-8b-2026-10-15"],
  // Thu 15/10 15:40: the 13/10 manual allocation reversed (each credit row negated, price copied, bonus without price).
  [
    "2026-10-15T08:40:00Z",
    "2026-10-15",
    "manual_adjustment",
    1,
    -10,
    160_000,
    `REV-${MISALLOCATED_TX}`,
    "Đảo phân bổ SePay: Phân bổ nhầm học sinh, phụ huynh xác nhận khoản chuyển khoản này đóng học phí cho em gái học lớp 7B online",
    null,
  ],
  [
    "2026-10-15T08:40:00Z",
    "2026-10-15",
    "manual_adjustment",
    1,
    -1,
    0,
    `REV-${MISALLOCATED_TX}`,
    "Đảo phân bổ SePay: Phân bổ nhầm học sinh, phụ huynh xác nhận khoản chuyển khoản này đóng học phí cho em gái học lớp 7B online",
    null,
  ],
  // Wed 14/10 21:30: lock of Toán 9A tối 2-4-6.
  ["2026-10-14T14:30:00Z", "2026-10-14", "session_charge", 0, -1, 0, null, REGULAR_CHARGE, "ses-9a-2026-10-14"],
  ["2026-10-14T14:30:00Z", "2026-10-14", "session_charge", 2, -1, 0, null, REGULAR_CHARGE, "ses-9a-2026-10-14"],
  ["2026-10-14T14:30:00Z", "2026-10-14", "session_charge", 7, -1, 0, null, REGULAR_CHARGE, "ses-9a-2026-10-14"],
  // Wed 14/10 20:10: a makeup session (học bù) charges like a regular one.
  ["2026-10-14T13:10:00Z", "2026-10-14", "session_charge", 6, -1, 0, null, MAKEUP_CHARGE, "ses-10nc-2026-10-14-bu"],
  // Wed 14/10 09:15: one 12/10 charge reversed with a typed reason (effective_on = the reversal day).
  [
    "2026-10-14T02:15:00Z",
    "2026-10-14",
    "session_reversal",
    2,
    1,
    0,
    null,
    "Điểm danh nhầm lớp: em Nam học bù ở lớp 10 nâng cao tối 12/10, không học buổi 9A",
    "ses-9a-2026-10-12",
  ],
  // Tue 13/10 16:10: manual allocation of a transfer without a request code (bank date 12/10).
  ["2026-10-13T09:10:00Z", "2026-10-12", "payment_credit", 1, 10, 160_000, `ALLOC-${MISALLOCATED_TX}`, "Phụ huynh chuyển khoản không ghi mã, kế toán đã gọi xác nhận", null],
  ["2026-10-13T09:10:00Z", "2026-10-12", "bonus_credit", 1, 1, 0, `ALLOC-${MISALLOCATED_TX}`, "Phụ huynh chuyển khoản không ghi mã, kế toán đã gọi xác nhận", null],
  // Mon 12/10 21:30: lock of Toán 9A (Nam's charge is reversed above).
  ["2026-10-12T14:30:00Z", "2026-10-12", "session_charge", 0, -1, 0, null, REGULAR_CHARGE, "ses-9a-2026-10-12"],
  ["2026-10-12T14:30:00Z", "2026-10-12", "session_charge", 2, -1, 0, null, REGULAR_CHARGE, "ses-9a-2026-10-12"],
  ["2026-10-12T14:30:00Z", "2026-10-12", "session_charge", 7, -1, 0, null, REGULAR_CHARGE, "ses-9a-2026-10-12"],
  // Mon 12/10 21:20: lock of Toán 10 nâng cao tối 2-6.
  ["2026-10-12T14:20:00Z", "2026-10-12", "session_charge", 6, -1, 0, null, REGULAR_CHARGE, "ses-10nc-2026-10-12"],
  ["2026-10-12T14:20:00Z", "2026-10-12", "session_charge", 0, -1, 0, null, REGULAR_CHARGE, "ses-10nc-2026-10-12"],
  ["2026-10-12T14:20:00Z", "2026-10-12", "session_charge", 1, -1, 0, null, REGULAR_CHARGE, "ses-10nc-2026-10-12"],
  // Mon 12/10 11:00: a historical SePay transaction matched by hand to its request (bank date 10/10).
  ["2026-10-12T04:00:00Z", "2026-10-10", "payment_credit", 3, 8, 140_000, "PAY-261009-A41F0B6C9E27", HISTORY_CREDIT, null],
  ["2026-10-12T04:00:00Z", "2026-10-10", "bonus_credit", 3, 1, 0, "PAY-261009-A41F0B6C9E27", HISTORY_BONUS, null],
  // Sat 10/10: a type the UI does not label → "Loại phát sinh chưa hỗ trợ: trial_credit".
  ["2026-10-10T02:30:00Z", "2026-10-10", "trial_credit", 5, 1, 0, null, "Ghi nhận buổi học thử theo quy trình cũ", null],
  // Thu 08/10: opening balances imported with the batch date 01/10 (one student owes 2 sessions).
  ["2026-10-08T03:00:00Z", "2026-10-01", "manual_adjustment", 4, 6, 0, "OPENING-BALANCE-3f1c9a7e", OPENING_BALANCE, null],
  ["2026-10-08T03:00:00Z", "2026-10-01", "manual_adjustment", 5, 3, 0, "OPENING-BALANCE-3f1c9a7e", OPENING_BALANCE, null],
  ["2026-10-08T03:00:00Z", "2026-10-01", "manual_adjustment", 7, -2, 0, "OPENING-BALANCE-3f1c9a7e", OPENING_BALANCE, null],
];

/*
 * Older routine weeks for the capped read, newest first from Wed 07/10: locks of
 * 9A (Mon/Wed/Fri 21:30), 10NC (Mon/Fri 21:20), 8B (Tue/Thu/Sat 18:05) and a
 * Tuesday-morning SePay auto-match. The 100-row cap cuts wherever it falls,
 * possibly through the oldest lock, exactly like the real read.
 */
function olderRoutineRows(): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (let offset = 0; rows.length < SESSION_LEDGER_ENTRY_LIMIT; offset += 1) {
    const day = addDays("2026-10-07", -offset);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const lock = (time: string, classKey: string, members: number[]) => {
      for (const student of members) {
        rows.push([`${day}T${time}Z`, day, "session_charge", student, -1, 0, null, REGULAR_CHARGE, `ses-${classKey}-${day}`]);
      }
    };

    if (weekday === 1 || weekday === 3 || weekday === 5) lock("14:30:00", "9a", [0, 2, 7]);
    if (weekday === 1 || weekday === 5) lock("14:20:00", "10nc", [6, 0, 1]);
    if (weekday === 2 || weekday === 4 || weekday === 6) lock("11:05:00", "8b", [3, 4, 5, 6]);
    if (weekday === 2) {
      const student = offset % students.length;
      const requestDay = addDays(day, -2).replaceAll("-", "").slice(2);
      const code = `PAY-${requestDay}-${(0x3d4e5f60718 + offset * 7919).toString(16).toUpperCase().padStart(12, "0")}`;
      rows.push([`${day}T03:00:00Z`, day, "payment_credit", student, 12, 150_000, code, AUTO_CREDIT, null]);
      rows.push([`${day}T03:00:00Z`, day, "bonus_credit", student, 2, 0, code, AUTO_BONUS, null]);
    }
  }
  return rows;
}

function toEntries(rows: LedgerRow[], prefix: string): CenterSessionLedgerEntryReadModel[] {
  return rows.map(([createdAt, effectiveOn, entryType, student, deltaSessions, unitPriceVnd, referenceCode, note, classSessionId], index) => {
    const [studentId, studentPublicCode, studentFullName] = students[student];
    return {
      classSessionId,
      createdAt,
      deltaSessions,
      effectiveOn,
      entryType,
      id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
      note,
      referenceCode,
      studentFullName,
      studentId,
      studentPublicCode,
      unitPriceVnd,
    };
  });
}

/** "normal": the last week and a half, every active writer plus one unsupported type. */
export const sessionLedgerEntries: CenterSessionLedgerEntryReadModel[] = toEntries(recentRows, "ledger");

/** "capped": exactly the loader's 100-row limit, so the page shows "Hiển thị 100 mục … (tối đa 100)." */
export const cappedSessionLedgerEntries: CenterSessionLedgerEntryReadModel[] = toEntries(
  [...recentRows, ...olderRoutineRows()].slice(0, SESSION_LEDGER_ENTRY_LIMIT),
  "ledger",
);
