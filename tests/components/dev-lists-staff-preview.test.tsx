// Value: protects=the /dev/lists staff preview body renders the real staff directory from fixtures and is inert: assigning and revoking a role from the inline role management run the preview's stubs and never the real role server actions (the preview runs on localhost where .env.local may point at production); the owner gets role badges, the "Vai trò" filter, role management and two pages; TA/accountant get the no-roles layout; capped equals normal (no loader limit); empty shows the in-frame empty state;
// fails_when=StaffRoleManagement stops accepting injected actions and falls back to assignStaffRoleAction/revokeStaffRoleAction, the directory stops forwarding them, the preview stops passing previewStaffRoleActions, a new role action ships without a stub, a fixture drifts so a status / leftAt / null field / second page disappears, or a non-owner preview shows role data;
// why_new=step 14b adds the staff view to /dev/lists and the first preview whose inline forms write role assignments;
// seam=the role actions module is mocked so any real call is observable; the body renders without AppShell (the controller wraps it); no_claim=does not cover the /dev/lists page wiring, the AppShell, or that /dev is unreachable in production (dev-lists-preview.test.tsx and the proxy tests do)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { previewStaffMembers } from "@/app/dev/lists/staff-fixtures";
import { previewStaffRoleActions, StaffPreviewBody, type StaffPreviewRole, type StaffPreviewState } from "@/app/dev/lists/staff-preview";
import * as roleActions from "@/features/staff/role-actions";

vi.mock("@/features/staff/role-actions", () => ({
  assignStaffRoleAction: vi.fn(),
  revokeStaffRoleAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
// 20 rows x 2 layouts of inline role forms: slow in jsdom on a loaded machine.
const HEAVY_RENDER_TIMEOUT = 30_000;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderBody(role: StaffPreviewRole, state: StaffPreviewState) {
  return render(<StaffPreviewBody role={role} state={state} />);
}

function expectNothingReal() {
  for (const action of Object.values(roleActions)) {
    expect(action).not.toHaveBeenCalled();
  }
}

function tableRowOf(name: string): HTMLElement {
  const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
  const row = within(table).getByText(name).closest("tr");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function cardOf(name: string): HTMLElement {
  const list = screen.getByRole("list", { name: "Danh sách nhân sự" });
  const card = within(list).getByText(name).closest('[role="listitem"]');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe("/dev/lists staff preview", () => {
  it("covers every role action with a stub", () => {
    // The real module's exports, not this file's mock keys, so a new role action fails here until it gets a stub.
    const source = readFileSync(join(process.cwd(), "src/features/staff/role-actions.ts"), "utf8");
    // assignStaffRoleAction -> "assign"; any other exported action keeps its full name and fails until stubbed.
    const realActions = Array.from(source.matchAll(/export async function (\w+)Action\b/g), (match) => match[1].replace(/StaffRole$/, ""));
    expect(realActions.length).toBeGreaterThan(0);
    expect(Object.keys(previewStaffRoleActions).sort()).toEqual(realActions.sort());
  });

  it("assigns and revokes a role through the stubs only", async () => {
    renderBody("owner", "normal");
    // First row by display name: active, two roles, so both forms are available.
    const target = previewStaffMembers[0];
    expect(target.employmentStatus).toBe("active");
    const heldRole = target.roles?.at(-1);
    expect(heldRole).toBeDefined();
    const row = tableRowOf(target.displayName);

    fireEvent.click(within(row).getByText("Mở quản lý vai trò"));
    fireEvent.change(within(row).getByLabelText(/Vai trò cần cấp/), { target: { value: "accountant" } });
    fireEvent.change(within(row).getByLabelText(/Lý do cấp vai trò/), { target: { value: "Phân công đối soát." } });
    const assignSubmit = within(row).getByRole("button", { name: "Cấp vai trò" });
    const assign = assignSubmit.closest("form") as HTMLElement;
    // Awaited act: a second async form action in the same test otherwise stays pending under testing-library's sync act.
    await act(async () => fireEvent.click(assignSubmit));
    expect(await within(assign).findByText(STUB, {}, { timeout: 10_000 })).toBeInTheDocument();

    const revokeSummary = within(row).getByText(`Thu hồi: ${heldRole?.name}`);
    fireEvent.click(revokeSummary);
    const revoke = revokeSummary.closest("details") as HTMLElement;
    fireEvent.change(within(revoke).getByLabelText(/Lý do thu hồi/), { target: { value: "Kết thúc phân công." } });
    await act(async () => fireEvent.click(within(revoke).getByRole("button", { name: `Xác nhận thu hồi ${heldRole?.name}` })));
    expect(await within(revoke).findByText(STUB, {}, { timeout: 10_000 })).toBeInTheDocument();

    expectNothingReal();
  }, HEAVY_RENDER_TIMEOUT);

  // Value: protects=the card layout's own StaffRoleManagement (the narrow-screen copy, a separate mount from the table row's) also runs the preview stub, never assignStaffRoleAction; fails_when=StaffCard stops forwarding `actions` to StaffRoleManagement while StaffTableRow still does; why_new=the stub test above only submits through the table row; seam=the role actions module is mocked so any real call is observable; no_claim=the revoke form in the card (same forwarding prop as assign)
  it("assigns a role through the card layout's role management via the stub only", async () => {
    renderBody("owner", "normal");
    const target = previewStaffMembers[0];
    expect(target.employmentStatus).toBe("active");
    const card = cardOf(target.displayName);

    fireEvent.click(within(card).getByText("Mở quản lý vai trò"));
    fireEvent.change(within(card).getByLabelText(/Vai trò cần cấp/), { target: { value: "accountant" } });
    fireEvent.change(within(card).getByLabelText(/Lý do cấp vai trò/), { target: { value: "Phân công đối soát." } });
    const assignSubmit = within(card).getByRole("button", { name: "Cấp vai trò" });
    const assign = assignSubmit.closest("form") as HTMLElement;
    await act(async () => fireEvent.click(assignSubmit));
    expect(await within(assign).findByText(STUB, {}, { timeout: 10_000 })).toBeInTheDocument();
    // The table row's copy of the form was not the one submitted.
    expect(within(tableRowOf(target.displayName)).queryByText(STUB)).not.toBeInTheDocument();

    expectNothingReal();
  }, HEAVY_RENDER_TIMEOUT);

  it("gives the owner role badges, the role filter, inline role management and a second page", () => {
    renderBody("owner", "normal");

    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    // Frame footer and the card pager both summarise the page.
    expect(screen.getAllByText("1–20 trong 25 nhân sự")).toHaveLength(2);
    expect(screen.getByLabelText("Vai trò")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Quản lý vai trò" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/25 nhân sự · \d+ đang làm việc/)).toBeInTheDocument();
    // The owner holds settings.view, so /settings/users opens.
    expect(screen.getByRole("link", { name: "Tài khoản và lời mời" })).toHaveAttribute("href", "/settings/users");

    // Fixture coverage on page 1: a sparse profile, the inactive member's leaving date, a held role.
    expect(within(table).getAllByText(/^Chưa có mã nhân sự · /)).not.toHaveLength(0);
    expect(within(table).getAllByText("Chưa cập nhật")).not.toHaveLength(0);
    expect(within(table).getByText("nghỉ từ 30/09/2026")).toBeInTheDocument();
    expect(within(table).getAllByText("Trợ giảng")).not.toHaveLength(0);
    const chips = screen.getByRole("group", { name: "Lọc nhanh nhân sự" });
    for (const label of ["Đang làm việc", "Tạm khóa", "Đã nghỉ", "Chưa xác định"]) {
      expect(within(chips).getByRole("button", { name: new RegExp(`^${label}\\s?\\d+$`) })).toBeInTheDocument();
    }

    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang nhân sự" })).getByRole("button", { name: "Sau" }));
    expect(screen.getAllByText("21–25 trong 25 nhân sự")).toHaveLength(2);
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getByText("Võ Thanh Sơn")).toBeInTheDocument();
    expect(within(table).getAllByText("Chưa xác định")).toHaveLength(1);
    expectNothingReal();
  }, HEAVY_RENDER_TIMEOUT);

  it.each(["ta", "accountant"] as const)("renders the no-roles layout for %s without role data or role management", (role) => {
    renderBody(role, "normal");

    expect(screen.getByRole("table", { name: "Danh sách nhân sự" })).toBeInTheDocument();
    expect(screen.getByText(/vai trò ẩn theo quyền hiện tại/)).toBeInTheDocument();
    expect(screen.getAllByText("Ẩn theo phân quyền")).not.toHaveLength(0);
    expect(screen.queryByLabelText("Vai trò")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quản lý vai trò" })).not.toBeInTheDocument();
    expect(screen.queryByText("Trợ giảng")).not.toBeInTheDocument();
    // No settings.view for these roles: /settings/users would deny, so no accounts link.
    expect(screen.queryByRole("link", { name: "Tài khoản và lời mời" })).not.toBeInTheDocument();
    expectNothingReal();
  }, HEAVY_RENDER_TIMEOUT);

  it("renders capped exactly like normal: the staff loader has no row limit", () => {
    const normal = renderBody("owner", "normal");
    const normalText = normal.container.textContent;
    normal.unmount();

    const capped = renderBody("owner", "capped");
    expect(capped.container.textContent).toBe(normalText);
  }, HEAVY_RENDER_TIMEOUT);

  it("renders the in-frame empty state without rows, cards or a pager", () => {
    renderBody("owner", "empty");

    const table = screen.getByRole("table", { name: "Danh sách nhân sự" });
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    expect(screen.getAllByText("Chưa có hồ sơ nhân sự")).toHaveLength(2);
    expect(screen.queryByRole("list", { name: "Danh sách nhân sự" })).not.toBeInTheDocument();
    expect(screen.queryByText(/trong 0 nhân sự/)).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Tìm nhân sự" })).toBeDisabled();
  });
});
