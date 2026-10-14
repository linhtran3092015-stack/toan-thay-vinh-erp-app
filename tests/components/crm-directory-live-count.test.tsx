// Value: protects=after a filter change the /crm lead list still announces "Hiển thị n / total lead" to screen readers through a polite live region, as the pre-redesign page did (aria-live="polite" on the count line);
// fails_when=the result count is rendered only as static footer text, so a screen-reader user who changes a filter or chip hears nothing about how many leads now match;
// why_new=step 10 moved the count into the table footer (CrmResultSummary) without a live region and no test checks the announcement; seam=none;
// no_claim=does not prove a real screen reader announces it (jsdom; permissions and CRM loaders are mocked, next/navigation is stubbed for the client filters)
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CrmDirectoryPage from "@/app/(app)/crm/page";

const data = vi.hoisted(() => ({
  getCrmDirectoryOverview: vi.fn(),
  getCrmLeadDirectory: vi.fn(),
  getCrmStatusCounts: vi.fn(),
  getLeadSources: vi.fn(),
  getSaleOwners: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("status=interested"),
}));
vi.mock("@/features/crm/data", () => data);
vi.mock("@/lib/permissions/database-permissions", () => permissions);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CRM lead list result announcement", () => {
  it("announces the matching lead count in a polite live region", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["crm.view"] });
    data.getCrmLeadDirectory.mockResolvedValue({
      items: [{
        birthYear: 2013,
        createdAt: "2026-10-12T02:00:00Z",
        expectedGrade: 8,
        expectedLevel: "B",
        expectedMode: "offline",
        fullName: "Nguyễn Gia Hân",
        guardianFullName: "Nguyễn Thị Thu",
        guardianPhone: "0905123456",
        id: "case-1",
        leadSourceName: "MMA · Facebook",
        publicCode: "LD-2610-0001",
        saleOwnerId: "sale-1",
        saleOwnerName: "Hoàng Minh Khôi",
        status: "interested",
        studentId: null,
      }],
      totalCount: 1,
    });
    data.getCrmStatusCounts.mockResolvedValue(null);
    data.getCrmDirectoryOverview.mockResolvedValue({ monthLabel: "10/2026", newLeadsThisMonth: 1, pendingConfirmation: 0 });
    data.getLeadSources.mockResolvedValue([]);
    data.getSaleOwners.mockResolvedValue([]);

    const { container } = render(await CrmDirectoryPage({ searchParams: Promise.resolve({ status: "interested" }) }));

    const liveRegions = Array.from(container.querySelectorAll('[aria-live="polite"], [role="status"]'));
    expect(liveRegions.map((region) => region.textContent?.replace(/\s+/g, " ").trim())).toContainEqual(
      expect.stringContaining("Hiển thị 1 / 1 lead"),
    );
  });

  // Value (extension, fix pass 1): protects=the live region stays mounted when a filter leaves no lead, so the change to "Không có lead phù hợp" is announced (the region must exist before its text changes), and it is not duplicated by the table/record-list copies;
  // fails_when=the live region only renders in the ready state, or each layout renders its own region;
  // why_new=F1 moves the region out of the ready-only footer; seam=as above; no_claim=as above
  it("keeps one live region that announces an empty filter result", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["crm.view"] });
    data.getCrmLeadDirectory.mockResolvedValue({ items: [], totalCount: 0 });
    data.getCrmStatusCounts.mockResolvedValue(null);
    data.getCrmDirectoryOverview.mockResolvedValue({ monthLabel: "10/2026", newLeadsThisMonth: 0, pendingConfirmation: 0 });
    data.getLeadSources.mockResolvedValue([]);
    data.getSaleOwners.mockResolvedValue([]);

    const { container } = render(await CrmDirectoryPage({ searchParams: Promise.resolve({ status: "interested" }) }));

    const liveRegions = container.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveTextContent("Không có lead phù hợp");
    expect(liveRegions[0]).toHaveClass("sr-only");
  });

  // Value (extension, fix pass 1): protects=an unknown ?status= value is ignored by the directory query (status null, like detail links) instead of returning an empty list for a status that does not exist;
  // fails_when=the page passes params.status straight to getCrmLeadDirectory;
  // why_new=F11 normalises the status param; seam=as above; no_claim=does not prove PostgREST behaviour for an unknown enum value
  it("queries an unknown status param as no status filter", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["crm.view"] });
    data.getCrmLeadDirectory.mockResolvedValue({ items: [], totalCount: 0 });
    data.getCrmStatusCounts.mockResolvedValue(null);
    data.getCrmDirectoryOverview.mockResolvedValue({ monthLabel: "10/2026", newLeadsThisMonth: 0, pendingConfirmation: 0 });
    data.getLeadSources.mockResolvedValue([]);
    data.getSaleOwners.mockResolvedValue([]);

    render(await CrmDirectoryPage({ searchParams: Promise.resolve({ status: "foo" }) }));
    expect(data.getCrmLeadDirectory).toHaveBeenCalledWith(expect.objectContaining({ status: null }));

    cleanup();
    render(await CrmDirectoryPage({ searchParams: Promise.resolve({ status: "dropped" }) }));
    expect(data.getCrmLeadDirectory).toHaveBeenLastCalledWith(expect.objectContaining({ status: "dropped" }));
  });

  // Value (extension, fix pass 2, G6): protects=a repeated query key (?search=a&search=b, which Next passes as an array) renders the list filtered by the first value instead of throwing on an array in the loaders' string handling;
  // fails_when=the page passes params.search/status/grade/sale/source through without taking the first value;
  // why_new=G6; seam=as above; no_claim=does not run the real loaders (they are mocked)
  it("filters by the first value of a repeated param", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["crm.view"] });
    data.getCrmLeadDirectory.mockResolvedValue({ items: [], totalCount: 0 });
    data.getCrmStatusCounts.mockResolvedValue(null);
    data.getCrmDirectoryOverview.mockResolvedValue({ monthLabel: "10/2026", newLeadsThisMonth: 0, pendingConfirmation: 0 });
    data.getLeadSources.mockResolvedValue([]);
    data.getSaleOwners.mockResolvedValue([]);

    render(await CrmDirectoryPage({ searchParams: Promise.resolve({ grade: ["5", "7"], search: ["a", "b"], status: ["dropped", "converted"] }) }));
    const expected = { expectedGrade: 5, search: "a" };
    expect(data.getCrmLeadDirectory).toHaveBeenCalledWith(expect.objectContaining({ ...expected, status: "dropped" }));
    expect(data.getCrmStatusCounts).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  // Value (extension, fix pass 3, H1): protects=a grade param that is not a whole grade 1–12 (`?grade=1.5`, `abc`, `13`) is queried as no grade filter instead of reaching expected_grade as a fractional/NaN number (a database cast error or an empty list);
  // fails_when=the page goes back to `Number(params.grade)` for any truthy grade;
  // why_new=H1; seam=as above; no_claim=does not run the real loaders (they are mocked)
  it("queries a grade param that is not a whole grade 1–12 as no grade filter", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["crm.view"] });
    data.getCrmLeadDirectory.mockResolvedValue({ items: [], totalCount: 0 });
    data.getCrmStatusCounts.mockResolvedValue(null);
    data.getCrmDirectoryOverview.mockResolvedValue({ monthLabel: "10/2026", newLeadsThisMonth: 0, pendingConfirmation: 0 });
    data.getLeadSources.mockResolvedValue([]);
    data.getSaleOwners.mockResolvedValue([]);

    for (const grade of ["1.5", "abc", "13"]) {
      render(await CrmDirectoryPage({ searchParams: Promise.resolve({ grade }) }));
      expect(data.getCrmLeadDirectory).toHaveBeenLastCalledWith(expect.objectContaining({ expectedGrade: null }));
      expect(data.getCrmStatusCounts).toHaveBeenLastCalledWith(expect.objectContaining({ expectedGrade: null }));
      cleanup();
    }

    render(await CrmDirectoryPage({ searchParams: Promise.resolve({ grade: "12" }) }));
    expect(data.getCrmLeadDirectory).toHaveBeenLastCalledWith(expect.objectContaining({ expectedGrade: 12 }));
  });
});
