// Value: protects=/students/new keeps its gates and URL contract through the step-15a redesign: a permission-load failure shows "Không tải được quyền truy cập" (never the form), a missing students.create shows "Không có quyền tạo học viên" with the standard description, and with students.create the page gets create defaults, mode "create", and cancelHref/returnQuery built only from the directory's own string params (arrays, unknown keys and invalid values dropped); the route passes no preview seams (actions, initial*, studentHref);
// fails_when=the gate checks another code (e.g. students.update) or renders the form on a load failure, cancelHref stops returning to the filtered directory, returnQuery leaks unknown or invalid params, a repeated param reaches the query, or the route starts passing preview-only props;
// why_new=no test rendered the /students/new route before step 15a (the redesign keeps its gates; this pins them);
// seam=getCachedDatabasePermissions and StudentFormPage are mocked at module boundaries; the returned element and its props are inspected; no_claim=does not prove the edit route's gates, the form's behaviour (student-profile-form.test.tsx) or that the server actions re-check students.create
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import NewStudentRoute from "@/app/(app)/students/new/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { StudentFormPage } from "@/features/students/form/student-form-page";
import { getStudentProfileFormDefaults } from "@/features/students/form/student-profile-form-helpers";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

const dependencies = vi.hoisted(() => ({
  StudentFormPage: vi.fn(() => null),
  getCachedDatabasePermissions: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/students/form/student-form-page", () => ({ StudentFormPage: dependencies.StudentFormPage }));

type Params = Record<string, string | string[] | undefined>;

async function renderRoute(params: Params = {}) {
  return (await NewStudentRoute({ searchParams: Promise.resolve(params) })) as ReactElement<
    ComponentProps<typeof StudentFormPage> & { description?: string; title?: string }
  >;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/students/new route", () => {
  it("shows the permission-load error instead of the form", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ error: { code: "query_failed", message: "x" }, ok: false });
    const element = await renderRoute();

    expect(element.type).toBe(ErrorState);
    expect(element.props.title).toBe("Không tải được quyền truy cập");
    expect(element.props.description).toBe("Hệ thống chưa tải được quyền tạo học viên từ cơ sở dữ liệu.");
  });

  it("denies without students.create, even with view and update", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["app.access", "students.view", "students.update"] });
    const element = await renderRoute({ search: "An" });

    expect(element.type).toBe(PermissionDeniedState);
    expect(element.props.title).toBe("Không có quyền tạo học viên");
    expect(element.props.description).toBe(permissionDeniedDescription("students.create"));
  });

  it("renders the create form with the directory's own string params as cancelHref and returnQuery", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["app.access", "students.create"] });
    const element = await renderRoute({
      class: ["10A1", "11A1"],
      foo: "bar",
      grade: "8",
      level: "Z",
      page: "2",
      search: "An",
      status: "active",
    });

    expect(element.type).toBe(dependencies.StudentFormPage);
    expect(element.props).toEqual({
      cancelHref: "/students?search=An&status=active&grade=8&page=2",
      defaultValues: getStudentProfileFormDefaults("create"),
      mode: "create",
      returnQuery: "search=An&status=active&grade=8&page=2",
    });
  });

  it("returns to the bare directory without params", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["students.create"] });
    const element = await renderRoute();

    expect(element.props.cancelHref).toBe("/students");
    expect(element.props.returnQuery).toBe("");
  });
});
