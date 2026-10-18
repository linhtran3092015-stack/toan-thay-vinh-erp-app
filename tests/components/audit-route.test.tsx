// Value: protects=/audit keeps its gate and copy (permission-load error, audit.view denial shared with the preview through AUDIT_LOG_ACCESS), reads the seven GET params with parseAuditFilters (first value of a repeated param, missing → ""), stops leaking the audit_logs table name on a failed read and hands the loader's model to AuditLogPage unchanged with the default form target;
// fails_when=the gate or its copy drifts from the preview's constants, the loader runs without audit.view, a param name changes or a repeated param stops reading its first value, the error copy names a table again, or the route starts passing preview-only props (formAction/hiddenParams);
// why_new=step 14d moves the route's param parsing into audit-log-models.ts and rewords the read error; seam=getCachedDatabasePermissions, getAuditLogsResult and AuditLogPage are mocked (the page component captures its props); no_claim=the loader's query (audit-load-limits.test.ts) or the page's rendering (audit-log-page.test.tsx)
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuditRoute from "@/app/(app)/audit/page";
import type { AuditLogPage } from "@/features/audit/audit-log-page";
import { AUDIT_LOG_ACCESS } from "@/features/audit/audit-log-models";
import type { AuditLogReadModel } from "@/features/audit/read-models";

const dependencies = vi.hoisted(() => ({
  AuditLogPage: vi.fn(() => null),
  getAuditLogsResult: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/audit/data", () => ({
  getAuditLogsResult: dependencies.getAuditLogsResult,
}));
vi.mock("@/features/audit/audit-log-page", () => ({
  AuditLogPage: dependencies.AuditLogPage,
}));

type PageElement = ReactElement<ComponentProps<typeof AuditLogPage>>;

const model: AuditLogReadModel = {
  entries: [],
  filters: { action: "", actorId: "", entityId: "", entityType: "", fromDate: "", module: "rbac", toDate: "" },
  options: { actions: [], actors: [], entityTypes: [], modules: ["rbac"] },
  totalCount: 0,
};

async function renderRoute(
  permissions: string[] | null,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  dependencies.getCachedDatabasePermissions.mockResolvedValue(
    permissions ? { ok: true, permissions } : { ok: false },
  );
  return AuditRoute({ searchParams: Promise.resolve(searchParams) });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/audit route", () => {
  it("shows the permission-load error and reads nothing when permissions fail to load", async () => {
    render(await renderRoute(null));

    expect(screen.getByRole("heading", { name: "Không tải được quyền truy cập" })).toBeInTheDocument();
    expect(screen.getByText("Hệ thống chưa tải được quyền truy cập nhật ký.")).toBeInTheDocument();
    expect(dependencies.getAuditLogsResult).not.toHaveBeenCalled();
  });

  it("denies without audit.view with the copy the preview shares, before any read", async () => {
    render(await renderRoute(["notifications.view", "reports.view", "staff.view"]));

    expect(AUDIT_LOG_ACCESS).toEqual({ deniedTitle: "Không có quyền xem nhật ký hệ thống", permission: "audit.view" });
    expect(screen.getByRole("heading", { level: 1, name: AUDIT_LOG_ACCESS.deniedTitle })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tài khoản hiện tại chưa được cấp quyền xem nhật ký hệ thống. Liên hệ quản trị viên nếu bạn cần quyền này.",
      ),
    ).toBeInTheDocument();
    expect(dependencies.getAuditLogsResult).not.toHaveBeenCalled();
  });

  it("passes the seven params raw, first value of a repeated one, missing as empty", async () => {
    dependencies.getAuditLogsResult.mockResolvedValue({ data: model, ok: true });

    await renderRoute(["audit.view"], {
      actorId: ["a1", "a2"],
      fromDate: "2026-10-01",
      module: " rbac ",
      page: "3",
      view: "audit",
    });

    expect(dependencies.getAuditLogsResult).toHaveBeenCalledWith({
      action: "",
      actorId: "a1",
      entityId: "",
      entityType: "",
      fromDate: "2026-10-01",
      module: " rbac ",
      toDate: "",
    });
  });

  it("renders the page with the loader's model unchanged and the real form target", async () => {
    dependencies.getAuditLogsResult.mockResolvedValue({ data: model, ok: true });

    const element = (await renderRoute(["audit.view"])) as PageElement;

    expect(element.type).toBe(dependencies.AuditLogPage);
    expect(element.props).toEqual({ model });
  });

  it("explains a failed read without naming the table", async () => {
    dependencies.getAuditLogsResult.mockResolvedValue({ ok: false });

    const { container } = render(await renderRoute(["audit.view"]));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Không tải được nhật ký hệ thống" })).toBeInTheDocument();
    expect(screen.getByText("Không tải được dữ liệu nhật ký từ hệ thống.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/audit_logs/);
    expect(dependencies.AuditLogPage).not.toHaveBeenCalled();
  });
});
