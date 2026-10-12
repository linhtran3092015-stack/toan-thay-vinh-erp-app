// Value: protects=the student profile route only runs the payments and care loaders for roles holding payments.view / student_care.view, maps the upcoming feed's failure to upcomingSessionFailed, and keeps ?tab out of the back/edit links;
// fails_when=a TA's profile load queries student_payment_requests or the care dashboard, attendance stops loading for attendance.view, a failed upcoming feed reaches the page as "nothing scheduled", or ?tab leaks into directoryHref/editHref;
// why_new=permission gating lived only in the route and no test exercised it (presentation tests pass permissions as props);
// seam=loaders and StudentProfilePage are mocked at module boundaries; the route's returned element props are inspected without rendering; no_claim=does not prove RLS or that the mocked loaders' real queries succeed
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StudentDetailRoute from "@/app/(app)/students/[studentId]/page";
import type { StudentProfilePageProps } from "@/features/students/detail/student-profile-page";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getCareDashboard: vi.fn(),
  getStudentAttendanceHistory: vi.fn(),
  getStudentDetail: vi.fn(),
  getStudentEnrollmentUiModel: vi.fn(),
  getStudentLedgerSummary: vi.fn(),
  getStudentPaymentRequests: vi.fn(),
  getStudentTuitionProfile: vi.fn(),
  getStudentUpcomingSession: vi.fn(),
  StudentProfilePage: vi.fn(() => null),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/students/data", () => ({ getStudentDetail: dependencies.getStudentDetail }));
vi.mock("@/features/students/detail/student-activity-data", () => ({
  getStudentAttendanceHistory: dependencies.getStudentAttendanceHistory,
  getStudentPaymentRequests: dependencies.getStudentPaymentRequests,
  getStudentUpcomingSession: dependencies.getStudentUpcomingSession,
}));
vi.mock("@/features/students/detail/student-profile-page", () => ({ StudentProfilePage: dependencies.StudentProfilePage }));
vi.mock("@/features/students/enrollment/student-enrollment-data", () => ({
  getStudentEnrollmentUiModel: dependencies.getStudentEnrollmentUiModel,
}));
vi.mock("@/features/students/ledger-data", () => ({ getStudentLedgerSummary: dependencies.getStudentLedgerSummary }));
vi.mock("@/features/students/tuition-profile-data", () => ({ getStudentTuitionProfile: dependencies.getStudentTuitionProfile }));
vi.mock("@/features/student-care/data", () => ({ getCareDashboard: dependencies.getCareDashboard }));
vi.mock("@/features/student-care/dashboard-card", () => ({ StudentCareDashboardCard: () => null }));
vi.mock("@/features/parent-messages/components/student-zalo-group-card", () => ({ StudentZaloGroupCard: () => null }));

const detail = {
  activeEnrollment: { classInfo: { id: "class-9a" } },
  fullName: "Nguyễn Minh Anh",
  id: "student-1",
};

function arrange(permissions: string[]) {
  dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
  dependencies.getStudentDetail.mockResolvedValue({ detail, ok: true });
  dependencies.getStudentEnrollmentUiModel.mockResolvedValue({ actions: {} });
  dependencies.getStudentTuitionProfile.mockResolvedValue({ currentRateVnd: null, rateHistory: [], sourceHistory: [], sourceName: null, sources: [] });
  dependencies.getStudentAttendanceHistory.mockResolvedValue({ classes: [], counts: {}, items: [], total: 0, truncated: false });
  dependencies.getStudentUpcomingSession.mockResolvedValue({ session: null });
}

async function renderRoute(searchParams: Record<string, string>) {
  const element = (await StudentDetailRoute({
    params: Promise.resolve({ studentId: "student-1" }),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<StudentProfilePageProps>;

  expect(element.type).toBe(dependencies.StudentProfilePage);
  return element.props;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Student detail route permission gating", () => {
  it("skips payments and care loaders for a TA-like role and keeps ?tab out of the back and edit links", async () => {
    arrange(["students.view", "classes.view", "attendance.view", "sessions.view"]);

    const props = await renderRoute({ page: "2", status: "active", tab: "payments" });

    expect(dependencies.getStudentPaymentRequests).not.toHaveBeenCalled();
    expect(dependencies.getCareDashboard).not.toHaveBeenCalled();
    expect(dependencies.getStudentLedgerSummary).not.toHaveBeenCalled();
    expect(dependencies.getStudentAttendanceHistory).toHaveBeenCalledWith("student-1");
    expect(dependencies.getStudentUpcomingSession).toHaveBeenCalledWith("class-9a");

    expect(props.payments).toBeUndefined();
    expect(props.canViewPayments).toBe(false);
    expect(props.canViewCare).toBe(false);
    expect(props.careCard).toBeNull();
    expect(props.initialTab).toBe("payments");
    expect(props.directoryHref).not.toContain("tab=");
    expect(props.directoryHref).toContain("status=active");
    expect(props.editHref).not.toContain("tab=");
    expect(props.editHref.startsWith("/students/student-1/edit")).toBe(true);
  });

  it("loads payments and care for roles that hold their view permissions", async () => {
    arrange(["students.view", "payments.view", "student_care.view"]);
    dependencies.getStudentPaymentRequests.mockResolvedValue(null);
    dependencies.getCareDashboard.mockResolvedValue({ total: 2 });

    const props = await renderRoute({});

    expect(dependencies.getStudentPaymentRequests).toHaveBeenCalledWith("student-1");
    expect(dependencies.getCareDashboard).toHaveBeenCalledWith({ student_id: "student-1" });
    expect(dependencies.getStudentAttendanceHistory).not.toHaveBeenCalled();
    expect(props.payments).toBeNull();
    expect(props.careTaskCount).toBe(2);
  });

  it("passes a failed upcoming-session feed as upcomingSessionFailed, not as nothing scheduled", async () => {
    arrange(["students.view", "sessions.view"]);
    dependencies.getStudentUpcomingSession.mockResolvedValue(null);

    const failed = await renderRoute({});
    expect(failed.upcomingSession).toBeNull();
    expect(failed.upcomingSessionFailed).toBe(true);

    dependencies.getStudentUpcomingSession.mockResolvedValue({ session: null });
    const none = await renderRoute({});
    expect(none.upcomingSession).toBeNull();
    expect(none.upcomingSessionFailed).toBe(false);
  });
});
