import { describe, expect, it } from "vitest";

import {
  getActiveNavigationDomain,
  getActiveNavigationItem,
  getVisibleNavigationDomains,
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

    expect(domains.map((domain) => domain.key)).toEqual(["academics"]);
    expect(domains[0]?.items.map((item) => item.href)).toEqual(["/sessions"]);
  });

  it("uses the first visible existing module when earlier modules are unavailable", () => {
    const domains = getVisibleNavigationDomains(["sessions.view"]);
    const academics = domains.find((domain) => domain.key === "academics");

    expect(academics?.items[0]?.href).toBe("/sessions");
  });

  it("keeps nested operational routes in their owning module", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const academics = getActiveNavigationDomain("/classes/academic-years", domains);
    const classesModule = getActiveNavigationItem(
      academics?.items ?? [],
      "/classes/academic-years",
    );

    expect(academics?.key).toBe("academics");
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

  it("maps the existing settings audit-log route to the audit module", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const administration = getActiveNavigationDomain("/settings/audit-logs", domains);
    const auditModule = getActiveNavigationItem(
      administration?.items ?? [],
      "/settings/audit-logs",
    );

    expect(administration?.key).toBe("administration");
    expect(auditModule?.href).toBe("/audit");
  });

  it("keeps settings child routes and trailing-slash module routes active", () => {
    const domains = getVisibleNavigationDomains(ownerPermissions);
    const administration = getActiveNavigationDomain("/settings/users", domains);
    const settingsModule = getActiveNavigationItem(
      administration?.items ?? [],
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
