/**
 * End-of-session Zalo comment message (AI grading plan §4.10).
 *
 * `renderCommentMessage` is the TypeScript copy of `render_comment_message`
 * (supabase/migrations/20261017090000_zalo_comment_message_v2.sql): the
 * database renders queued messages, this copy powers the settings preview.
 * `splitMessageParts` only exists here: the send action and the queue editor
 * split the stored text into Zalo messages at send time. Pure module, safe for
 * client components.
 */

/** Zalo / ZaloCRM limit for one message. */
export const ZALO_PART_MAX_CHARS = 2000;
/** More parts than this blocks sending (the TA shortens the text). */
export const ZALO_MAX_PARTS = 3;
/** parent_messages.content limit. */
export const PARENT_MESSAGE_MAX_CHARS = 6000;
export const COMMENT_TEMPLATE_MAX_CHARS = 3000;
export const COMMENT_FOOTER_MAX_CHARS = 1500;

export const DEFAULT_COMMENT_TEMPLATE = `THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY {date}

- Tên học sinh: {student_full_name}
- Kết quả: Điểm luyện tập cuối buổi: {test_score} - Điểm vở: {notebook_score} - Xếp hạng: {rank}

- Bài làm của học sinh:
{answer_text}

- Bài chữa chi tiết của thầy cô:
{solution}

- Nhận xét cho học sinh:
{comment}

{footer}`;

export const DEFAULT_COMMENT_FOOTER = `Chủ nhiệm CLB: Thầy Lã Quang Vinh
Trợ giảng Giám thị: {supervisor_name}
SĐT thắc mắc bài chấm: {grading_contact_phone}
SĐT các thầy cô hỗ trợ:
   Thầy Linh: 077 88878 64
   Thầy Phương: 093 698 4828
   Cô Huyền: 036 356 0088
   Thầy Cô Trực Văn Phòng (18h-22h30 hàng ngày): 086 989 0233

- SĐT phản ánh nếu PH,HS không được hỗ trợ: Thầy Vinh 09666 49198`;

/** Placeholders the comment template understands, in the order the settings help lists them. */
export const COMMENT_TEMPLATE_VARIABLES = [
  { key: "date", label: "Ngày buổi học (17/10/2026)" },
  { key: "student_full_name", label: "Họ tên đầy đủ" },
  { key: "student", label: "Tên gọi (biệt danh, nếu không có thì họ tên)" },
  { key: "class", label: "Mã và tên lớp" },
  { key: "time", label: "Giờ học" },
  { key: "test_score", label: "Điểm luyện tập cuối buổi" },
  { key: "notebook_score", label: "Điểm vở" },
  { key: "rank", label: "Xếp hạng theo thang điểm" },
  { key: "answer_text", label: "Bài làm của học sinh (chấm AI, sắp có)" },
  { key: "solution", label: "Lời giải cả đề (chấm AI, sắp có)" },
  { key: "comment", label: "Nhận xét" },
  { key: "center", label: "Tên trung tâm" },
  { key: "footer", label: "Thông tin cuối" },
  { key: "supervisor_name", label: "Trợ giảng giám thị (trong thông tin cuối)" },
  { key: "grading_contact_phone", label: "SĐT thắc mắc bài chấm (trong thông tin cuối)" },
] as const;

export type CommentMessageVars = Record<string, string>;

export interface RankBand {
  label: string;
  minScore: number;
}

const PLACEHOLDER = /\{([a-z_]+)\}/g;
const LEAD_LABEL = /^([^{}:]*:[ \t]*)/;
const BLANK_LINES = /\n(?:[ \t]*\n)+/;

function trimMessage(value: string): string {
  return value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
}

function hasVar(vars: CommentMessageVars, key: string): boolean {
  return Object.hasOwn(vars, key);
}

/** 0 = no known placeholder, 1 = at least one has a value, 2 = every known placeholder is empty. */
function placeholderState(text: string, vars: CommentMessageVars): 0 | 1 | 2 {
  let known = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const key = match[1];
    if (!hasVar(vars, key)) continue;
    known += 1;
    if (trimMessage(vars[key] ?? "") !== "") return 1;
  }
  return known === 0 ? 0 : 2;
}

/** One pass: a value containing "{...}" is never substituted again. Unknown placeholders stay as typed. */
function fill(text: string, vars: CommentMessageVars): string {
  return text.replace(PLACEHOLDER, (whole, key: string) => (hasVar(vars, key) ? trimMessage(vars[key] ?? "") : whole));
}

function isLabelLine(line: string, state: 0 | 1 | 2): boolean {
  return state === 0 && line.replace(/[ \t]+$/, "").endsWith(":");
}

/**
 * Renders the template with empty sections hidden together with their labels:
 * 1. a line whose placeholders are all empty is hidden;
 * 2. a label line (no placeholder, ends with ":") is hidden when the lines under
 *    it (up to the next label line or the end of the paragraph) hold data and
 *    were all hidden;
 * 3. in a kept line, after its leading label ("- Kết quả: "), a " - " separated
 *    part whose placeholders are all empty is hidden;
 * 4. a paragraph with no line left is hidden.
 * `{footer}` is replaced by the footer text first, so its placeholders follow the same rules.
 */
export function renderCommentMessage(template: string, footer: string, vars: CommentMessageVars): string {
  const known: CommentMessageVars = { ...vars };
  delete known.footer;
  const source = template.replace(/\r\n/g, "\n").split("{footer}").join(trimMessage(footer.replace(/\r\n/g, "\n")));
  const blocks: string[] = [];

  for (const block of source.split(BLANK_LINES)) {
    if (block.replace(/^[ \t\n]+|[ \t\n]+$/g, "") === "") continue;
    const lines = block.split("\n");
    const states = lines.map((line) => placeholderState(line, known));
    const keep = states.map((state) => state !== 2);
    const labels = lines.map((line, index) => isLabelLine(line, states[index]));

    labels.forEach((isLabel, index) => {
      if (!isLabel) return;
      let hasData = false;
      let anyKept = false;
      for (let next = index + 1; next < lines.length && !labels[next]; next += 1) {
        hasData ||= states[next] !== 0;
        anyKept ||= keep[next];
      }
      if (hasData && !anyKept) keep[index] = false;
    });

    const out: string[] = [];
    lines.forEach((line, index) => {
      if (!keep[index]) return;
      if (states[index] === 0) {
        out.push(line);
        return;
      }
      const lead = LEAD_LABEL.exec(line)?.[1] ?? "";
      const parts = line
        .slice(lead.length)
        .split(" - ")
        .filter((part) => placeholderState(part, known) !== 2)
        .map((part) => fill(part, known));
      out.push(lead + parts.join(" - "));
    });
    if (out.length > 0) blocks.push(out.join("\n"));
  }

  const joined = blocks.join("\n\n").replace(/[ \t]+(\n|$)/g, "$1");
  return trimMessage(trimMessage(joined).slice(0, PARENT_MESSAGE_MAX_CHARS));
}

/** Mirrors format_message_score: 8.5 → "8,5", 9 → "9", none → "". */
export function formatMessageScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "";
  if (Number.isInteger(score)) return String(score);
  return String(Number(score.toFixed(2))).replace(".", ",");
}

/** Mirrors grading_rank_label: the band with the largest min score not above the score (8,5 → band 8). */
export function rankLabelForScore(score: number | null | undefined, bands: readonly RankBand[]): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "";
  let best: RankBand | null = null;
  for (const band of bands) {
    if (band.minScore <= score && (best === null || band.minScore > best.minScore)) best = band;
  }
  return best?.label ?? "";
}

export function continuationPrefix(index: number, total: number): string {
  return `(tiếp theo ${index}/${total})`;
}

/** Room for "(tiếp theo NN/NN)\n" so every part, prefix included, stays within the limit. */
function partBudget(maxChars: number): number {
  return maxChars - continuationPrefix(99, 99).length - 1;
}

interface SplitUnit {
  /** Joins this unit to the previous one when both land in the same part. */
  separator: string;
  text: string;
}

/** Cuts one over-long line at the last space before the budget (or hard, when there is none). */
function wrapLine(line: string, budget: number): string[] {
  const pieces: string[] = [];
  let rest = line;
  while (rest.length > budget) {
    const space = rest.lastIndexOf(" ", budget);
    const cut = space > budget / 2 ? space : budget;
    pieces.push(rest.slice(0, cut));
    rest = rest.slice(space > budget / 2 ? cut + 1 : cut);
  }
  pieces.push(rest);
  return pieces;
}

/**
 * `sections`: a paragraph that fits in one message stays whole (cuts land between sections).
 * `lines`: every paragraph may be cut between lines (used only when whole sections need too many messages).
 */
function splitUnits(text: string, budget: number, mode: "lines" | "sections"): SplitUnit[] {
  const units: SplitUnit[] = [];
  text.split(BLANK_LINES).forEach((block, blockIndex) => {
    const blockSeparator = blockIndex === 0 ? "" : "\n\n";
    if (mode === "sections" && block.length <= budget) {
      units.push({ separator: blockSeparator, text: block });
      return;
    }
    // Cut between lines, keeping a label line with the line under it.
    const lines = block.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const separator = index === 0 ? blockSeparator : "\n";
      const line = lines[index];
      const next = lines[index + 1];
      if (next !== undefined && line.trimEnd().endsWith(":") && line.length + 1 + next.length <= budget) {
        units.push({ separator, text: `${line}\n${next}` });
        index += 1;
        continue;
      }
      wrapLine(line, budget).forEach((piece, pieceIndex) => {
        units.push({ separator: pieceIndex === 0 ? separator : " ", text: piece });
      });
    }
  });
  return units;
}

function packUnits(units: readonly SplitUnit[], budget: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current === "") {
      current = unit.text;
      continue;
    }
    const joined = current + unit.separator + unit.text;
    if (joined.length <= budget) {
      current = joined;
    } else {
      chunks.push(current);
      current = unit.text;
    }
  }
  if (current !== "") chunks.push(current);
  return chunks.map((chunk) => chunk.replace(/^\n+|\n+$/g, "")).filter((chunk) => chunk.trim() !== "");
}

/**
 * Splits a stored message into Zalo messages of at most `maxChars`. Cuts land
 * between sections (paragraphs), and between lines inside a section longer
 * than one message. Only when whole sections would need more than
 * ZALO_MAX_PARTS messages are sections also cut between lines to fit. Parts 2+
 * start with "(tiếp theo k/n)". Deterministic, so a retry resumes on the same parts.
 */
export function splitMessageParts(content: string, maxChars = ZALO_PART_MAX_CHARS): string[] {
  const text = trimMessage(content.replace(/\r\n/g, "\n"));
  if (text.length <= maxChars) return [text];

  const budget = partBudget(maxChars);
  let chunks = packUnits(splitUnits(text, budget, "sections"), budget);
  if (chunks.length > ZALO_MAX_PARTS) {
    const byLines = packUnits(splitUnits(text, budget, "lines"), budget);
    if (byLines.length < chunks.length) chunks = byLines;
  }
  return chunks.map((chunk, index) => (index === 0 ? chunk : `${continuationPrefix(index + 1, chunks.length)}\n${chunk}`));
}

export type MessagePartsPlan =
  | { ok: true; parts: string[] }
  | { ok: false; parts: string[]; reason: string };

/** Parts plus the "too long" block the queue shows (more than ZALO_MAX_PARTS messages). */
export function planMessageParts(content: string): MessagePartsPlan {
  const parts = splitMessageParts(content);
  if (parts.length > ZALO_MAX_PARTS) {
    return {
      ok: false,
      parts,
      reason: `Tin quá dài: cần ${parts.length} tin Zalo (tối đa ${ZALO_MAX_PARTS}). Rút gọn nội dung trước khi gửi.`,
    };
  }
  return { ok: true, parts };
}
