// Value: protects=the "Chung" settings form with its StickySaveBar (design 09a): the bar starts clean, counts and names changed controls against the saved values, sits inside the form so "Lưu cài đặt" submits it, Hủy restores the saved values (including the Zalo nick picked from the list), a failed save keeps typed values and shows a danger banner in the bar, a successful save returns the bar to clean, and the read-only view has no bar;
// fails_when=dirty tracking misses a field or counts the two hidden Zalo fields twice, Hủy keeps edits or the picked nick, the bar leaves the form, a failed save resets the fields (React form-action auto reset), or the read-only view gains a save bar;
// why_new=step 9 adds dirty tracking, cancel and the save bar to the system settings form;
// seam=the settings actions module and next/navigation (leave dialog) are mocked; the Zalo list goes through the injected listZaloAccounts stub; dirty state is read after a 0ms timer so tests wait for it; no_claim=does not prove the server keeps the values (system-settings unit tests) nor the fixed bar layout visually
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuardedLink, LeaveGuardProvider } from "@/features/settings/components/leave-guard";
import type { SettingsActionOverrides } from "@/features/settings/settings-action-overrides";
import { SYSTEM_SETTING_DEFAULTS } from "@/features/settings/system-settings";
import { SystemSettingsForm, SystemSettingsReadOnly } from "@/features/settings/system-settings-form";

const actions = vi.hoisted(() => ({ updateSystemSettingsAction: vi.fn() }));
vi.mock("@/features/settings/actions", () => actions);
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push, refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const listZaloAccounts = vi.fn(async () => ({
  accounts: [{ displayName: "Nick trung tâm", id: "zalo-1", phone: "0912", status: "connected", zaloUid: null }],
  ok: true as const,
}));

function bar() {
  return screen.getByRole("region", { name: "Thanh lưu thay đổi" });
}

/** Fires a cancelable beforeunload; true when the page asked the browser to confirm leaving. */
function beforeUnloadIsPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

/** Clicks a link; true when the app held the click (leave dialog), false when the link was left to navigate. */
function clickIsHeld(link: HTMLElement): boolean {
  const seen = { held: false };
  // Runs after React's handlers (window is last in the bubble path); then stops jsdom's document navigation.
  const record = (event: MouseEvent) => {
    seen.held = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener("click", record);
  fireEvent.click(link);
  window.removeEventListener("click", record);
  return seen.held;
}

describe("SystemSettingsForm save bar", () => {
  it("tracks changed controls, sits inside the form and restores on Hủy", async () => {
    render(<SystemSettingsForm actions={{ listZaloAccounts }} initialValues={SYSTEM_SETTING_DEFAULTS} />);
    const form = screen.getByLabelText("Tên hiển thị trung tâm").closest("form")!;
    expect(within(form).getByRole("region", { name: "Thanh lưu thay đổi" })).toBe(bar());
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(within(bar()).getByRole("button", { name: "Lưu cài đặt" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Trung tâm QA" } });
    fireEvent.click(screen.getByLabelText("Tạo tin nhận xét cuối buổi"));
    fireEvent.click(screen.getByRole("button", { name: "Tải danh sách nick từ ZaloCRM" }));
    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "zalo-1" } });

    await waitFor(() => expect(bar()).toHaveTextContent("3 thay đổi chưa lưu"));
    expect(bar()).toHaveTextContent("Tên hiển thị trung tâm, Nick trung tâm gửi tin, Tạo tin nhận xét cuối buổi");
    expect(within(bar()).getByRole("button", { name: "Lưu cài đặt" })).toBeEnabled();

    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue(SYSTEM_SETTING_DEFAULTS["center.display_name"]);
    expect(screen.getByLabelText("Tạo tin nhận xét cuối buổi")).toBeChecked();
    expect(form.querySelector<HTMLInputElement>('input[name="zaloCenterAccountId"]')?.value).toBe("");
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
  });

  it("keeps typed values and shows the error in the bar when saving fails", async () => {
    // A server answer distinct from the connection fallback, so the test proves the server message is shown.
    actions.updateSystemSettingsAction.mockResolvedValueOnce({ message: "Số ngày tự khóa phải từ 0 đến 30.", status: "error" });
    render(<SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Tự khóa buổi học sau (ngày)"), { target: { value: "5" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));

    const banner = await within(bar()).findByRole("alert");
    expect(banner).toHaveTextContent("Chưa lưu được cài đặt. Số ngày tự khóa phải từ 0 đến 30.");
    expect(banner).not.toHaveTextContent("Không thể kết nối hệ thống cài đặt.");
    expect(actions.updateSystemSettingsAction).toHaveBeenCalledWith(expect.objectContaining({ sessionAutoLockAfterDays: 5 }));
    expect(screen.getByLabelText("Tự khóa buổi học sau (ngày)")).toHaveValue(5);
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
  });

  it("returns to clean after a successful save", async () => {
    actions.updateSystemSettingsAction.mockResolvedValueOnce({ message: "Đã lưu cài đặt hệ thống.", status: "success" });
    render(<SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Email liên hệ"), { target: { value: "a@b.vn" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));

    expect(await within(bar()).findByRole("status")).toHaveTextContent("Đã lưu cài đặt hệ thống.");
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(screen.getByLabelText("Email liên hệ")).toHaveValue("a@b.vn");
  });

  it("starts dirty from a seeded draft (preview) and Hủy goes back to the saved values", async () => {
    render(<SystemSettingsForm initialDraft={{ displayName: "Cơ sở 2" }} initialValues={SYSTEM_SETTING_DEFAULTS} />);
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue("Cơ sở 2");
    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue(SYSTEM_SETTING_DEFAULTS["center.display_name"]);
  });

  // Value: protects=a save call that throws (network, server crash) never reaches the error boundary: the danger banner above the bar says the settings could not be saved, the typed value and dirty count stay, and the save button works again;
  // fails_when=the try/catch around updateSystemSettingsAction is removed (the rejection escapes the transition), the banner text changes, the field resets, or the bar stays in its saving state;
  // why_new=only resolved error results were covered; seam=the settings actions module is mocked with a rejection; no_claim=the real network failure mode
  it("shows the connection banner and keeps the edit when the save call throws", async () => {
    actions.updateSystemSettingsAction.mockRejectedValueOnce(new Error("fetch failed"));
    render(<SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Số điện thoại liên hệ"), { target: { value: "0909 000 111" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));

    expect(await within(bar()).findByRole("alert")).toHaveTextContent("Chưa lưu được cài đặt. Không thể kết nối hệ thống cài đặt.");
    expect(screen.getByLabelText("Số điện thoại liên hệ")).toHaveValue("0909 000 111");
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    await waitFor(() => expect(within(bar()).getByRole("button", { name: "Lưu cài đặt" })).toBeEnabled());
  });

  // Value: protects=the Zalo nick select is named "Nick trung tâm gửi tin" (label linked to the control) and carries the hint;
  // fails_when=the label goes back to a bare span so the select has no accessible name, or the hint is unlinked;
  // why_new=the select had no accessible name (bare span label); seam=listZaloAccounts stub; no_claim=ZaloCRM itself
  it("names the Zalo nick select by its label", async () => {
    render(<SystemSettingsForm actions={{ listZaloAccounts }} initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Tải danh sách nick từ ZaloCRM" }));
    const select = await screen.findByRole("combobox", { name: "Nick trung tâm gửi tin" });
    expect(select).toHaveAccessibleDescription(/Nick này phải có mặt trong các nhóm sổ liên lạc/);
  });

  // Value: protects=the read-only Chung view (settings.view without settings.manage) shows the same sections and Vietnamese field names as the form, values as text, and says editing needs settings.manage;
  // fails_when=raw setting keys (center.display_name) come back, a section is lost, booleans show as "on"/"", or the read-only notice disappears;
  // why_new=the read-only fallback showed raw setting keys; seam=none; no_claim=the page's permission check (server route)
  it("shows the read-only view with sections, field names and a Chỉ đọc notice", () => {
    render(<SystemSettingsReadOnly settings={SYSTEM_SETTING_DEFAULTS} />);
    for (const title of ["Thông tin trung tâm", "Coaching", "Buổi học", "Tin nhắn phụ huynh (Zalo)"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("Chỉ đọc")).toBeInTheDocument();
    expect(screen.getByText(/Cần quyền settings\.manage để sửa cài đặt chung\./)).toBeInTheDocument();
    const name = screen.getByText("Tên hiển thị trung tâm");
    expect(name.tagName).toBe("DT");
    expect(name.nextElementSibling).toHaveTextContent(SYSTEM_SETTING_DEFAULTS["center.display_name"]);
    expect(screen.getByText("Tạo tin khi vắng không phép").nextElementSibling).toHaveTextContent(/^(Bật|Tắt)$/);
    expect(screen.queryByText(/center\.display_name|zalo\.|sessions\.auto_lock/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("has no save bar in the read-only view", () => {
    render(<SystemSettingsReadOnly settings={SYSTEM_SETTING_DEFAULTS} />);
    expect(screen.queryByRole("region", { name: "Thanh lưu thay đổi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  // Value: protects=the exact payload sent to updateSystemSettingsAction: all 12 keys (the comment template moved to Cài đặt → Tin Zalo), numbers as numbers, an unticked checkbox as false, the Zalo nick picked from the list (id and display name) and a multi-line address;
  // fails_when=toPayload drops or renames a key, sends numbers as strings, sends an unticked box as true or a missing value, loses the picked nick, or drops the address line break;
  // why_new=earlier tests only checked a few keys with objectContaining; seam=the settings actions module is mocked; the Zalo list goes through the injected stub; no_claim=server-side validation, nor CRLF handling (jsdom normalises textarea values; the CRLF saved-values test covers toFields)
  it("sends the full payload", async () => {
    actions.updateSystemSettingsAction.mockResolvedValueOnce({ message: "Đã lưu cài đặt hệ thống.", status: "success" });
    render(<SystemSettingsForm actions={{ listZaloAccounts }} initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Địa chỉ"), { target: { value: "Số 1 Lê Lợi\nPhường Bến Nghé" } });
    fireEvent.click(screen.getByLabelText("Tạo tin khi vắng không phép"));
    fireEvent.click(screen.getByRole("button", { name: "Tải danh sách nick từ ZaloCRM" }));
    fireEvent.change(await screen.findByRole("combobox", { name: "Nick trung tâm gửi tin" }), { target: { value: "zalo-1" } });
    await waitFor(() => expect(bar()).toHaveTextContent("3 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() => expect(actions.updateSystemSettingsAction).toHaveBeenCalledTimes(1));
    expect(actions.updateSystemSettingsAction.mock.calls[0][0]).toEqual({
      address: "Số 1 Lê Lợi\nPhường Bến Nghé",
      contactEmail: "",
      contactPhone: "",
      defaultPublicLinkExpiryDays: 7,
      displayName: "Trung tâm Toán Thầy Vinh",
      sessionAutoLockAfterDays: 3,
      teacherDisplayName: "Toán Thầy Vinh",
      zaloAbsenceMessageEnabled: false,
      zaloAbsenceTemplate: SYSTEM_SETTING_DEFAULTS["zalo.absence_template"],
      zaloCenterAccountId: "zalo-1",
      zaloCenterAccountName: "Nick trung tâm (0912)",
      zaloCommentMessageEnabled: true,
    });
    expect(await within(bar()).findByRole("status")).toHaveTextContent("Đã lưu cài đặt hệ thống.");
  });

  // Value: protects=edits made while a save is in flight stay counted: after the save of A succeeds, the bar shows "1 thay đổi chưa lưu" naming only B;
  // fails_when=a successful save marks everything clean (B would be lost on leaving) or keeps counting A against the old saved values;
  // why_new=testing review: no test changed a field during a pending save; seam=the save is a deferred promise; no_claim=the server's handling of two quick saves
  it("keeps an edit made during the save as the only change", async () => {
    let release: ((value: { message: string; status: "success" }) => void) | undefined;
    actions.updateSystemSettingsAction.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(<SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Email liên hệ"), { target: { value: "a@b.vn" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));
    await waitFor(() => expect(actions.updateSystemSettingsAction).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Số điện thoại liên hệ"), { target: { value: "0909 000 111" } });
    await waitFor(() => expect(bar()).toHaveTextContent("2 thay đổi chưa lưu"));
    await act(async () => release?.({ message: "Đã lưu cài đặt hệ thống.", status: "success" }));

    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Số điện thoại liên hệ");
    expect(bar()).not.toHaveTextContent("Email liên hệ");
  });

  // Value: protects=saved values with Windows line breaks (CRLF) compare equal to what the form reads back (LF): editing another field lists only that field;
  // fails_when=toFields stops normalising \r\n, so the address and templates always count as changed and the bar never returns to clean;
  // why_new=red-team review: CRLF values from the database made the form dirty on load; seam=initialValues with CRLF; no_claim=how the database stores line breaks
  it("treats CRLF saved values as unchanged", async () => {
    const crlf = {
      ...SYSTEM_SETTING_DEFAULTS,
      "center.address": "Số 1 Lê Lợi\r\nPhường Bến Nghé",
      "zalo.absence_template": "Dòng 1\r\nDòng 2 {student}",
    } as unknown as typeof SYSTEM_SETTING_DEFAULTS;
    render(<SystemSettingsForm initialValues={crlf} />);
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Cơ sở 2" } });

    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    expect(within(bar()).getByTitle("Tên hiển thị trung tâm")).toBeInTheDocument();
  });

  // Value: protects=loading the ZaloCRM nick list fails gracefully: a rejected call shows "Không thể kết nối ZaloCRM.", an {ok:false} answer shows its own message; either way the alert is linked to the button by aria-describedby, the button works again and typed values stay;
  // fails_when=the try/catch around listAccounts is removed (the rejection reaches the error boundary), the message is unlinked, the button stays busy, or the form resets;
  // why_new=red-team review: a network failure while loading nicks escaped the transition; seam=injected listZaloAccounts stubs; no_claim=ZaloCRM itself
  it.each([
    ["rejects", () => Promise.reject(new Error("fetch failed")), "Không thể kết nối ZaloCRM."],
    ["answers ok:false", async () => ({ message: "Chưa cấu hình ZALOCRM_BASE_URL.", ok: false as const }), "Chưa cấu hình ZALOCRM_BASE_URL."],
  ])("explains when the nick list call %s", async (_label, listAccounts, message) => {
    render(<SystemSettingsForm actions={{ listZaloAccounts: listAccounts as NonNullable<SettingsActionOverrides["listZaloAccounts"]> }} initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Cơ sở 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Tải danh sách nick từ ZaloCRM" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    const button = screen.getByRole("button", { name: "Tải danh sách nick từ ZaloCRM" });
    expect(button).toHaveAccessibleDescription(new RegExp(message.replace(/\./g, "\\.")));
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue("Cơ sở 3");
  });
  // Value: protects="Rời trang" in the leave dialog runs the form's Hủy before navigating: fields go back to the saved values and the bar is clean, so a hidden copy of the route cannot revive the draft;
  // fails_when=the form stops passing onCancel to useLeaveGuard or the provider navigates without discarding;
  // why_new=red-team review: leaving kept the typed draft in Next's hidden route copy; seam=next/navigation mocked (router.push observable); a GuardedLink stands in for a hub link; no_claim=Next's route cache itself
  it("discards the typed draft on Rời trang", async () => {
    render(
      <LeaveGuardProvider>
        <GuardedLink href="/settings/permissions">Phân quyền</GuardedLink>
        <SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />
      </LeaveGuardProvider>,
    );
    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Bản nháp" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));

    fireEvent.click(screen.getByRole("link", { name: "Phân quyền" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));

    expect(navigation.push).toHaveBeenCalledWith("/settings/permissions");
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue(SYSTEM_SETTING_DEFAULTS["center.display_name"]);
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
  });

  // Value: protects=leaving during an in-flight save never discards or cuts it short: a hub link clicked while saving navigates without the dialog and without running Hủy, the typed value stays, and when the save resolves the bar is clean ("Chưa có thay đổi") with the saved value in the field;
  // fails_when=the form keeps its leave guard registered while saving (the dialog appears, or "Rời trang" runs Hủy so the field reverts and the save then counts the old value as a change), or Hủy runs during a save;
  // why_new=four reviewers found that leaving during a save discarded the values being saved; seam=updateSystemSettingsAction is a deferred promise; next/navigation mocked; a click the app does not hold is left to the link (jsdom); no_claim=Next's real navigation or route cache
  it("lets a hub link leave during a save without discarding it", async () => {
    let release: ((value: { message: string; status: "success" }) => void) | undefined;
    actions.updateSystemSettingsAction.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(
      <LeaveGuardProvider>
        <GuardedLink href="/settings/permissions">Phân quyền</GuardedLink>
        <SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />
      </LeaveGuardProvider>,
    );
    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Cơ sở Quận 3" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));
    await waitFor(() => expect(actions.updateSystemSettingsAction).toHaveBeenCalledTimes(1));

    expect(clickIsHeld(screen.getByRole("link", { name: "Phân quyền" }))).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue("Cơ sở Quận 3");

    await act(async () => release?.({ message: "Đã lưu cài đặt hệ thống.", status: "success" }));
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue("Cơ sở Quận 3");
    expect(actions.updateSystemSettingsAction).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Cơ sở Quận 3" }));
  });

  // Value: protects=a reload or tab close while the save is in flight asks first (beforeunload is prevented although the leave guard is off during the save) without running Hủy, and stops asking once the save settles clean;
  // fails_when=the form drops its save-in-flight guard (a reload silently cuts the request), the guard runs Hủy so the field reverts, or the listener stays after the save so every later reload prompts;
  // why_new=adversarial review: turning the leave guard off while saving also removed the reload/close prompt during the save; seam=updateSystemSettingsAction is a deferred promise; a synthetic cancelable beforeunload event stands in for the browser; no_claim=the browser's native prompt itself
  it("asks before a reload or close while the save is in flight", async () => {
    let release: ((value: { message: string; status: "success" }) => void) | undefined;
    actions.updateSystemSettingsAction.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(
      <LeaveGuardProvider>
        <SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />
      </LeaveGuardProvider>,
    );
    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Cơ sở Quận 3" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));
    await waitFor(() => expect(actions.updateSystemSettingsAction).toHaveBeenCalledTimes(1));

    expect(beforeUnloadIsPrevented()).toBe(true);
    expect(screen.getByLabelText("Tên hiển thị trung tâm")).toHaveValue("Cơ sở Quận 3");

    await act(async () => release?.({ message: "Đã lưu cài đặt hệ thống.", status: "success" }));
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(beforeUnloadIsPrevented()).toBe(false);
  });

  // Value: protects=the save result is announced through a live region that already exists before saving: the bar's role="status" node is present (empty) on load and the same node gets "Đã lưu cài đặt hệ thống." after the save;
  // fails_when=the form goes back to mounting a new role="status" element with its text (screen readers often skip live regions that appear with their content), or the success copy changes;
  // why_new=accessibility review: the status line was mounted only after saving; seam=the settings actions module is mocked; no_claim=what a given screen reader actually speaks
  it("announces the save result in the live region that was already there", async () => {
    actions.updateSystemSettingsAction.mockResolvedValueOnce({ message: "Đã lưu cài đặt hệ thống.", status: "success" });
    render(<SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />);
    const status = within(bar()).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.textContent).toBe("");

    fireEvent.change(screen.getByLabelText("Email liên hệ"), { target: { value: "lienhe@trungtam.vn" } });
    await waitFor(() => expect(bar()).toHaveTextContent("1 thay đổi chưa lưu"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() => expect(status).toHaveTextContent("Đã lưu cài đặt hệ thống."));
    expect(within(bar()).getByRole("status")).toBe(status);
  });
});
