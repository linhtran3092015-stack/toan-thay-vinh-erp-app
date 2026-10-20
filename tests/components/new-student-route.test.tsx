// Value: protects=/students/new keeps its gates and URL contract through the step-15a redesign: a permission-load failure shows "Không tải được quyền truy cập" (never the form), a missing students.create shows "Không có quyền tạo học viên" with the standard description (exactly STUDENT_CREATE_DENIED, the copy the /dev/forms preview shows), and with students.create the page gets create defaults, mode "create", and cancelHref/returnQuery built only from the directory's own string params (arrays, unknown keys and invalid values dropped); the route passes no preview seams (actions, initial*, studentHref); /students/[id]/edit denies without students.view + students.update with exactly STUDENT_EDIT_DENIED before loading the student; the /students/new loading skeleton announces one status with its title and hides the pulsing skeleton from assistive tech;
// fails_when=the gate checks another code (e.g. students.update) or renders the form on a load failure, a route's denial copy drifts from student-form-route-copy.ts (the preview would then show other words), cancelHref stops returning to the filtered directory, returnQuery leaks unknown or invalid params, a repeated param reaches the query, the route starts passing preview-only props, the edit route loads the student before its gate, or loading.tsx gains a second status / exposes its skeleton;
// why_new=no test rendered the /students/new route before step 15a (the redesign keeps its gates; this pins them); review findings M4 (preview retyped the routes' denials) and T2 (loading.tsx never rendered) extend it;
// seam=getCachedDatabasePermissions, getStudentDetail and StudentFormPage are mocked at module boundaries; the returned element and its props are inspected; loading.tsx is rendered with Testing Library; no_claim=does not prove the edit route's other states (invalid id, not found, load error), the form's behaviour (student-profile-form.test.tsx) or that the server actions re-check students.create
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EditStudentRoute from "@/app/(app)/students/[studentId]/edit/page";
import NewStudentLoading from "@/app/(app)/students/new/loading";
import NewStudentRoute from "@/app/(app)/students/new/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { StudentFormPage } from "@/features/students/form/student-form-page";
import { STUDENT_CREATE_DENIED, STUDENT_EDIT_DENIED } from "@/features/students/form/student-form-route-copy";
import { getStudentProfileFormDefaults } from "@/features/students/form/student-profile-form-helpers";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

const dependencies = vi.hoisted(() => ({
  StudentFormPage: vi.fn(() => null),
  getCachedDatabasePermissions: vi.fn(),
  getStudentDetail: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/students/data", () => ({ getStudentDetail: dependencies.getStudentDetail }));
vi.mock("@/features/students/form/student-form-page", () => ({ StudentFormPage: dependencies.StudentFormPage }));

type Params = Record<string, string | string[] | undefined>;

async function renderRoute(params: Params = {}) {
  return (await NewStudentRoute({ searchParams: Promise.resolve(params) })) as ReactElement<
    ComponentProps<typeof StudentFormPage> & { description?: string; title?: string }
  >;
}

afterEach(() => {
  cleanup();
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
    // Exactly the shared copy the /dev/forms preview renders.
    expect(element.props).toEqual(STUDENT_CREATE_DENIED);
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

describe("/students/[studentId]/edit route denial", () => {
  const studentId = "5f0c2a8e-3b1d-4c6e-9a7f-2d4b6c8e0a13";

  async function renderEdit(permissions: string[]) {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
    return (await EditStudentRoute({ params: Promise.resolve({ studentId }), searchParams: Promise.resolve({}) })) as ReactElement<
      Record<string, unknown>
    >;
  }

  it.each([[["students.view"]], [["students.update"]], [["students.create", "sessions.manage"]]])(
    "denies %j with the preview's copy before loading the student",
    async (permissions) => {
      const element = await renderEdit(permissions);

      expect(element.type).toBe(PermissionDeniedState);
      expect(element.props).toEqual(STUDENT_EDIT_DENIED);
      expect(STUDENT_EDIT_DENIED).toEqual({
        description: "Tài khoản hiện tại cần có cả quyền students.view và students.update.",
        title: "Không có quyền chỉnh sửa học viên",
      });
      expect(dependencies.getStudentDetail).not.toHaveBeenCalled();
    },
  );
});

describe("/students/new loading", () => {
  it("announces one status with its title and keeps the pulsing skeleton hidden from assistive tech", () => {
    const { container } = render(<NewStudentLoading />);

    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent("Đang tải form học sinh");
    expect(statuses[0].closest('[aria-hidden="true"]')).toBeNull();

    const skeletons = container.querySelectorAll(".motion-safe\\:animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    for (const skeleton of skeletons) {
      expect(skeleton.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });
});
