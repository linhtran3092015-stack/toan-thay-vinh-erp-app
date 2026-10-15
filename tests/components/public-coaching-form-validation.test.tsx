// Value: protects=the public Coaching form (/coaching/form/[token], design 13c) checks required questions before sending: nothing is sent while one is unanswered, the missing question is named next to itself, a summary banner counts them and focus moves to the first missing question's first control; answering clears its error; an optional text typed then cleared is left out of the payload; the injected action replaces the module action; a retryable server error or a rejected call keeps the form with its message; a link that became used/expired/revoked shows its final screen instead; a second submit while one is pending sends nothing; a number the browser cannot read is named, not dropped; success leaves one focused confirmation heading; the brand line names the student when known;
// fails_when=the form submits with a required answer missing, focuses the wrong question (or nothing), keeps a stale error after an answer, sends '' for an emptied optional answer (the server rejects it), ignores the injected action (the /dev preview would write through the real one), drops the form on a retryable error or a rejected call (error boundary), offers a retry on a link that can never succeed, double-submits, silently drops an unreadable optional number, or shows the confirmation twice / without focus;
// why_new=step 11b adds client-side required checks, an action override and the student brand line to the public form;
// seam=@/features/coaching/actions/public-coaching-form-actions is mocked (as in coaching-forms-wave-b.test.tsx) so any real call is observable; most tests inject a stub through the action prop; no_claim=does not prove the submit_public_coaching_form RPC or the page loader (expired/revoked states), nor the mobile layout
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { submitPublicCoachingFormAction } from "@/features/coaching/actions/public-coaching-form-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { PUBLIC_FORM_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import { PublicCoachingForm } from "@/features/coaching/components/public-coaching-form";
import {
  getPublicFormStateForMessage,
  getPublicFormStateMessage,
} from "@/features/coaching/components/public-coaching-form-shell";
import type { PublicCoachingQuestion } from "@/features/coaching/forms/coaching-form-types";

vi.mock("@/features/coaching/actions/public-coaching-form-actions", () => ({
  submitPublicCoachingFormAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type SubmitAction = NonNullable<CoachingActionOverrides["submitPublicCoachingForm"]>;

const TOKEN = "t".repeat(48);
const REQUIRED = "Câu này bắt buộc. Vui lòng trả lời.";
const NOT_A_NUMBER = "Vui lòng nhập một số (dùng dấu chấm, ví dụ 1.5).";
const SUCCESS = "Phiếu Coaching đã được gửi thành công.";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "n. title (bắt buộc)"; jsdom trims the sr-only span's leading space that browsers keep. */
function requiredName(numberedTitle: string): RegExp {
  return new RegExp(`^${escapeRegExp(numberedTitle)}\\s*\\(bắt buộc\\)$`);
}

const ids = {
  note: "00000000-0000-4000-8000-000000000001",
  attended: "00000000-0000-4000-8000-000000000002",
  confidence: "00000000-0000-4000-8000-000000000003",
};

const questions: PublicCoachingQuestion[] = [
  { configuration: {}, description: null, id: ids.note, required: false, title: "Ghi chú thêm", type: "short_text" },
  {
    configuration: { options: ["Có", "Không"] },
    description: null,
    id: ids.attended,
    required: true,
    title: "Con có làm bài tập về nhà?",
    type: "single_choice",
  },
  {
    configuration: { max: 5, maxLabel: "Rất tự tin", min: 1, minLabel: "Chưa tự tin" },
    description: null,
    id: ids.confidence,
    required: true,
    title: "Con tự tin với môn Toán đến mức nào?",
    type: "scale",
  },
];

function renderForm(props: Partial<Parameters<typeof PublicCoachingForm>[0]> = {}) {
  return render(
    <PublicCoachingForm
      instructions="Phụ huynh điền trong khoảng 3 phút."
      questions={questions}
      title="Phiếu phản hồi tháng 10"
      token={TOKEN}
      {...props}
    />,
  );
}

const attendedGroup = () => screen.getByRole("group", { name: requiredName("2. Con có làm bài tập về nhà?") });
const confidenceGroup = () => screen.getByRole("group", { name: requiredName("3. Con tự tin với môn Toán đến mức nào?") });
const submitButton = () => screen.getByRole("button", { name: "Gửi phiếu" });

describe("PublicCoachingForm required checks", () => {
  it("does not send while a required answer is missing; names it, summarises and focuses the first missing control", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>();
    renderForm({ action });

    await user.click(submitButton());

    expect(action).not.toHaveBeenCalled();
    expect(submitPublicCoachingFormAction).not.toHaveBeenCalled();
    expect(within(attendedGroup()).getByText(REQUIRED)).toBeInTheDocument();
    expect(attendedGroup()).toHaveAccessibleDescription(REQUIRED);
    expect(within(confidenceGroup()).getByText(REQUIRED)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "1. Ghi chú thêm" })).not.toHaveAccessibleDescription(REQUIRED);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Vui lòng trả lời các câu hỏi bắt buộc.");
    expect(banner).toHaveTextContent("Còn 2 câu cần trả lời; các câu đó được đánh dấu ở trên.");

    // Question 1 is optional, so focus skips to question 2's first option.
    expect(screen.getByRole("radio", { name: "Có" })).toHaveFocus();
  });

  it("focuses the first scale button when the scale is the first missing answer", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>();
    renderForm({ action });

    await user.click(screen.getByRole("radio", { name: "Không" }));
    await user.click(submitButton());

    expect(action).not.toHaveBeenCalled();
    expect(within(confidenceGroup()).getByRole("button", { name: "1" })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 1 câu cần trả lời");
  });

  it("clears a question's error as soon as it is answered", async () => {
    const user = userEvent.setup();
    renderForm({ action: vi.fn<SubmitAction>() });

    await user.click(submitButton());
    expect(within(attendedGroup()).getByText(REQUIRED)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Có" }));
    expect(within(attendedGroup()).queryByText(REQUIRED)).not.toBeInTheDocument();
    expect(attendedGroup()).not.toHaveAccessibleDescription(REQUIRED);
    expect(within(confidenceGroup()).getByText(REQUIRED)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 1 câu cần trả lời");

    await user.click(within(confidenceGroup()).getByRole("button", { name: "4" }));
    expect(screen.queryByText(REQUIRED)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("PublicCoachingForm payload and action", () => {
  it("leaves an optional text that was typed then cleared out of the payload", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message: SUCCESS, status: "success" });
    renderForm({ action });

    const note = screen.getByRole("textbox", { name: "1. Ghi chú thêm" });
    await user.type(note, "Con hay quên");
    await user.clear(note);
    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(within(confidenceGroup()).getByRole("button", { name: "4" }));
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SUCCESS });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(TOKEN, { [ids.attended]: "Có", [ids.confidence]: 4 });
    expect(Object.keys(action.mock.calls[0]![1])).not.toContain(ids.note);
  });

  it("uses the injected action instead of the module action", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message: SUCCESS, status: "success" });
    renderForm({ action });

    await user.type(screen.getByRole("textbox", { name: "1. Ghi chú thêm" }), "Cảm ơn thầy");
    await user.click(screen.getByRole("radio", { name: "Không" }));
    await user.click(within(confidenceGroup()).getByRole("button", { name: "2" }));
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SUCCESS });
    expect(action).toHaveBeenCalledWith(TOKEN, {
      [ids.attended]: "Không",
      [ids.confidence]: 2,
      [ids.note]: "Cảm ơn thầy",
    });
    expect(submitPublicCoachingFormAction).not.toHaveBeenCalled();
  });

  it("falls back to the module action when none is injected", async () => {
    const user = userEvent.setup();
    vi.mocked(submitPublicCoachingFormAction).mockResolvedValue({ message: SUCCESS, status: "success" });
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(within(confidenceGroup()).getByRole("button", { name: "5" }));
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SUCCESS });
    expect(submitPublicCoachingFormAction).toHaveBeenCalledWith(TOKEN, { [ids.attended]: "Có", [ids.confidence]: 5 });
  });

  it("keeps the form and shows the server's message when sending fails", async () => {
    const user = userEvent.setup();
    // A retryable failure (the link states have their own screen, tested below).
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message: "Không thể gửi phiếu lúc này. Vui lòng thử lại.", status: "error" });
    renderForm({ action });

    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(within(confidenceGroup()).getByRole("button", { name: "3" }));
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể gửi phiếu lúc này. Vui lòng thử lại.");
    expect(action).toHaveBeenCalledTimes(1);
    expect(submitButton()).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Có" })).toBeChecked();
    expect(within(confidenceGroup()).getByRole("button", { name: "3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
  });

  it("replaces the form with one focused confirmation heading on success", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message: SUCCESS, status: "success" });
    renderForm({ action });

    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(within(confidenceGroup()).getByRole("button", { name: "1" }));
    await user.click(submitButton());

    const heading = await screen.findByRole("heading", { name: SUCCESS });
    expect(heading).toHaveFocus();
    expect(screen.getAllByText(SUCCESS)).toHaveLength(1);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Gửi phiếu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("PublicCoachingForm failures and repeats", () => {
  async function answerRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(within(confidenceGroup()).getByRole("button", { name: "3" }));
  }

  it("keeps every answer and offers a retry when the call itself is rejected (offline, deploy)", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn<SubmitAction>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ message: SUCCESS, status: "success" });
    renderForm({ action });

    await user.type(screen.getByRole("textbox", { name: "1. Ghi chú thêm" }), "Con hay quên");
    await answerRequired(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(PUBLIC_FORM_CONNECTION_ERROR_MESSAGE);
    expect(screen.getByRole("textbox", { name: "1. Ghi chú thêm" })).toHaveValue("Con hay quên");
    expect(screen.getByRole("radio", { name: "Có" })).toBeChecked();
    expect(within(confidenceGroup()).getByRole("button", { name: "3" })).toHaveAttribute("aria-pressed", "true");
    expect(submitButton()).toBeEnabled();

    await user.click(submitButton());
    await screen.findByRole("heading", { name: SUCCESS });
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]).toEqual(action.mock.calls[0]);
  });

  it.each([
    ["submitted", "Phiếu này đã được gửi."],
    ["expired", "Liên kết đã hết hạn."],
    ["revoked", "Liên kết không còn hiệu lực."],
  ])("replaces the form with the %s screen when the server says the link is final", async (_state, message) => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message, status: "error" });
    renderForm({ action });

    await answerRequired(user);
    await user.click(submitButton());

    const heading = await screen.findByRole("heading", { level: 1, name: message });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Liên hệ trung tâm nếu cần một liên kết mới.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi phiếu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on a second submit while the first is still running", async () => {
    const user = userEvent.setup();
    let finish!: (value: Awaited<ReturnType<SubmitAction>>) => void;
    const action = vi.fn<SubmitAction>().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm({ action });

    await answerRequired(user);
    await user.click(submitButton());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const sending = screen.getByRole("button", { name: "Đang gửi…" });
    expect(sending).toBeDisabled();

    // Enter in a field or a script can still submit the form itself; the pending check holds it.
    fireEvent.submit(sending.closest("form")!);
    fireEvent.submit(sending.closest("form")!);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ message: SUCCESS, status: "success" });
    });
    expect(await screen.findByRole("heading", { name: SUCCESS })).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("names an optional number the browser cannot read instead of silently leaving it out", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>();
    const scoreId = "00000000-0000-4000-8000-000000000004";
    renderForm({
      action,
      questions: [
        ...questions,
        { configuration: {}, description: null, id: scoreId, required: false, title: "Điểm kiểm tra", type: "number" },
      ],
    });
    await answerRequired(user);

    // "1,5" where the browser expects "1.5": type=number reports "" with validity.badInput.
    const score = screen.getByRole("spinbutton", { name: "4. Điểm kiểm tra" });
    await user.type(score, "1");
    Object.defineProperty(score, "validity", { configurable: true, value: { badInput: true, valid: false } });
    fireEvent.change(score, { target: { value: "" } });
    await user.click(submitButton());

    expect(action).not.toHaveBeenCalled();
    expect(within(screen.getByRole("group", { name: "4. Điểm kiểm tra" })).getByText(NOT_A_NUMBER)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng kiểm tra lại phiếu.");
    expect(score).toHaveFocus();
  });

  // Value: protects=the check judges the number boxes as the parent sees them; fails_when=unreadable text typed into an
  // empty box is dropped as blank (or a required box with text says "bắt buộc"), or deleting unreadable text keeps blocking
  // the form with "Vui lòng nhập một số (…)"; why_new=React skips onChange while the box's value stays "" (review pass 2);
  // seam=jsdom has no locale parsing: validity is overridden on the element and no change event is fired, as in a browser;
  // no_claim=does not prove which strings a real browser rejects
  it("re-reads number boxes before checking: unreadable text typed into an empty box is named, not dropped", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>();
    const requiredId = "00000000-0000-4000-8000-000000000004";
    const optionalId = "00000000-0000-4000-8000-000000000005";
    renderForm({
      action,
      questions: [
        ...questions,
        { configuration: {}, description: null, id: requiredId, required: true, title: "Điểm kiểm tra", type: "number" },
        { configuration: {}, description: null, id: optionalId, required: false, title: "Số buổi vắng", type: "number" },
      ],
    });
    await answerRequired(user);

    // "1,5" typed into empty boxes: value stays "", so React never reports a change.
    for (const name of [requiredName("4. Điểm kiểm tra"), "5. Số buổi vắng"]) {
      Object.defineProperty(screen.getByRole("spinbutton", { name }), "validity", {
        configurable: true,
        value: { badInput: true, valid: false },
      });
    }
    await user.click(submitButton());

    expect(action).not.toHaveBeenCalled();
    const required = screen.getByRole("group", { name: requiredName("4. Điểm kiểm tra") });
    expect(within(required).getByText(NOT_A_NUMBER)).toBeInTheDocument();
    expect(within(required).queryByText(REQUIRED)).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "5. Số buổi vắng" })).getByText(NOT_A_NUMBER)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 2 câu cần sửa");
  });

  it("re-reads number boxes before checking: deleting unreadable text leaves an empty optional answer, not an error", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message: SUCCESS, status: "success" });
    const scoreId = "00000000-0000-4000-8000-000000000004";
    renderForm({
      action,
      questions: [
        ...questions,
        { configuration: {}, description: null, id: scoreId, required: false, title: "Điểm kiểm tra", type: "number" },
      ],
    });
    await answerRequired(user);
    const score = screen.getByRole("spinbutton", { name: "4. Điểm kiểm tra" });
    await user.type(score, "1");
    Object.defineProperty(score, "validity", { configurable: true, value: { badInput: true, valid: false } });
    fireEvent.change(score, { target: { value: "" } });
    act(() => score.blur());

    // Select all + delete: the value stays "", so React never reports it.
    Object.defineProperty(score, "validity", { configurable: true, value: { badInput: false, valid: true } });
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SUCCESS });
    expect(action).toHaveBeenCalledWith(TOKEN, { [ids.attended]: "Có", [ids.confidence]: 3 });
  });

  // Value: protects=Enter never submits the one-time form: in a text or number box, on a radio or a checkbox it moves focus
  // to the next control (past the rest of a radio group, onto a group's checked radio, then "Gửi phiếu"); a textarea keeps
  // its new line and an input method's Enter is left alone; fails_when=Enter on any input submits early (implicit
  // submission), focus stays or lands on the next radio of the same group, or a composing Enter is swallowed;
  // why_new=review passes 2 and 3 (radios and checkboxes still submitted); seam=user-event's Enter, which performs implicit
  // submission when nothing prevents it; no_claim=does not prove a phone keyboard's Enter key or a real IME
  it("moves focus on Enter instead of sending: text box, checkboxes, radios, long answer, number box", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>().mockResolvedValue({ message: SUCCESS, status: "success" });
    const enterIds = {
      comment: "00000000-0000-4000-8000-000000000014",
      note: "00000000-0000-4000-8000-000000000011",
      score: "00000000-0000-4000-8000-000000000015",
      subjects: "00000000-0000-4000-8000-000000000012",
      attended: "00000000-0000-4000-8000-000000000013",
    };
    renderForm({
      action,
      questions: [
        { configuration: {}, description: null, id: enterIds.note, required: false, title: "Ghi chú", type: "short_text" },
        { configuration: { options: ["Toán", "Văn"] }, description: null, id: enterIds.subjects, required: false, title: "Môn", type: "multiple_choice" },
        { configuration: { options: ["Có", "Không"] }, description: null, id: enterIds.attended, required: true, title: "Có làm bài?", type: "single_choice" },
        { configuration: {}, description: null, id: enterIds.comment, required: false, title: "Nhận xét", type: "long_text" },
        { configuration: {}, description: null, id: enterIds.score, required: false, title: "Điểm", type: "number" },
      ],
    });
    const note = screen.getByRole("textbox", { name: "1. Ghi chú" });
    const comment = screen.getByRole("textbox", { name: "4. Nhận xét" });
    const score = screen.getByRole("spinbutton", { name: "5. Điểm" });
    // Every answer is valid from here on, so an implicit submission would reach the action.
    await user.type(note, "Con hay quên");
    await user.click(screen.getByRole("checkbox", { name: "Văn" }));
    await user.click(screen.getByRole("radio", { name: "Không" }));
    await user.type(comment, "Ổn");
    await user.type(score, "8");

    act(() => note.focus());
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "Toán" })).toHaveFocus();
    await user.keyboard("{Enter}");
    // Enter on a checkbox is an implicit submission in browsers (and in user-event).
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Văn" })).toHaveFocus();
    // Into a radio group: its checked radio, as Tab would.
    await user.keyboard("{Enter}");
    expect(screen.getByRole("radio", { name: "Không" })).toHaveFocus();
    // Out of a radio group: past its other radios, whichever one has focus.
    act(() => screen.getByRole("radio", { name: "Có" }).focus());
    await user.keyboard("{Enter}");
    expect(comment).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Không" })).toBeChecked();
    // A long answer keeps Enter as a new line.
    await user.keyboard("{Enter}");
    expect(comment).toHaveFocus();
    expect(comment).toHaveValue("Ổn\n");
    act(() => score.focus());
    await user.keyboard("{Enter}");
    expect(submitButton()).toHaveFocus();
    expect(action).not.toHaveBeenCalled();

    // An input method's Enter (it commits a word) is left alone: not prevented, focus stays.
    act(() => note.focus());
    expect(fireEvent.keyDown(note, { isComposing: true, key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(note, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(note).toHaveFocus();

    // A held Enter auto-repeats: no repeat moves focus, and none may press "Gửi phiếu" (a prevented keydown
    // is what stops a browser's button activation; jsdom does not activate buttons from keydown itself).
    act(() => score.focus());
    expect(fireEvent.keyDown(score, { key: "Enter", repeat: true })).toBe(false);
    expect(score).toHaveFocus();
    act(() => submitButton().focus());
    expect(fireEvent.keyDown(submitButton(), { key: "Enter", repeat: true })).toBe(false);
    // A single press on the button is left to the browser.
    expect(fireEvent.keyDown(submitButton(), { key: "Enter" })).toBe(true);
    expect(action).not.toHaveBeenCalled();

    await user.click(submitButton());
    await screen.findByRole("heading", { name: SUCCESS });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(TOKEN, {
      [enterIds.attended]: "Không",
      [enterIds.comment]: "Ổn\n",
      [enterIds.note]: "Con hay quên",
      [enterIds.score]: "8",
      [enterIds.subjects]: ["Văn"],
    });
  });

  // Value: protects=the server HTML is inert until React controls it: "Gửi phiếu" (no submit handler yet: a native GET would
  // drop the answers and put the chosen options in the URL) and every question control (the first client render after
  // hydration writes the empty controlled values back over anything typed or ticked before it), with "Đang tải phiếu…" as
  // the reason; fails_when=a control or the button renders enabled on the server, stays disabled after hydration, the
  // caption stays, or hydration warns; why_new=review pass 3 and the post-cap red team (answers silently wiped on slow
  // phones); seam=react-dom/server + hydrateRoot in jsdom; no_claim=does not prove a browser's timing while scripts load
  it("keeps the server HTML inert (questions and Gửi phiếu) until hydrated, then lets the parent answer", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error");
    const element = (
      <PublicCoachingForm action={vi.fn<SubmitAction>()} instructions={null} questions={questions} title="Phiếu" token={TOKEN} />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const view = within(container);
    const controls = () => [
      view.getByRole("textbox", { name: "1. Ghi chú thêm" }),
      ...view.getAllByRole("radio"),
      ...within(view.getByRole("group", { name: requiredName("3. Con tự tin với môn Toán đến mức nào?") })).getAllByRole("button"),
    ];
    let root: Root | undefined;
    try {
      // Server HTML: nothing can be typed, ticked or sent, and the button says why.
      expect(controls()).toHaveLength(1 + 2 + 5);
      for (const control of controls()) expect(control).toBeDisabled();
      expect(view.getByRole("button", { name: "Gửi phiếu" })).toBeDisabled();
      expect(view.getByRole("button", { name: "Gửi phiếu" })).toHaveAccessibleDescription("Đang tải phiếu…");
      await user.type(view.getByRole("textbox", { name: "1. Ghi chú thêm" }), "Gõ trước khi tải xong");
      await user.click(view.getByRole("radio", { name: "Có" }));
      expect(view.getByRole("textbox", { name: "1. Ghi chú thêm" })).toHaveValue("");
      expect(view.getByRole("radio", { name: "Có" })).not.toBeChecked();

      await act(async () => {
        root = hydrateRoot(container, element);
      });
      for (const control of controls()) expect(control).toBeEnabled();
      expect(view.getByRole("button", { name: "Gửi phiếu" })).toBeEnabled();
      expect(view.queryByText("Đang tải phiếu…")).not.toBeInTheDocument();
      expect(view.getByRole("button", { name: "Gửi phiếu" })).not.toHaveAccessibleDescription();
      expect(consoleError).not.toHaveBeenCalled();

      // Hydrated: answers stick.
      await user.type(view.getByRole("textbox", { name: "1. Ghi chú thêm" }), "Con hay quên");
      await user.click(view.getByRole("radio", { name: "Có" }));
      expect(view.getByRole("textbox", { name: "1. Ghi chú thêm" })).toHaveValue("Con hay quên");
      expect(view.getByRole("radio", { name: "Có" })).toBeChecked();
    } finally {
      consoleError.mockRestore();
      // Not mounted through render(), so cleanup() would not remove it.
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("says only that the form can be sent once (no expiry it cannot know)", () => {
    renderForm({ action: vi.fn<SubmitAction>() });
    const note = screen.getByText("Phiếu chỉ gửi được một lần.");
    expect(note).toHaveClass("text-text-muted");
    expect(screen.queryByText(/Link hết hạn/)).not.toBeInTheDocument();
  });
});

describe("public link state helpers", () => {
  // Value: protects=state and message lookups read only their own map, so a crafted state or message never matches a prototype key;
  // fails_when=the lookups use `in` or bracket access on a plain object again; why_new=review fix 10; seam=none; no_claim=none
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "", "active"])(
    "reads %j as an invalid link",
    (state) => {
      expect(getPublicFormStateMessage(state)).toBe("Liên kết không hợp lệ.");
    },
  );

  it("maps the action's final-state messages back to their state and nothing else", () => {
    expect(getPublicFormStateForMessage("Phiếu này đã được gửi.")).toBe("submitted");
    expect(getPublicFormStateForMessage("Liên kết đã hết hạn.")).toBe("expired");
    expect(getPublicFormStateForMessage("Liên kết không còn hiệu lực.")).toBe("revoked");
    for (const message of ["constructor", "toString", "__proto__", "", "expired", "Không thể gửi phiếu lúc này. Vui lòng thử lại."]) {
      expect(getPublicFormStateForMessage(message)).toBeNull();
    }
    // Round trip: each state's own message leads back to it.
    for (const state of ["submitted", "expired", "revoked"]) {
      expect(getPublicFormStateForMessage(getPublicFormStateMessage(state))).toBe(state);
    }
  });
});

describe("PublicCoachingForm brand line", () => {
  it("names the student after the centre when known", () => {
    renderForm({ action: vi.fn<SubmitAction>(), studentName: "Nguyễn Minh An" });
    expect(screen.getByText("Toán Thầy Vinh · Nguyễn Minh An")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Phiếu phản hồi tháng 10" })).toBeInTheDocument();
  });

  it("shows only the centre without a student", () => {
    renderForm({ action: vi.fn<SubmitAction>() });
    expect(screen.getByText("Toán Thầy Vinh")).toBeInTheDocument();
    expect(screen.queryByText(/Toán Thầy Vinh ·/)).not.toBeInTheDocument();
  });

  it("says 'kiểm tra lại' (not 'bắt buộc') when the only problem is an optional answer out of range", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SubmitAction>();
    const scoreId = "00000000-0000-4000-8000-000000000004";
    renderForm({
      action,
      questions: [
        ...questions,
        { configuration: { max: 10, min: 0 }, description: null, id: scoreId, required: false, title: "Điểm kiểm tra", type: "number" },
      ],
    });

    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.type(screen.getByRole("spinbutton", { name: "4. Điểm kiểm tra" }), "12");
    await user.click(submitButton());

    expect(action).not.toHaveBeenCalled();
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Vui lòng kiểm tra lại phiếu.");
    expect(banner).toHaveTextContent("Còn 1 câu cần sửa; các câu đó được đánh dấu ở trên.");
    expect(banner).not.toHaveTextContent("bắt buộc");
    expect(screen.getByText("Vui lòng nhập số từ 0 đến 10.")).toBeInTheDocument();
  });
});
