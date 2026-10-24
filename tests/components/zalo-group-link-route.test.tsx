// Value: protects=/parent-messages/groups needs students.view and students.update before it reads ZaloCRM (server key) or any guardian data, and guardian details follow guardians.view;
// fails_when=a permission check is dropped or reordered after the loader, guardian details are shown without guardians.view, or the table renders before groups load;
// why_new=testing review: the page gate in front of getZaloGroupLinkWorkspace had no test (the actions are tested separately);
// seam=none; the loader, checklist and table are module mocks; no_claim=the loader's own output (zalo-group-link-data test)
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ZaloGroupLinkPage from "@/app/(app)/parent-messages/groups/page";

const deps = vi.hoisted(() => ({ permissions: vi.fn(), workspace: vi.fn() }));

vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: deps.permissions }));
vi.mock("@/features/parent-messages/zalo-group-link-data", () => ({ getZaloGroupLinkWorkspace: deps.workspace }));
vi.mock("@/features/parent-messages/components/zalo-connection-status", () => ({ ZaloConnectionStatusCard: () => <p>checklist</p> }));
vi.mock("@/features/parent-messages/components/zalo-group-bulk-linker", () => ({
  ZaloGroupBulkLinker: ({ showGuardians, students }: { showGuardians: boolean; students: unknown[] }) => (
    <p>
      linker rows:{students.length} guardians:{String(showGuardians)}
    </p>
  ),
}));

const status = { centerAccountId: "acc-center", groupsTotal: 3 };

beforeEach(() => {
  deps.workspace.mockResolvedValue({ data: { matches: [], status, students: [{ id: "s1" }, { id: "s2" }] }, ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/parent-messages/groups", () => {
  it.each(["students.view", "students.update"])("refuses without %s and never loads ZaloCRM or guardians", async (missing) => {
    deps.permissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.update", "guardians.view"].filter((code) => code !== missing) });
    render(await ZaloGroupLinkPage());
    expect(screen.getByText("Không có quyền liên kết nhóm Zalo")).toBeInTheDocument();
    expect(deps.workspace).not.toHaveBeenCalled();
  });

  it("shows an error when permissions or the workspace cannot be read", async () => {
    deps.permissions.mockResolvedValue({ ok: false });
    render(await ZaloGroupLinkPage());
    expect(screen.getByText("Không tải được quyền truy cập")).toBeInTheDocument();
    expect(deps.workspace).not.toHaveBeenCalled();
    cleanup();

    deps.permissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.update"] });
    deps.workspace.mockResolvedValue({ error: "Không tải được danh sách học sinh và phụ huynh.", ok: false });
    render(await ZaloGroupLinkPage());
    expect(screen.getByText("Không tải được dữ liệu liên kết")).toBeInTheDocument();
  });

  it("passes guardians.view through and waits for groups before the table", async () => {
    deps.permissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.update", "guardians.view"] });
    render(await ZaloGroupLinkPage());
    expect(deps.workspace).toHaveBeenLastCalledWith({ includeGuardianDetails: true });
    expect(screen.getByText("linker rows:2 guardians:true")).toBeInTheDocument();
    cleanup();

    deps.permissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.update"] });
    deps.workspace.mockResolvedValue({ data: { matches: [], status: { ...status, groupsTotal: null }, students: [{ id: "s1" }] }, ok: true });
    render(await ZaloGroupLinkPage());
    expect(deps.workspace).toHaveBeenLastCalledWith({ includeGuardianDetails: false });
    expect(screen.getByText("Chưa có gợi ý nhóm")).toBeInTheDocument();
    expect(screen.queryByText(/linker rows/)).not.toBeInTheDocument();
  });
});
