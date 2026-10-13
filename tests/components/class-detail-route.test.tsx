// Value: protects=the class route asks the workspace loader only for feeds the viewer may read, loads enrolment candidates only for an active class and a role holding students.view and students.manage_status, and forwards ?tab;
// fails_when=a TA's class page reads payment requests, attendance loads without attendance.view, candidates load for a draft class or without students.manage_status, or the tab param is dropped;
// why_new=permission gating for the new workspace lives only in the route;
// seam=loaders and ClassDetailPage are mocked at module boundaries; the returned element's props are inspected without rendering; no_claim=does not prove RLS or the loaders' queries
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ClassDetailRoute from "@/app/(app)/classes/[classId]/page";

const dependencies = vi.hoisted(() => ({
  ClassDetailPage: vi.fn(() => null),
  getCachedDatabasePermissions: vi.fn(),
  getClassDetail: vi.fn(),
  getClassDetailWorkspace: vi.fn(),
  getClassEnrollmentCandidates: vi.fn(),
  getClassTuitionPeriods: vi.fn(),
  getClassTuitionView: vi.fn(),
  getTransferClassOptions: vi.fn(),
  getVietnamTime: vi.fn(() => "19:45:00"),
  getVietnamToday: vi.fn(() => "2026-10-13"),
}));

vi.mock("@/lib/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/datetime")>()),
  getVietnamTime: dependencies.getVietnamTime,
  getVietnamToday: dependencies.getVietnamToday,
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/classes/data", () => ({ getClassDetail: dependencies.getClassDetail }));
vi.mock("@/features/classes/detail/class-detail-data", () => ({
  getClassDetailWorkspace: dependencies.getClassDetailWorkspace,
  getClassEnrollmentCandidates: dependencies.getClassEnrollmentCandidates,
}));
vi.mock("@/features/classes/detail/class-tuition-data", () => ({
  getClassTuitionPeriods: dependencies.getClassTuitionPeriods,
  getClassTuitionView: dependencies.getClassTuitionView,
}));
vi.mock("@/features/students/enrollment/student-enrollment-data", () => ({
  getTransferClassOptions: dependencies.getTransferClassOptions,
}));
vi.mock("@/features/classes/class-detail-page", () => ({ ClassDetailPage: dependencies.ClassDetailPage }));

afterEach(() => {
  vi.clearAllMocks();
});

const CLASS_ID = "8f9c2a4e-1b2c-4d3e-8f00-123456789abc";

function arrange(permissions: string[], status = "active") {
  dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
  dependencies.getClassDetail.mockResolvedValue({ detail: { id: CLASS_ID, status }, ok: true });
  dependencies.getClassDetailWorkspace.mockResolvedValue({ marker: "workspace" });
  dependencies.getClassEnrollmentCandidates.mockResolvedValue({ candidates: [], truncated: false });
}

async function renderRoute(searchParams: Record<string, string> = {}) {
  const element = (await ClassDetailRoute({
    params: Promise.resolve({ classId: CLASS_ID }),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<Record<string, unknown>>;

  return element.props;
}

describe("class detail route", () => {
  it("gives a TA sessions, attendance and results but no payments or enrolment", async () => {
    arrange(["classes.view", "sessions.view", "sessions.manage", "attendance.view", "results.view", "students.view"]);

    const props = await renderRoute({ tab: "sessions" });

    expect(dependencies.getClassDetailWorkspace).toHaveBeenCalledWith(CLASS_ID, {
      canViewAttendance: true,
      canViewLedger: false,
      canViewPayments: false,
      canViewResults: true,
      canViewSessions: true,
      canViewStudents: true,
    });
    expect(dependencies.getClassEnrollmentCandidates).not.toHaveBeenCalled();
    expect(props).toMatchObject({
      canBulkCancelSessions: false,
      canEnrollStudents: false,
      canLockSessions: false,
      canManageSessions: true,
      enrollmentCandidates: undefined,
      initialTab: "sessions",
      workspace: { marker: "workspace" },
    });
  });

  it("does not read attendance or results without sessions.view", async () => {
    arrange(["classes.view", "attendance.view", "results.view", "payments.view"]);

    await renderRoute();

    expect(dependencies.getClassDetailWorkspace).toHaveBeenCalledWith(CLASS_ID, expect.objectContaining({
      canViewAttendance: false,
      canViewPayments: true,
      canViewResults: false,
      canViewSessions: false,
    }));
  });

  it("loads enrolment candidates only for an active class and a role that may enroll", async () => {
    arrange(["classes.view", "students.view", "students.manage_status"]);
    expect(await renderRoute()).toMatchObject({ canEnrollStudents: true, enrollmentCandidates: { candidates: [], truncated: false } });

    vi.clearAllMocks();
    arrange(["classes.view", "students.view", "students.manage_status"], "draft");
    expect(await renderRoute()).toMatchObject({ canEnrollStudents: true, enrollmentCandidates: undefined });
    expect(dependencies.getClassEnrollmentCandidates).not.toHaveBeenCalled();

    vi.clearAllMocks();
    arrange(["classes.view", "students.manage_status"]);
    expect(await renderRoute()).toMatchObject({ canEnrollStudents: false });
    expect(dependencies.getClassEnrollmentCandidates).not.toHaveBeenCalled();
  });

  // Value: protects=bulk cancel is offered only to roles holding both sessions.manage and classes.manage_schedule (owner decision);
  // fails_when=canBulkCancelSessions follows sessions.manage alone, so a teaching assistant can cancel many sessions at once;
  // why_new=TAs received sessions.manage (migration 20261014090100) and the bulk flag used to be that permission;
  // seam=ClassDetailPage is mocked and its props inspected; no_claim=does not prove cancel_session's own permission check
  it("allows bulk cancel only with sessions.manage and classes.manage_schedule", async () => {
    arrange(["classes.view", "sessions.view", "sessions.manage", "classes.manage_schedule"]);
    expect(await renderRoute()).toMatchObject({ canBulkCancelSessions: true, canManageSessions: true });

    vi.clearAllMocks();
    arrange(["classes.view", "sessions.view", "classes.manage_schedule"]);
    expect(await renderRoute()).toMatchObject({ canBulkCancelSessions: false, canManageSessions: false });
  });

  // Value: protects=the class page receives the Vietnam wall-clock time and date (not server UTC) to decide started/overdue sessions;
  // fails_when=nowTime/today are dropped, swapped, or computed from new Date() in server time instead of getVietnamTime/getVietnamToday;
  // why_new=the route forwards nowTime and today but no test checked them;
  // seam=none; no_claim=does not prove the Vietnam formatters themselves (getVietnamTime/getVietnamToday are mocked at their module)
  it("passes the Vietnam time and date to the page", async () => {
    arrange(["classes.view", "sessions.view"]);

    const props = await renderRoute();

    expect(dependencies.getVietnamTime).toHaveBeenCalled();
    expect(dependencies.getVietnamToday).toHaveBeenCalled();
    expect(props).toMatchObject({ nowTime: "19:45:00", today: "2026-10-13" });
  });

  // Value: protects=the tuition tab loads only for classes.view+sessions.view+students.view+tuition_periods.view, opens on today's period, and transfer targets load only with students.transfer_class on an active class;
  // fails_when=tuition loads without one of its permissions, the default period is not the one covering today, payments.view is not forwarded, a failed period list is not null, or transfer options load for a draft class;
  // why_new=step 5b part 2 added the tuition and transfer gates to the route; earlier route tests use roles holding neither;
  // seam=loaders mocked at module boundaries; no_claim=does not prove RLS on tuition tables or the transfer RPC's own permission check
  it("gates the tuition tab and transfer targets on permissions and opens the current period", async () => {
    const tuition = ["classes.view", "sessions.view", "students.view", "tuition_periods.view"];
    const sep = { dueOn: null, endsOn: "2026-09-30", id: "sep", name: "T9", startsOn: "2026-09-01", status: "locked" };
    const oct = { dueOn: null, endsOn: "2026-10-31", id: "oct", name: "T10", startsOn: "2026-10-01", status: "draft" };

    arrange(["classes.view", "sessions.view", "payments.view", "students.view", "students.transfer_class"]);
    dependencies.getTransferClassOptions.mockResolvedValue([{ id: "class-2" }]);
    let props = await renderRoute();
    expect(dependencies.getClassTuitionPeriods).not.toHaveBeenCalled();
    expect(props).toMatchObject({ canTransferStudents: true, transferClassOptions: [{ id: "class-2" }], tuition: undefined });
    expect(dependencies.getTransferClassOptions).toHaveBeenCalledWith(CLASS_ID);

    vi.clearAllMocks();
    arrange([...tuition, "payments.view"]);
    dependencies.getClassTuitionPeriods.mockResolvedValue([oct, sep]);
    dependencies.getClassTuitionView.mockResolvedValue({ marker: "view" });
    props = await renderRoute();
    expect(dependencies.getClassTuitionView).toHaveBeenCalledWith(CLASS_ID, oct, { canViewPayments: true });
    expect(props).toMatchObject({ canTransferStudents: false, transferClassOptions: undefined, tuition: { initialPeriodId: "oct", initialView: { marker: "view" }, periods: [oct, sep] } });
    expect(dependencies.getTransferClassOptions).not.toHaveBeenCalled();

    // Without students.view the tab could not name the students (students RLS): no tuition read.
    vi.clearAllMocks();
    arrange(tuition.filter((code) => code !== "students.view"));
    expect(await renderRoute()).toMatchObject({ tuition: undefined });
    expect(dependencies.getClassTuitionPeriods).not.toHaveBeenCalled();

    vi.clearAllMocks();
    arrange(tuition);
    dependencies.getClassTuitionPeriods.mockResolvedValue(null);
    expect(await renderRoute()).toMatchObject({ tuition: null });
    expect(dependencies.getClassTuitionView).not.toHaveBeenCalled();

    vi.clearAllMocks();
    arrange(["classes.view", "students.view", "students.transfer_class"], "draft");
    expect(await renderRoute()).toMatchObject({ canTransferStudents: true, transferClassOptions: undefined });
    expect(dependencies.getTransferClassOptions).not.toHaveBeenCalled();
  });
});
