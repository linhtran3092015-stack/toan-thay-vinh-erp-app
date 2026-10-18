// Value: protects=the /reports route keeps its gate and copy through the redesign: a permission read failure shows "Không tải được quyền truy cập" with the reports-specific description, an account without reports.view gets "Không có quyền xem Báo cáo" + the shared denial sentence, and an allowed account gets ReportsPage with its permissions and none of the preview-only props (so production always exports and links to /sessions); the new loading file announces "Đang tải báo cáo";
// fails_when=the gate or its copy changes, the page is rendered without reports.view, the route starts passing exportPreviewNotice or sessionListHref, or the loading file loses its status notice;
// why_new=step 14d: the route had no test and the page gained optional preview props; seam=getCachedDatabasePermissions mocked; ReportsPage mocked to capture props; no_claim=what the page renders (reports-page.test.tsx) or the export handler (reports-export-route.test.ts)
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportsLoading from "@/app/(app)/reports/loading";
import ReportsRoute from "@/app/(app)/reports/page";
import type { ReportsPage } from "@/features/reports/reports-page";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  ReportsPage: vi.fn(() => null),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/reports/reports-page", () => ({
  ReportsPage: dependencies.ReportsPage,
}));

type PageElement = ReactElement<ComponentProps<typeof ReportsPage>>;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Reports route", () => {
  it("says the permissions could not be loaded", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ error: { code: "query_failed", message: "x" }, ok: false });
    render(await ReportsRoute());

    expect(screen.getByText("Không tải được quyền truy cập")).toBeInTheDocument();
    expect(screen.getByText("Hệ thống chưa tải được quyền truy cập trung tâm Báo cáo.")).toBeInTheDocument();
    expect(dependencies.ReportsPage).not.toHaveBeenCalled();
  });

  it("denies an account without reports.view, even with module views", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["sessions.view", "students.view"] });
    render(await ReportsRoute());

    expect(screen.getByRole("heading", { name: "Không có quyền xem Báo cáo" })).toBeInTheDocument();
    expect(screen.getByText(permissionDeniedDescription("reports.view"))).toBeInTheDocument();
    expect(dependencies.ReportsPage).not.toHaveBeenCalled();
  });

  it("renders ReportsPage with the account's permissions and no preview-only prop", async () => {
    const permissions = ["reports.view", "sessions.view"];
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });

    const element = (await ReportsRoute()) as PageElement;

    expect(element.type).toBe(dependencies.ReportsPage);
    expect(element.props).toEqual({ permissions });
  });

  it("announces its own loading notice", () => {
    render(<ReportsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải báo cáo");
  });
});
