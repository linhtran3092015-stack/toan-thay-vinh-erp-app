import {
  SessionLedgerHistory,
  SessionLedgerPermissionDenied,
} from "@/features/finance/components/session-ledger-history";

import { sessionPreviewToday } from "./session-fixtures";
import { cappedSessionLedgerEntries, sessionLedgerEntries } from "./session-ledger-fixtures";

export type SessionLedgerPreviewRole = "owner" | "ta" | "accountant";
export type SessionLedgerPreviewState = "normal" | "capped" | "empty";

/** The route's link gates per role (rules map §D, per migrations). */
const roleFlags: Record<
  Exclude<SessionLedgerPreviewRole, "ta">,
  { canViewPaymentRequests: boolean; canViewSessions: boolean; canViewStudents: boolean }
> = {
  /**
   * Kế toán: session_ledger.view and payments.view/manage, but not students.view
   * or sessions.view, so no profile or session links; PAY- codes link to the
   * payment-request list. The fixtures still show names: in production the
   * students embed is RLS-gated on students.view, so this role would see the
   * loader's "Học viên" fallback and no code unless the owner grants it.
   */
  accountant: { canViewPaymentRequests: true, canViewSessions: false, canViewStudents: false },
  owner: { canViewPaymentRequests: true, canViewSessions: true, canViewStudents: true },
};

/**
 * /dev/lists?view=session-ledger body (the controller wraps it in AppShell): the
 * real read-only SessionLedgerHistory over fixtures. It has no server action,
 * router or URL state, so nothing needs a stub. Fixed clock `sessionPreviewToday`.
 *
 * - owner: every link (student profile, class session, payment request).
 * - accountant: PAY- links only (see roleFlags).
 * - ta: no session_ledger.view in the migrations → the route's own denial.
 * - capped: exactly the loader's 100 rows. empty: the single in-frame empty state.
 */
export function SessionLedgerPreviewBody({
  role,
  state,
}: {
  role: SessionLedgerPreviewRole;
  state: SessionLedgerPreviewState;
}) {
  if (role === "ta") return <SessionLedgerPermissionDenied />;

  const entries =
    state === "empty" ? [] : state === "capped" ? cappedSessionLedgerEntries : sessionLedgerEntries;

  return <SessionLedgerHistory {...roleFlags[role]} entries={entries} today={sessionPreviewToday} />;
}
