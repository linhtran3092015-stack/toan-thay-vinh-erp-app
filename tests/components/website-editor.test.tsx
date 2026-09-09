import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WebsiteEditor } from "@/features/website/editor";
import { createDefaultWebsite } from "@/features/website/schema";
const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/website/actions", () => ({ saveWebsite: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ ok: true, version: 2, message: "Đã lưu" }); });
it("allows saving initial defaults and requires explicit publication confirmation", async () => {
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={0} initiallyPublished={false} canManage mode="website" />);
  expect(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" }));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() => expect(mocks.save).toHaveBeenLastCalledWith(expect.any(Object), 2, "publish"));
});
it("blocks publishing unsaved changes", () => {
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={1} initiallyPublished canManage mode="website" />);
  fireEvent.change(screen.getByLabelText("Tên website"), { target: { value: "Tên mới" } });
  expect(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" })).toBeDisabled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("keeps editor read-only for viewers", () => {
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={1} initiallyPublished canManage={false} mode="website" />);
  expect(screen.getByLabelText("Tên website")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Đăng phiên bản đã lưu" })).not.toBeInTheDocument();
});
