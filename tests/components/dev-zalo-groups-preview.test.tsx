// Value: protects=/dev/zalo-groups is inert (saving runs the preview stub, never the real bulk link action), falls back to the ready state, and 404s in production;
// fails_when=the preview stops passing its stub linkAction, an unknown ?state= crashes, or the production guard is removed;
// why_new=testing review: every other dev preview has this test; seam=the parent-messages actions module is mocked so a real call is observable;
// AppShell is replaced by its children; no_claim=the per-row "Tìm nhóm" dialog, which calls its real (permission-checked) actions by design
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DevZaloGroupsPage from "@/app/dev/zalo-groups/page";
import * as parentMessageActions from "@/features/parent-messages/actions";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => router,
}));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/parent-messages/actions", () => ({
  checkStudentZaloGroupAction: vi.fn(),
  linkStudentZaloGroupAction: vi.fn(),
  linkStudentZaloGroupsAction: vi.fn(),
  searchZaloGroupsAction: vi.fn(),
  unlinkStudentZaloGroupAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("/dev/zalo-groups preview", () => {
  it("404s in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevZaloGroupsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("falls back to the ready state and saves through its stub only", async () => {
    render(await DevZaloGroupsPage({ searchParams: Promise.resolve({ state: "nonsense" }) }));
    expect(screen.getByRole("heading", { name: /Học sinh chưa liên kết \(/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Liên kết \d+ học sinh$/ }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(screen.getByText(/chưa liên kết được/)).toBeInTheDocument();
    expect(parentMessageActions.linkStudentZaloGroupsAction).not.toHaveBeenCalled();
    expect(parentMessageActions.linkStudentZaloGroupAction).not.toHaveBeenCalled();
  });

  it.each(["not-configured", "crm-error", "nick-offline"])("shows the checklist without a table for %s", async (state) => {
    render(await DevZaloGroupsPage({ searchParams: Promise.resolve({ state }) }));
    expect(screen.getByText("Chưa có gợi ý nhóm")).toBeInTheDocument();
    expect(screen.queryByText(/Học sinh chưa liên kết \(/)).not.toBeInTheDocument();
  });
});
