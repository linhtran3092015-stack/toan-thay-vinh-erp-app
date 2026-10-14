// Value: protects=the /dev/settings preview is inert: saving Chung, branding and website, publishing, saving role permissions, loading the ZaloCRM nick list and picking a personal palette all run the preview's stubs and never the real server actions or localStorage (the preview runs on localhost where .env.local may point at production); state=error shows the realistic failure banners; the page 404s in production;
// fails_when=a settings component stops accepting an injected action and falls back to updateSystemSettingsAction, saveWebsite, setRolePermissionsAction or listZaloAccountsAction, the preview stops passing its stubs, the personal palette writes storage, or the production guard is removed;
// why_new=step 9 adds a preview of screens whose every save writes production settings;
// seam=the three actions modules are mocked so any real call is observable; AppShell is replaced by its children (the shell is not under test); next/navigation notFound throws a marker; no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DevSettingsPage from "@/app/dev/settings/page";
import { SettingsPreview } from "@/app/dev/settings/settings-preview";
import { listZaloAccountsAction } from "@/features/parent-messages/actions";
import * as settingsActions from "@/features/settings/actions";
import { saveWebsite } from "@/features/website/actions";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/settings",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/settings/actions", () => ({
  deleteAccountAction: vi.fn(),
  inviteAccountAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
  setAccountRolesAction: vi.fn(),
  setRolePermissionsAction: vi.fn(),
  updateSystemSettingsAction: vi.fn(),
}));
vi.mock("@/features/website/actions", () => ({ saveWebsite: vi.fn() }));
vi.mock("@/features/parent-messages/actions", () => ({ listZaloAccountsAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(settingsActions)) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(saveWebsite).not.toHaveBeenCalled();
  expect(listZaloAccountsAction).not.toHaveBeenCalled();
}

function bar() {
  return screen.getByRole("region", { name: "Thanh lưu thay đổi" });
}

describe("/dev/settings preview", () => {
  it("saves Chung and loads the Zalo nicks through stubs only", async () => {
    render(<SettingsPreview role="owner" state="dirty" view="general" />);
    expect(screen.getByRole("navigation", { name: "Mục cài đặt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chung" })).toHaveAttribute("aria-current", "page");
    expect(bar()).toHaveTextContent("2 thay đổi chưa lưu");

    fireEvent.click(screen.getByRole("button", { name: "Tải danh sách nick từ ZaloCRM" }));
    expect(await screen.findByRole("combobox")).toHaveValue("zalo-account-1");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));

    expect(await within(bar()).findByRole("alert")).toHaveTextContent("Bản xem trước không ghi dữ liệu.");
    expectNothingReal();
  });

  it("saves branding and the personal palette through stubs only", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<SettingsPreview role="owner" state="dirty" view="branding" />);
    expect(bar()).toHaveTextContent("Mô tả thương hiệu, Màu nhấn");

    const personal = screen.getByRole("heading", { name: "Giao diện của riêng anh" }).closest("section")!;
    fireEvent.click(within(personal).getByRole("button", { name: "Theo trung tâm" }));
    expect(within(personal).getByRole("status")).toHaveTextContent("Bản xem trước không lưu lựa chọn trên trình duyệt.");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));

    expect(await within(bar()).findByRole("alert")).toHaveTextContent("Bản xem trước không ghi dữ liệu.");
    expect(setItem).not.toHaveBeenCalled();
    expectNothingReal();
  });

  it("publishes the website through stubs only", async () => {
    render(<SettingsPreview role="owner" state="normal" view="website" />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByText("Bản xem trước không ghi dữ liệu.")).toBeInTheDocument();
    expectNothingReal();
  });

  it("saves role permissions through stubs and shows the partial failure in state=error", async () => {
    render(<SettingsPreview role="owner" state="error" view="permissions" />);
    expect(bar()).toHaveTextContent("Kế toán +2 −1, Trợ giảng +1");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu phân quyền" }));
    const dialog = screen.getByRole("dialog", { name: "Lưu phân quyền" });
    fireEvent.change(within(dialog).getByLabelText("Lý do thay đổi"), { target: { value: "Xem trước" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận lưu" }));

    const banner = await within(bar()).findByRole("alert");
    expect(banner).toHaveTextContent("Chưa lưu được quyền cho Kế toán.");
    await waitFor(() => expect(bar()).toHaveTextContent("Kế toán +2 −1"));
    expect(bar()).not.toHaveTextContent("Trợ giảng +1");
    expectNothingReal();
  });

  // Value: protects=each settings form with unsaved edits arms the hub's leave guard: inside the real SettingsHub, a TOC click while Chung, branding or permissions is dirty opens "Thay đổi chưa lưu sẽ mất" instead of navigating;
  // fails_when=a form drops its useLeaveGuard call (or passes the wrong flag), or SettingsHub stops wrapping content in LeaveGuardProvider, so leaving silently discards edits;
  // why_new=settings-toc proves the guard with a probe component only; nothing ties the real forms and hub together; seam=none; no_claim=sidebar/back-button navigation (not guarded by design; AppShell mocked)
  it.each([
    ["general", "Phân quyền"],
    ["branding", "Chung"],
    ["permissions", "Chung"],
  ] as const)("asks before leaving the dirty %s section through the table of contents", (view, target) => {
    render(<SettingsPreview role="owner" state="dirty" view={view} />);
    const nav = screen.getByRole("navigation", { name: "Mục cài đặt" });
    fireEvent.click(within(nav).getByRole("link", { name: target }));
    expect(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).toBeInTheDocument();
  });

  it("shows read-only views without a save bar for a viewer", () => {
    render(<SettingsPreview role="viewer" state="dirty" view="permissions" />);
    expect(screen.queryByRole("region", { name: "Thanh lưu thay đổi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Người dùng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nhật ký" })).not.toBeInTheDocument();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevSettingsPage({ searchParams: Promise.resolve({ view: "general" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
