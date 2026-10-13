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
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/classes/data", () => ({ getClassDetail: dependencies.getClassDetail }));
vi.mock("@/features/classes/detail/class-detail-data", () => ({
  getClassDetailWorkspace: dependencies.getClassDetailWorkspace,
  getClassEnrollmentCandidates: dependencies.getClassEnrollmentCandidates,
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
});
