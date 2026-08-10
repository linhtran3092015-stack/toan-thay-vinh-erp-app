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
});
