// Value: protects=the one question renderer shared by the public Coaching form and the builder's "Phụ huynh sẽ thấy" preview (design 13c): numbered legends, "*" decorative with "(bắt buộc)" for assistive tech, scale buttons named by their bare number with aria-pressed and end labels outside the buttons, real radio/checkbox inputs named by option text, an inert preview that never reports answers, no button wall for an invalid scale, errors linked to their question, unreadable number text reported as a marker rather than blank; plus the client mirrors of the database rules (required/optional answers, 0 as a real answer, number bounds and the invalid-number marker, choice membership, option and scale config issues including a missing bound, payload normalisation);
// fails_when=the preview starts reporting answers or a control in it becomes enabled, a scale with max 1000 renders buttons, scale answers arrive as strings, end labels leak into button names, an error stops being described on its fieldset, an empty optional answer is sent (the server rejects '' and []), 0 is treated as blank, an unreadable number is dropped or sent, a scale without Từ/Đến passes the builder check, or text questions stop normalising to {} (the database requires exactly {});
// why_new=step 11b extracts the public form's questions into one renderer and moves the client-side rules into coaching-question-rules.ts, so the form and the preview cannot drift;
// seam=the renderer is mounted directly with a small stateful harness standing in for the public form; the rule helpers are pure; no_claim=does not prove the database functions themselves (supabase tests) nor 44px targets or the 390px layout (checked visually in /dev/coaching)
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CoachingQuestionRenderer,
  type CoachingRendererQuestion,
} from "@/features/coaching/components/coaching-question-renderer";
import {
  COACHING_INVALID_NUMBER,
  COACHING_REQUIRED_ANSWER_MESSAGE,
  COACHING_UNKNOWN_CHOICE_MESSAGE,
  getQuestionConfigIssues,
  normalizeQuestionConfiguration,
  validatePublicAnswers,
} from "@/features/coaching/forms/coaching-question-rules";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const INVALID_SCALE = "Thang điểm chưa hợp lệ: Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến.";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Accessible name of a required question: "n. title (bắt buộc)". jsdom's name
 * computation trims the leading space of the sr-only span (browsers keep it),
 * so the space is optional here; the "*" must stay out of the name.
 */
function requiredName(numberedTitle: string): RegExp {
  return new RegExp(`^${escapeRegExp(numberedTitle)}\\s*\\(bắt buộc\\)$`);
}

function question(
  fields: Partial<CoachingRendererQuestion> & Pick<CoachingRendererQuestion, "id" | "type">,
): CoachingRendererQuestion {
  return { configuration: {}, description: null, required: false, title: `Câu ${fields.id}`, ...fields };
}

const allTypes: CoachingRendererQuestion[] = [
  question({ id: "short", required: true, title: "Tên con", type: "short_text" }),
  question({ id: "long", title: "Nhận xét", type: "long_text" }),
  question({ configuration: { options: ["Có", "Không"] }, id: "single", title: "Con có làm bài tập?", type: "single_choice" }),
  question({ configuration: { options: ["Toán", "Lý", "Hóa"] }, id: "multi", title: "Môn con thích", type: "multiple_choice" }),
  question({
    configuration: { max: 5, maxLabel: "Rất hiểu bài", min: 1, minLabel: "Chưa hiểu bài" },
    id: "scale",
    required: true,
    title: "Mức độ hiểu bài",
    type: "scale",
  }),
  question({ configuration: { max: 10, min: 0 }, id: "number", title: "Điểm kiểm tra", type: "number" }),
];

/** Holds answers the way the public form does, so controls can be clicked several times in a row. */
function InteractiveHarness({
  onAnswer,
  questions,
}: {
  onAnswer: (questionId: string, value: unknown) => void;
  questions: CoachingRendererQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  return (
    <CoachingQuestionRenderer
      answers={answers}
      idPrefix="public"
      mode="interactive"
      onAnswer={(questionId, value) => {
        onAnswer(questionId, value);
        setAnswers((current) => ({ ...current, [questionId]: value }));
      }}
      questions={questions}
    />
  );
}

describe("CoachingQuestionRenderer, interactive (public form)", () => {
  it("numbers each question and names required ones as 'bắt buộc' for assistive tech, with a decorative star", () => {
    render(<InteractiveHarness onAnswer={vi.fn()} questions={allTypes} />);

    const required = screen.getByRole("group", { name: requiredName("1. Tên con") });
    expect(within(required).getByText("*")).toHaveAttribute("aria-hidden", "true");
    expect(within(required).getByRole("textbox", { name: requiredName("1. Tên con") })).toHaveAttribute(
      "aria-required",
      "true",
    );

    const optional = screen.getByRole("group", { name: "2. Nhận xét" });
    expect(within(optional).queryByText("*")).not.toBeInTheDocument();
    expect(within(optional).getByRole("textbox", { name: "2. Nhận xét" })).not.toHaveAttribute("aria-required");

    expect(screen.getByRole("group", { name: "3. Con có làm bài tập?" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "4. Môn con thích" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: requiredName("5. Mức độ hiểu bài") })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "6. Điểm kiểm tra" })).toBeInTheDocument();
  });

  it("names scale buttons by their bare number, reports a number answer and marks it pressed; end labels sit outside the buttons", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<InteractiveHarness onAnswer={onAnswer} questions={[allTypes[4]!]} />);

    const scale = screen.getByRole("group", { name: requiredName("1. Mức độ hiểu bài") });
    const buttons = within(scale).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    buttons.forEach((button, index) => {
      expect(button).toHaveAccessibleName(String(index + 1));
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button).toHaveAttribute("type", "button");
    });

    await user.click(within(scale).getByRole("button", { name: "4" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("scale", 4);
    expect(within(scale).getByRole("button", { name: "4" })).toHaveAttribute("aria-pressed", "true");
    expect(within(scale).getByRole("button", { name: "3" })).toHaveAttribute("aria-pressed", "false");

    for (const label of ["Chưa hiểu bài", "Rất hiểu bài"]) {
      const text = within(scale).getByText(label);
      expect(text.closest("button")).toBeNull();
    }
  });

  it("uses real radio and checkbox inputs named by option text; multiple choice toggles an array", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<InteractiveHarness onAnswer={onAnswer} questions={[allTypes[2]!, allTypes[3]!]} />);

    const yes = screen.getByRole("radio", { name: "Có" });
    const no = screen.getByRole("radio", { name: "Không" });
    await user.click(yes);
    await user.click(no);
    expect(onAnswer).toHaveBeenNthCalledWith(1, "single", "Có");
    expect(onAnswer).toHaveBeenNthCalledWith(2, "single", "Không");
    expect(no).toBeChecked();
    expect(yes).not.toBeChecked();

    onAnswer.mockClear();
    await user.click(screen.getByRole("checkbox", { name: "Toán" }));
    await user.click(screen.getByRole("checkbox", { name: "Hóa" }));
    await user.click(screen.getByRole("checkbox", { name: "Toán" }));
    expect(onAnswer.mock.calls).toEqual([
      ["multi", ["Toán"]],
      ["multi", ["Toán", "Hóa"]],
      ["multi", ["Hóa"]],
    ]);
    expect(screen.getByRole("checkbox", { name: "Hóa" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Toán" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Lý" })).not.toBeChecked();
  });

  it("reports text and number answers as typed", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<InteractiveHarness onAnswer={onAnswer} questions={[allTypes[0]!, allTypes[5]!]} />);

    await user.type(screen.getByRole("textbox", { name: requiredName("1. Tên con") }), "An");
    expect(onAnswer).toHaveBeenLastCalledWith("short", "An");

    await user.type(screen.getByRole("spinbutton", { name: "2. Điểm kiểm tra" }), "8");
    expect(onAnswer).toHaveBeenLastCalledWith("number", "8");
  });

  // Value: protects=text a type=number input cannot parse ("1,5" on some locales) is reported as the invalid-number marker, not as "" (blank);
  // fails_when=the renderer reports "" for bad input (an optional answer is silently dropped) or writes the marker into the box;
  // why_new=review fix 5; seam=jsdom has no locale parsing, so validity is overridden on the element and the change event is fired by hand; no_claim=does not prove which strings a real browser rejects
  it("reports text the browser cannot read as a number as the invalid-number marker and leaves the box alone", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<InteractiveHarness onAnswer={onAnswer} questions={[allTypes[5]!]} />);
    const input = screen.getByRole("spinbutton", { name: "1. Điểm kiểm tra" });

    await user.type(input, "1");
    expect(onAnswer).toHaveBeenLastCalledWith("number", "1");

    // Typing "," next: the browser keeps the raw text but reports value "" with validity.badInput.
    Object.defineProperty(input, "validity", { configurable: true, value: { badInput: true, valid: false } });
    fireEvent.change(input, { target: { value: "" } });
    expect(onAnswer).toHaveBeenLastCalledWith("number", COACHING_INVALID_NUMBER);
    expect(input).toHaveValue(null);
    expect(input).not.toHaveAttribute("value", COACHING_INVALID_NUMBER);
  });
});

describe("CoachingQuestionRenderer, what onChange never sees", () => {
  // Value: protects=a number box is re-read on blur (React skips onChange while its value stays ""), and one-line boxes label
  // their Enter key "next" (the public form moves focus on Enter; public-coaching-form-validation covers that); fails_when=the
  // blur re-read is dropped, or the hint goes missing / reaches the long answer (where Enter is a new line);
  // why_new=review passes 2 and 3; seam=validity overridden on the element; no_claim=does not prove how a phone keyboard draws the hint
  it("re-reads a number box on blur: unreadable text typed into it, then deleted", () => {
    const onAnswer = vi.fn();
    render(<InteractiveHarness onAnswer={onAnswer} questions={[allTypes[5]!]} />);
    const input = screen.getByRole("spinbutton", { name: "1. Điểm kiểm tra" });

    act(() => input.focus());
    Object.defineProperty(input, "validity", { configurable: true, value: { badInput: true, valid: false } });
    act(() => input.blur());
    expect(onAnswer).toHaveBeenLastCalledWith("number", COACHING_INVALID_NUMBER);

    act(() => input.focus());
    Object.defineProperty(input, "validity", { configurable: true, value: { badInput: false, valid: true } });
    act(() => input.blur());
    expect(onAnswer).toHaveBeenLastCalledWith("number", "");
    expect(onAnswer).toHaveBeenCalledTimes(2);

    // Nothing changed since: blur reports nothing.
    act(() => input.focus());
    act(() => input.blur());
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });

  it("labels the Enter key of one-line boxes \"next\", not the long answer's", () => {
    render(<InteractiveHarness onAnswer={vi.fn()} questions={[allTypes[0]!, allTypes[1]!, allTypes[5]!]} />);
    const short = screen.getByRole("textbox", { name: requiredName("1. Tên con") });
    const long = screen.getByRole("textbox", { name: "2. Nhận xét" });
    const number = screen.getByRole("spinbutton", { name: "3. Điểm kiểm tra" });

    for (const input of [short, number]) expect(input).toHaveAttribute("enterkeyhint", "next");
    expect(long).not.toHaveAttribute("enterkeyhint");
  });
});

describe("CoachingQuestionRenderer, preview (builder)", () => {
  it("disables every control and never reports an answer, even when a change event reaches a disabled control", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <CoachingQuestionRenderer idPrefix="preview" mode="preview" onAnswer={onAnswer} questions={allTypes} />
      </form>,
    );

    const controls = [
      ...screen.getAllByRole("textbox"),
      ...screen.getAllByRole("spinbutton"),
      ...screen.getAllByRole("radio"),
      ...screen.getAllByRole("checkbox"),
      ...screen.getAllByRole("button"),
    ];
    expect(controls).toHaveLength(2 + 1 + 2 + 3 + 5);
    for (const control of controls) expect(control).toBeDisabled();
    expect(screen.getByPlaceholderText("Câu trả lời ngắn")).toBeDisabled();
    expect(screen.getByPlaceholderText("Câu trả lời dài")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("radio", { name: "Có" }));
    await user.click(screen.getByRole("checkbox", { name: "Toán" }));
    await user.type(screen.getByRole("textbox", { name: requiredName("1. Tên con") }), "An");

    // A change event delivered straight to a disabled control still must not reach onAnswer.
    fireEvent.change(screen.getByRole("textbox", { name: "2. Nhận xét" }), { target: { value: "Ghi chú" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "6. Điểm kiểm tra" }), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("radio", { name: "Không" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));

    expect(onAnswer).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Gửi/ })).not.toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });
});

describe("CoachingQuestionRenderer, scale configuration", () => {
  it.each([
    ["max 1000", { max: 1000, min: 1 }],
    ["min equal to max", { max: 5, min: 5 }],
    ["min above max", { max: 2, min: 6 }],
    ["min below 0", { max: 5, min: -1 }],
    ["fractional bound", { max: 5, min: 1.5 }],
  ])("renders the invalid-scale text and no buttons for %s", (_label, configuration) => {
    render(
      <CoachingQuestionRenderer
        idPrefix="public"
        mode="interactive"
        onAnswer={vi.fn()}
        questions={[question({ configuration, id: "scale", type: "scale" })]}
      />,
    );
    expect(screen.getByText(INVALID_SCALE)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders eleven buttons for 0–10 and five for an unset range (1–5)", () => {
    render(
      <CoachingQuestionRenderer
        idPrefix="public"
        mode="interactive"
        onAnswer={vi.fn()}
        questions={[
          question({ configuration: { max: 10, min: 0 }, id: "wide", title: "Rộng", type: "scale" }),
          question({ configuration: {}, id: "unset", title: "Mặc định", type: "scale" }),
        ]}
      />,
    );
    const wide = within(screen.getByRole("group", { name: "1. Rộng" })).getAllByRole("button");
    expect(wide.map((button) => button.textContent)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(within(screen.getByRole("group", { name: "2. Mặc định" })).getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByText(INVALID_SCALE)).not.toBeInTheDocument();
  });
});

describe("CoachingQuestionRenderer, errors", () => {
  it("shows the message under its question, describes the fieldset with it and marks text controls invalid", () => {
    render(
      <CoachingQuestionRenderer
        errors={{ number: "Vui lòng nhập số từ 0 đến 10.", scale: COACHING_REQUIRED_ANSWER_MESSAGE, short: COACHING_REQUIRED_ANSWER_MESSAGE }}
        idPrefix="public"
        mode="interactive"
        onAnswer={vi.fn()}
        questions={[
          { ...allTypes[0]!, description: "Ghi đầy đủ họ tên" },
          allTypes[1]!,
          allTypes[4]!,
          allTypes[5]!,
        ]}
      />,
    );

    const short = screen.getByRole("group", { name: requiredName("1. Tên con") });
    expect(short).toHaveAccessibleDescription(`Ghi đầy đủ họ tên ${COACHING_REQUIRED_ANSWER_MESSAGE}`);
    expect(within(short).getByText(COACHING_REQUIRED_ANSWER_MESSAGE)).toBeInTheDocument();
    const shortInput = within(short).getByRole("textbox");
    expect(shortInput).toHaveAttribute("aria-invalid", "true");
    expect(shortInput).toHaveAccessibleDescription(`Ghi đầy đủ họ tên ${COACHING_REQUIRED_ANSWER_MESSAGE}`);

    const optional = screen.getByRole("group", { name: "2. Nhận xét" });
    expect(optional).not.toHaveAttribute("aria-describedby");
    expect(within(optional).getByRole("textbox")).not.toHaveAttribute("aria-invalid");

    const scale = screen.getByRole("group", { name: requiredName("3. Mức độ hiểu bài") });
    expect(scale).toHaveAccessibleDescription(COACHING_REQUIRED_ANSWER_MESSAGE);

    const number = screen.getByRole("group", { name: "4. Điểm kiểm tra" });
    expect(number).toHaveAccessibleDescription("Vui lòng nhập số từ 0 đến 10.");
    expect(within(number).getByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("validatePublicAnswers", () => {
  const rulesQuestions = [
    { configuration: {}, id: "a", required: true, title: "Tên", type: "short_text" as const },
    { configuration: {}, id: "b", required: false, title: "Nhận xét", type: "long_text" as const },
    { configuration: { options: ["Toán", "Văn"] }, id: "c", required: false, title: "Môn", type: "multiple_choice" as const },
    { configuration: {}, id: "d", required: false, title: "Ghi chú", type: "short_text" as const },
    { configuration: { max: 10, min: 0 }, id: "e", required: false, title: "Điểm", type: "number" as const },
    { configuration: { options: ["Có", "Không"] }, id: "f", required: false, title: "Có đi học?", type: "single_choice" as const },
    { configuration: { max: 5, min: 1 }, id: "g", required: true, title: "Mức độ", type: "scale" as const },
  ];

  it("flags blank required answers, out-of-range numbers and unknown choices; leaves empty optional answers out", () => {
    const result = validatePublicAnswers(rulesQuestions, {
      a: "   ",
      b: "",
      c: [],
      d: undefined,
      e: "11",
      f: "Có thể",
      g: 3,
    });
    expect(result.errors).toEqual({
      a: COACHING_REQUIRED_ANSWER_MESSAGE,
      e: "Vui lòng nhập số từ 0 đến 10.",
      // An optional question with an answer outside its options is not "required": it gets its own message.
      f: COACHING_UNKNOWN_CHOICE_MESSAGE,
    });
    expect(result.payload).toEqual({ g: 3 });
    expect(Object.keys(result.payload)).toEqual(["g"]);
  });

  it("flags a missing required answer given as null or absent, and a number below its minimum or not a number", () => {
    expect(validatePublicAnswers(rulesQuestions, { a: null }).errors).toMatchObject({
      a: COACHING_REQUIRED_ANSWER_MESSAGE,
      g: COACHING_REQUIRED_ANSWER_MESSAGE,
    });
    expect(validatePublicAnswers(rulesQuestions, { a: "An", e: "-1", g: 1 }).errors).toEqual({
      e: "Vui lòng nhập số từ 0 đến 10.",
    });
    expect(validatePublicAnswers(rulesQuestions, { a: "An", e: "abc", g: 1 }).errors).toEqual({
      e: "Vui lòng nhập một số (dùng dấu chấm, ví dụ 1.5).",
    });
  });

  it("passes valid answers through unchanged", () => {
    const answers = { a: "Nguyễn An", b: "Con tiến bộ", c: ["Toán"], e: "7", f: "Có", g: 5 };
    const result = validatePublicAnswers(rulesQuestions, answers);
    expect(result.errors).toEqual({});
    expect(result.payload).toEqual(answers);
  });

  it("treats 0 as a real answer: a required 0–10 scale answered 0 and a number answered \"0\" are sent", () => {
    const zeroQuestions = [
      { configuration: { max: 10, min: 0 }, id: "scale", required: true, title: "Mức độ", type: "scale" as const },
      { configuration: { max: 10, min: 0 }, id: "number", required: true, title: "Điểm", type: "number" as const },
      { configuration: {}, id: "optional", required: false, title: "Số buổi vắng", type: "number" as const },
    ];
    const result = validatePublicAnswers(zeroQuestions, { number: "0", optional: 0, scale: 0 });
    expect(result.errors).toEqual({});
    expect(result.payload).toEqual({ number: "0", optional: 0, scale: 0 });
  });

  it("names the invalid-number marker as not a number, required or optional, and never sends it", () => {
    const numberQuestions = [
      { configuration: {}, id: "required", required: true, title: "Điểm", type: "number" as const },
      { configuration: { max: 10, min: 0 }, id: "optional", required: false, title: "Điểm thêm", type: "number" as const },
    ];
    const result = validatePublicAnswers(numberQuestions, { optional: COACHING_INVALID_NUMBER, required: COACHING_INVALID_NUMBER });
    // The message names the usual cause: "1,5" where the box wants "1.5".
    const notANumber = "Vui lòng nhập một số (dùng dấu chấm, ví dụ 1.5).";
    expect(result.errors).toEqual({ optional: notANumber, required: notANumber });
    expect(result.payload).toEqual({});
  });
});

describe("getQuestionConfigIssues", () => {
  const choice = (options: unknown[], title = "Môn học") => ({
    configuration: { options },
    required: false,
    title,
    type: "single_choice" as const,
  });

  it("names blank, missing, duplicate (after trimming) and too many options", () => {
    expect(getQuestionConfigIssues(choice(["Toán", "  "]))).toEqual(["Lựa chọn không được để trống."]);
    expect(getQuestionConfigIssues(choice(["Toán", " Toán "]))).toEqual(["Các lựa chọn phải khác nhau."]);
    expect(getQuestionConfigIssues(choice([]))).toEqual(["Cần ít nhất một lựa chọn."]);
    expect(getQuestionConfigIssues(choice(Array.from({ length: 51 }, (_, index) => `Lựa chọn ${index + 1}`)))).toEqual([
      "Tối đa 50 lựa chọn.",
    ]);
    expect(getQuestionConfigIssues({ ...choice(["A", ""], " "), type: "multiple_choice" })).toEqual([
      "Cần nhập nội dung câu hỏi.",
      "Lựa chọn không được để trống.",
    ]);
    expect(getQuestionConfigIssues(choice(["Toán", "Văn"]))).toEqual([]);
  });

  it("flags a scale outside 0–10 or with Từ not below Đến, and accepts 0–10", () => {
    const scale = (configuration: Record<string, unknown>) => ({
      configuration,
      required: false,
      title: "Mức độ",
      type: "scale" as const,
    });
    const issue = "Thang điểm cần Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến.";
    expect(getQuestionConfigIssues(scale({ max: 11, min: 0 }))).toEqual([issue]);
    expect(getQuestionConfigIssues(scale({ max: 3, min: 3 }))).toEqual([issue]);
    expect(getQuestionConfigIssues(scale({ max: 5, min: "" }))).toEqual([issue]);
    expect(getQuestionConfigIssues(scale({ max: 10, min: 0 }))).toEqual([]);
  });

  it("flags a scale missing Từ or Đến, although the public renderer shows such a scale as 1–5", () => {
    const scale = (configuration: Record<string, unknown>) => ({
      configuration,
      required: false,
      title: "Mức độ",
      type: "scale" as const,
    });
    const issue = "Thang điểm cần Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến.";
    expect(getQuestionConfigIssues(scale({ max: 5 }))).toEqual([issue]);
    expect(getQuestionConfigIssues(scale({ min: 1 }))).toEqual([issue]);
    expect(getQuestionConfigIssues(scale({}))).toEqual([issue]);
    expect(getQuestionConfigIssues(scale({ max: "5", min: "1" }))).toEqual([]);
  });

  it("does not check the configuration of text questions (it is normalised away)", () => {
    expect(
      getQuestionConfigIssues({ configuration: { options: [""] }, required: true, title: "Tên", type: "short_text" }),
    ).toEqual([]);
  });
});

describe("normalizeQuestionConfiguration", () => {
  it("sends exactly {} for text questions", () => {
    expect(
      normalizeQuestionConfiguration({ configuration: { options: ["cũ"] }, required: false, title: "Tên", type: "short_text" }),
    ).toEqual({});
    expect(
      normalizeQuestionConfiguration({ configuration: { min: 1 }, required: false, title: "Nhận xét", type: "long_text" }),
    ).toEqual({});
  });

  it("trims choice options and keeps other keys", () => {
    expect(
      normalizeQuestionConfiguration({
        configuration: { note: "giữ", options: [" Toán ", "Văn  ", 3] },
        required: false,
        title: "Môn",
        type: "multiple_choice",
      }),
    ).toEqual({ note: "giữ", options: ["Toán", "Văn"] });
  });

  it("turns whole-number scale bounds into numbers and leaves number questions untouched", () => {
    expect(
      normalizeQuestionConfiguration({
        configuration: { max: "8", maxLabel: "Cao", min: "2", minLabel: "Thấp" },
        required: false,
        title: "Mức độ",
        type: "scale",
      }),
    ).toEqual({ max: 8, maxLabel: "Cao", min: 2, minLabel: "Thấp" });
    const numberConfiguration = { max: 10, min: 0 };
    expect(
      normalizeQuestionConfiguration({ configuration: numberConfiguration, required: false, title: "Điểm", type: "number" }),
    ).toBe(numberConfiguration);
  });
});
