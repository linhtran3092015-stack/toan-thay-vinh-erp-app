import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CenterSessionLedgerPage from "@/app/(app)/finance/session-ledger/page";

const data = vi.hoisted(() => ({ getCenterSessionLedgerEntriesResult: vi.fn() }));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

vi.mock("@/features/finance/data", () => data);
vi.mock("@/lib/permissions/database-permissions", () => permissions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Session ledger route states", () => {
  it("preserves the existing session_ledger.view permission-denied state", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: [],
    });

    render(await CenterSessionLedgerPage());

    expect(screen.getByText("Không có quyền xem Sổ cái số buổi")).toBeInTheDocument();
    expect(data.getCenterSessionLedgerEntriesResult).not.toHaveBeenCalled();
  });

  it("preserves the existing ledger-loader error state after session_ledger.view passes", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: ["session_ledger.view"],
    });
    data.getCenterSessionLedgerEntriesResult.mockResolvedValue({ ok: false });

    render(await CenterSessionLedgerPage());

    expect(screen.getByText("Không tải được sổ cái số buổi")).toBeInTheDocument();
  });

  // Step 14c: the route derives the ledger's link gates and Vietnam "today" from what it
  // already loads (permission codes, the clock); the loader call stays argument-free.
  const ledgerEntry = {
    classSessionId: "session-1",
    createdAt: "2026-08-09T18:30:00.000Z",
    deltaSessions: 12,
    effectiveOn: "2026-08-10",
    entryType: "payment_credit",
    id: "ledger-1",
    note: "Nap hoc phi tu dong qua SePay (VCB)",
    referenceCode: "PAY-260808-7C2E91A04B3D",
    studentFullName: "Nguyễn Minh An",
    studentId: "student-1",
    studentPublicCode: "HV-001",
    unitPriceVnd: 150_000,
  };

  async function renderLedgerWith(codes: string[]) {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["session_ledger.view", ...codes] });
    data.getCenterSessionLedgerEntriesResult.mockResolvedValue({ data: [ledgerEntry], ok: true });
    render(await CenterSessionLedgerPage());
  }

  it("renders the ledger without profile, session or payment-request links for session_ledger.view alone", async () => {
    await renderLedgerWith([]);

    expect(data.getCenterSessionLedgerEntriesResult).toHaveBeenCalledWith();
    expect(screen.getByRole("heading", { level: 1, name: "Sổ cái số buổi" })).toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Minh An")).toHaveLength(2);
    expect(screen.getAllByText("PAY-260808-7C2E91A04B3D")).toHaveLength(2);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("passes students.view, sessions.view and payments.view through as link gates", async () => {
    await renderLedgerWith(["students.view", "sessions.view", "payments.view"]);

    expect(screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /^Mở buổi học/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Xem yêu cầu thanh toán PAY-260808-7C2E91A04B3D" })).toHaveLength(2);
  });

  it("treats payments.manage like payments.view for the payment-request link", async () => {
    await renderLedgerWith(["payments.manage"]);

    expect(screen.getAllByRole("link", { name: "Xem yêu cầu thanh toán PAY-260808-7C2E91A04B3D" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Mở hồ sơ|Mở buổi học/ })).not.toBeInTheDocument();
  });

  it("formats the recorded time against today's Vietnam date, not the UTC date", async () => {
    // Only Date is faked. 00:30 on 01/01/2027 in Vietnam is still 31/12/2026 in UTC: a
    // UTC "today" would drop the year from a 2026 time; the Vietnam one keeps it.
    vi.useFakeTimers({ now: new Date("2026-12-31T17:30:00.000Z"), toFake: ["Date"] });
    try {
      await renderLedgerWith([]);
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByText("ghi nhận 10/08/2026 01:30")).toBeInTheDocument();
  });
});
