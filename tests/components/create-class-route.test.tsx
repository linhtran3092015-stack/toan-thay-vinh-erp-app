// Value: protects=/classes/new keeps its four gates in order (permission load error, classes.create, classes.view, academic-year load error) with the copy the /dev preview reuses, hands ClassFormPage only open (draft/active) years and a directory query built from string params only; the edit route's first gate and closed-year error match the preview's copy too;
// fails_when=a gate is dropped or reordered, its copy drifts from class-form-route-copy.ts, closed/archived years reach the form, array params leak into the directory query, or the years load before the permission gates pass;
// why_new=step 15a restyles the class form and adds a /dev preview that shows these denials; no route test existed;
// seam=getCachedDatabasePermissions, getAcademicYearManagementData, getClassDetail and ClassFormPage are mocked at module boundaries; the returned element's type and props are inspected; no_claim=the loaders' queries or that ClassFormPage honours the props (class-form-page.test.tsx)
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CreateClassLoading from "@/app/(app)/classes/new/loading";
import CreateClassRoute from "@/app/(app)/classes/new/page";
import EditClassRoute from "@/app/(app)/classes/[classId]/edit/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { ClassFormPage } from "@/features/classes/management/class-form-page";
import {
  CLASS_CREATE_DENIED,
  CLASS_CREATE_VIEW_DENIED,
  CLASS_EDIT_VIEW_DENIED,
  CLASS_EDIT_YEAR_CLOSED,
} from "@/features/classes/management/class-form-route-copy";

const dependencies = vi.hoisted(() => ({
  ClassFormPage: vi.fn(() => null),
  getAcademicYearManagementData: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
  getClassDetail: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/classes/academic-year-data", () => ({
  getAcademicYearManagementData: dependencies.getAcademicYearManagementData,
}));
vi.mock("@/features/classes/data", () => ({ getClassDetail: dependencies.getClassDetail }));
vi.mock("@/features/classes/management/class-form-page", () => ({ ClassFormPage: dependencies.ClassFormPage }));

const year = (id: string, status: string) => ({
  classCounts: { active: 0, archived: 0, closed: 0, draft: 0, total: 0 },
  code: id,
  endsOn: "2027-05-31",
  id,
  isCurrent: status === "active",
  name: `Năm ${id}`,
  startsOn: "2026-08-15",
  status,
});
const years = [year("y-active", "active"), year("y-draft", "draft"), year("y-closed", "closed"), year("y-archived", "archived")];

async function renderCreate(
  params: Record<string, string | string[] | undefined>,
  options: { permissions?: string[] | null; yearsResult?: unknown } = {},
) {
  const permissions = options.permissions === undefined ? ["classes.create", "classes.view"] : options.permissions;
  dependencies.getCachedDatabasePermissions.mockResolvedValue(permissions === null ? { ok: false } : { ok: true, permissions });
  dependencies.getAcademicYearManagementData.mockResolvedValue(options.yearsResult ?? { academicYears: years, ok: true });
  return (await CreateClassRoute({ searchParams: Promise.resolve(params) })) as ReactElement<Record<string, unknown>>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/classes/new route", () => {
  it("hands the form the open years and the class-directory query from string params", async () => {
    const element = (await renderCreate({ mode: ["online", "offline"], page: "2", status: "active", unknown: "x" })) as unknown as ReactElement<ComponentProps<typeof ClassFormPage>>;

    expect(element.type).toBe(dependencies.ClassFormPage);
    expect(element.props.academicYears.map((item) => item.id)).toEqual(["y-active", "y-draft"]);
    expect(element.props.directoryQuery).toBe("status=active&page=2");
    expect(element.props.classDetail).toBeUndefined();
  });

  it("keeps its gates in order with the preview's copy", async () => {
    const loadError = await renderCreate({}, { permissions: null });
    expect(loadError.type).toBe(ErrorState);
    expect(loadError.props).toEqual({ description: "Hệ thống chưa tải được quyền tạo lớp.", title: "Không tải được quyền truy cập" });

    // classes.create is checked first, even without classes.view.
    const noCreate = await renderCreate({}, { permissions: ["sessions.manage"] });
    expect(noCreate.type).toBe(PermissionDeniedState);
    expect(noCreate.props).toEqual(CLASS_CREATE_DENIED);

    const noView = await renderCreate({}, { permissions: ["classes.create"] });
    expect(noView.type).toBe(PermissionDeniedState);
    expect(noView.props).toEqual(CLASS_CREATE_VIEW_DENIED);
    expect(dependencies.getAcademicYearManagementData).not.toHaveBeenCalled();
  });

  // Value (extension, review T2 of step 15a): protects=/classes/new's loading file announces "Đang tải biểu mẫu tạo lớp" as its only status, and its pulsing skeleton is hidden from assistive tech;
  // fails_when=the LoadingNotice is dropped or renamed, a second status appears, or the skeleton loses aria-hidden (a screen reader walks empty boxes);
  // why_new=the loading file was added in step 15a without a test; seam=none; no_claim=the skeleton's geometry matching the form
  it("its loading state announces one status and hides the pulsing skeleton", () => {
    const { container } = render(<CreateClassLoading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải biểu mẫu tạo lớp");
    const skeleton = container.querySelector('[class*="animate-pulse"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton!.closest('[role="status"]')).toBeNull();
  });

  it("states a year-loading error in the frame", async () => {
    const element = await renderCreate({}, { yearsResult: { error: { code: "academic_years_query_failed", message: "Không tải được danh sách năm học." }, ok: false } });
    expect(element.type).toBe(ErrorState);
    expect(element.props).toEqual({ description: "Không tải được danh sách năm học.", title: "Không tải được danh sách năm học" });
  });
});

describe("/classes/[classId]/edit route copy reused by the preview", () => {
  const classId = "33333333-3333-4333-8333-333333333333";

  async function renderEdit(permissions: string[], detailYearStatus = "active", params: Record<string, string | string[] | undefined> = {}) {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
    dependencies.getClassDetail.mockResolvedValue({
      detail: { academicYear: year("y-x", detailYearStatus), id: classId, status: "active" },
      ok: true,
    });
    dependencies.getAcademicYearManagementData.mockResolvedValue({ academicYears: [year("y-x", detailYearStatus)], ok: true });
    return (await EditClassRoute({ params: Promise.resolve({ classId }), searchParams: Promise.resolve(params) })) as ReactElement<Record<string, unknown>>;
  }

  // Value (extension, review C1 of step 15a): protects=the edit route tells the form whether the user holds sessions.manage, so "Tạo buổi hàng loạt" links into /sessions/batch only for users the batch route lets in; the form gets the class, its open years and the class-directory query;
  // fails_when=the route stops passing canManageSessions (no one gets the link) or passes it without the permission (a TA meets the batch route's denial);
  // why_new=step 4's link was not gated on the permission; seam=ClassFormPage is mocked and its props inspected; no_claim=that the form honours the flag (class-form-page.test.tsx)
  it("passes whether the user may create sessions", async () => {
    const withManage = (await renderEdit(["classes.view", "classes.create", "sessions.manage"], "active", { page: "2", status: "active" })) as unknown as ReactElement<
      ComponentProps<typeof ClassFormPage>
    >;
    expect(withManage.type).toBe(dependencies.ClassFormPage);
    expect(withManage.props).toMatchObject({ canManageSessions: true, directoryQuery: "status=active&page=2" });
    expect(withManage.props.classDetail?.id).toBe(classId);

    const without = (await renderEdit(["classes.view", "classes.create"])) as unknown as ReactElement<ComponentProps<typeof ClassFormPage>>;
    expect(without.type).toBe(dependencies.ClassFormPage);
    expect(without.props.canManageSessions).toBe(false);
  });

  it("denies without classes.view first, and refuses a class whose year is closed", async () => {
    const noView = await renderEdit(["sessions.manage"]);
    expect(noView.type).toBe(PermissionDeniedState);
    expect(noView.props).toEqual(CLASS_EDIT_VIEW_DENIED);

    const closed = await renderEdit(["classes.view", "classes.create"], "closed");
    expect(closed.type).toBe(ErrorState);
    expect(closed.props).toEqual(CLASS_EDIT_YEAR_CLOSED);
  });
});
