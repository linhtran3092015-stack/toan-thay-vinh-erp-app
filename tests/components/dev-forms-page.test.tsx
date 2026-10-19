// Value: protects=the /dev/forms page (design 17a/17b previews): 404 in production; `view`, `role` and `state` are whitelisted (arrays use their first value) with fallbacks student / owner / the view's first state, and a state from another view never leaks in; the matching lane body receives exactly { view, role, state }; the shell gets the real route of the view as previewPathname and the role's permission codes (owner = every code but student_care.view, ta = app.access + sessions.manage, viewer = app.access); the controller's preview files stay on the design tokens;
// fails_when=the production guard is removed, an unknown value reaches a body, a body gets a state of another view or the wrong body renders, previewPathname points at another route, a role gains codes it must not have (e.g. the TA gets classes.view or students.create), or a legacy token / outline-none / raw hex enters the controller files;
// why_new=step 15a adds /dev/forms for the student form, class form and batch session previews;
// seam=AppShell and the three lane bodies are mocked to capture their props (the shell and the bodies are not under test); next/navigation notFound throws a marker; no_claim=does not prove the bodies' fixtures, stubs or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DevFormsPage from "@/app/dev/forms/page";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";

const captured = vi.hoisted(() => ({
  bodies: [] as Array<{ name: string; props: Record<string, unknown> }>,
  shells: [] as Array<{ permissions: readonly string[]; previewPathname?: string }>,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/forms",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children, permissions, previewPathname }: { children: ReactNode; permissions: readonly string[]; previewPathname?: string }) => {
    captured.shells.push({ permissions, previewPathname });
    return <div data-testid="shell">{children}</div>;
  },
}));
vi.mock("@/app/dev/forms/student-form-preview", () => ({
  StudentFormPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "student", props });
    return <p>student body</p>;
  },
}));
vi.mock("@/app/dev/forms/class-form-preview", () => ({
  ClassFormPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "class", props });
    return <p>class body</p>;
  },
}));
vi.mock("@/app/dev/forms/batch-preview", () => ({
  BatchPreviewBody: (props: Record<string, unknown>) => {
    captured.bodies.push({ name: "batch", props });
    return <p>batch body</p>;
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  captured.bodies.length = 0;
  captured.shells.length = 0;
});

type Params = Record<string, string | string[] | undefined>;

async function renderPage(params: Params) {
  render(await DevFormsPage({ searchParams: Promise.resolve(params) }));
  expect(captured.bodies).toHaveLength(1);
  expect(captured.shells).toHaveLength(1);
  return { body: captured.bodies[0], shell: captured.shells[0] };
}

describe("/dev/forms page", () => {
  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevFormsPage({ searchParams: Promise.resolve({ view: "batch" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("falls back to the student form for the owner in its clean state", async () => {
    const { body, shell } = await renderPage({});
    expect(body).toEqual({ name: "student", props: { role: "owner", state: "clean", view: "student" } });
    expect(shell.previewPathname).toBe("/students/new");
    expect(screen.getByTestId("shell")).toHaveTextContent("student body");
  });

  it("drops unknown values and uses the first of repeated params", async () => {
    const { body } = await renderPage({ role: ["ta", "owner"], state: "bogus", view: "settings" });
    expect(body).toEqual({ name: "student", props: { role: "ta", state: "clean", view: "student" } });
  });

  it.each([
    { expected: { name: "student", props: { role: "owner", state: "dirty", view: "student" } }, params: { state: "dirty", view: "student" }, pathname: "/students/new" },
    { expected: { name: "student", props: { role: "viewer", state: "sibling", view: "student-edit" } }, params: { role: "viewer", state: "sibling", view: "student-edit" }, pathname: "/students/hs-preview/edit" },
    { expected: { name: "student", props: { role: "owner", state: "duplicate", view: "student" } }, params: { state: "duplicate", view: "student" }, pathname: "/students/new" },
    { expected: { name: "class", props: { role: "owner", state: "no-year", view: "class" } }, params: { state: "no-year", view: "class" }, pathname: "/classes/new" },
    { expected: { name: "class", props: { role: "ta", state: "error", view: "class-edit" } }, params: { role: "ta", state: "error", view: "class-edit" }, pathname: "/classes/cls-preview/edit" },
    { expected: { name: "batch", props: { role: "owner", state: "holidays", view: "batch" } }, params: { state: "holidays", view: "batch" }, pathname: "/sessions/batch" },
    { expected: { name: "batch", props: { role: "ta", state: "capped", view: "batch" } }, params: { role: "ta", state: "capped", view: "batch" }, pathname: "/sessions/batch" },
  ])("renders $params.view ($params.state) in the matching body on $pathname", async ({ expected, params, pathname }) => {
    const { body, shell } = await renderPage(params);
    expect(body).toEqual(expected);
    expect(shell.previewPathname).toBe(pathname);
  });

  it.each([
    { params: { state: "duplicate", view: "class" }, state: "clean" },
    { params: { state: "no-year", view: "student" }, state: "clean" },
    { params: { state: "dirty", view: "batch" }, state: "default" },
    { params: { state: "holidays", view: "class-edit" }, state: "clean" },
    { params: { state: "empty", view: "student-edit" }, state: "clean" },
  ])("never passes a state of another view ($params.view with $params.state → $state)", async ({ params, state }) => {
    const { body } = await renderPage(params);
    expect(body.props).toEqual({ role: "owner", state, view: params.view });
  });

  it("gives the shell each role's permission codes", async () => {
    const owner = await renderPage({ role: "owner" });
    expect([...owner.shell.permissions].sort()).toEqual(DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view").sort());
    cleanup();
    captured.bodies.length = 0;
    captured.shells.length = 0;

    const ta = await renderPage({ role: "ta", view: "batch" });
    expect(ta.shell.permissions).toEqual(["app.access", "sessions.manage"]);
    cleanup();
    captured.bodies.length = 0;
    captured.shells.length = 0;

    const viewer = await renderPage({ role: "viewer", view: "class" });
    expect(viewer.shell.permissions).toEqual(["app.access"]);
  });

  it("keeps the controller's preview files on the design tokens", () => {
    const files = ["src/app/dev/forms/page.tsx", "src/app/dev/forms/forms-preview.tsx", "src/app/dev/forms/forms-preview-params.ts"];
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;

    for (const file of files) {
      expect(readFileSync(join(process.cwd(), file), "utf8"), file).not.toMatch(forbidden);
    }
  });
});
