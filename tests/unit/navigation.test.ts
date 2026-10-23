import { describe, expect, it } from "vitest";

import {
  getActiveNavigationDomain,
  getActiveNavigationItem,
  getNavigationBreadcrumb,
  getVisibleNavigationDomains,
  getVisibleNavigationGroups,
} from "@/config/navigation";

describe("redesigned shell navigation", () => {
  const ownerPermissions = [
    "dashboard.view",
    "students.view",
    "classes.view",
    "sessions.view",
    "results.view",
    "coaching.view",
    "crm.view",
    "finance.view",
    "payments.view",
    "sepay.view",
    "session_ledger.view",
    "tuition_periods.view",
    "staff.view",
    "timekeeping.view",
    "payroll.view",
    "advances.view",
    "grading_credits.view",
    "commissions.view",
    "imports.students",
    "imports.session_balances",
    "imports.classes",
    "imports.enrollments",
    "reports.view",
    "staff.roles.view",
    "audit.view",
  ] as const;

  it("hides domains without a permission-visible child route", () => {
    const domains = getVisibleNavigationDomains(["sessions.view"]);

    expect(domains.map((domain) => domain.key)).toEqual(["sessions"]);
    expect(domains[0]?.items.map((item) => item.href)).toEqual(["/sessions"]);
  });

  it("uses the first visible existing module when earlier modules are unavailable", () => {
    const domains = getVisibleNavigationDomains(["sepay.view"]);
    const finance = domains.find((domain) => domain.key === "finance");

    expect(finance?.items[0]?.href).toBe("/finance/sepay");
  });

  it("groups daily entities flat under Việc chính and office work under Vận hành", () => {
    const groups = getVisibleNavigationGroups(ownerPermissions);

    expect(groups.map((group) => group.key)).toEqual(["primary", "operations", "footer"]);
    expect(groups[0]?.domains.map((domain) => domain.items.map((item) => item.href))).toEqual([
      ["/"],
      ["/students"],
      ["/classes"],
      ["/sessions"],
      ["/learning-results"],
    ]);
    expect(groups[1]?.domains.map((domain) => domain.key)).toEqual(["finance", "people", "care", "reports"]);
    expect(groups[2]?.domains.map((domain) => domain.key)).toEqual(["imports", "settings"]);
  });

  it("hides a whole group, title included, when no domain in it is visible", () => {
    const groups = getVisibleNavigationGroups(["sessions.view", "timekeeping.view"]);

    expect(groups.map((group) => group.key)).toEqual(["primary", "operations"]);
    expect(groups[1]?.domains.map((domain) => domain.key)).toEqual(["people"]);
  });

  // Value: protects=a TA who holds timekeeping.check (not timekeeping.view) finds "Chấm công" in the sidebar, alone in Nhân sự (no module strip, no manager routes), and the item opens for any code the /timekeeping route admits;
  // fails_when=the item goes back to timekeeping.view only (TAs lose the entry to their own timesheet), or an any-of list starts revealing items whose codes the user lacks;
  // why_new=the route admitted timekeeping.check since the staff-only layout, but the single-code nav filter hid the entry; seam=pure function; no_claim=which panels the page renders (timekeeping-route.test.tsx)
  it("shows Chấm công to a timekeeping.check holder without timekeeping.view", () => {
    const groups = getVisibleNavigationGroups(["sessions.view", "timekeeping.check"]);
    const people = groups[1]?.domains.find((domain) => domain.key === "people");

    expect(groups.map((group) => group.key)).toEqual(["primary", "operations"]);
    expect(groups[1]?.domains.map((domain) => domain.key)).toEqual(["people"]);
    expect(people?.items.map((item) => item.href)).toEqual(["/timekeeping"]);
    expect(getNavigationBreadcrumb("/timekeeping", getVisibleNavigationDomains(["timekeeping.check"]))).toEqual({
      domain: undefined,
      item: { href: "/timekeeping", label: "Chấm công" },
    });

    for (const code of ["timekeeping.view", "timekeeping.manage_verification"] as const) {
      expect(getVisibleNavigationDomains([code]).flatMap((domain) => domain.items.map((item) => item.href))).toEqual(["/timekeeping"]);
    }
    expect(getVisibleNavigationDomains(["sessions.view"]).some((domain) => domain.key === "people")).toBe(false);
  });

  it("builds a real-route breadcrumb: domain only when a module strip exists", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);

    expect(getNavigationBreadcrumb("/finance/tuition-periods/abc", domains)).toEqual({
      domain: { href: "/finance", label: "Tài chính" },
      item: { href: "/finance/tuition-periods", label: "Kỳ thu học phí" },
    });
    expect(getNavigationBreadcrumb("/classes/123", domains)).toEqual({
      domain: undefined,
      item: { href: "/classes", label: "Lớp học" },
    });
    expect(getNavigationBreadcrumb("/unknown", domains)).toEqual({});
  });

  it("keeps nested operational routes in their owning module", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const classes = getActiveNavigationDomain("/classes/academic-years", domains);
    const classesModule = getActiveNavigationItem(
      classes?.items ?? [],
      "/classes/academic-years",
    );

    expect(classes?.key).toBe("classes");
    expect(classesModule?.href).toBe("/classes");
  });

  it("resolves the most specific existing module route", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const finance = getActiveNavigationDomain("/finance/payment-requests", domains);
    const paymentsModule = getActiveNavigationItem(
      finance?.items ?? [],
      "/finance/payment-requests",
    );

    expect(finance?.key).toBe("finance");
    expect(paymentsModule?.href).toBe("/finance/payment-requests");
  });

  it("keeps Finance Orders in the finance domain under finance.view", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const finance = getActiveNavigationDomain("/finance/orders", domains);
    const ordersModule = getActiveNavigationItem(finance?.items ?? [], "/finance/orders");

    expect(finance?.key).toBe("finance");
    expect(ordersModule?.href).toBe("/finance/orders");
  });

  it("maps the existing settings audit-log route to the audit module", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const settings = getActiveNavigationDomain("/settings/audit-logs", domains);
    const auditModule = getActiveNavigationItem(
      settings?.items ?? [],
      "/settings/audit-logs",
    );

    expect(settings?.key).toBe("settings");
    expect(auditModule?.href).toBe("/audit");
  });

  it("keeps settings child routes and trailing-slash module routes active", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const settings = getActiveNavigationDomain("/settings/users", domains);
    const settingsModule = getActiveNavigationItem(
      settings?.items ?? [],
      "/settings/users",
    );
    const finance = getActiveNavigationDomain(
      "/finance/payment-requests/",
      domains,
    );
    const paymentsModule = getActiveNavigationItem(
      finance?.items ?? [],
      "/finance/payment-requests/",
    );

    expect(settingsModule?.href).toBe("/settings");
    expect(paymentsModule?.href).toBe("/finance/payment-requests");
  });
});
