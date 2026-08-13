import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SepayTransactionsPage from "@/app/(app)/finance/sepay/page";

const data = vi.hoisted(() => ({ getSepayTransactionsResult: vi.fn() }));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

vi.mock("@/features/finance/data", () => data);
vi.mock("@/lib/permissions/database-permissions", () => permissions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SePay transaction history route states", () => {
  it("preserves the existing sepay.view permission-denied state", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: [],
    });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Không có quyền xem Giao dịch SePay")).toBeInTheDocument();
    expect(data.getSepayTransactionsResult).not.toHaveBeenCalled();
  });

  it("preserves the existing read failure state after sepay.view passes", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: ["sepay.view"],
    });
    data.getSepayTransactionsResult.mockResolvedValue({ ok: false });

    render(await SepayTransactionsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Không tải được giao dịch SePay")).toBeInTheDocument();
  });
});
