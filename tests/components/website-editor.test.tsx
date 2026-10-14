// Value: protects=the public website editor (WebsiteEditor mode="website"): defaults can be saved, publishing needs the saved version plus an explicit "Xác nhận", unsaved edits block publishing, viewers get a read-only editor; publish/unpublish results show in the publish panel (failure keeps the published state and does not refresh), and the save bar names the changed website parts and Hủy restores the saved draft;
// fails_when=publishing skips the confirmation or uses a stale version, a publish failure flips the published state, refreshes or lands in the save bar, unpublish sends another operation, the bar's changed parts are wrong, or Hủy leaves an unsaved page selected;
// why_new=step 9 moved "Lưu thay đổi" into the StickySaveBar; the publish panel paths had no test;
// seam=the website actions module and next/navigation are mocked; no_claim=the public /site rendering or the server's publish transaction
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function publishPanel() {
  return screen.getByRole("heading", { name: /^Website (đang|chưa) công khai$/ }).closest("section")!;
}
function saveBar() {
  return screen.getByRole("region", { name: "Thanh lưu thay đổi" });
}

// Value: protects=a failed publish shows a danger banner inside the publish panel, keeps "Website chưa công khai", does not refresh and does not put the message in the save bar;
// fails_when=publish errors route to saveError (the bar), the state flips to published, or router.refresh runs on failure;
// why_new=publish failures had no test; seam=saveWebsite mock; no_claim=server-side publish validation
it("shows a publish failure in the publish panel only", async () => {
  mocks.save.mockResolvedValueOnce({ ok: false, message: "Phiên bản đã đổi ở nơi khác." });
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={3} initiallyPublished={false} canManage mode="website" />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

  const banner = await within(publishPanel()).findByRole("alert");
  expect(banner).toHaveTextContent("Chưa thực hiện được.");
  expect(banner).toHaveTextContent("Phiên bản đã đổi ở nơi khác.");
  expect(mocks.save).toHaveBeenCalledWith(expect.any(Object), 3, "publish");
  expect(screen.getByRole("heading", { name: "Website chưa công khai" })).toBeInTheDocument();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(saveBar()).not.toHaveTextContent("Phiên bản đã đổi ở nơi khác.");
});

// Value: protects=a rejected publish call (network) is caught: the panel shows the connection message and nothing changes;
// fails_when=the try/catch in run() is removed and the rejection reaches the error boundary;
// why_new=a rejected publish call used to reach the error boundary; seam=saveWebsite mock rejects; no_claim=real network failures
it("shows a connection failure in the publish panel when the call throws", async () => {
  mocks.save.mockRejectedValueOnce(new Error("fetch failed"));
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={3} initiallyPublished={false} canManage mode="website" />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

  expect(await within(publishPanel()).findByRole("alert")).toHaveTextContent("Không thể kết nối hệ thống.");
  expect(screen.getByRole("heading", { name: "Website chưa công khai" })).toBeInTheDocument();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

// Value: protects=a successful publish shows the success banner in the panel and switches to "Website đang công khai";
// fails_when=the success result is dropped or the published state does not follow;
// why_new=the publish success path had no test; seam=saveWebsite mock; no_claim=the public site content
it("shows the publish success banner and the published state", async () => {
  mocks.save.mockResolvedValueOnce({ ok: true, version: 4, message: "Đã đăng website." });
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={3} initiallyPublished={false} canManage mode="website" />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng phiên bản đã lưu" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

  expect(await within(publishPanel()).findByRole("status")).toHaveTextContent("Đã đăng website.");
  expect(screen.getByRole("heading", { name: "Website đang công khai" })).toBeInTheDocument();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

// Value: protects=unpublishing needs its own confirmation and sends operation "unpublish" with the current version; the inline confirm is not a solid danger button (solid danger only inside dialogs);
// fails_when=Ngừng công khai acts without confirming, sends another operation, or the inline confirm becomes danger-solid again;
// why_new=the unpublish path had no test and its inline confirm was a solid danger button; seam=saveWebsite mock; the variant is read from the button class; no_claim=what visitors see after unpublishing
it("confirms unpublishing and sends the unpublish operation", async () => {
  mocks.save.mockResolvedValueOnce({ ok: true, version: 2, message: "Đã ngừng công khai." });
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={1} initiallyPublished canManage mode="website" />);
  fireEvent.click(screen.getByRole("button", { name: "Ngừng công khai" }));
  expect(mocks.save).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: "Xác nhận" });
  expect(confirm.className).toBe(screen.getByRole("button", { name: "Ngừng công khai" }).className);
  fireEvent.click(confirm);

  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.any(Object), 1, "unpublish"));
  expect(await screen.findByRole("heading", { name: "Website chưa công khai" })).toBeInTheDocument();
});

// Value: protects=in website mode the save bar names the changed parts ("Tên website, Các trang và khối nội dung") and Hủy restores the saved draft, including selecting the first saved page again;
// fails_when=the website labels are wrong or missing, or Hủy leaves the removed unsaved page selected;
// why_new=website-mode save bar labels and Hủy had no test; seam=crypto.randomUUID from jsdom for the new page id; no_claim=saving the restored draft
it("names the changed website parts and Hủy restores the first saved page", () => {
  render(<WebsiteEditor initialSite={createDefaultWebsite()} initialVersion={1} initiallyPublished={false} canManage mode="website" />);
  fireEvent.change(screen.getByLabelText("Tên website"), { target: { value: "Toán Thầy Vinh · Cơ sở 2" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm trang" }));
  expect(screen.getByLabelText("Tên trang")).toHaveValue("Trang mới");

  expect(saveBar()).toHaveTextContent("2 thay đổi chưa lưu");
  expect(saveBar()).toHaveTextContent("Tên website, Các trang và khối nội dung");

  fireEvent.click(within(saveBar()).getByRole("button", { name: "Hủy" }));
  expect(screen.getByLabelText("Tên website")).toHaveValue("Trung tâm Toán Thầy Vinh");
  expect(screen.getByLabelText("Trang đang chỉnh")).toHaveValue("home");
  expect(screen.getByLabelText("Tên trang")).toHaveValue("Trang chủ");
  expect(saveBar()).toHaveTextContent("Chưa có thay đổi");
});
