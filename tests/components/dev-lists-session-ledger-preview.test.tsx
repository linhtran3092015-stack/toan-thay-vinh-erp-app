// Value: protects=the /dev/lists session-ledger body renders the real read-only /finance/session-ledger page from fixtures shaped like the migrations' writers (charges without price or code, PAY-/ALLOC- credits, a typed-reason reversal, opening-balance and REV- SePay-reversal adjustments, one unsupported type) on the fixed preview clock: the owner gets every link, the accountant only payment-request links (no students.view / sessions.view), the TA the route's own denial, "capped" fills the 100-row read and "empty" the single in-frame empty state;
// fails_when=a role gains a link its permissions do not grant, the TA stops seeing the route's denial copy, the capped set stops matching the loader limit, a fixture drifts from server order or from what the writers store (e.g. a priced or coded session charge like the /dev/student fixture), or a control appears on the read-only page;
// why_new=step 14c adds the session-ledger view to /dev/lists; seam=none (the page has no server action, router or URL state, and the body has no AppShell); no_claim=the /dev/lists wiring, shell and production 404 (dev-lists-preview.test.tsx) and the real route's gate and loader states (session-ledger-page.test.tsx)
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { sessionPreviewToday } from "@/app/dev/lists/session-fixtures";
import { cappedSessionLedgerEntries, sessionLedgerEntries } from "@/app/dev/lists/session-ledger-fixtures";
import { SessionLedgerPreviewBody } from "@/app/dev/lists/session-ledger-preview";
import { getLedgerEntryLabel } from "@/features/finance/components/session-ledger-history";
import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";
import { SESSION_LEDGER_ENTRY_LIMIT } from "@/features/finance/session-ledger-models";
import { toVietnamDate } from "@/lib/datetime";

// Run as a UTC host (like the production server), so a time formatted without the
// Vietnam time zone shows the wrong hour here too; the runner's TZ is restored after.
const timeZone = vi.hoisted(() => {
  const original = process.env.TZ;
  process.env.TZ = "UTC";
  return { original };
});

afterAll(() => {
  if (timeZone.original === undefined) delete process.env.TZ;
  else process.env.TZ = timeZone.original;
});

afterEach(cleanup);

const LIST = "Danh sách mục sổ cái số buổi mới nhất";
const DENIED = "Không có quyền xem Sổ cái số buổi";
const table = () => screen.getByRole("table", { name: LIST });
const isPaymentRequestCode = (code: string | null) => Boolean(code?.startsWith("PAY-"));
const isUnsupported = (entry: CenterSessionLedgerEntryReadModel) =>
  getLedgerEntryLabel(entry.entryType).startsWith("Loại phát sinh chưa hỗ trợ");

describe("session-ledger preview fixtures", () => {
  it.each([
    ["normal", sessionLedgerEntries],
    ["capped", cappedSessionLedgerEntries],
  ] as const)("keep the loader's newest-first order with unique ids (%s)", (_name, entries) => {
    for (let index = 1; index < entries.length; index += 1) {
      expect(entries[index - 1].createdAt >= entries[index].createdAt).toBe(true);
    }
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(toVietnamDate(entry.createdAt) <= sessionPreviewToday).toBe(true);
      expect(Number.isInteger(entry.deltaSessions)).toBe(true);
    }
  });

  it("fill exactly the 100-row read when capped and start with the normal rows", () => {
    expect(cappedSessionLedgerEntries).toHaveLength(SESSION_LEDGER_ENTRY_LIMIT);
    expect(sessionLedgerEntries.length).toBeLessThan(SESSION_LEDGER_ENTRY_LIMIT);
    expect(cappedSessionLedgerEntries.slice(0, sessionLedgerEntries.length)).toEqual(sessionLedgerEntries);
  });

  it("store what each writer stores", () => {
    const entries = cappedSessionLedgerEntries;
    for (const entry of entries.filter((row) => row.entryType === "session_charge")) {
      expect(entry).toMatchObject({ deltaSessions: -1, referenceCode: null, unitPriceVnd: 0 });
      expect(entry.note).toMatch(/^Tru 1 buoi cho buoi hoc \((regular|makeup)\)$/);
      expect(entry.classSessionId).toBeTruthy();
    }
    for (const entry of entries.filter((row) => row.entryType === "payment_credit")) {
      expect(entry.referenceCode).toMatch(/^(PAY-\d{6}-[0-9A-F]{12}|ALLOC-[0-9a-f-]{36})$/);
      expect(entry.unitPriceVnd).toBeGreaterThan(0);
      expect(entry.deltaSessions).toBeGreaterThan(0);
      expect(entry.classSessionId).toBeNull();
    }
    for (const entry of entries.filter((row) => row.entryType === "bonus_credit")) {
      expect(entry.referenceCode).toMatch(/^(PAY-|ALLOC-)/);
      expect(entry.unitPriceVnd).toBe(0);
    }
    for (const entry of entries.filter((row) => row.entryType === "session_reversal")) {
      expect(entry).toMatchObject({ deltaSessions: 1, referenceCode: null });
      expect(entry.classSessionId).toBeTruthy();
    }
    const adjustments = entries.filter((row) => row.entryType === "manual_adjustment");
    for (const entry of adjustments) {
      expect(entry.referenceCode).toMatch(/^(REV-[0-9a-f-]{36}|OPENING-BALANCE-[0-9a-f]{8})$/);
      if (entry.referenceCode?.startsWith("REV-")) expect(entry.note).toMatch(/^Đảo phân bổ SePay: /);
    }
    expect(adjustments.some((entry) => entry.referenceCode?.startsWith("REV-"))).toBe(true);
    expect(adjustments.some((entry) => entry.referenceCode?.startsWith("OPENING-BALANCE-"))).toBe(true);

    const known = new Set(["payment_credit", "bonus_credit", "session_charge", "session_reversal", "manual_adjustment"]);
    expect(new Set(sessionLedgerEntries.filter((entry) => !isUnsupported(entry)).map((entry) => entry.entryType))).toEqual(known);
    expect(sessionLedgerEntries.filter(isUnsupported)).toHaveLength(1);
  });
});

describe("SessionLedgerPreviewBody", () => {
  it("gives the owner every link on the normal rows, with nothing to click but links", () => {
    const { container } = render(<SessionLedgerPreviewBody role="owner" state="normal" />);
    const entries = sessionLedgerEntries;

    expect(screen.getByRole("heading", { level: 1, name: "Sổ cái số buổi" })).toBeInTheDocument();
    expect(screen.getByText(`Hiển thị ${entries.length} mục sổ cái mới nhất (tối đa 100).`)).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(entries.length + 1);
    expect(screen.getAllByRole("link", { name: /^Mở hồ sơ học viên / })).toHaveLength(entries.length * 2);
    expect(screen.getAllByRole("link", { name: /^Mở buổi học/ })).toHaveLength(
      entries.filter((entry) => entry.classSessionId).length * 2,
    );
    expect(screen.getAllByRole("link", { name: /^Xem yêu cầu thanh toán PAY-/ })).toHaveLength(
      entries.filter((entry) => isPaymentRequestCode(entry.referenceCode)).length * 2,
    );
    expect(screen.getAllByText(getLedgerEntryLabel(entries.find(isUnsupported)!.entryType))).toHaveLength(2);
    expect(container.querySelector(".text-danger")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("reads recording times on the fixed preview clock in Vietnam time", () => {
    render(<SessionLedgerPreviewBody role="owner" state="normal" />);

    // The 16/10 SePay credit + bonus (03:20 UTC) share one timestamp: 10:20 in Vietnam, same year → no year.
    expect(within(table()).getAllByText("ghi nhận 16/10 10:20")).toHaveLength(2);
  });

  it("gives the accountant payment-request links only: no profile or session links", () => {
    render(<SessionLedgerPreviewBody role="accountant" state="normal" />);
    const entries = sessionLedgerEntries;

    expect(within(table()).getAllByRole("row")).toHaveLength(entries.length + 1);
    expect(screen.queryByRole("link", { name: /Mở hồ sơ|Mở buổi học/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(
      entries.filter((entry) => isPaymentRequestCode(entry.referenceCode)).length * 2,
    );
    expect(screen.getAllByText(entries[0].studentFullName).length).toBeGreaterThan(0);
  });

  it.each(["normal", "capped", "empty"] as const)("shows the TA the route's own denial (%s)", (state) => {
    render(<SessionLedgerPreviewBody role="ta" state={state} />);

    expect(screen.getByRole("heading", { level: 1, name: DENIED })).toBeInTheDocument();
    expect(screen.getByText(/chưa được cấp quyền xem sổ buổi học/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each(["owner", "accountant"] as const)("fills the 100-row read when capped (%s)", (role) => {
    render(<SessionLedgerPreviewBody role={role} state="capped" />);

    expect(screen.getByText("Hiển thị 100 mục sổ cái mới nhất (tối đa 100).")).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(SESSION_LEDGER_ENTRY_LIMIT + 1);
    expect(screen.getAllByRole("listitem")).toHaveLength(SESSION_LEDGER_ENTRY_LIMIT);
  });

  it.each(["owner", "accountant"] as const)("renders the empty state once, without a list or a control (%s)", (role) => {
    render(<SessionLedgerPreviewBody role={role} state="empty" />);

    expect(screen.getByText("Chưa có mục sổ cái")).toBeInTheDocument();
    expect(screen.getByText("Chưa có mục sổ cái số buổi nào được ghi nhận.")).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(1);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
