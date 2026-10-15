// Value: protects=the Coaching form builder (design 13c): all six question types can be added from "Thêm câu hỏi:" (the old builder could not add "Câu trả lời ngắn") and the new card's "Nội dung" takes focus; cards move and delete with the preview following; the choice and scale editors drive the "Phụ huynh sẽ thấy" preview; blank/duplicate options and blank name/title are named before anything is sent; the save payload is exactly { formId, instructions, name, questions, title } with text configs {} and trimmed options; "Xuất bản vN" asks first, saves unsaved edits before publishing (a failed save stops it) and is disabled with its reason without the publish permission or before the first save; viewers and published versions are read-only (the latter offers "Tạo bản nháp phiên bản mới"); the preview is inert; a new form opens its own page after the first save; reload/close asks only while edits are unsaved; a form with no questions is not offered for publishing (banner until one is added); the back link asks before dropping unsaved edits ("Ở lại" keeps them, "Rời trang" restores the saved form and opens the list);
// fails_when=a question type cannot be added, focus is lost after add/move/delete, the preview drifts from the editor, a draft the database would reject is sent, the payload leaks client keys or untrimmed options, publish runs before (or without) saving unsaved edits or after a failed save, the publish/save buttons appear for viewers, the preview reports answers or submits, the new form is not opened after its first save, a later save of a new form sends formId null again (a second form), or beforeunload keeps prompting after a successful save; the publish dialog opens for (or publish is sent with) zero questions; the back link leaves silently with unsaved edits, or "Rời trang" keeps the draft (or is overridden by the new form's pending redirect); a rejected action (deploy skew, offline) wipes the typed form; a failed check leaves focus on the button; "Đã lưu" stays over newer edits; a publish failure after a successful save-first hides that the edits were saved; the 100-question / 50-option caps stop disabling their buttons;
// why_new=step 11b rebuilds the builder (question cards, type settings, preview, publish dialog, leave guard, action overrides for /dev/coaching); the zero-question publish check and the GuardedLink back link were only covered for beforeunload;
// seam=next/navigation is mocked (router.replace observable) and @/features/coaching/actions/coaching-form-actions is mocked so any real call is observable; most tests inject stubs through the actions prop; a cancelable beforeunload event stands in for the browser; no_claim=does not prove the save_coaching_form_draft / publish RPCs (supabase tests), the two-column lg layout or sticky preview (checked visually in /dev/coaching)
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCoachingFormVersionDraftAction,
  issueCoachingPublicLinkAction,
  publishCoachingFormAction,
  revokeCoachingPublicLinkAction,
  saveCoachingFormDraftAction,
} from "@/features/coaching/actions/coaching-form-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { COACHING_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import {
  CoachingFormBuilder,
  type CoachingFormBuilderProps,
} from "@/features/coaching/components/coaching-form-builder";
import type { CoachingQuestionDraft } from "@/features/coaching/forms/coaching-form-types";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/coaching/forms/form-1",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/coaching/actions/coaching-form-actions", () => ({
  createCoachingFormVersionDraftAction: vi.fn(),
  issueCoachingPublicLinkAction: vi.fn(),
  publishCoachingFormAction: vi.fn(),
  revokeCoachingPublicLinkAction: vi.fn(),
  saveCoachingFormDraftAction: vi.fn(),
}));

type SaveAction = NonNullable<CoachingActionOverrides["saveCoachingFormDraft"]>;
type PublishAction = NonNullable<CoachingActionOverrides["publishCoachingForm"]>;
type CreateDraftAction = NonNullable<CoachingActionOverrides["createCoachingFormVersionDraft"]>;
type ActionResult = Awaited<ReturnType<SaveAction>>;

const saved: ActionResult = { formId: "form-1", message: "Đã lưu bản nháp biểu mẫu.", status: "success" };
const published: ActionResult = { message: "Đã xuất bản phiên bản biểu mẫu.", status: "success" };

function makeStubs() {
  return {
    createCoachingFormVersionDraft: vi.fn<CreateDraftAction>(),
    publishCoachingForm: vi.fn<PublishAction>().mockResolvedValue(published),
    saveCoachingFormDraft: vi.fn<SaveAction>().mockResolvedValue(saved),
  };
}

let stubs = makeStubs();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  stubs = makeStubs();
});

const shortText = (title: string, extra: Partial<CoachingQuestionDraft> = {}): CoachingQuestionDraft => ({
  configuration: {},
  description: "",
  required: false,
  title,
  type: "short_text",
  ...extra,
});

function renderBuilder(overrides: Partial<CoachingFormBuilderProps> = {}) {
  const props: CoachingFormBuilderProps = {
    actions: stubs,
    canManage: true,
    canPublish: true,
    formId: "form-1",
    formVersionId: "version-2",
    initialInstructions: "Phụ huynh điền trong khoảng 3 phút.",
    initialName: "Phiếu cuối kỳ",
    initialQuestions: [shortText("Con tên gì?")],
    initialTitle: "Phiếu phản hồi cuối kỳ",
    isDraft: true,
    versionNumber: 2,
    ...overrides,
  };
  return render(<CoachingFormBuilder {...props} />);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Name of a control whose label ends in an sr-only part, e.g. "Nội dung" +
 * " câu 1". jsdom's name computation trims the sr-only span's leading space
 * (browsers keep it), so the space is optional here.
 */
const named = (visible: string, srOnly: string) =>
  new RegExp(`^${escapeRegExp(visible)}\\s*${escapeRegExp(srOnly)}$`);

const preview = () => screen.getByRole("region", { name: "Phụ huynh sẽ thấy (390px)" });
const addGroup = () => screen.getByRole("group", { name: "Thêm câu hỏi:" });
// A card is a group named by its "Câu n" heading (not a region: 100 questions must not add 100 landmarks).
const card = (number: number) => screen.getByRole("group", { name: `Câu ${number}` });
const cards = () => screen.queryAllByRole("group", { name: /^Câu \d+$/ });
const titleInput = (number: number) => screen.getByRole("textbox", { name: named("Nội dung", `câu ${number}`) });
const cardTitles = () =>
  screen.getAllByRole("textbox", { name: /^Nội dung\s*câu \d+$/ }).map((input) => (input as HTMLInputElement).value);
const scaleButtons = () => within(preview()).queryAllByRole("button", { name: /^\d+$/ });
const saveButton = () => screen.getByRole("button", { name: "Lưu nháp" });
const headerPublish = (version = 2) => screen.getAllByRole("button", { name: `Xuất bản v${version}` })[0]!;

/** Fires a cancelable beforeunload; true when the page asked the browser to confirm leaving. */
function beforeUnloadIsPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

/** Clicks a link; true when the page held the click (the leave dialog asks first). Stops jsdom's own navigation either way. */
function linkClickIsHeld(link: HTMLElement): boolean {
  let held = false;
  // window is last in the bubble path, so this runs after React's handler.
  const record = (event: MouseEvent) => {
    held = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener("click", record);
  fireEvent.click(link);
  window.removeEventListener("click", record);
  return held;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("CoachingFormBuilder questions", () => {
  it("adds a question of each of the six types and focuses the new card's Nội dung field", async () => {
    const user = userEvent.setup();
    renderBuilder({ initialQuestions: [] });
    expect(screen.getByText("Chưa có câu hỏi nào. Thêm câu hỏi bằng các nút bên dưới.")).toBeInTheDocument();
    expect(within(preview()).getByText("Câu hỏi sẽ hiện ở đây.")).toBeInTheDocument();

    const labels = ["Câu trả lời ngắn", "Câu trả lời dài", "Một lựa chọn", "Nhiều lựa chọn", "Thang điểm", "Số"];
    for (const [index, label] of labels.entries()) {
      await user.click(within(addGroup()).getByRole("button", { name: label }));
      const number = index + 1;
      expect(cards()).toHaveLength(number);
      expect(titleInput(number)).toHaveFocus();
      expect(titleInput(number)).toHaveValue("Câu hỏi mới");
      expect(within(card(number)).getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText(/· 6 câu hỏi$/)).toBeInTheDocument();
    const shown = preview();
    expect(within(shown).getAllByRole("group")).toHaveLength(6);
    expect(within(shown).getByPlaceholderText("Câu trả lời ngắn")).toBeInTheDocument();
    expect(within(shown).getByPlaceholderText("Câu trả lời dài")).toBeInTheDocument();
    expect(within(shown).getAllByRole("radio")).toHaveLength(2);
    expect(within(shown).getAllByRole("checkbox")).toHaveLength(2);
    expect(scaleButtons()).toHaveLength(5);
    expect(within(shown).getByRole("spinbutton")).toBeInTheDocument();
    // The preview's form title is not a second h1.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("moves cards up and down and deletes one; the preview and focus follow", async () => {
    const user = userEvent.setup();
    renderBuilder({ initialQuestions: [shortText("Câu A"), shortText("Câu B"), shortText("Câu C")] });

    expect(screen.getByRole("button", { name: "Đưa câu 1 lên" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đưa câu 3 xuống" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Đưa câu 1 xuống" }));
    expect(cardTitles()).toEqual(["Câu B", "Câu A", "Câu C"]);
    expect(within(preview()).getByRole("group", { name: "1. Câu B" })).toBeInTheDocument();
    expect(within(preview()).getByRole("group", { name: "2. Câu A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đưa câu 2 xuống" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Đưa câu 3 lên" }));
    expect(cardTitles()).toEqual(["Câu B", "Câu C", "Câu A"]);
    expect(within(preview()).getByRole("group", { name: "3. Câu A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đưa câu 2 lên" })).toHaveFocus();

    // Reaching the last place disables "xuống", so focus moves to the card's "lên".
    await user.click(screen.getByRole("button", { name: "Đưa câu 2 xuống" }));
    expect(cardTitles()).toEqual(["Câu B", "Câu A", "Câu C"]);
    expect(screen.getByRole("button", { name: "Đưa câu 3 lên" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Xóa câu 1" }));
    expect(cardTitles()).toEqual(["Câu A", "Câu C"]);
    expect(within(preview()).getAllByRole("group")).toHaveLength(2);
    expect(within(preview()).getByRole("group", { name: "1. Câu A" })).toBeInTheDocument();
    expect(within(preview()).getByRole("group", { name: "2. Câu C" })).toBeInTheDocument();
    expect(within(preview()).queryByRole("group", { name: /Câu B/ })).not.toBeInTheDocument();
    expect(titleInput(1)).toHaveFocus();
    expect(screen.getByText(/· 2 câu hỏi$/)).toBeInTheDocument();

    // Deleting the last card focuses its previous neighbour; deleting the only card focuses the first add button.
    await user.click(screen.getByRole("button", { name: "Xóa câu 2" }));
    expect(cardTitles()).toEqual(["Câu A"]);
    expect(titleInput(1)).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Xóa câu 1" }));
    expect(cards()).toHaveLength(0);
    expect(within(addGroup()).getByRole("button", { name: "Câu trả lời ngắn" })).toHaveFocus();
    expect(within(preview()).getByText("Câu hỏi sẽ hiện ở đây.")).toBeInTheDocument();
  });

  it("edits choice options: add an empty option, fill it, delete one; the preview lists the filled options", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        { configuration: { options: ["Toán", "Văn"] }, description: "", required: false, title: "Môn con thích", type: "single_choice" },
      ],
    });

    expect(within(preview()).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual(["Toán", "Văn"]);
    expect(within(preview()).getByRole("radio", { name: "Toán" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: named("Thêm lựa chọn", "cho câu 1") }));
    const third = screen.getByRole("textbox", { name: "Lựa chọn 3 của câu 1" });
    expect(third).toHaveValue("");
    expect(third).toHaveFocus();
    // A blank option is not shown to parents.
    expect(within(preview()).getAllByRole("radio")).toHaveLength(2);

    await user.type(third, "Tiếng Anh");
    expect(within(preview()).getByRole("radio", { name: "Tiếng Anh" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa lựa chọn 1 của câu 1" }));
    expect(screen.getByRole("textbox", { name: "Lựa chọn 1 của câu 1" })).toHaveValue("Văn");
    expect(screen.getByRole("textbox", { name: "Lựa chọn 2 của câu 1" })).toHaveValue("Tiếng Anh");
    expect(screen.queryByRole("textbox", { name: "Lựa chọn 3 của câu 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Lựa chọn 1 của câu 1" })).toHaveFocus();
    expect(within(preview()).queryByRole("radio", { name: "Toán" })).not.toBeInTheDocument();
    expect(within(preview()).getAllByRole("radio")).toHaveLength(2);

    // The last option cannot be deleted.
    await user.click(screen.getByRole("button", { name: "Xóa lựa chọn 2 của câu 1" }));
    expect(screen.queryByRole("button", { name: /^Xóa lựa chọn/ })).not.toBeInTheDocument();
  });

  it("drives the preview's scale from Từ, Đến, Nhãn thấp and Nhãn cao", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        {
          configuration: { max: 5, maxLabel: "Cao", min: 1, minLabel: "Thấp" },
          description: "",
          required: false,
          title: "Mức độ tự tin",
          type: "scale",
        },
      ],
    });
    expect(scaleButtons().map((button) => button.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    expect(within(preview()).getByText("Thấp")).toBeInTheDocument();
    expect(within(preview()).getByText("Cao")).toBeInTheDocument();

    const from = screen.getByRole("spinbutton", { name: named("Từ", "(câu 1)") });
    await user.clear(from);
    await user.type(from, "0");
    expect(scaleButtons()).toHaveLength(6);

    const to = screen.getByRole("spinbutton", { name: named("Đến", "(câu 1)") });
    await user.clear(to);
    await user.type(to, "10");
    expect(scaleButtons().map((button) => button.textContent)).toEqual([
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    ]);

    const low = screen.getByRole("textbox", { name: named("Nhãn thấp", "(câu 1)") });
    await user.clear(low);
    await user.type(low, "Chưa tự tin");
    const high = screen.getByRole("textbox", { name: named("Nhãn cao", "(câu 1)") });
    await user.clear(high);
    await user.type(high, "Rất tự tin");
    expect(within(preview()).getByText("Chưa tự tin")).toBeInTheDocument();
    expect(within(preview()).getByText("Rất tự tin")).toBeInTheDocument();
    expect(within(preview()).queryByText("Thấp")).not.toBeInTheDocument();
    for (const button of scaleButtons()) expect(button.textContent).toMatch(/^\d+$/);

    await user.clear(to);
    await user.type(to, "20");
    expect(scaleButtons()).toHaveLength(0);
    expect(
      within(preview()).getByText("Thang điểm chưa hợp lệ: Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến."),
    ).toBeInTheDocument();
  });
});

describe("CoachingFormBuilder checks before saving", () => {
  it("names a blank option, then a duplicate option, on its question and does not save until fixed", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        { configuration: { options: ["Có", "Không"] }, description: "", required: true, title: "Con có làm bài?", type: "single_choice" },
      ],
    });

    await user.click(screen.getByRole("button", { name: named("Thêm lựa chọn", "cho câu 1") }));
    expect(screen.queryByText("Lựa chọn không được để trống.")).not.toBeInTheDocument();

    await user.click(saveButton());
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(within(card(1)).getByText("Lựa chọn không được để trống.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 1 chỗ cần sửa, được đánh dấu bên dưới.");

    await user.type(screen.getByRole("textbox", { name: "Lựa chọn 3 của câu 1" }), "Có");
    expect(within(card(1)).queryByText("Lựa chọn không được để trống.")).not.toBeInTheDocument();
    expect(within(card(1)).getByText("Các lựa chọn phải khác nhau.")).toBeInTheDocument();
    await user.click(saveButton());
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 1 chỗ cần sửa");

    await user.type(screen.getByRole("textbox", { name: "Lựa chọn 3 của câu 1" }), " rồi");
    expect(within(card(1)).queryByText("Các lựa chọn phải khác nhau.")).not.toBeInTheDocument();
    await user.click(saveButton());
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu bản nháp biểu mẫu.");
  });

  it("names a blank form name, display title and question text; nothing is saved", async () => {
    const user = userEvent.setup();
    renderBuilder();

    const name = screen.getByRole("textbox", { name: "Tên biểu mẫu" });
    const title = screen.getByRole("textbox", { name: "Tiêu đề hiển thị cho phụ huynh" });
    await user.clear(name);
    await user.clear(title);
    await user.clear(titleInput(1));
    await user.click(saveButton());

    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Cần nhập tên biểu mẫu.");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("Cần nhập tiêu đề hiển thị cho phụ huynh.");
    expect(titleInput(1)).toHaveAttribute("aria-invalid", "true");
    expect(titleInput(1)).toHaveAccessibleDescription("Cần nhập nội dung câu hỏi.");
    expect(screen.getByText("Còn 3 chỗ cần sửa, được đánh dấu bên dưới.")).toBeInTheDocument();
    // The preview shows a placeholder instead of an empty title.
    expect(within(preview()).getByText("(Chưa có tiêu đề)")).toBeInTheDocument();
    expect(within(preview()).getByRole("group", { name: "1. (Chưa có nội dung câu hỏi)" })).toBeInTheDocument();
  });
});

describe("CoachingFormBuilder save payload", () => {
  it("sends exactly { formId, instructions, name, questions, title } with text configs {} and trimmed options", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        shortText("Con tên gì?", { configuration: { options: ["cũ"] }, description: "Ghi đầy đủ họ tên", required: true }),
        { configuration: { options: [" Toán ", "Văn  "] }, description: "", required: false, title: "Môn con thích", type: "multiple_choice" },
        { configuration: { max: 5, maxLabel: "Cao", min: 1, minLabel: "Thấp" }, description: "", required: false, title: "Mức độ", type: "scale" },
      ],
    });

    await user.click(screen.getByRole("checkbox", { name: named("Bắt buộc", "câu 2") }));
    await user.click(within(addGroup()).getByRole("button", { name: "Câu trả lời dài" }));
    await user.click(saveButton());

    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));
    expect(stubs.saveCoachingFormDraft).toHaveBeenCalledWith({
      formId: "form-1",
      instructions: "Phụ huynh điền trong khoảng 3 phút.",
      name: "Phiếu cuối kỳ",
      questions: [
        { configuration: {}, description: "Ghi đầy đủ họ tên", required: true, title: "Con tên gì?", type: "short_text" },
        { configuration: { options: ["Toán", "Văn"] }, description: "", required: true, title: "Môn con thích", type: "multiple_choice" },
        { configuration: { max: 5, maxLabel: "Cao", min: 1, minLabel: "Thấp" }, description: "", required: false, title: "Mức độ", type: "scale" },
        { configuration: {}, description: "", required: false, title: "Câu hỏi mới", type: "long_text" },
      ],
      title: "Phiếu phản hồi cuối kỳ",
    });
    const payload = stubs.saveCoachingFormDraft.mock.calls[0]![0];
    expect(Object.keys(payload).sort()).toEqual(["formId", "instructions", "name", "questions", "title"]);
    for (const question of payload.questions) {
      expect(Object.keys(question).sort()).toEqual(["configuration", "description", "required", "title", "type"]);
    }
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu bản nháp biểu mẫu.");
  });

  it("uses the real module action when no actions are injected", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCoachingFormDraftAction).mockResolvedValue(saved);
    renderBuilder({ actions: undefined });

    await user.click(saveButton());

    await waitFor(() => expect(saveCoachingFormDraftAction).toHaveBeenCalledTimes(1));
    expect(saveCoachingFormDraftAction).toHaveBeenCalledWith(expect.objectContaining({ formId: "form-1", name: "Phiếu cuối kỳ" }));
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu bản nháp biểu mẫu.");
  });

  it("opens the new form's page after its first save", async () => {
    const user = userEvent.setup();
    stubs.saveCoachingFormDraft.mockResolvedValue({ formId: "form-new", message: "Đã lưu bản nháp biểu mẫu.", status: "success" });
    renderBuilder({ formId: null, formVersionId: null, initialName: "", initialQuestions: [], initialTitle: "", versionNumber: null });
    expect(screen.getByRole("heading", { level: 1, name: "Tạo biểu mẫu Coaching" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), "Phiếu tháng 11");
    await user.type(screen.getByRole("textbox", { name: "Tiêu đề hiển thị cho phụ huynh" }), "Phản hồi tháng 11");
    await user.click(saveButton());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/coaching/forms/form-new"));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(stubs.saveCoachingFormDraft).toHaveBeenCalledWith({
      formId: null,
      instructions: "Phụ huynh điền trong khoảng 3 phút.",
      name: "Phiếu tháng 11",
      questions: [],
      title: "Phản hồi tháng 11",
    });
  });

  // Regression guard: when the person types while the first save of a new form runs,
  // the redirect waits for a clean state, so the next "Lưu nháp" must reuse the
  // created form's id instead of sending formId: null (a second form).
  it("saves edits typed during a new form's first save into that form, not into a second new form", async () => {
    const user = userEvent.setup();
    const first = deferred<ActionResult>();
    stubs.saveCoachingFormDraft
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ formId: "form-new", message: "Đã lưu bản nháp biểu mẫu.", status: "success" });
    renderBuilder({ formId: null, formVersionId: null, initialName: "", initialQuestions: [], initialTitle: "", versionNumber: null });

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), "Phiếu tháng 11");
    await user.type(screen.getByRole("textbox", { name: "Tiêu đề hiển thị cho phụ huynh" }), "Phản hồi tháng 11");
    await user.click(saveButton());
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));

    // Typed while the first save is still running (the fields stay editable).
    await user.type(screen.getByRole("textbox", { name: "Hướng dẫn" }), " Cảm ơn.");
    await act(async () => {
      first.resolve({ formId: "form-new", message: "Đã lưu bản nháp biểu mẫu.", status: "success" });
    });
    await waitFor(() => expect(saveButton()).toHaveTextContent("Lưu nháp"));
    // The edits typed during the save are not saved yet: no "Đã lưu" over them, and the page stays put.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(beforeUnloadIsPrevented()).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(saveButton());
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(2));
    expect(stubs.saveCoachingFormDraft.mock.calls[1]![0]).toMatchObject({
      formId: "form-new",
      instructions: "Phụ huynh điền trong khoảng 3 phút. Cảm ơn.",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu bản nháp biểu mẫu.");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/coaching/forms/form-new"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("hides Đã lưu bản nháp as soon as the form is edited again", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " (sửa)");
    await user.click(saveButton());
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu bản nháp biểu mẫu.");

    await user.type(screen.getByRole("textbox", { name: "Hướng dẫn" }), " Cảm ơn.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(beforeUnloadIsPrevented()).toBe(true);
  });
});

describe("CoachingFormBuilder publishing", () => {
  it("asks before publishing, naming what changes, then publishes the version", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(headerPublish());
    const dialog = screen.getByRole("dialog", { name: "Xuất bản v2?" });
    // Publishing locks the version, so Enter right after opening must not publish: the safe choice has focus.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Hủy" })).toHaveFocus());
    expect(dialog).toHaveAccessibleDescription(
      "Câu hỏi của v2 bị khóa; muốn sửa phải tạo bản nháp phiên bản mới. Link phát từ nay dùng v2; link v1 đã gửi vẫn nộp được.",
    );
    expect(within(dialog).queryByText(/Thay đổi chưa lưu/)).not.toBeInTheDocument();
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();

    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));

    await waitFor(() => expect(stubs.publishCoachingForm).toHaveBeenCalledWith("version-2"));
    expect(stubs.publishCoachingForm).toHaveBeenCalledTimes(1);
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Đã xuất bản phiên bản biểu mẫu.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves unsaved edits first and publishes only after the save succeeds", async () => {
    const user = userEvent.setup();
    const save = deferred<ActionResult>();
    stubs.saveCoachingFormDraft.mockReturnValue(save.promise);
    renderBuilder();

    await user.clear(titleInput(1));
    await user.type(titleInput(1), "Con tên là gì?");
    await user.click(headerPublish());
    const dialog = screen.getByRole("dialog", { name: "Xuất bản v2?" });
    expect(within(dialog).getByText("Thay đổi chưa lưu được lưu trước, rồi mới xuất bản.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Xuất bản v2" }));
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));
    expect(stubs.saveCoachingFormDraft.mock.calls[0]![0].questions[0]!.title).toBe("Con tên là gì?");
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();

    await act(async () => {
      save.resolve(saved);
    });
    await waitFor(() => expect(stubs.publishCoachingForm).toHaveBeenCalledWith("version-2"));
    expect(stubs.saveCoachingFormDraft.mock.invocationCallOrder[0]!).toBeLessThan(
      stubs.publishCoachingForm.mock.invocationCallOrder[0]!,
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Đã xuất bản phiên bản biểu mẫu.");
  });

  it("does not publish when saving the unsaved edits fails", async () => {
    const user = userEvent.setup();
    stubs.saveCoachingFormDraft.mockResolvedValue({
      message: "Không thể lưu dữ liệu Coaching. Dữ liệu chưa được thay đổi.",
      status: "error",
    });
    renderBuilder();

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " (sửa)");
    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa xuất bản: Không thể lưu dữ liệu Coaching. Dữ liệu chưa được thay đổi.",
    );
    expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1);
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says the edits were saved when publishing fails after the save, and only then", async () => {
    const user = userEvent.setup();
    const refused = "Không thể lưu dữ liệu Coaching. Dữ liệu chưa được thay đổi.";
    stubs.publishCoachingForm.mockResolvedValue({ message: refused, status: "error" });
    renderBuilder();

    // Nothing unsaved: the publish error is shown as it came.
    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${escapeRegExp(refused)}$`));
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " (sửa)");
    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));
    await waitFor(() => expect(stubs.publishCoachingForm).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent(`Đã lưu bản nháp nhưng chưa xuất bản: ${refused}`);
    expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1);
    // The save counted: nothing is unsaved any more.
    expect(beforeUnloadIsPrevented()).toBe(false);
  });

  // Regression guard: the dialog closes while the publish is still pending, when "Xuất bản vN" is disabled,
  // so the dialog's own focus return used to land on <body>.
  it("returns focus to Xuất bản vN when publishing fails, whether the publish or the save before it failed", async () => {
    const user = userEvent.setup();
    const refused = "Không thể lưu dữ liệu Coaching. Dữ liệu chưa được thay đổi.";
    stubs.publishCoachingForm.mockResolvedValue({ message: refused, status: "error" });
    renderBuilder();

    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(refused);
    await waitFor(() => expect(headerPublish()).toHaveFocus());

    stubs.saveCoachingFormDraft.mockResolvedValueOnce({ message: refused, status: "error" });
    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " (sửa)");
    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(`Chưa xuất bản: ${refused}`);
    await waitFor(() => expect(headerPublish()).toHaveFocus());
    expect(stubs.publishCoachingForm).toHaveBeenCalledTimes(1);
  });

  it("reads Đang lưu… on Lưu nháp only while a save runs, never during a publish", async () => {
    const user = userEvent.setup();
    renderBuilder();
    const header = saveButton();

    // Every label the button shows, including ones replaced within the same tick.
    const labels: string[] = [];
    const collect = (records: MutationRecord[]) => {
      for (const record of records) {
        if (record.oldValue !== null) labels.push(record.oldValue);
        record.removedNodes.forEach((node) => labels.push(node.textContent ?? ""));
      }
    };
    const observer = new MutationObserver(collect);
    observer.observe(header, { characterData: true, characterDataOldValue: true, childList: true, subtree: true });

    const publishing = deferred<ActionResult>();
    stubs.publishCoachingForm.mockReturnValueOnce(publishing.promise);
    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " (sửa)");
    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));
    await waitFor(() => expect(stubs.publishCoachingForm).toHaveBeenCalledTimes(1));
    await act(async () => {
      publishing.resolve({ message: "Không thể xuất bản lúc này.", status: "error" });
    });
    await waitFor(() => expect(headerPublish()).toBeEnabled());
    collect(observer.takeRecords());
    observer.disconnect();
    labels.push(header.textContent ?? "");
    expect(labels.filter((label) => label.includes("Đang lưu"))).toEqual([]);

    // A save of its own does say so.
    const saving = deferred<ActionResult>();
    stubs.saveCoachingFormDraft.mockReturnValueOnce(saving.promise);
    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " lần 2");
    await user.click(header);
    expect(header).toHaveTextContent("Đang lưu…");
    await act(async () => {
      saving.resolve(saved);
    });
    expect(header).toHaveTextContent("Lưu nháp");
  });

  it("does not offer a form without questions for publishing and says why until a question is added", async () => {
    const user = userEvent.setup();
    renderBuilder({ initialQuestions: [] });

    await user.click(headerPublish());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Cần có ít nhất một câu hỏi trước khi xuất bản.");
    // Focus goes where the fix is: the first "Thêm câu hỏi" button.
    expect(within(addGroup()).getByRole("button", { name: "Câu trả lời ngắn" })).toHaveFocus();
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(publishCoachingFormAction).not.toHaveBeenCalled();

    await user.click(within(addGroup()).getByRole("button", { name: "Câu trả lời ngắn" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(headerPublish());
    expect(screen.getByRole("dialog", { name: "Xuất bản v2?" })).toBeInTheDocument();
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();
  });

  it("disables Xuất bản with its reason without the publish permission", () => {
    renderBuilder({ canPublish: false });
    const publish = screen.getByRole("button", { name: "Xuất bản v2" });
    expect(publish).toBeDisabled();
    // Named in words, not as the raw permission code.
    expect(publish).toHaveAccessibleDescription("Cần quyền xuất bản mẫu coaching.");
    expect(screen.getByText("Cần quyền xuất bản mẫu coaching.")).toBeVisible();
    expect(screen.queryByText(/coaching_forms\./)).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("disables Xuất bản on a new form until its first save", () => {
    renderBuilder({ formId: null, formVersionId: null, versionNumber: null });
    const publish = screen.getByRole("button", { name: "Xuất bản v1" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription("Lưu nháp lần đầu rồi mới xuất bản được.");
    expect(screen.getByText("Bản nháp mới")).toBeInTheDocument();
  });

  it("shows no Lưu nháp or Xuất bản to a viewer without coaching_forms.manage and disables every input", () => {
    renderBuilder({
      canManage: false,
      initialQuestions: [
        shortText("Con tên gì?"),
        { configuration: { options: ["Có", "Không"] }, description: "", required: false, title: "Con có làm bài?", type: "single_choice" },
        { configuration: { max: 5, min: 1 }, description: "", required: false, title: "Mức độ", type: "scale" },
      ],
    });

    expect(screen.queryByRole("button", { name: "Lưu nháp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xuất bản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo bản nháp phiên bản mới" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Thêm câu hỏi:" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Đưa|Xóa) câu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Thêm lựa chọn/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Bạn chỉ xem được bản nháp này; cần quyền quản lý mẫu coaching để sửa."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/coaching_forms\./)).not.toBeInTheDocument();
    for (const control of [
      ...screen.getAllByRole("textbox"),
      ...screen.getAllByRole("checkbox"),
      ...screen.getAllByRole("spinbutton"),
    ]) {
      expect(control).toBeDisabled();
    }
  });
});

describe("CoachingFormBuilder published version", () => {
  it("is read-only and offers Tạo bản nháp phiên bản mới, which creates a draft for the form", async () => {
    const user = userEvent.setup();
    stubs.createCoachingFormVersionDraft.mockResolvedValue({ message: "Đã tạo bản nháp phiên bản mới.", status: "success" });
    renderBuilder({
      initialQuestions: [
        shortText("Con tên gì?"),
        { configuration: { options: ["Có", "Không"] }, description: "", required: false, title: "Con có làm bài?", type: "single_choice" },
      ],
      isDraft: false,
    });

    expect(screen.getByText("Phiên bản đã xuất bản chỉ đọc; sửa đổi phải tạo bản nháp mới.")).toBeInTheDocument();
    expect(screen.getByText("v2 · Đang xuất bản")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xuất bản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Thêm câu hỏi:" })).not.toBeInTheDocument();
    for (const control of [...screen.getAllByRole("textbox"), ...screen.getAllByRole("checkbox")]) {
      expect(control).toBeDisabled();
    }

    await user.click(screen.getByRole("button", { name: "Tạo bản nháp phiên bản mới" }));
    await waitFor(() => expect(stubs.createCoachingFormVersionDraft).toHaveBeenCalledWith("form-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã tạo bản nháp phiên bản mới.");
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();
  });
});

describe("CoachingFormBuilder preview", () => {
  it("is inert: every control and Gửi phiếu are disabled and interacting calls nothing", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        shortText("Con tên gì?", { required: true }),
        { configuration: {}, description: "", required: false, title: "Nhận xét", type: "long_text" },
        { configuration: { options: ["Có", "Không"] }, description: "", required: false, title: "Con có làm bài?", type: "single_choice" },
        { configuration: { options: ["Toán", "Văn"] }, description: "", required: false, title: "Môn", type: "multiple_choice" },
        { configuration: { max: 3, min: 1 }, description: "", required: false, title: "Mức độ", type: "scale" },
        { configuration: {}, description: "", required: false, title: "Điểm", type: "number" },
      ],
    });
    const shown = preview();
    const send = within(shown).getByRole("button", { name: "Gửi phiếu" });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription("Xem trước — không gửi được.");

    const controls = [
      ...within(shown).getAllByRole("textbox"),
      ...within(shown).getAllByRole("spinbutton"),
      ...within(shown).getAllByRole("radio"),
      ...within(shown).getAllByRole("checkbox"),
      ...within(shown).getAllByRole("button"),
    ];
    expect(controls).toHaveLength(2 + 1 + 2 + 2 + 3 + 1);
    for (const control of controls) expect(control).toBeDisabled();

    await user.click(within(shown).getByRole("radio", { name: "Có" }));
    await user.click(within(shown).getByRole("checkbox", { name: "Toán" }));
    await user.click(within(shown).getByRole("button", { name: "2" }));
    await user.type(within(shown).getByPlaceholderText("Câu trả lời ngắn"), "An");
    await user.click(send);

    expect(within(shown).getByRole("radio", { name: "Có" })).not.toBeChecked();
    expect(within(shown).getByRole("checkbox", { name: "Toán" })).not.toBeChecked();
    expect(within(shown).getByRole("button", { name: "2" })).toHaveAttribute("aria-pressed", "false");
    expect(within(shown).getByPlaceholderText("Câu trả lời ngắn")).toHaveValue("");
    for (const action of [
      stubs.saveCoachingFormDraft,
      stubs.publishCoachingForm,
      stubs.createCoachingFormVersionDraft,
      saveCoachingFormDraftAction,
      publishCoachingFormAction,
      createCoachingFormVersionDraftAction,
      issueCoachingPublicLinkAction,
      revokeCoachingPublicLinkAction,
    ]) {
      expect(action).not.toHaveBeenCalled();
    }
    // Touching the preview does not count as an edit.
    expect(beforeUnloadIsPrevented()).toBe(false);
  });
});

describe("CoachingFormBuilder leave guard", () => {
  it("asks before reload/close only while edits are unsaved (and while the save runs)", async () => {
    const user = userEvent.setup();
    const save = deferred<ActionResult>();
    stubs.saveCoachingFormDraft.mockReturnValue(save.promise);
    renderBuilder();
    expect(beforeUnloadIsPrevented()).toBe(false);

    await user.type(screen.getByRole("textbox", { name: "Hướng dẫn" }), " Cảm ơn.");
    expect(beforeUnloadIsPrevented()).toBe(true);

    await user.click(saveButton());
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));
    expect(beforeUnloadIsPrevented()).toBe(true);

    await act(async () => {
      save.resolve(saved);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu bản nháp biểu mẫu.");
    expect(beforeUnloadIsPrevented()).toBe(false);
  });

  it("asks before the back link drops unsaved edits: Ở lại keeps them, Rời trang restores the saved form and opens the list", async () => {
    const user = userEvent.setup();
    renderBuilder();
    const back = screen.getByRole("link", { name: "Biểu mẫu Coaching" });
    expect(back).toHaveAttribute("href", "/coaching/forms");
    // Nothing unsaved: the link is not held.
    expect(linkClickIsHeld(back)).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const name = screen.getByRole("textbox", { name: "Tên biểu mẫu" });
    await user.type(name, " (sửa)");
    expect(linkClickIsHeld(back)).toBe(true);
    const dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    await user.click(within(dialog).getByRole("button", { name: "Ở lại" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(name).toHaveValue("Phiếu cuối kỳ (sửa)");
    expect(router.push).not.toHaveBeenCalled();

    expect(linkClickIsHeld(back)).toBe(true);
    await user.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));
    expect(router.push).toHaveBeenCalledWith("/coaching/forms");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Tên biểu mẫu" })).toHaveValue("Phiếu cuối kỳ");
    expect(beforeUnloadIsPrevented()).toBe(false);
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
  });

  // Regression guard: "Rời trang" restores the saved form, which makes it clean; the redirect a
  // new form's first save left pending must not then open the new form instead of the list.
  it("Rời trang on a new form with edits typed during its first save opens the list, not the new form", async () => {
    const user = userEvent.setup();
    const first = deferred<ActionResult>();
    stubs.saveCoachingFormDraft.mockReturnValueOnce(first.promise);
    renderBuilder({ formId: null, formVersionId: null, initialName: "", initialQuestions: [], initialTitle: "", versionNumber: null });

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), "Phiếu tháng 11");
    await user.type(screen.getByRole("textbox", { name: "Tiêu đề hiển thị cho phụ huynh" }), "Phản hồi tháng 11");
    await user.click(saveButton());
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));
    await user.type(screen.getByRole("textbox", { name: "Hướng dẫn" }), " Cảm ơn.");
    await act(async () => {
      first.resolve({ formId: "form-new", message: "Đã lưu bản nháp biểu mẫu.", status: "success" });
    });
    await waitFor(() => expect(saveButton()).toHaveTextContent("Lưu nháp"));

    expect(linkClickIsHeld(screen.getByRole("link", { name: "Biểu mẫu Coaching" }))).toBe(true);
    await user.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));

    expect(router.push).toHaveBeenCalledWith("/coaching/forms");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("points each problem at its own field and drops the banner once every problem is fixed", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        { configuration: { options: ["Có", "Không"] }, description: "", required: true, title: "Con có làm bài?", type: "single_choice" },
        { configuration: { max: 5, min: 1 }, description: "", required: false, title: "Mức tự tin", type: "scale" },
      ],
    });

    await user.click(screen.getByRole("button", { name: named("Thêm lựa chọn", "cho câu 1") }));
    const from = within(card(2)).getByRole("spinbutton", { name: named("Từ", "(câu 2)") });
    await user.clear(from);
    await user.type(from, "7");
    await user.click(saveButton());
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 2 chỗ cần sửa");

    const blankOption = screen.getByRole("textbox", { name: "Lựa chọn 3 của câu 1" });
    expect(blankOption).toHaveAttribute("aria-invalid", "true");
    expect(blankOption).toHaveAccessibleDescription("Lựa chọn không được để trống.");
    expect(screen.getByRole("textbox", { name: "Lựa chọn 1 của câu 1" })).not.toHaveAttribute("aria-invalid");
    // The question text is fine, so it is not described by the option problem.
    expect(titleInput(1)).not.toHaveAttribute("aria-invalid");
    expect(titleInput(1)).not.toHaveAccessibleDescription("Lựa chọn không được để trống.");
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(within(card(2)).getByRole("spinbutton", { name: named("Đến", "(câu 2)") })).toHaveAttribute("aria-invalid", "true");

    await user.type(blankOption, "Chưa xong");
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 1 chỗ cần sửa");
    await user.clear(from);
    await user.type(from, "1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(from).not.toHaveAttribute("aria-invalid");
  });
});

describe("CoachingFormBuilder rejected actions", () => {
  // Value: protects=a server action call that rejects (deploy skew → unrecognised action, offline, a 5xx that is not an action answer) leaves the builder and everything typed on screen with the connection message;
  // fails_when=a rejected save/publish/new-version call reaches the error boundary (the typed form is wiped), or a failed first save still opens a new form's page;
  // why_new=review fix: every action ran in startTransition without try/catch; seam=the injected stubs reject; no_claim=does not prove the real error boundary or Next's action transport
  const rejected = () => Object.assign(new Error('Server Action "x" was not found on the server.'), { name: "UnrecognizedActionError" });

  it("keeps a new form's typed values and stays on the page when Lưu nháp is rejected; a retry still creates one form", async () => {
    const user = userEvent.setup();
    stubs.saveCoachingFormDraft.mockRejectedValueOnce(rejected());
    renderBuilder({ formId: null, formVersionId: null, initialName: "", initialQuestions: [], initialTitle: "", versionNumber: null });

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), "Phiếu tháng 11");
    await user.type(screen.getByRole("textbox", { name: "Tiêu đề hiển thị cho phụ huynh" }), "Phản hồi tháng 11");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(COACHING_CONNECTION_ERROR_MESSAGE);
    expect(screen.getByRole("textbox", { name: "Tên biểu mẫu" })).toHaveValue("Phiếu tháng 11");
    expect(screen.getByRole("textbox", { name: "Tiêu đề hiển thị cho phụ huynh" })).toHaveValue("Phản hồi tháng 11");
    expect(saveButton()).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(beforeUnloadIsPrevented()).toBe(true);

    stubs.saveCoachingFormDraft.mockResolvedValueOnce({ formId: "form-new", message: "Đã lưu bản nháp biểu mẫu.", status: "success" });
    await user.click(saveButton());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/coaching/forms/form-new"));
    expect(stubs.saveCoachingFormDraft.mock.calls.map(([input]) => input.formId)).toEqual([null, null]);
  });

  it("keeps the edits and does not publish when the save before publishing is rejected", async () => {
    const user = userEvent.setup();
    stubs.saveCoachingFormDraft.mockRejectedValue(rejected());
    renderBuilder();

    await user.type(screen.getByRole("textbox", { name: "Tên biểu mẫu" }), " (sửa)");
    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(`Chưa xuất bản: ${COACHING_CONNECTION_ERROR_MESSAGE}`);
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tên biểu mẫu" })).toHaveValue("Phiếu cuối kỳ (sửa)");
    expect(beforeUnloadIsPrevented()).toBe(true);
  });

  it("keeps the form when Xuất bản is rejected", async () => {
    const user = userEvent.setup();
    stubs.publishCoachingForm.mockRejectedValue(new TypeError("Failed to fetch"));
    renderBuilder();

    await user.click(headerPublish());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xuất bản v2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      new RegExp(`^${escapeRegExp(COACHING_CONNECTION_ERROR_MESSAGE)}$`),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titleInput(1)).toHaveValue("Con tên gì?");
    expect(headerPublish()).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps the published version on screen when Tạo bản nháp phiên bản mới is rejected", async () => {
    const user = userEvent.setup();
    stubs.createCoachingFormVersionDraft.mockRejectedValue(rejected());
    renderBuilder({ isDraft: false });

    await user.click(screen.getByRole("button", { name: "Tạo bản nháp phiên bản mới" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(COACHING_CONNECTION_ERROR_MESSAGE);
    expect(screen.getByText("v2 · Đang xuất bản")).toBeInTheDocument();
    expect(titleInput(1)).toHaveValue("Con tên gì?");
    expect(screen.getByRole("button", { name: "Tạo bản nháp phiên bản mới" })).toBeEnabled();
  });
});

describe("CoachingFormBuilder focus after a failed check", () => {
  // Value: protects=a blocked Lưu nháp / Xuất bản moves focus to the first control named, in screen order (form name, display title, then the first flagged question's Nội dung, blank/repeated option or Từ);
  // fails_when=focus stays on the button (keyboard and screen-reader users must hunt for the problem) or lands on a later problem first;
  // why_new=review fix 8c; seam=none; no_claim=does not prove scrolling into view
  it("focuses the form name, then the blank option, then the scale's Từ as each is fixed", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        { configuration: { options: ["Có", "Không"] }, description: "", required: true, title: "Con có làm bài?", type: "single_choice" },
        { configuration: { max: 5, min: 1 }, description: "", required: false, title: "Mức tự tin", type: "scale" },
      ],
    });
    const name = screen.getByRole("textbox", { name: "Tên biểu mẫu" });
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: named("Thêm lựa chọn", "cho câu 1") }));
    const from = within(card(2)).getByRole("spinbutton", { name: named("Từ", "(câu 2)") });
    await user.clear(from);
    await user.type(from, "7");

    await user.click(saveButton());
    expect(name).toHaveFocus();

    await user.type(name, "Phiếu tháng 11");
    await user.click(saveButton());
    expect(screen.getByRole("textbox", { name: "Lựa chọn 3 của câu 1" })).toHaveFocus();

    await user.type(screen.getByRole("textbox", { name: "Lựa chọn 3 của câu 1" }), "Chưa xong");
    await user.click(saveButton());
    expect(from).toHaveFocus();
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
  });

  it("focuses a blank Nội dung before the question's options, and a repeated option when Xuất bản is blocked", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        { configuration: { options: ["Có", "Có"] }, description: "", required: true, title: "Con có làm bài?", type: "single_choice" },
      ],
    });

    await user.click(headerPublish());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Lựa chọn 2 của câu 1" })).toHaveFocus();

    await user.clear(titleInput(1));
    await user.click(saveButton());
    expect(titleInput(1)).toHaveFocus();
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(stubs.publishCoachingForm).not.toHaveBeenCalled();
  });

  // Value: protects=the builder never sends a scale without Từ or Đến; fails_when=getQuestionConfigIssues trusts getScaleRange's 1–5 display fallback again; why_new=review fix 6; seam=none; no_claim=does not prove the database rule
  it("names a scale whose Đến is missing and focuses its Từ, although the preview falls back to 1–5", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [{ configuration: { min: 1 }, description: "", required: false, title: "Mức tự tin", type: "scale" }],
    });
    expect(scaleButtons()).toHaveLength(5);

    await user.click(saveButton());
    expect(stubs.saveCoachingFormDraft).not.toHaveBeenCalled();
    expect(within(card(1)).getByText("Thang điểm cần Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến.")).toBeInTheDocument();
    const from = screen.getByRole("spinbutton", { name: named("Từ", "(câu 1)") });
    const to = screen.getByRole("spinbutton", { name: named("Đến", "(câu 1)") });
    expect(from).toHaveFocus();
    expect(to).toHaveAttribute("aria-invalid", "true");

    await user.type(to, "5");
    expect(to).not.toHaveAttribute("aria-invalid");
    await user.click(saveButton());
    await waitFor(() => expect(stubs.saveCoachingFormDraft).toHaveBeenCalledTimes(1));
    expect(stubs.saveCoachingFormDraft.mock.calls[0]![0].questions[0]!.configuration).toEqual({ max: 5, min: 1 });
  });
});

describe("CoachingFormBuilder limits", () => {
  // Value: protects=the 100-question and 50-option caps (the database limits) disable their add buttons and say why;
  // fails_when=an add button stays enabled at its cap (the draft would be rejected on save) or the reason disappears;
  // why_new=testing review; seam=none; no_claim=does not prove the server-side limits
  it("disables all six Thêm câu hỏi buttons and says why once the 100th question is added", async () => {
    const user = userEvent.setup();
    renderBuilder({ initialQuestions: Array.from({ length: 99 }, (_, index) => shortText(`Câu ${index + 1}`)) });
    expect(within(addGroup()).getAllByRole("button").every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.queryByText(/^Đã đủ 100 câu hỏi/)).not.toBeInTheDocument();

    await user.click(within(addGroup()).getByRole("button", { name: "Số" }));

    expect(cards()).toHaveLength(100);
    const buttons = within(addGroup()).getAllByRole("button");
    expect(buttons).toHaveLength(6);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(screen.getByText("Đã đủ 100 câu hỏi, số câu tối đa của một phiếu.")).toBeInTheDocument();
  });

  it("disables Thêm lựa chọn with its reason once the 50th option is added", async () => {
    const user = userEvent.setup();
    renderBuilder({
      initialQuestions: [
        {
          configuration: { options: Array.from({ length: 49 }, (_, index) => `Lựa chọn ${index + 1}`) },
          description: "",
          required: false,
          title: "Môn học",
          type: "multiple_choice",
        },
      ],
    });
    const add = () => screen.getByRole("button", { name: named("Thêm lựa chọn", "cho câu 1") });
    expect(add()).toBeEnabled();

    await user.click(add());

    expect(screen.getByRole("textbox", { name: "Lựa chọn 50 của câu 1" })).toHaveFocus();
    expect(add()).toBeDisabled();
    expect(add()).toHaveAccessibleDescription("Tối đa 50 lựa chọn.");
  });
});

describe("CoachingFormBuilder page structure", () => {
  it("keeps heading levels in order (h1, the hidden h2 Câu hỏi, the cards' h3) and keeps the list named Câu hỏi", () => {
    renderBuilder({ initialQuestions: [shortText("Câu A"), shortText("Câu B")] });
    const levels = screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, index) => expect(level).toBeLessThanOrEqual(levels[index]! + 1));
    expect(screen.getByRole("heading", { level: 2, name: "Câu hỏi" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Câu hỏi" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("lets the keyboard reach the sticky preview so it can be scrolled", () => {
    renderBuilder();
    expect(preview()).toHaveAttribute("tabindex", "0");
  });

  it("adds one landmark, the preview, however many questions there are", () => {
    renderBuilder({ initialQuestions: Array.from({ length: 5 }, (_, index) => shortText(`Câu hỏi ${index + 1}`)) });
    expect(screen.getAllByRole("region")).toEqual([preview()]);
    expect(cards()).toHaveLength(5);
    // The card's name is its heading only, so "Câu 1" finds exactly one group.
    expect(screen.getAllByRole("group", { name: "Câu 1" })).toHaveLength(1);
    expect(within(card(1)).getByRole("heading", { level: 3, name: "Câu 1" })).toBeInTheDocument();
  });

  it("tells a v2 draft that new links for this form wait until v2 is published", () => {
    renderBuilder();
    expect(
      screen.getByText(
        "v1 đang xuất bản (link đã gửi vẫn nộp được) · trong lúc soạn v2, chưa phát được link mới cho biểu mẫu này · 1 câu hỏi",
      ),
    ).toBeInTheDocument();
  });
});
