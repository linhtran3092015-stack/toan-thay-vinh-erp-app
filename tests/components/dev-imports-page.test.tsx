// Value: protects=the /dev/imports page (design 17c import wizard previews): 404 in production; `view`, `role` and `state` are whitelisted (arrays use their first value) with fallbacks students / owner / the view's first state, and a state from another view never leaks in; the matching lane body receives exactly { view, role, state } (students, enrollments, classes + class-batch, balances + balance-batch); the shell gets the real route of the view as previewPathname, the role's fixed user and permission codes (owner = the /dev/forms owner set incl. every imports.* code, imports.session_balances.approve, students.create and app.access; maker = app.access + imports.session_balances, never .approve; viewer = app.access); the preview files (controller and lane bodies) stay on the design tokens;
// fails_when=the production guard is removed, an unknown value reaches a body, a body gets a state of another view or the wrong body renders, previewPathname points at another route (or at /dev), the maker gains the approval code or another import code, the viewer gains anything but app access, the owner loses an import code, or a legacy token / outline-none / raw hex enters the controller files;
// why_new=step 15b adds /dev/imports for the four import wizards and the two batch pages;
// seam=AppShell and the four lane bodies are mocked to capture their props (the shell and the bodies are not under test); next/navigation notFound throws a marker;
// no_claim=does not prove the bodies' fixtures, action stubs or copy (each lane's preview test), or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DevImportsPage from "@/app/dev/imports/page";
import { IMPORTS_PREVIEW_PATHNAMES, IMPORTS_PREVIEW_STATES, IMPORTS_PREVIEW_TODAY } from "@/app/dev/imports/imports-preview-params";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";

const captured = vi.hoisted(() => ({
  bodies: [] as Array<{ name: string; props: Record<string, unknown> }>,
  shells: [] as Array<{ authUserId: string; permissions: readonly string[]; previewPathname?: string }>,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/imports",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({
    authUser,
    children,
    permissions,
    previewPathname,
  }: {
    authUser: { id: string };
    children: ReactNode;
    permissions: readonly string[];
    previewPathname?: string;
  }) => {
    captured.shells.push({ authUserId: authUser.id, permissions, previewPathname });
    return <div data-testid="shell">{children}</div>;
  },
}));
vi.mock("@/app/dev/imports/students-preview", () => ({
  StudentImportPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "students", props });
    return <p>students body</p>;
  },
}));
vi.mock("@/app/dev/imports/enrollments-preview", () => ({
  EnrollmentImportPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "enrollments", props });
    return <p>enrollments body</p>;
  },
}));
vi.mock("@/app/dev/imports/class-import-preview", () => ({
  ClassImportPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "classes", props });
    return <p>classes body</p>;
  },
}));
vi.mock("@/app/dev/imports/balance-import-preview", () => ({
  BalanceImportPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "balances", props });
    return <p>balances body</p>;
  },
}));

function resetCaptured() {
  captured.bodies.length = 0;
  captured.shells.length = 0;
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  resetCaptured();
});

type Params = Record<string, string | string[] | undefined>;

async function renderPage(params: Params) {
  render(await DevImportsPage({ searchParams: Promise.resolve(params) }));
  expect(captured.bodies).toHaveLength(1);
  expect(captured.shells).toHaveLength(1);
  return { body: captured.bodies[0], shell: captured.shells[0] };
}

describe("/dev/imports page", () => {
  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevImportsPage({ searchParams: Promise.resolve({ view: "balances" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(captured.bodies).toHaveLength(0);
  });

  it("falls back to the student import for the owner on its file step", async () => {
    const { body, shell } = await renderPage({});
    expect(body).toEqual({ name: "students", props: { role: "owner", state: "file", view: "students" } });
    expect(shell.previewPathname).toBe("/imports/students");
    expect(shell.authUserId).toBe("dev-user");
    expect(screen.getByTestId("shell")).toHaveTextContent("students body");
  });

  it("drops unknown values and uses the first of repeated params", async () => {
    const { body } = await renderPage({ role: ["maker", "owner"], state: "bogus", view: "imports" });
    expect(body).toEqual({ name: "students", props: { role: "maker", state: "file", view: "students" } });

    cleanup();
    resetCaptured();
    const repeated = await renderPage({ role: "admin", state: ["approve-own", "posted"], view: ["balance-batch", "students"] });
    expect(repeated.body).toEqual({ name: "balances", props: { role: "owner", state: "approve-own", view: "balance-batch" } });
  });

  it.each([
    { name: "students", params: { state: "review-errors", view: "students" }, pathname: "/imports/students", role: "owner" },
    { name: "students", params: { role: "viewer", state: "done", view: "students" }, pathname: "/imports/students", role: "viewer" },
    { name: "enrollments", params: { state: "batch", view: "enrollments" }, pathname: "/imports/enrollments", role: "owner" },
    { name: "enrollments", params: { state: "done", view: "enrollments" }, pathname: "/imports/enrollments", role: "owner" },
    { name: "classes", params: { state: "review-conflicts", view: "classes" }, pathname: "/imports/classes", role: "owner" },
    { name: "classes", params: { state: "previewed", view: "class-batch" }, pathname: "/imports/classes/batch-preview", role: "owner" },
    { name: "balances", params: { role: "maker", state: "list", view: "balances" }, pathname: "/imports/session-balances", role: "maker" },
    {
      name: "balances",
      params: { role: "maker", state: "approve-own", view: "balance-batch" },
      pathname: "/imports/session-balances/batch-preview",
      role: "maker",
    },
    { name: "balances", params: { state: "posted", view: "balance-batch" }, pathname: "/imports/session-balances/batch-preview", role: "owner" },
  ])("renders $params.view ($params.state) in the $name body on $pathname", async ({ name, params, pathname, role }) => {
    const { body, shell } = await renderPage(params);
    expect(body).toEqual({ name, props: { role, state: params.state, view: params.view } });
    expect(shell.previewPathname).toBe(pathname);
  });

  it("accepts every listed state of every view and nothing from another view", async () => {
    for (const [view, states] of Object.entries(IMPORTS_PREVIEW_STATES)) {
      for (const state of states) {
        const { body } = await renderPage({ state, view });
        expect(body.props).toEqual({ role: "owner", state, view });
        cleanup();
        resetCaptured();
      }
    }
  });

  it.each([
    { params: { state: "review-errors", view: "enrollments" }, state: "file" },
    { params: { state: "batch", view: "students" }, state: "file" },
    { params: { state: "mapping", view: "class-batch" }, state: "ready" },
    { params: { state: "committed", view: "classes" }, state: "file" },
    { params: { state: "reconcile", view: "balances" }, state: "file" },
    { params: { state: "review", view: "balance-batch" }, state: "reconcile" },
  ])("never passes a state of another view ($params.view with $params.state → $state)", async ({ params, state }) => {
    const { body } = await renderPage(params);
    expect(body.props).toEqual({ role: "owner", state, view: params.view });
  });

  it("gives the shell each role's user and permission codes", async () => {
    const owner = await renderPage({ role: "owner" });
    const ownerCodes = DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view");
    expect([...owner.shell.permissions].sort()).toEqual([...ownerCodes].sort());
    expect(owner.shell.permissions).toEqual(
      expect.arrayContaining([
        "app.access",
        "imports.classes",
        "imports.enrollments",
        "imports.session_balances",
        "imports.session_balances.approve",
        "imports.students",
        "students.create",
      ]),
    );
    cleanup();
    resetCaptured();

    const maker = await renderPage({ role: "maker", view: "balance-batch" });
    expect(maker.shell.permissions).toEqual(["app.access", "imports.session_balances"]);
    expect(maker.shell.authUserId).toBe("dev-maker");
    cleanup();
    resetCaptured();

    const viewer = await renderPage({ role: "viewer", view: "classes" });
    expect(viewer.shell.permissions).toEqual(["app.access"]);
    expect(viewer.shell.authUserId).toBe("dev-viewer");
  });

  it("keeps the preview on the fixed clock and the real import routes", () => {
    expect(IMPORTS_PREVIEW_TODAY).toBe("2026-10-19");
    expect(Object.keys(IMPORTS_PREVIEW_PATHNAMES).sort()).toEqual(Object.keys(IMPORTS_PREVIEW_STATES).sort());
    for (const pathname of Object.values(IMPORTS_PREVIEW_PATHNAMES)) expect(pathname).toMatch(/^\/imports\/(students|enrollments|classes|session-balances)(\/batch-preview)?$/);
  });

  it("keeps the preview files on the design tokens (the lane bodies too)", () => {
    const files = [
      "src/app/dev/imports/page.tsx",
      "src/app/dev/imports/imports-preview.tsx",
      "src/app/dev/imports/imports-preview-params.ts",
      "src/app/dev/imports/students-preview.tsx",
      "src/app/dev/imports/enrollments-preview.tsx",
      "src/app/dev/imports/class-import-preview.tsx",
      "src/app/dev/imports/balance-import-preview.tsx",
    ];
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;

    for (const file of files) {
      expect(readFileSync(join(process.cwd(), file), "utf8"), file).not.toMatch(forbidden);
    }
  });
});
