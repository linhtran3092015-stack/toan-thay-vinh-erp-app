// Value: protects=the "Link phiếu công khai" panel (design 13c) shows a newly issued link once as a full URL (origin + path) in a read-only field named "Liên kết vừa tạo" that selects itself on focus, with "Sao chép liên kết", copies exactly that URL, and announces copy success, copy failure or a missing clipboard in its single status line (never a second live region) while the decorative check goes after 2.5 s; the injected issue/revoke stubs replace the module actions and the issue payload carries the chosen version, and the expiry field defaults to now + N days and is read back in Vietnam time whatever the runtime's zone (the server renders in UTC); with no published form the link history and "Thu hồi" stay available while issuing explains that a form must be published first; issuing says first which active link of the chosen version it revokes (this record's exact link, otherwise a line covering the student's other Coaching records); a history that failed to load says so and disables issuing; a forms list that failed to load, a missing coaching_forms.view or a draft above v1 hiding a published version is named instead of the publish hint (drafts also as a note under a non-empty picker); the history-failed instruction is said once and is the disabled button's description; an unknown link status shows as unsupported with no revoke; the two-step revoke sends nothing without a non-blank reason (named on the field, labelled as required, capped at the action's 1000 characters), keeps the form and reason after a failed revoke, and one confirmation (button or Enter, never the Enter committing an IME word) sends one revoke; "Hủy" gives focus back to the row's "Thu hồi", a done revoke moves it to the status line and drops the one-time URL when it was that link; a call that never reaches the server (rejected promise) is announced in the status line and keeps the form, choices and reason;
// fails_when=the panel shows only the path (parents get a broken link), the URL is not in a focusable field, copies something else, reports success when the clipboard rejects, adds a second role=status, keeps the check forever, ignores the injected actions (the /dev preview would write through the real ones), sends another version or an expiry not counted from now or shifted by the runtime's zone, or hides the history/revoke when no form is published; issuing replaces a parent's active link (here or on another record) without saying so, a failed history load reads as "Chưa phát hành liên kết nào." or still lets a link be issued, a failed forms load, a missing permission or a draft v2+ reads as "publish a form first", the history-failed instruction appears twice, or "constructor" reads a prototype member; a blank/whitespace reason reaches the action, the form closes or drops the reason on an error, a second Enter while the revoke runs sends it again, or the Enter committing a Vietnamese IME word revokes; focus falls to the page after "Hủy" or a revoke, a revoked link stays offered for copying, or a rejected call reaches the error boundary and wipes the form;
// why_new=step 11b adds copy feedback, action overrides, the replace warning and the connection-failure path to the link panel; coaching-forms-wave-b.test.tsx covers revoke-with-reason and the expiry check only; its "first Thu hồi calls nothing" check now only opens the new two-step form;
// seam=@/features/coaching/actions/coaching-form-actions is mocked so any real call is observable; navigator.clipboard is replaced by a stub per test and restored after; clicks use fireEvent because user-event installs its own clipboard; Date or setTimeout are faked, and the runtime TZ switched, only inside the tests that need them; no_claim=does not prove the issue/revoke RPCs or token hashing (action tests), that issue_coaching_public_link revokes the previous link or the unique index spans records (migration), nor real browser clipboard permissions, nor Next's server-action queueing
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  issueCoachingPublicLinkAction,
  revokeCoachingPublicLinkAction,
} from "@/features/coaching/actions/coaching-form-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import type { CoachingFormSummary, CoachingPublicLinkSummary } from "@/features/coaching/coaching-form-data";
import { COACHING_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import { CoachingPublicLinkPanel } from "@/features/coaching/components/coaching-public-link-panel";
import { COACHING_MAX_REVOKE_REASON_LENGTH } from "@/features/coaching/forms/coaching-question-rules";

vi.mock("@/features/coaching/actions/coaching-form-actions", () => ({
  createCoachingFormVersionDraftAction: vi.fn(),
  issueCoachingPublicLinkAction: vi.fn(),
  publishCoachingFormAction: vi.fn(),
  revokeCoachingPublicLinkAction: vi.fn(),
  saveCoachingFormDraftAction: vi.fn(),
}));

type IssueAction = NonNullable<CoachingActionOverrides["issueCoachingPublicLink"]>;
type RevokeAction = NonNullable<CoachingActionOverrides["revokeCoachingPublicLink"]>;

const RECORD_ID = "00000000-0000-4000-8000-000000000001";
const ISSUED = "Đã tạo liên kết. Hãy sao chép ngay vì token không được lưu dạng rõ.";

const publishedForm: CoachingFormSummary = {
  formId: "00000000-0000-4000-8000-000000000002",
  formStatus: "active",
  name: "Phiếu học kỳ",
  publishedAt: "2026-08-16T00:00:00.000Z",
  responseCount: 0,
  title: "Phiếu học kỳ",
  versionId: "00000000-0000-4000-8000-000000000003",
  versionNumber: 1,
  versionStatus: "published",
};

const activeLink: CoachingPublicLinkSummary = {
  expiresAt: "2026-08-30T00:00:00.000Z",
  formName: "Phiếu học kỳ",
  formVersionId: "00000000-0000-4000-8000-000000000003",
  id: "00000000-0000-4000-8000-000000000004",
  issuedAt: "2026-08-16T00:00:00.000Z",
  revokeReason: null,
  revokedAt: null,
  status: "active",
  versionNumber: 1,
};

const secondForm: CoachingFormSummary = {
  ...publishedForm,
  formId: "00000000-0000-4000-8000-000000000005",
  name: "Phiếu cuối kỳ",
  title: "Phiếu cuối kỳ",
  versionId: "00000000-0000-4000-8000-000000000006",
  versionNumber: 2,
};

let clipboardDescriptor: PropertyDescriptor | undefined;

function stubClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
}

beforeEach(() => {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});

function makeActions() {
  return {
    issueCoachingPublicLink: vi
      .fn<IssueAction>()
      .mockResolvedValue({ linkUrl: "/coaching/form/tok", message: ISSUED, status: "success" }),
    revokeCoachingPublicLink: vi.fn<RevokeAction>().mockResolvedValue({ message: "Đã thu hồi liên kết.", status: "success" }),
  };
}

async function issueLink(actions: ReturnType<typeof makeActions>) {
  render(<CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[publishedForm]} />);
  fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(ISSUED));
  return `${window.location.origin}/coaching/form/tok`;
}

describe("CoachingPublicLinkPanel issuing and copying", () => {
  it("issues through the injected action and shows the full URL once with Sao chép liên kết", async () => {
    const actions = makeActions();
    const url = await issueLink(actions);

    expect(actions.issueCoachingPublicLink).toHaveBeenCalledTimes(1);
    expect(actions.issueCoachingPublicLink).toHaveBeenCalledWith({
      coachingRecordId: RECORD_ID,
      expiresAt: expect.any(String),
      formVersionId: publishedForm.versionId,
    });
    expect(issueCoachingPublicLinkAction).not.toHaveBeenCalled();
    expect(url.startsWith("http")).toBe(true);
    // A read-only field rather than plain text, so keyboard users can select and copy it by hand.
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Liên kết vừa tạo" });
    expect(field).toHaveValue(url);
    expect(field).toHaveAttribute("readonly");
    fireEvent.focus(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, url.length]);
    expect(screen.getByText("Liên kết vừa tạo (chỉ hiện một lần)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sao chép liên kết" })).toBeEnabled();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("copies exactly the full URL and says so in the one status line", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const url = await issueLink(makeActions());

    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(url);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép liên kết."));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    // The inline "Đã sao chép" check is decorative; the status line is the announcement.
    expect(screen.getByText("Đã sao chép")).toHaveAttribute("aria-hidden", "true");
  });

  it("asks for a manual copy when the clipboard rejects, keeping the URL on screen", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error("NotAllowedError"));
    stubClipboard({ writeText });
    const url = await issueLink(makeActions());

    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Không sao chép được. Hãy chọn liên kết và sao chép thủ công."),
    );
    expect(writeText).toHaveBeenCalledWith(url);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByText("Đã sao chép")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(url)).toBeInTheDocument();
  });

  it("asks for a manual copy when the browser has no clipboard API", async () => {
    stubClipboard(undefined);
    await issueLink(makeActions());

    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Trình duyệt không cho sao chép tự động. Hãy chọn liên kết và sao chép thủ công.",
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("drops the inline Đã sao chép check after 2.5 s while the status line keeps its text", async () => {
    stubClipboard({ writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined) });
    await issueLink(makeActions());

    // Only the timers: issuing above needed real ones for waitFor.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));
      // Let the clipboard promise settle.
      await act(async () => {});
      expect(screen.getByText("Đã sao chép")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(2499));
      expect(screen.getByText("Đã sao chép")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("Đã sao chép")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép liên kết.");
    } finally {
      vi.useRealTimers();
    }
  });

  // The server renders in UTC and a browser may sit in any zone; the runtime zone is switched per case
  // (Node applies process.env.TZ at once), so the runner's own TZ does not decide the outcome.
  it.each(["UTC", "America/Los_Angeles", "Asia/Ho_Chi_Minh"])(
    "defaults the expiry to now + N days in Vietnam time and reads the field as Vietnam time (runtime zone %s)",
    async (zone) => {
      // 20:20:45Z on 15/10 is 03:20 on 16/10 in Vietnam: a default in the runtime's zone lands hours (and, in
      // UTC, a day) off. Seconds on purpose: the field holds the minute.
      vi.stubEnv("TZ", zone);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-15T20:20:45.000Z"));
      try {
        const actions = makeActions();
        render(
          <CoachingPublicLinkPanel
            actions={actions}
            coachingRecordId={RECORD_ID}
            defaultExpiryDays={3}
            forms={[publishedForm, secondForm]}
          />,
        );

        fireEvent.change(screen.getByLabelText("Phiên bản biểu mẫu"), { target: { value: secondForm.versionId } });
        const expiry = screen.getByLabelText<HTMLInputElement>("Hết hạn lúc");
        expect(expiry).toHaveValue("2026-10-19T03:20");

        fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
        await waitFor(() => expect(actions.issueCoachingPublicLink).toHaveBeenCalledTimes(1));
        expect(actions.issueCoachingPublicLink).toHaveBeenCalledWith({
          coachingRecordId: RECORD_ID,
          expiresAt: "2026-10-18T20:20:00.000Z",
          formVersionId: secondForm.versionId,
        });

        // A typed value is Vietnam time too (new Date(value) would use the browser's zone): 09:30 there is 02:30Z.
        fireEvent.change(expiry, { target: { value: "2026-12-01T09:30" } });
        fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
        await waitFor(() => expect(actions.issueCoachingPublicLink).toHaveBeenCalledTimes(2));
        expect(actions.issueCoachingPublicLink).toHaveBeenLastCalledWith({
          coachingRecordId: RECORD_ID,
          expiresAt: "2026-12-01T02:30:00.000Z",
          formVersionId: secondForm.versionId,
        });
      } finally {
        vi.useRealTimers();
        vi.unstubAllEnvs();
      }
    },
  );

  it("announces a call that never reached the server and keeps the form and its choices", async () => {
    const actions = makeActions();
    const call = deferred<Awaited<ReturnType<IssueAction>>>();
    actions.issueCoachingPublicLink.mockReturnValueOnce(call.promise);
    render(<CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[publishedForm, secondForm]} />);
    fireEvent.change(screen.getByLabelText("Phiên bản biểu mẫu"), { target: { value: secondForm.versionId } });
    fireEvent.change(screen.getByLabelText("Hết hạn lúc"), { target: { value: "2026-12-01T09:30" } });

    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
    // The spinner keeps the button's name.
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo liên kết" })).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toBeDisabled();

    // Deploy skew: Next rejects the call instead of returning a state.
    await act(async () => {
      call.reject(new Error("Server Action was not found on the server."));
    });

    expect(screen.getByRole("status")).toHaveTextContent(COACHING_CONNECTION_ERROR_MESSAGE);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByLabelText("Phiên bản biểu mẫu")).toHaveValue(secondForm.versionId);
    expect(screen.getByLabelText("Hết hạn lúc")).toHaveValue("2026-12-01T09:30");
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("textbox", { name: "Liên kết vừa tạo" })).not.toBeInTheDocument();
    expect(issueCoachingPublicLinkAction).not.toHaveBeenCalled();
  });

  it("says before issuing which active link will be revoked, here or on another Coaching record", () => {
    render(
      <CoachingPublicLinkPanel
        actions={makeActions()}
        coachingRecordId={RECORD_ID}
        forms={[publishedForm, secondForm]}
        links={[activeLink]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Phát link mới" }));

    // 00:00 UTC on 16/08 is 07:00 in Vietnam.
    const warning = "Link v1 đang hoạt động (phát 16/08 07:00) sẽ bị thu hồi và thay bằng link mới.";
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toHaveAccessibleDescription(warning);
    // The row badge stays the only "Đang hoạt động" (case-sensitive, as coaching-forms-wave-b pins it).
    expect(screen.getAllByText(/Đang hoạt động/)).toHaveLength(1);

    // The other version has no active link here, but issue_coaching_public_link revokes the student's
    // active link for that version on any record (one per student and version): the general line says so.
    fireEvent.change(screen.getByLabelText("Phiên bản biểu mẫu"), { target: { value: secondForm.versionId } });
    expect(screen.queryByText(/sẽ bị thu hồi và thay bằng link mới/)).not.toBeInTheDocument();
    const elsewhere = "Nếu học sinh đang có link v2 hoạt động ở phiếu Coaching khác, link đó sẽ bị thu hồi.";
    expect(screen.getByText(elsewhere)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toHaveAccessibleDescription(elsewhere);
    expect(screen.getAllByText(/Đang hoạt động/)).toHaveLength(1);

    // Revoked or submitted links of the chosen version are not replaced; only the general line remains.
    cleanup();
    render(
      <CoachingPublicLinkPanel
        actions={makeActions()}
        coachingRecordId={RECORD_ID}
        forms={[publishedForm]}
        links={[{ ...activeLink, status: "submitted" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Phát link mới" }));
    expect(screen.queryByText(/sẽ bị thu hồi và thay bằng link mới/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toHaveAccessibleDescription(
      "Nếu học sinh đang có link v1 hoạt động ở phiếu Coaching khác, link đó sẽ bị thu hồi.",
    );

    // No link on this record at all (the form opens by itself): still the general line.
    cleanup();
    render(<CoachingPublicLinkPanel actions={makeActions()} coachingRecordId={RECORD_ID} forms={[publishedForm]} />);
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toHaveAccessibleDescription(
      "Nếu học sinh đang có link v1 hoạt động ở phiếu Coaching khác, link đó sẽ bị thu hồi.",
    );
    expect(screen.queryByText(/Đang hoạt động/)).not.toBeInTheDocument();
  });

  it("names why it cannot offer a version instead of asking to publish a form", () => {
    const actions = makeActions();
    // Without coaching_forms.view the route loads no forms: the panel names the missing permission.
    render(<CoachingPublicLinkPanel actions={actions} canViewForms={false} coachingRecordId={RECORD_ID} forms={[]} />);
    expect(screen.getByText("Cần quyền xem mẫu coaching để chọn phiên bản khi phát link.")).toBeInTheDocument();
    expect(screen.queryByText("Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();
    cleanup();

    // The forms list failed to load: a reload, not a publish, is what is missing.
    render(<CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[]} formsUnavailable />);
    expect(screen.getByText("Không tải được danh sách biểu mẫu. Tải lại trang để phát link.")).toBeInTheDocument();
    expect(screen.queryByText("Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Phiên bản biểu mẫu")).not.toBeInTheDocument();
    expect(actions.issueCoachingPublicLink).not.toHaveBeenCalled();
  });
});

describe("CoachingPublicLinkPanel history states", () => {
  it("says the history did not load instead of reading as empty, and offers no way to issue", () => {
    const actions = makeActions();
    render(<CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[publishedForm]} linksUnavailable />);

    const unavailable = "Không tải được lịch sử liên kết. Tải lại trang trước khi phát link mới.";
    // Said once: the history line is also the disabled button's reason (no second caption under the button).
    expect(screen.getAllByText(/Không tải được lịch sử liên kết/)).toHaveLength(1);
    const historyLine = screen.getByText(unavailable);
    expect(screen.queryByText("Chưa phát hành liên kết nào.")).not.toBeInTheDocument();
    // Issuing would silently revoke an active link the panel cannot show, and it could not warn about it.
    const create = screen.getByRole("button", { name: "Phát link mới" });
    expect(create).toBeDisabled();
    expect(create).toHaveAttribute("aria-describedby", historyLine.id);
    expect(create).toHaveAccessibleDescription(unavailable);
    expect(create).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(create);
    expect(screen.queryByLabelText("Phiên bản biểu mẫu")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();
    expect(actions.issueCoachingPublicLink).not.toHaveBeenCalled();
    expect(issueCoachingPublicLinkAction).not.toHaveBeenCalled();
  });

  it("shows an unknown link status as unsupported, without a revoke", () => {
    render(
      <CoachingPublicLinkPanel
        actions={makeActions()}
        coachingRecordId={RECORD_ID}
        forms={[publishedForm]}
        links={[{ ...activeLink, status: "constructor" as CoachingPublicLinkSummary["status"] }]}
      />,
    );

    expect(screen.getByText("Trạng thái chưa hỗ trợ: constructor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thu hồi" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Đang hoạt động/)).not.toBeInTheDocument();
  });
});

describe("CoachingPublicLinkPanel without a published form", () => {
  it("still shows the link history and lets an active link be revoked; issuing explains what is missing", async () => {
    const actions = makeActions();
    render(
      <CoachingPublicLinkPanel
        actions={actions}
        coachingRecordId={RECORD_ID}
        forms={[{ ...publishedForm, publishedAt: null, versionNumber: 2, versionStatus: "draft" }]}
        links={[activeLink]}
      />,
    );

    expect(screen.getByText("Lịch sử liên kết")).toBeInTheDocument();
    expect(screen.getByText("Phiếu học kỳ · v1")).toBeInTheDocument();
    expect(screen.getByText("Đang hoạt động · chưa nộp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thu hồi" })).toBeEnabled();

    const create = screen.getByRole("button", { name: "Phát link mới" });
    expect(create).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(create);
    expect(create).toHaveAttribute("aria-expanded", "true");
    // The form's latest version is a draft v2 (get_coaching_forms returns only that one): it says so
    // rather than asking to publish a first form.
    expect(screen.getByText("«Phiếu học kỳ» đang soạn v2: chỉ phát được link mới sau khi xuất bản v2.")).toBeInTheDocument();
    expect(screen.queryByText("Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    fireEvent.change(screen.getByLabelText(`Lý do thu hồi ${activeLink.id}`), { target: { value: "Gửi nhầm học viên" } });
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã thu hồi liên kết."));
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledWith({
      coachingRecordId: RECORD_ID,
      linkId: activeLink.id,
      reason: "Gửi nhầm học viên",
    });
    expect(revokeCoachingPublicLinkAction).not.toHaveBeenCalled();
    expect(actions.issueCoachingPublicLink).not.toHaveBeenCalled();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("issues for the first published version when published forms arrive after the panel mounted", async () => {
    const actions = makeActions();
    const { rerender } = render(<CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[]} />);
    rerender(<CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[publishedForm]} />);

    expect(screen.getByLabelText("Phiên bản biểu mẫu")).toHaveValue(publishedForm.versionId);
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
    await waitFor(() => expect(actions.issueCoachingPublicLink).toHaveBeenCalledTimes(1));
    expect(actions.issueCoachingPublicLink.mock.calls[0]![0]).toMatchObject({ formVersionId: publishedForm.versionId });
  });

  it("names each form whose draft hides its published version, with or without another form to issue", () => {
    const draft = (form: CoachingFormSummary, versionNumber: number, id: string): CoachingFormSummary => ({
      ...form,
      publishedAt: null,
      versionId: `00000000-0000-4000-8000-0000000000${id}`,
      versionNumber,
      versionStatus: "draft",
    });
    const newForm: CoachingFormSummary = { ...secondForm, formId: "00000000-0000-4000-8000-000000000009", name: "Phiếu mới" };
    const lineFor = (name: string, n: number) => `«${name}» đang soạn v${n}: chỉ phát được link mới sau khi xuất bản v${n}.`;

    // Nothing published: one line per draft above v1 instead of the publish hint; a never-published v1 has none.
    render(
      <CoachingPublicLinkPanel
        actions={makeActions()}
        coachingRecordId={RECORD_ID}
        forms={[draft(publishedForm, 4, "10"), draft(secondForm, 2, "11"), draft(newForm, 1, "12")]}
      />,
    );
    expect(screen.getByText(lineFor("Phiếu học kỳ", 4))).toBeInTheDocument();
    expect(screen.getByText(lineFor("Phiếu cuối kỳ", 2))).toBeInTheDocument();
    expect(screen.queryByText(/«Phiếu mới»/)).not.toBeInTheDocument();
    expect(screen.queryByText("Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();
    cleanup();

    // Only a never-published v1 draft: the publish hint is the right cause.
    render(<CoachingPublicLinkPanel actions={makeActions()} coachingRecordId={RECORD_ID} forms={[draft(newForm, 1, "12")]} />);
    expect(screen.getByText("Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.")).toBeInTheDocument();
    expect(screen.queryByText(/đang soạn/)).not.toBeInTheDocument();
    cleanup();

    // Another form is published: it stays issuable, and the hidden one is a muted note under the picker.
    render(
      <CoachingPublicLinkPanel
        actions={makeActions()}
        coachingRecordId={RECORD_ID}
        forms={[publishedForm, draft(secondForm, 4, "11")]}
      />,
    );
    const picker = screen.getByLabelText("Phiên bản biểu mẫu");
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["Phiếu học kỳ · v1"]);
    expect(screen.getByText(lineFor("Phiếu cuối kỳ", 4))).toBeInTheDocument();
    expect(picker).toHaveAccessibleDescription(lineFor("Phiếu cuối kỳ", 4));
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toBeEnabled();
    cleanup();

    // No draft: no note on the picker.
    render(<CoachingPublicLinkPanel actions={makeActions()} coachingRecordId={RECORD_ID} forms={[publishedForm]} />);
    expect(screen.getByLabelText("Phiên bản biểu mẫu")).not.toHaveAttribute("aria-describedby");
  });
});

type RevokeResult = Awaited<ReturnType<RevokeAction>>;

const NOT_SAVED = "Không thể lưu dữ liệu Coaching. Dữ liệu chưa được thay đổi.";
const reasonField = () => screen.getByLabelText(`Lý do thu hồi ${activeLink.id}`);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function renderWithActiveLink(actions: ReturnType<typeof makeActions>) {
  render(
    <CoachingPublicLinkPanel actions={actions} coachingRecordId={RECORD_ID} forms={[publishedForm]} links={[activeLink]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
}

describe("CoachingPublicLinkPanel revoking", () => {
  it("sends nothing without a non-blank reason, names it on the field, keeps the reason after a failed revoke; Hủy backs out", async () => {
    const actions = makeActions();
    actions.revokeCoachingPublicLink.mockResolvedValue({ message: NOT_SAVED, status: "error" });
    renderWithActiveLink(actions);

    const reason = reasonField();
    await waitFor(() => expect(reason).toHaveFocus());
    expect(reason).toHaveAccessibleDescription(/^Liên kết ngừng hoạt động ngay/);
    // A visible label; the pinned aria-label stays the field's accessible name.
    expect(screen.getByText("Lý do thu hồi (bắt buộc)")).toBeInstanceOf(HTMLLabelElement);
    expect(screen.getByRole("textbox", { name: `Lý do thu hồi ${activeLink.id}` })).toBe(reason);
    expect(reason).toHaveAttribute("maxlength", String(COACHING_MAX_REVOKE_REASON_LENGTH));

    fireEvent.change(reason, { target: { value: "   " } });
    // Move focus to the confirm button first (fireEvent.click does not), so the focus check below
    // proves the blank-reason path sends focus back to the field.
    const confirm = screen.getByRole("button", { name: "Thu hồi" });
    confirm.focus();
    fireEvent.click(confirm);
    expect(actions.revokeCoachingPublicLink).not.toHaveBeenCalled();
    expect(revokeCoachingPublicLinkAction).not.toHaveBeenCalled();
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveAccessibleDescription(/Cần nêu lý do thu hồi liên kết\.$/);
    expect(screen.getByRole("status")).toHaveTextContent("Cần nêu lý do thu hồi liên kết.");
    expect(reason).toHaveFocus();

    fireEvent.change(reason, { target: { value: "Gửi nhầm học viên" } });
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(NOT_SAVED));
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(1);
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledWith({
      coachingRecordId: RECORD_ID,
      linkId: activeLink.id,
      reason: "Gửi nhầm học viên",
    });
    // A failed revoke leaves the form open with the typed reason, ready to retry.
    expect(reasonField()).toHaveValue("Gửi nhầm học viên");
    expect(reasonField()).not.toHaveAttribute("aria-invalid");

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByLabelText(`Lý do thu hồi ${activeLink.id}`)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thu hồi" })).toBeEnabled();
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(1);
  });

  it("sends one revoke per confirmation: a second Enter while the first revoke runs sends nothing", async () => {
    const actions = makeActions();
    const first = deferred<RevokeResult>();
    actions.revokeCoachingPublicLink
      .mockReturnValueOnce(first.promise)
      // A second request would reach a link that is no longer active.
      .mockResolvedValue({ message: NOT_SAVED, status: "error" });
    renderWithActiveLink(actions);

    const reason = reasonField();
    fireEvent.change(reason, { target: { value: "Gửi nhầm học viên" } });
    fireEvent.keyDown(reason, { key: "Enter" });
    await waitFor(() => expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Thu hồi" })).toBeDisabled();
    // The spinner is decorative: the confirm button is still named exactly "Thu hồi".
    expect(screen.getByRole("button", { name: "Thu hồi" })).toHaveAttribute("aria-busy", "true");

    fireEvent.keyDown(reason, { key: "Enter" });
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({ message: "Đã thu hồi liên kết.", status: "success" });
    });
    expect(screen.getByRole("status")).toHaveTextContent("Đã thu hồi liên kết.");
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(1);
  });

  it("does not revoke on the Enter that commits a Vietnamese input-method word", async () => {
    const actions = makeActions();
    renderWithActiveLink(actions);
    const reason = reasonField();
    fireEvent.change(reason, { target: { value: "Gửi nhầm học viên" } });

    // Chrome/Firefox flag the commit as composing; Safari reports keyCode 229 instead.
    fireEvent.keyDown(reason, { isComposing: true, key: "Enter" });
    fireEvent.keyDown(reason, { key: "Enter", keyCode: 229 });
    expect(actions.revokeCoachingPublicLink).not.toHaveBeenCalled();
    expect(reasonField()).toHaveValue("Gửi nhầm học viên");

    fireEvent.keyDown(reason, { key: "Enter", keyCode: 13 });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã thu hồi liên kết."));
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(1);
    expect(actions.revokeCoachingPublicLink).toHaveBeenCalledWith({
      coachingRecordId: RECORD_ID,
      linkId: activeLink.id,
      reason: "Gửi nhầm học viên",
    });
  });

  it("gives focus back to the row's Thu hồi after Hủy and to the status line after a revoke", async () => {
    const actions = makeActions();
    renderWithActiveLink(actions);
    await waitFor(() => expect(reasonField()).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("button", { name: "Thu hồi" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    fireEvent.change(reasonField(), { target: { value: "Gửi nhầm học viên" } });
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));

    // The form (and the focus in it) is gone; the status line holds both the result and the focus.
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveFocus());
    expect(status).toHaveTextContent("Đã thu hồi liên kết.");
    expect(status).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByLabelText(`Lý do thu hồi ${activeLink.id}`)).not.toBeInTheDocument();
  });

  it("keeps the form and the reason when the revoke call never reaches the server", async () => {
    const actions = makeActions();
    actions.revokeCoachingPublicLink.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderWithActiveLink(actions);

    fireEvent.change(reasonField(), { target: { value: "Gửi nhầm học viên" } });
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(COACHING_CONNECTION_ERROR_MESSAGE));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).not.toHaveFocus();
    expect(reasonField()).toHaveValue("Gửi nhầm học viên");
    // The message is set inside the transition; the button re-enables when the transition settles.
    await waitFor(() => expect(screen.getByRole("button", { name: "Thu hồi" })).toBeEnabled());
    expect(revokeCoachingPublicLinkAction).not.toHaveBeenCalled();
  });

  it("drops the one-time URL once that link is revoked, but not for another version's link", async () => {
    const actions = makeActions();
    const otherVersionLink: CoachingPublicLinkSummary = {
      ...activeLink,
      formName: "Phiếu cuối kỳ",
      formVersionId: secondForm.versionId,
      id: "00000000-0000-4000-8000-000000000007",
      versionNumber: 2,
    };
    const { rerender } = render(
      <CoachingPublicLinkPanel
        actions={actions}
        coachingRecordId={RECORD_ID}
        forms={[publishedForm, secondForm]}
        links={[otherVersionLink]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Phát link mới" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(ISSUED));
    const url = `${window.location.origin}/coaching/form/tok`;
    expect(screen.getByRole("textbox", { name: "Liên kết vừa tạo" })).toHaveValue(url);

    // The refresh after issuing brings the new link (first version) into the history.
    const issuedLink: CoachingPublicLinkSummary = { ...activeLink, id: "00000000-0000-4000-8000-000000000008" };
    rerender(
      <CoachingPublicLinkPanel
        actions={actions}
        coachingRecordId={RECORD_ID}
        forms={[publishedForm, secondForm]}
        links={[issuedLink, otherVersionLink]}
      />,
    );
    const revokeRow = async (row: HTMLElement, link: CoachingPublicLinkSummary, calls: number) => {
      fireEvent.click(within(row).getByRole("button", { name: "Thu hồi" }));
      fireEvent.change(within(row).getByLabelText(`Lý do thu hồi ${link.id}`), { target: { value: "Gửi nhầm" } });
      fireEvent.click(within(row).getByRole("button", { name: "Thu hồi" }));
      await waitFor(() => expect(actions.revokeCoachingPublicLink).toHaveBeenCalledTimes(calls));
      await waitFor(() => expect(screen.queryByLabelText(`Lý do thu hồi ${link.id}`)).not.toBeInTheDocument());
    };
    const [issuedRow, otherRow] = screen.getAllByRole("listitem") as [HTMLElement, HTMLElement];

    await revokeRow(otherRow, otherVersionLink, 1);
    expect(screen.getByRole("textbox", { name: "Liên kết vừa tạo" })).toHaveValue(url);

    await revokeRow(issuedRow, issuedLink, 2);
    expect(screen.queryByRole("textbox", { name: "Liên kết vừa tạo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sao chép liên kết" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đã thu hồi liên kết.");
  });
});
