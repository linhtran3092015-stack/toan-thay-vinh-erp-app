// Value: protects=the /imports/students and /imports/enrollments routes keep their gates and copy (permission-load error, imports.students / imports.enrollments denial with the shared description, students.create reaching the student wizard as canCreateStudents, the enrollment wizard rendered with no props so it opens on step 1), their new loading files keep the wizard's geometry with a labelled status (four and five stepper cells), and every file lane I1 touched stays on the design tokens, off raw palette colours, outline-none/focus:ring, window.confirm/alert, toLocaleString/Intl formatting, the hard-coded fallback batch id and "pilot" defaults, with no next/navigation import in the two wizards;
// fails_when=a gate keys off the wrong code or drops its copy, canCreateStudents stops following students.create, the enrollment route starts passing seeds (e.g. a batch), a loading file loses its status or step count, or a touched file regains a legacy token, a raw colour, window.confirm, the fallback batch id, "pilot" text or a navigation hook;
// why_new=step 15b adds the loading files and rewrites both wizards; no route test covered these routes;
// seam=permissions and both page components are mocked at the module boundary (the returned element's props are inspected); source files read from disk; no_claim=the wizards' behaviour (student-import-page.test.tsx, enrollment-import-page.test.tsx) or the server actions' own permission checks
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EnrollmentImportLoading from "@/app/(app)/imports/enrollments/loading";
import EnrollmentImportRoute from "@/app/(app)/imports/enrollments/page";
import StudentImportLoading from "@/app/(app)/imports/students/loading";
import StudentImportRoute from "@/app/(app)/imports/students/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

const dependencies = vi.hoisted(() => ({
  EnrollmentImportPage: vi.fn(() => null),
  getCachedDatabasePermissions: vi.fn(),
  StudentImportPage: vi.fn(() => null),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/imports/students/student-import-page", () => ({ StudentImportPage: dependencies.StudentImportPage }));
vi.mock("@/features/imports/enrollments/enrollment-import-page", () => ({ EnrollmentImportPage: dependencies.EnrollmentImportPage }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type Element = ReactElement<Record<string, unknown>>;

async function studentRoute(result: { ok: boolean; permissions?: string[] }) {
  dependencies.getCachedDatabasePermissions.mockResolvedValue(result);
  return (await StudentImportRoute()) as Element;
}

async function enrollmentRoute(result: { ok: boolean; permissions?: string[] }) {
  dependencies.getCachedDatabasePermissions.mockResolvedValue(result);
  return (await EnrollmentImportRoute()) as Element;
}

describe("/imports/students route", () => {
  it("shows the permission-load error, then the imports.students denial", async () => {
    const failed = await studentRoute({ ok: false });
    expect(failed.type).toBe(ErrorState);
    expect(failed.props).toEqual({
      description: "Hệ thống chưa tải được quyền import học viên từ cơ sở dữ liệu.",
      title: "Không tải được quyền truy cập",
    });

    const denied = await studentRoute({ ok: true, permissions: ["students.create", "imports.enrollments"] });
    expect(denied.type).toBe(PermissionDeniedState);
    expect(denied.props).toEqual({
      description: permissionDeniedDescription("imports.students"),
      title: "Không có quyền import học viên",
    });
  });

  it("passes canCreateStudents from students.create and nothing else", async () => {
    const importer = await studentRoute({ ok: true, permissions: ["imports.students"] });
    expect(importer.type).toBe(dependencies.StudentImportPage);
    expect(importer.props).toEqual({ canCreateStudents: false });

    const creator = await studentRoute({ ok: true, permissions: ["imports.students", "students.create"] });
    expect(creator.props).toEqual({ canCreateStudents: true });
  });
});

describe("/imports/enrollments route", () => {
  it("shows the permission-load error, the imports.enrollments denial, then the wizard with no seeds", async () => {
    const failed = await enrollmentRoute({ ok: false });
    expect(failed.type).toBe(ErrorState);
    expect(failed.props).toEqual({
      description: "Hệ thống chưa tải được quyền import ghi danh học viên từ cơ sở dữ liệu.",
      title: "Không tải được quyền truy cập",
    });

    const denied = await enrollmentRoute({ ok: true, permissions: ["imports.students"] });
    expect(denied.type).toBe(PermissionDeniedState);
    expect(denied.props).toEqual({
      description: permissionDeniedDescription("imports.enrollments"),
      title: "Không có quyền import ghi danh học viên",
    });

    const allowed = await enrollmentRoute({ ok: true, permissions: ["imports.enrollments"] });
    expect(allowed.type).toBe(dependencies.EnrollmentImportPage);
    expect(allowed.props).toEqual({});
  });
});

describe("import loading files", () => {
  it.each([
    { Loading: StudentImportLoading, steps: 4, title: "Đang tải màn nhập học sinh" },
    { Loading: EnrollmentImportLoading, steps: 5, title: "Đang tải màn nhập ghi danh" },
  ])("keeps the wizard geometry with a status ($title)", ({ Loading, steps, title }) => {
    const { container } = render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(container.querySelectorAll("ol > li")).toHaveLength(steps);
    expect(container.querySelector("ol")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("lane I1 sources", () => {
  const files = [
    "src/features/imports/students/student-import-page.tsx",
    "src/features/imports/students/student-import-commit-panel.tsx",
    "src/features/imports/students/student-import-action-overrides.ts",
    "src/features/imports/enrollments/enrollment-import-page.tsx",
    "src/features/imports/enrollments/enrollment-import-action-overrides.ts",
    "src/app/(app)/imports/students/loading.tsx",
    "src/app/(app)/imports/enrollments/loading.tsx",
    "src/app/dev/imports/students-preview.tsx",
    "src/app/dev/imports/student-import-fixtures.ts",
    "src/app/dev/imports/enrollments-preview.tsx",
    "src/app/dev/imports/enrollment-import-fixtures.ts",
  ];
  const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

  it("stay on the design tokens, off raw palette colours and off browser dialogs", () => {
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;
    const rawPalette =
      /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(forbidden);
      expect(source, file).not.toMatch(rawPalette);
      expect(source, file).not.toMatch(/window\.confirm|\balert\(|toLocaleString|new Intl\.DateTimeFormat/);
      expect(source, file).not.toMatch(/pilot/i);
    }
  });

  it("drop the enrollment fallback batch id and keep both wizards off next/navigation", () => {
    for (const file of files) expect(read(file), file).not.toContain("36be8c0e-2787-4d88-ab21-61e1a43baccb");
    for (const file of files.filter((name) => /import-page\.tsx$|commit-panel\.tsx$/.test(name))) {
      expect(read(file), file).not.toMatch(/next\/navigation/);
    }
  });
});
