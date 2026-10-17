import { PAYMENT_REQUEST_LOAD_LIMIT } from "@/features/finance/payment-request-directory-models";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

/**
 * Payment-request fixtures for /dev/lists?view=payment-requests. Server order
 * (created_at desc), Vietnam clock `sessionPreviewToday` (16/10/2026).
 *
 * Truthful to the database (map-rules-data §C): the four statuses something
 * writes (pending, partially_paid, paid, cancelled; never `expired`), `paidAt`
 * only on paid rows (the settling transfer's time), a cancelled row always has
 * nothing paid, an overpaid row stays `paid` with paid > expected, unit price =
 * round(expected / purchased) (bonus sessions excluded), codes
 * `PAY-YYMMDD-XXXXXXXXXXXX` with the UTC creation date, transfer code =
 * "NAME BIRTHYEAR PHONE CODE". Edge rows: pending requests created before
 * 02/10 (older than 14 days: "chờ quá 14 ngày"), one created at 01:30 on 10/10
 * Vietnam time (still 09/10 in UTC), one whose guardian the read could not
 * embed, a very long student name.
 *
 * Names: the read embeds student and guardian names through RLS that needs
 * `students.view`/`guardians.view` (owner only per the migrations). The fixtures
 * show names for every role; in production an accountant without those grants
 * would see the loader fallbacks ("Học viên", "Chưa cập nhật").
 */

interface PreviewStudent {
  birthYear: number;
  code: string;
  guardian: string | null;
  id: string;
  name: string;
  phone: string | null;
}

const students: readonly PreviewStudent[] = [
  { birthYear: 2014, code: "HV-0101", guardian: "Nguyễn Thị Mai", id: "d1000000-0000-4000-8000-000000000101", name: "Nguyễn Minh An", phone: "0912345678" },
  { birthYear: 2013, code: "HV-0102", guardian: "Trần Quốc Dũng", id: "d1000000-0000-4000-8000-000000000102", name: "Trần Gia Bảo", phone: "0903112233" },
  { birthYear: 2012, code: "HV-0103", guardian: "Lê Thị Hương", id: "d1000000-0000-4000-8000-000000000103", name: "Lê Hoàng Nam", phone: "0978445566" },
  { birthYear: 2014, code: "HV-0104", guardian: "Phạm Văn Toàn", id: "d1000000-0000-4000-8000-000000000104", name: "Phạm Thu Hà", phone: "0966778899" },
  { birthYear: 2011, code: "HV-0105", guardian: "Vũ Thị Nga", id: "d1000000-0000-4000-8000-000000000105", name: "Vũ Đức Huy", phone: "0932556677" },
  { birthYear: 2013, code: "HV-0106", guardian: "Đỗ Mạnh Cường", id: "d1000000-0000-4000-8000-000000000106", name: "Đỗ Khánh Linh", phone: "0918223344" },
  { birthYear: 2012, code: "HV-0107", guardian: "Bùi Thu Trang", id: "d1000000-0000-4000-8000-000000000107", name: "Bùi Quang Minh", phone: "0975334455" },
  // The guardian embed came back empty: "Chưa cập nhật" / "Chưa có SĐT".
  { birthYear: 2014, code: "HV-0108", guardian: null, id: "d1000000-0000-4000-8000-000000000108", name: "Hoàng Ngọc Mai", phone: null },
  { birthYear: 2011, code: "HV-0109", guardian: "Ngô Thị Bích", id: "d1000000-0000-4000-8000-000000000109", name: "Ngô Tuấn Kiệt", phone: "0944889900" },
  { birthYear: 2013, code: "HV-0110", guardian: "Tôn Thất Hùng", id: "d1000000-0000-4000-8000-000000000110", name: "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh", phone: "0989001122" },
  { birthYear: 2012, code: "HV-0111", guardian: "Đặng Văn Lâm", id: "d1000000-0000-4000-8000-000000000111", name: "Đặng Hải Đăng", phone: "0911222333" },
  { birthYear: 2014, code: "HV-0112", guardian: "Trịnh Thị Lan", id: "d1000000-0000-4000-8000-000000000112", name: "Trịnh Bảo Châu", phone: "0922333444" },
];

interface RequestRow {
  bonus?: number;
  createdAt: string;
  expected: number;
  paid?: number;
  /** Bank time of the settling transfer; paid rows only. */
  paidAt?: string;
  sessions: number;
  status: Exclude<PaymentRequestReadModel["status"], "expired">;
  student: number;
  topup: PaymentRequestReadModel["topupType"];
}

const rows: readonly RequestRow[] = [
  { createdAt: "2026-10-16T03:20:00Z", expected: 1_400_000, sessions: 10, status: "pending", student: 0, topup: "new" },
  { bonus: 2, createdAt: "2026-10-16T01:05:00Z", expected: 2_800_000, paid: 2_800_000, paidAt: "2026-10-16T02:10:00Z", sessions: 20, status: "paid", student: 1, topup: "renewal" },
  { createdAt: "2026-10-15T09:40:00Z", expected: 2_600_000, paid: 1_000_000, sessions: 20, status: "partially_paid", student: 2, topup: "renewal" },
  { bonus: 1, createdAt: "2026-10-15T02:00:00Z", expected: 1_400_000, sessions: 10, status: "pending", student: 3, topup: "new" },
  // Overpaid: still `paid`, the extra became sessions at settlement.
  { createdAt: "2026-10-14T08:15:00Z", expected: 1_400_000, paid: 1_500_000, paidAt: "2026-10-14T10:02:00Z", sessions: 10, status: "paid", student: 4, topup: "new" },
  { createdAt: "2026-10-14T03:30:00Z", expected: 1_400_000, sessions: 10, status: "cancelled", student: 5, topup: "new" },
  { bonus: 3, createdAt: "2026-10-13T07:45:00Z", expected: 3_900_000, paid: 3_900_000, paidAt: "2026-10-13T08:00:00Z", sessions: 30, status: "paid", student: 6, topup: "renewal" },
  { createdAt: "2026-10-12T10:00:00Z", expected: 1_400_000, sessions: 10, status: "pending", student: 7, topup: "new" },
  { createdAt: "2026-10-11T04:20:00Z", expected: 3_900_000, paid: 2_000_000, sessions: 30, status: "partially_paid", student: 8, topup: "renewal" },
  { bonus: 2, createdAt: "2026-10-10T02:30:00Z", expected: 2_800_000, paid: 2_800_000, paidAt: "2026-10-10T03:15:00Z", sessions: 20, status: "paid", student: 9, topup: "new" },
  // 01:30 on 10/10 in Vietnam, still 09/10 in UTC: a "Từ ngày 10/10" filter keeps it.
  { createdAt: "2026-10-09T18:30:00Z", expected: 1_300_000, sessions: 10, status: "pending", student: 10, topup: "renewal" },
  { createdAt: "2026-10-09T06:00:00Z", expected: 1_400_000, paid: 1_400_000, paidAt: "2026-10-09T06:45:00Z", sessions: 10, status: "paid", student: 11, topup: "new" },
  // Superseded by a reissued tuition slip: cancelled with nothing paid.
  { createdAt: "2026-10-08T03:10:00Z", expected: 1_400_000, sessions: 10, status: "cancelled", student: 0, topup: "new" },
  { createdAt: "2026-10-07T09:00:00Z", expected: 2_600_000, paid: 2_600_000, paidAt: "2026-10-07T12:00:00Z", sessions: 20, status: "paid", student: 1, topup: "renewal" },
  { createdAt: "2026-10-06T02:45:00Z", expected: 2_600_000, sessions: 20, status: "pending", student: 2, topup: "renewal" },
  { bonus: 1, createdAt: "2026-10-05T08:30:00Z", expected: 1_400_000, paid: 1_400_000, paidAt: "2026-10-05T09:00:00Z", sessions: 10, status: "paid", student: 3, topup: "new" },
  { createdAt: "2026-10-03T04:00:00Z", expected: 2_800_000, paid: 1_400_000, sessions: 20, status: "partially_paid", student: 4, topup: "new" },
  // 13:00 on 02/10 in Vietnam: 13 days 23 hours before the fixture clock, so not yet "chờ quá 14 ngày".
  { createdAt: "2026-10-02T06:00:00Z", expected: 1_400_000, sessions: 10, status: "pending", student: 3, topup: "new" },
  // Pending since 01/10 (Vietnam): more than 14 days before 16/10.
  { createdAt: "2026-10-01T03:00:00Z", expected: 1_400_000, sessions: 10, status: "pending", student: 5, topup: "new" },
  { createdAt: "2026-09-30T07:20:00Z", expected: 2_600_000, paid: 2_600_000, paidAt: "2026-10-01T01:00:00Z", sessions: 20, status: "paid", student: 6, topup: "renewal" },
  { bonus: 2, createdAt: "2026-09-28T02:15:00Z", expected: 2_600_000, sessions: 20, status: "pending", student: 8, topup: "renewal" },
  { createdAt: "2026-09-26T09:50:00Z", expected: 1_400_000, sessions: 10, status: "cancelled", student: 7, topup: "new" },
  { createdAt: "2026-09-25T03:30:00Z", expected: 1_400_000, paid: 1_400_000, paidAt: "2026-09-25T04:00:00Z", sessions: 10, status: "paid", student: 9, topup: "new" },
  { bonus: 3, createdAt: "2026-09-22T06:00:00Z", expected: 3_900_000, paid: 3_900_000, paidAt: "2026-09-23T02:00:00Z", sessions: 30, status: "paid", student: 10, topup: "renewal" },
  { createdAt: "2026-09-20T01:40:00Z", expected: 1_400_000, paid: 700_000, sessions: 10, status: "partially_paid", student: 11, topup: "new" },
  { createdAt: "2026-09-18T08:00:00Z", expected: 1_400_000, paid: 1_400_000, paidAt: "2026-09-18T09:30:00Z", sessions: 10, status: "paid", student: 0, topup: "new" },
  { createdAt: "2026-09-15T03:00:00Z", expected: 2_600_000, paid: 2_600_000, paidAt: "2026-09-15T04:20:00Z", sessions: 20, status: "paid", student: 1, topup: "renewal" },
  { createdAt: "2026-09-10T02:00:00Z", expected: 2_600_000, sessions: 20, status: "cancelled", student: 2, topup: "renewal" },
  { createdAt: "2026-09-05T04:30:00Z", expected: 1_400_000, paid: 1_400_000, paidAt: "2026-09-05T05:10:00Z", sessions: 10, status: "paid", student: 3, topup: "new" },
];

/** Deterministic 12 uppercase hex characters (the RPC uses md5(random())). */
function hex12(seed: number): string {
  let value = (seed * 2_654_435_761 + 1_013_904_223) >>> 0;
  let result = "";
  while (result.length < 12) {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    result += value.toString(16).padStart(8, "0");
  }
  return result.slice(0, 12).toUpperCase();
}

/** `student_payment_transfer_identity`: unaccented upper-case name, birth year, phone. */
function transferIdentity(student: PreviewStudent): string {
  const name = student.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/Đ/g, "D")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return [name, String(student.birthYear), student.phone].filter(Boolean).join(" ");
}

function toRequest(row: RequestRow, id: string, seed: number): PaymentRequestReadModel {
  const student = students[row.student];
  const publicCode = `PAY-${row.createdAt.slice(2, 4)}${row.createdAt.slice(5, 7)}${row.createdAt.slice(8, 10)}-${hex12(seed)}`;
  return {
    bonusSessions: row.bonus ?? 0,
    calculatedUnitPriceVnd: Math.round(row.expected / row.sessions),
    createdAt: row.createdAt,
    expectedAmountVnd: row.expected,
    guardianFullName: student.guardian,
    guardianPhone: student.phone,
    id,
    notes: null,
    paidAmountVnd: row.paid ?? 0,
    paidAt: row.status === "paid" ? (row.paidAt ?? null) : null,
    publicCode,
    purchasedSessions: row.sessions,
    status: row.status,
    studentFullName: student.name,
    studentId: student.id,
    studentPublicCode: student.code,
    topupType: row.topup,
    transferCode: `${transferIdentity(student)} ${publicCode}`,
  };
}

/** "normal": 29 requests, two pages. */
export const paymentRequestFixtures: PaymentRequestReadModel[] = rows.map((row, index) =>
  toRequest(row, `e1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, index + 1),
);

const HOUR_MS = 60 * 60 * 1000;
const CAPPED_NEWEST = Date.parse("2026-10-16T03:20:00Z");

/**
 * "capped": `PAYMENT_REQUEST_LOAD_LIMIT` (1000) requests, the read's cap, so the header says the
 * list only holds the newest 1000. The normal rows' shapes repeat every 7 hours
 * going back in time (newest first); timing fields are shifted with them.
 */
export const cappedPaymentRequestFixtures: PaymentRequestReadModel[] = Array.from({ length: PAYMENT_REQUEST_LOAD_LIMIT }, (_, index) => {
  const template = rows[index % rows.length];
  const createdMs = CAPPED_NEWEST - index * 7 * HOUR_MS;
  const createdAt = new Date(createdMs).toISOString();
  const paidAt = template.paidAt ? new Date(createdMs + HOUR_MS).toISOString() : undefined;
  return toRequest(
    { ...template, createdAt, paidAt },
    `e2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    10_000 + index,
  );
});
