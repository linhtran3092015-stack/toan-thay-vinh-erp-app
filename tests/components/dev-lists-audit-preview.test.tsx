// Value: protects=the /dev/lists audit body renders the real AuditLogPage over a fixture copy of getAuditLogsResult (same normalisers, exact filters, Vietnam-day bounds, 100-row cap with an exact count, options from the newest 1.000 rows) read from the preview URL; the GET form and "Xóa lọc" stay on /dev/lists with view (+ state); the gate is the route's (the shell's permissions must hold audit.view, owner-only per the migrations: the owner gets the log, the TA and the accountant the route's own denial) and a non-default role travels in the form's params; "capped" shows 1.240 matching rows with the newest 100 and "empty" the single in-frame empty state; fixtures follow what the migrations' writers store;
// fails_when=the preview form or reset points at the production-backed /audit, the body stops reading the URL or keeping view/role/state, the fixture query drifts from the loader (filters, day bounds, cap, option window), the denial follows the role name instead of the permissions (a role without audit.view sees the log, or one granted it is denied), the capped count stops matching the rows, or a fixture invents a request_id or a system actor for a row a person wrote;
// why_new=step 14d adds the audit view to /dev/lists; seam=next/navigation offers a settable useSearchParams carrying the preview URL; the body has no AppShell (the controller wraps it) and the page has no server action to stub; no_claim=the /dev/lists wiring, shell and production 404 (dev-lists-preview.test.tsx) or the real route (audit-route.test.tsx)
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  AUDIT_PREVIEW_CAPPED_TOTAL,
  auditPreviewActorIds,
  auditPreviewProfiles,
  auditPreviewRows,
  cappedAuditPreviewRows,
  runAuditPreviewQuery,
} from "@/app/dev/lists/audit-fixtures";
import { AUDIT_PREVIEW_FORM_ACTION, AuditPreviewBody, getAuditPreviewHiddenParams } from "@/app/dev/lists/audit-preview";
import type { ListsPreviewRole, ListsPreviewState } from "@/app/dev/lists/lists-preview";
import { getListsPreviewPermissions } from "@/app/dev/lists/preview-permissions";
import { sessionPreviewNowTime, sessionPreviewToday } from "@/app/dev/lists/session-fixtures";
import { AUDIT_FILTER_OPTION_ROW_LIMIT, AUDIT_LOG_ROW_LIMIT } from "@/features/audit/audit-log-models";
import { toVietnamDate } from "@/lib/datetime";

// Run as a UTC host (like the production server); the runner's TZ is restored after.
const timeZone = vi.hoisted(() => {
  const original = process.env.TZ;
  process.env.TZ = "UTC";
  return { original };
});

const search = vi.hoisted(() => ({ value: "view=audit" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));

afterAll(() => {
  if (timeZone.original === undefined) delete process.env.TZ;
  else process.env.TZ = timeZone.original;
});

afterEach(() => {
  cleanup();
  search.value = "view=audit";
});

const TABLE = "Nhật ký hệ thống";
const DENIED = "Không có quyền xem nhật ký hệ thống";
const table = () => screen.getByRole("table", { name: TABLE });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const previewNow = Date.parse(`${sessionPreviewToday}T${sessionPreviewNowTime}+07:00`);

// The shell's own permission sets (preview-permissions.ts, the codes lists-preview.tsx
// passes to the body; rules-data §D): owner = every code but student_care.view; TA and
// accountant = their preview codes + notifications.view and reports.view, never audit.view.
const permissionsFor = (role: ListsPreviewRole, state: ListsPreviewState) =>
  getListsPreviewPermissions(role, "audit", state);

describe("audit preview fixtures", () => {
  it.each([
    ["normal", auditPreviewRows],
    ["capped", cappedAuditPreviewRows],
  ] as const)("keep the loader's order with unique ids, on or before the preview clock (%s)", (_name, rows) => {
    for (let index = 1; index < rows.length; index += 1) {
      expect(Date.parse(rows[index - 1].occurred_at) >= Date.parse(rows[index].occurred_at)).toBe(true);
    }
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    for (const row of rows) {
      expect(Date.parse(row.occurred_at)).toBeLessThanOrEqual(previewNow);
      // No writer sets request_id today.
      expect(row.request_id).toBeNull();
    }
  });

  it("cover the cases the page must present", () => {
    const rows = auditPreviewRows;
    const modules = new Set(rows.map((row) => row.module));
    for (const code of ["rbac", "ops", "students"]) expect(modules.has(code)).toBe(true);

    const student = rows.find((row) => row.action === "student_updated");
    expect(student?.old_data).toEqual(expect.objectContaining({ full_name: expect.any(String), public_code: expect.any(String) }));
    expect(Object.keys(student?.new_data as object).sort()).toEqual(Object.keys(student?.old_data as object).sort());

    // A null actor only where the database writes one (alerts, auto-end); auto-lock names the completer.
    expect(new Set(rows.filter((row) => row.actor_user_id === null).map((row) => row.action))).toEqual(
      new Set(["ops_alert_raised", "time_entry_auto_ended"]),
    );
    const autoLock = rows.find((row) => row.action === "class_session_auto_locked");
    expect(autoLock?.actor_user_id).toBe(auditPreviewActorIds.ta);
    expect(autoLock?.metadata).toEqual({ auto_lock_after_days: 3, source: "auto_lock_worker" });

    const readable = new Set(auditPreviewProfiles.map((profile) => profile.id));
    expect(rows.some((row) => row.actor_user_id === auditPreviewActorIds.unreadable)).toBe(true);
    expect(readable.has(auditPreviewActorIds.unreadable)).toBe(false);
    expect(rows.some((row) => row.reason)).toBe(true);
    expect(rows.some((row) => JSON.stringify(row.metadata) === "{}")).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(18);
  });

  it("make the capped set 1.240 rows that include every normal row, so the option window cuts the oldest", () => {
    expect(cappedAuditPreviewRows).toHaveLength(AUDIT_PREVIEW_CAPPED_TOTAL);
    const ids = new Set(cappedAuditPreviewRows.map((row) => row.id));
    for (const row of auditPreviewRows) expect(ids.has(row.id)).toBe(true);
    expect(AUDIT_PREVIEW_CAPPED_TOTAL).toBeGreaterThan(AUDIT_FILTER_OPTION_ROW_LIMIT);
  });
});

describe("runAuditPreviewQuery (fixture copy of getAuditLogsResult)", () => {
  it("counts every match exactly, lists the newest 100 and builds options from the newest 1.000 rows only", () => {
    const result = runAuditPreviewQuery(cappedAuditPreviewRows, {});

    expect(result.totalCount).toBe(AUDIT_PREVIEW_CAPPED_TOTAL);
    expect(result.entries).toHaveLength(AUDIT_LOG_ROW_LIMIT);
    expect(result.entries.map((entry) => entry.id)).toEqual(cappedAuditPreviewRows.slice(0, 100).map((row) => row.id));
    const windowModules = new Set(cappedAuditPreviewRows.slice(0, AUDIT_FILTER_OPTION_ROW_LIMIT).map((row) => row.module));
    expect(result.options.modules).toEqual([...windowModules].sort((left, right) => left.localeCompare(right, "vi")));
    // The July staff-rate row is older than the window, so "staff" is not an option.
    expect(result.options.modules).not.toContain("staff");
  });

  it("filters exactly and bounds days in Vietnam time", () => {
    const day = runAuditPreviewQuery(auditPreviewRows, { fromDate: "2026-10-16", toDate: "2026-10-16" });
    expect(day.entries.length).toBeGreaterThan(0);
    for (const entry of day.entries) expect(toVietnamDate(entry.occurredAt)).toBe("2026-10-16");
    // 15:45 UTC on 15/10 is 22:45 in Vietnam: outside the 16/10 day; 20:00 UTC on 15/10 is 03:00 on 16/10: inside.
    expect(day.entries.some((entry) => entry.action === "time_entry_auto_ended")).toBe(false);
    expect(day.entries.some((entry) => entry.occurredAt.startsWith("2026-10-15T20:00"))).toBe(true);

    const rbac = runAuditPreviewQuery(auditPreviewRows, { module: " rbac " });
    expect(rbac.filters.module).toBe("rbac");
    expect(new Set(rbac.entries.map((entry) => entry.module))).toEqual(new Set(["rbac"]));
    expect(runAuditPreviewQuery(auditPreviewRows, { module: "rba" }).totalCount).toBe(0);
    expect(runAuditPreviewQuery(auditPreviewRows, { fromDate: "2026-02-30" }).filters.fromDate).toBe("");
  });

  it("joins only readable profiles: an unknown actor stays an id", () => {
    const result = runAuditPreviewQuery(auditPreviewRows, {});
    const unreadable = result.entries.find((entry) => entry.actorUserId === auditPreviewActorIds.unreadable);

    expect(unreadable?.actor).toBeNull();
    expect(result.options.actors).toContainEqual({ id: auditPreviewActorIds.unreadable, label: auditPreviewActorIds.unreadable });
    expect(result.options.actors).toContainEqual({
      id: auditPreviewActorIds.admissions,
      label: "minh.tuyensinh · minh.tuyensinh@example.com",
    });
  });
});

describe("AuditPreviewBody", () => {
  it("renders the owner's log from the normal rows with the form on /dev/lists", () => {
    const { container } = render(<AuditPreviewBody permissions={permissionsFor("owner", "normal")} role="owner" state="normal" />);
    const form = container.querySelector("form") as HTMLFormElement;

    expect(screen.getByRole("heading", { level: 1, name: "Nhật ký hệ thống" })).toBeInTheDocument();
    expect(
      screen.getByText(`${auditPreviewRows.length} bản ghi · hiển thị ${auditPreviewRows.length} mới nhất`),
    ).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(auditPreviewRows.length);
    expect(screen.getAllByRole("listitem")).toHaveLength(auditPreviewRows.length);
    expect(form.getAttribute("action")).toBe(AUDIT_PREVIEW_FORM_ACTION);
    expect(AUDIT_PREVIEW_FORM_ACTION).toBe("/dev/lists");
    expect([...form.querySelectorAll('input[type="hidden"]')].map((input) => (input as HTMLInputElement).name)).toEqual(["view"]);
    expect(screen.queryByText(/Thu hẹp bộ lọc/)).not.toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("Hệ thống")).toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("16/10/2026")).toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("11:41:12")).toBeInTheDocument();
  });

  it("caps at the newest 100 of 1.240 and asks to narrow, keeping state on the form", () => {
    const { container } = render(<AuditPreviewBody permissions={permissionsFor("owner", "capped")} role="owner" state="capped" />);

    expect(screen.getByText("1.240 bản ghi · hiển thị 100 mới nhất")).toBeInTheDocument();
    expect(screen.getByText(/Thu hẹp bộ lọc để xem bản ghi cũ hơn\.$/)).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(AUDIT_LOG_ROW_LIMIT);
    expect(screen.getAllByRole("listitem")).toHaveLength(AUDIT_LOG_ROW_LIMIT);
    expect(
      [...(container.querySelectorAll('form input[type="hidden"]') as NodeListOf<HTMLInputElement>)].map((input) => [input.name, input.value]),
    ).toEqual([
      ["state", "capped"],
      ["view", "audit"],
    ]);
    expect(getAuditPreviewHiddenParams("owner", "empty")).toEqual({ state: "empty", view: "audit" });
    expect(getAuditPreviewHiddenParams("ta", "normal")).toEqual({ role: "ta", view: "audit" });
  });

  it("reads filters from the preview URL and resets to /dev/lists with the preview params", () => {
    search.value = "view=audit&state=capped&module=staff&role=owner";
    render(<AuditPreviewBody permissions={permissionsFor("owner", "capped")} role="owner" state="capped" />);

    // "staff" is older than the option window: still shown as the applied filter.
    expect(screen.getByLabelText("Module")).toHaveValue("staff");
    expect(within(screen.getByLabelText("Module")).getByRole("option", { name: "Nhân sự (đang lọc)" })).toBeInTheDocument();
    expect(screen.getByText("1 bản ghi khớp bộ lọc · hiển thị 1 mới nhất")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Xóa lọc (1)" })).toHaveAttribute("href", "/dev/lists?state=capped&view=audit");
  });

  it("explains an inverted range and shows the filtered empty state once", () => {
    search.value = "view=audit&fromDate=2026-10-16&toDate=2026-10-01";
    render(<AuditPreviewBody permissions={permissionsFor("owner", "normal")} role="owner" state="normal" />);

    expect(screen.getByText("Từ ngày sau Đến ngày nên không có bản ghi nào khớp.")).toBeInTheDocument();
    expect(screen.getAllByText("Không có nhật ký phù hợp")).toHaveLength(1);
    expect(screen.getByText("0 bản ghi khớp bộ lọc")).toBeInTheDocument();
  });

  it("renders the unfiltered empty state once for state=empty", () => {
    render(<AuditPreviewBody permissions={permissionsFor("owner", "empty")} role="owner" state="empty" />);

    expect(screen.getAllByText("Chưa có nhật ký")).toHaveLength(1);
    expect(screen.getByText("0 bản ghi")).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(1);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it.each(["ta", "accountant"] as const)("shows the %s the route's own denial in every state", (role) => {
    for (const state of ["normal", "capped", "empty"] as const) {
      const { unmount } = render(<AuditPreviewBody permissions={permissionsFor(role, state)} role={role} state={state} />);

      expect(screen.getByRole("heading", { level: 1, name: DENIED })).toBeInTheDocument();
      expect(screen.getByText(/chưa được cấp quyền xem nhật ký hệ thống/)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(document.querySelector("form")).toBeNull();
      unmount();
    }
  });

  it("gates on the shell's permissions, not the role name, and keeps a non-default role on the form", () => {
    const { container, unmount } = render(
      <AuditPreviewBody permissions={[...permissionsFor("ta", "empty"), "audit.view"]} role="ta" state="empty" />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Nhật ký hệ thống" })).toBeInTheDocument();
    expect(
      [...(container.querySelectorAll('form input[type="hidden"]') as NodeListOf<HTMLInputElement>)].map((input) => [input.name, input.value]),
    ).toEqual([
      ["role", "ta"],
      ["state", "empty"],
      ["view", "audit"],
    ]);
    unmount();

    render(
      <AuditPreviewBody permissions={permissionsFor("owner", "normal").filter((code) => code !== "audit.view")} role="owner" state="normal" />,
    );
    expect(screen.getByRole("heading", { level: 1, name: DENIED })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("never points a link or a form at a production route", () => {
    search.value = "view=audit&module=rbac";
    const { container } = render(<AuditPreviewBody permissions={permissionsFor("owner", "normal")} role="owner" state="normal" />);

    for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).toMatch(/^\/dev\/lists\?/);
    for (const form of container.querySelectorAll("form")) expect(form.getAttribute("action")).toBe("/dev/lists");
  });
});
