import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMMENT_FOOTER,
  DEFAULT_COMMENT_TEMPLATE,
  formatMessageScore,
  NOTEBOOK_NOT_SUBMITTED_TEXT,
  planMessageParts,
  rankLabelForScore,
  renderCommentMessage,
  splitMessageParts,
  ZALO_PART_MAX_CHARS,
} from "@/features/parent-messages/comment-template";

const BANDS = [
  { label: "Tiến bộ ít", minScore: 0 },
  { label: "Tiến bộ vừa", minScore: 5 },
  { label: "Tiến bộ", minScore: 8 },
  { label: "Tiến bộ nhiều", minScore: 9 },
  { label: "Rất tiến bộ", minScore: 10 },
];

const FOOTER_TAIL = `SĐT các thầy cô hỗ trợ:
   Thầy Linh: 077 88878 64
   Thầy Phương: 093 698 4828
   Cô Huyền: 036 356 0088
   Thầy Cô Trực Văn Phòng (18h-22h30 hàng ngày): 086 989 0233

- SĐT phản ánh nếu PH,HS không được hỗ trợ: Thầy Vinh 09666 49198`;

function vars(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    answer_text: "",
    center: "Trung tâm Toán Thầy Vinh",
    class: "8A1 (Lớp 8 nâng cao)",
    comment: "Con làm bài cẩn thận, cần trình bày rõ hơn.",
    date: "17/10/2026",
    grading_contact_phone: "0912 345 678",
    notebook_score: "9",
    rank: "Tiến bộ",
    scores: "",
    solution: "",
    student: "Anh",
    student_full_name: "Nguyễn Minh Anh",
    supervisor_name: "Cô Lan",
    test_score: "8,5",
    time: "18:00-19:30",
    ...overrides,
  };
}

function render(overrides: Record<string, string> = {}): string {
  return renderCommentMessage(DEFAULT_COMMENT_TEMPLATE, DEFAULT_COMMENT_FOOTER, vars(overrides));
}

describe("Zalo comment message rendering", () => {
  // Value: protects=the owner-approved §4.10 layout for an AI-graded session: every section in template order, multi-line answer and solution kept verbatim, footer placeholders filled;
  // fails_when=a section is reordered or dropped while it has data, a value loses its line breaks, the footer is not merged, or a value is trimmed into the label;
  // why_new=phase 2b replaces the one-line template for every session; seam=none; no_claim=does not prove the SQL copy matches (pgTAP asserts the manual-session case byte for byte)
  it("renders every section of the default template when all data is present", () => {
    expect(
      render({
        answer_text: "Câu 1: x = 2\nCâu 2: 15",
        solution: "Câu 1: 2x + 1 = 5 nên x = 2.\nCâu 2: 3 · 5 = 15.",
      }),
    ).toBe(`THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY 17/10/2026

- Tên học sinh: Nguyễn Minh Anh
- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Điểm vở: 9 - Xếp hạng: Tiến bộ

- Bài làm của học sinh:
Câu 1: x = 2
Câu 2: 15

- Bài chữa chi tiết của thầy cô:
Câu 1: 2x + 1 = 5 nên x = 2.
Câu 2: 3 · 5 = 15.

- Nhận xét cho học sinh:
Con làm bài cẩn thận, cần trình bày rõ hơn.

Chủ nhiệm CLB: Thầy Lã Quang Vinh
Trợ giảng Giám thị: Cô Lan
SĐT thắc mắc bài chấm: 0912 345 678
${FOOTER_TAIL}`);
  });

  // Value: protects=a manual-score session (no answer, no solution yet) shows no empty "Bài làm" / "Bài chữa" headings; the same string is asserted in supabase/tests/zalo-comment-message-v2.test.sql;
  // fails_when=a label line survives above its hidden data line, a blank paragraph is left behind, or the TS and SQL renderers drift;
  // why_new=phase 2b "mục trống tự ẩn"; seam=none; no_claim=does not render through the database
  it("hides the answer and solution sections with their labels on a manual session", () => {
    expect(render()).toBe(`THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY 17/10/2026

- Tên học sinh: Nguyễn Minh Anh
- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Điểm vở: 9 - Xếp hạng: Tiến bộ

- Nhận xét cho học sinh:
Con làm bài cẩn thận, cần trình bày rõ hơn.

Chủ nhiệm CLB: Thầy Lã Quang Vinh
Trợ giảng Giám thị: Cô Lan
SĐT thắc mắc bài chấm: 0912 345 678
${FOOTER_TAIL}`);
  });

  // Value: protects=the Kết quả line without a test drops the score and the rank but keeps the notebook score and its "- Kết quả: " label; with nothing left the line goes;
  // fails_when=the leading label is dropped with the first part, a dangling " - " separator remains, or an empty "Kết quả:" line is sent;
  // why_new=phase 2b rule "buổi không có bài kiểm tra thì dòng Kết quả bỏ phần điểm luyện tập và xếp hạng"; seam=none; no_claim=none
  it("drops the score and rank parts of the Kết quả line when there is no test score", () => {
    const noTest = render({ rank: "", test_score: "" });
    expect(noTest).toContain("- Tên học sinh: Nguyễn Minh Anh\n- Kết quả: Điểm vở: 9\n\n- Nhận xét");

    const notebookOnlyMissing = render({ notebook_score: "" });
    expect(notebookOnlyMissing).toContain("- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Xếp hạng: Tiến bộ\n");

    const nothing = render({ notebook_score: "", rank: "", test_score: "" });
    expect(nothing).toContain("- Tên học sinh: Nguyễn Minh Anh\n\n- Nhận xét");
    expect(nothing).not.toContain("Kết quả");
  });

  // Value: protects=a student who did not hand in the notebook gets "Điểm vở: Chưa nộp vở" in the Kết quả line (owner decision 17/10/2026), the same words the SQL vars produce;
  // fails_when=the preview's not-submitted text drifts from session_comment_message_vars or the part is hidden like a pending notebook;
  // why_new=the "Chờ chấm vở" status splits "not graded yet" from "not handed in"; seam=none; no_claim=does not prove the SQL side (notebook-pending-status.test.sql does)
  it("says the notebook was not handed in instead of hiding it", () => {
    expect(render({ notebook_score: NOTEBOOK_NOT_SUBMITTED_TEXT })).toContain(
      "- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Điểm vở: Chưa nộp vở - Xếp hạng: Tiến bộ\n",
    );
  });

  // Value: protects=an empty supervisor block hides only its own footer lines; the club head and the support numbers (a label with static lines) stay;
  // fails_when=a paragraph-level rule hides the whole first footer paragraph, or "SĐT các thầy cô hỗ trợ:" is treated as an empty label;
  // why_new=phase 2b footer placeholders {supervisor_name} / {grading_contact_phone}; seam=none; no_claim=does not cover the send lock (pgTAP does)
  it("hides only the empty supervisor lines of the footer", () => {
    const text = render({ grading_contact_phone: "", supervisor_name: "" });
    expect(text).toContain(`Chủ nhiệm CLB: Thầy Lã Quang Vinh\n${FOOTER_TAIL}`);
    expect(text).not.toContain("Trợ giảng Giám thị");
    expect(text).not.toContain("SĐT thắc mắc bài chấm");
  });

  // Value: protects=values are substituted once and kept apart from template syntax: a comment that quotes "{date}" or contains " - " is sent as typed, unknown placeholders stay literal, and an empty footer leaves no blank tail;
  // fails_when=sequential replace re-substitutes inside a value, the " - " part split runs on values, or an unknown key silently disappears;
  // why_new=phase 2b renderer; seam=none; no_claim=none
  it("substitutes values in one pass and leaves unknown placeholders as typed", () => {
    const text = renderCommentMessage(
      "Ngày {date} - {unknown}\n- Nhận xét:\n{comment}\n\n{footer}",
      "",
      vars({ comment: "Con viết {date} - chưa đúng" }),
    );
    expect(text).toBe("Ngày 17/10/2026 - {unknown}\n- Nhận xét:\nCon viết {date} - chưa đúng");
  });

  // Value: protects=message scores read like the rest of the app (Vietnamese decimal comma, no trailing zeros) and ranks are ranges, so a manual 8,5 is "Tiến bộ";
  // fails_when=8.5 renders as "8.5" or "8,50", 10 loses a zero, or the rank needs an exact band match;
  // why_new=phase 2b ranks via grading_rank_bands (SQL grading_rank_label has the same rule); seam=none; no_claim=does not read the bands table
  it("formats scores and ranks them by range", () => {
    expect([formatMessageScore(8.5), formatMessageScore(10), formatMessageScore(0), formatMessageScore(7.25), formatMessageScore(null)]).toEqual([
      "8,5",
      "10",
      "0",
      "7,25",
      "",
    ]);
    expect([8.5, 4.99, 5, 9.75, 10].map((score) => rankLabelForScore(score, BANDS))).toEqual([
      "Tiến bộ",
      "Tiến bộ ít",
      "Tiến bộ vừa",
      "Tiến bộ nhiều",
      "Rất tiến bộ",
    ]);
    expect(rankLabelForScore(null, BANDS)).toBe("");
  });
});

/** A section of `lines` lines, each `width` characters long. */
function section(label: string, lines: number, width = 90): string {
  return [`- ${label}:`, ...Array.from({ length: lines }, (_, index) => `${String(index + 1).padStart(2, "0")} ${"x".repeat(width - 3)}`)].join("\n");
}

describe("Zalo message splitting", () => {
  // Value: protects=a message within one Zalo message is sent unchanged as a single part;
  // fails_when=short messages gain a "(tiếp theo)" prefix or lose whitespace inside;
  // why_new=phase 2b send splitting; seam=none; no_claim=none
  it("keeps a message of up to 2.000 characters as one part", () => {
    const text = `Đầu\n\n${"a".repeat(ZALO_PART_MAX_CHARS - 5)}`;
    expect(text.length).toBe(ZALO_PART_MAX_CHARS);
    expect(splitMessageParts(text)).toEqual([text]);
  });

  // Value: protects=a long message is cut between sections, in template order, every part (prefix included) ≤ 2.000 characters, parts 2+ start with "(tiếp theo k/n)", and the split is the same on retry;
  // fails_when=a cut lands inside a section that would fit whole, a prefix pushes a part over the limit, the order changes, or two calls disagree (a resumed send would skip or repeat text);
  // why_new=phase 2b "tách 2–3 tin, cắt ở chỗ chuyển mục"; seam=none; no_claim=does not call ZaloCRM
  it("splits at section boundaries with continuation prefixes", () => {
    const head = "THẦY VINH ... NGÀY 17/10/2026\n\n- Tên học sinh: Nguyễn Minh Anh";
    const answer = section("Bài làm của học sinh", 12);
    const solution = section("Bài chữa chi tiết của thầy cô", 12);
    const comment = section("Nhận xét cho học sinh", 5);
    const text = [head, answer, solution, comment].join("\n\n");

    const parts = splitMessageParts(text);
    // head + answer fit; adding the solution would not, so the cut is before "- Bài chữa"; solution + comment fit together.
    expect(parts).toEqual([`${head}\n\n${answer}`, `(tiếp theo 2/2)\n${solution}\n\n${comment}`]);
    expect(parts.every((part) => part.length <= ZALO_PART_MAX_CHARS)).toBe(true);
    expect(splitMessageParts(text)).toEqual(parts);
  });

  // Value: protects=one section longer than a Zalo message is cut at line breaks, its label line stays with the first line under it;
  // fails_when=the section is hard-cut mid-line while line breaks exist, or the label ends one part alone;
  // why_new=phase 2b "mục dài quá 2.000 ký tự thì cắt tiếp theo dòng"; seam=none; no_claim=none
  it("cuts a section longer than one message at line breaks", () => {
    const answer = section("Bài làm của học sinh", 30);
    const parts = splitMessageParts(`Đầu tin\n\n${answer}`);
    expect(parts).toHaveLength(2);
    expect(parts.every((part) => part.length <= ZALO_PART_MAX_CHARS)).toBe(true);
    expect(parts[0]).toMatch(/- Bài làm của học sinh:\n01 x+/);
    expect(parts[0].endsWith("x")).toBe(true);
    expect(parts[1]).toMatch(/^\(tiếp theo 2\/2\)\n\d\d x+/);
    const rejoined = `${parts[0]}\n${parts[1].replace(/^\(tiếp theo 2\/2\)\n/, "")}`;
    expect(rejoined).toBe(`Đầu tin\n\n${answer}`);
  });

  // Value: protects=a message needing more than 3 Zalo messages is blocked with a reason telling the TA to shorten it; 3 parts is still allowed;
  // fails_when=the plan sends 4+ messages, or blocks a 3-part message;
  // why_new=phase 2b "cần hơn 3 tin thì không cho gửi"; seam=none; no_claim=does not prove the database refuses (begin_parent_message_send checks 1..3 in pgTAP)
  it("refuses more than three parts", () => {
    const three = [section("A", 18), section("B", 18), section("C", 18)].join("\n\n");
    expect(planMessageParts(three)).toMatchObject({ ok: true });
    expect(planMessageParts(three).parts).toHaveLength(3);

    const four = [three, section("D", 18)].join("\n\n");
    const plan = planMessageParts(four);
    expect(plan.ok).toBe(false);
    expect(plan.parts).toHaveLength(4);
    expect(plan.ok ? "" : plan.reason).toBe("Tin quá dài: cần 4 tin Zalo (tối đa 3). Rút gọn nội dung trước khi gửi.");
  });

  // Value: protects=when whole sections would need 4 messages but cutting between lines fits 3, the message goes as 3 (sendable) with every line intact, in order;
  // fails_when=a section that fits one message alone is always moved whole to a new part, so a 4.5k message with a long answer and solution is blocked as "cần 4 tin";
  // why_new=found while checking the queue preview: 1.914 + 407 + 1.931 + 357 characters was blocked although 3 messages suffice; seam=none; no_claim=does not choose the cut that reads best, only the fewest parts
  it("cuts between lines when whole sections would need more than three messages", () => {
    const head = section("Kết quả", 3);
    const answer = section("Bài làm của học sinh", 22, 92);
    const solution = section("Bài chữa chi tiết của thầy cô", 20, 92);
    const footer = section("Liên hệ", 4);
    const text = [head, answer, solution, footer].join("\n\n");

    const parts = splitMessageParts(text);
    expect(parts).toHaveLength(3);
    expect(parts.every((part) => part.length <= ZALO_PART_MAX_CHARS)).toBe(true);
    const lines = parts.flatMap((part) => part.replace(/^\(tiếp theo \d\/\d\)\n/, "").split("\n")).filter((line) => line !== "");
    expect(lines).toEqual(text.split("\n").filter((line) => line !== ""));
  });

  // Value: protects=a single line with no line breaks longer than a message is wrapped at a space and re-joins to the original text;
  // fails_when=wrapping drops or duplicates characters at the cut;
  // why_new=phase 2b splitting fallback; seam=none; no_claim=none
  it("wraps a single over-long line at a space", () => {
    const words = Array.from({ length: 500 }, (_, index) => `từ${index}`).join(" ");
    const parts = splitMessageParts(words);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= ZALO_PART_MAX_CHARS)).toBe(true);
    const rejoined = parts.map((part) => part.replace(/^\(tiếp theo \d\/\d\)\n/, "")).join(" ");
    expect(rejoined).toBe(words);
  });
});
