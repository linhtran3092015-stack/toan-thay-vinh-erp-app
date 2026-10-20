// @ts-check
// Pure helpers for scripts/ai-grading-eval.mjs (Phase 0 of the AI grading plan,
// docs/AI_GRADING_INTEGRATION_PLAN_2026-10-16.md). No network and no SDK runtime
// here, so unit tests import this file directly. The request builders are typed
// against @anthropic-ai/sdk so `npm run typecheck` catches request-shape drift.
import { createHash } from "node:crypto";

import { GRADER_INSTRUCTIONS, KEY_INSTRUCTIONS } from "./prompts.mjs";

/** @typedef {import("@anthropic-ai/sdk").Anthropic.MessageCreateParamsNonStreaming} MessageCreateParamsNonStreaming */
/** @typedef {import("@anthropic-ai/sdk").Anthropic.Beta.Messages.MessageCreateParamsNonStreaming} BetaMessageCreateParams */
/** @typedef {import("@anthropic-ai/sdk").Anthropic.Messages.MessageBatchIndividualResponse} MessageBatchIndividualResponse */

/** @typedef {"low" | "medium" | "high"} Effort */
/** @typedef {{ id: string, model: string, effort: Effort, maxTokens: number }} GradeConfig */
/** @typedef {"correct" | "incorrect" | "missing"} Verdict */
/**
 * @typedef {{
 *   label: string,
 *   prompt_text: string,
 *   max_points: number,
 *   final_answer: string,
 *   accepted_equivalents?: string[],
 *   solution_steps?: string[],
 * }} KeyQuestion
 */
/** @typedef {{ test_id: string, title?: string, confirmed?: boolean, version?: number, questions: KeyQuestion[] }} AnswerKey */
/**
 * @typedef {{
 *   submission_id: string,
 *   test_id: string,
 *   answer_text: string,
 *   ta_score: number,
 *   bonus: boolean | null,
 *   submitted_on: string | null,
 * }} PreparedSubmission
 */
/**
 * @typedef {{
 *   input_tokens: number,
 *   output_tokens: number,
 *   cache_read_input_tokens?: number | null,
 *   cache_creation_input_tokens?: number | null,
 * }} TokenUsage
 */
/**
 * @typedef {{
 *   custom_id: string,
 *   status: string,
 *   model?: string,
 *   stop_reason?: string | null,
 *   text?: string,
 *   usage?: TokenUsage,
 *   error?: string | null,
 * }} BatchResultSummary
 */
/**
 * @typedef {{ ok: true, verdicts: Record<string, Verdict>, questions: any[], flags: string[], confidence: string }
 *   | { ok: false, error: string, detail?: string }} ParsedRun
 */

export const PROMPT_VERSION = "grade-v2";
export const KEY_PROMPT_VERSION = "key-v1";

export const MODELS = Object.freeze({
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
});

/**
 * USD per million tokens, standard API (Haiku 5.5: prompts up to 100K tokens).
 * @type {Readonly<Record<string, { input: number, output: number, cacheRead: number, cacheWrite: number }>>}
 */
export const PRICES_PER_MTOK = Object.freeze({
  [MODELS.haiku]: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  [MODELS.sonnet]: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  [MODELS.opus]: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
});
export const BATCH_DISCOUNT = 0.5;
export const MONTHLY_PAPERS = 3833; // August 2026 volume

/** @type {readonly GradeConfig[]} */
export const GRADE_CONFIGS = Object.freeze([
  { id: "haiku-low", model: MODELS.haiku, effort: "low", maxTokens: 16000 },
  { id: "haiku-medium", model: MODELS.haiku, effort: "medium", maxTokens: 16000 },
  { id: "haiku-high", model: MODELS.haiku, effort: "high", maxTokens: 32000 },
  { id: "sonnet-medium", model: MODELS.sonnet, effort: "medium", maxTokens: 16000 },
  { id: "sonnet-high", model: MODELS.sonnet, effort: "high", maxTokens: 32000 },
]);
export const DEFAULT_RUNS = 2;
/** Rough output tokens per grading call (thinking included), used only for estimates. */
export const OUTPUT_TOKEN_GUESS = Object.freeze({ low: 2000, medium: 3000, high: 8000 });

export const GRADE_FLAGS = Object.freeze([
  "empty",
  "off_topic",
  "wrong_test",
  "ambiguous_notation",
  "contains_instructions",
]);
const VERDICTS = Object.freeze(["correct", "incorrect", "missing"]);
const CONFIDENCE = Object.freeze(["high", "medium", "low"]);

/** Owner decision 2026-10-17: final score after bonus → label. Highest band first. */
export const DEFAULT_RANK_BANDS = Object.freeze([
  { min: 10, label: "Rất tiến bộ" },
  { min: 9, label: "Tiến bộ nhiều" },
  { min: 8, label: "Tiến bộ" },
  { min: 5, label: "Tiến bộ vừa" },
  { min: 0, label: "Tiến bộ ít" },
]);

/** Phase 0 pass bars (plan §6). */
export const CRITERIA = Object.freeze({ exactRate: 0.9, within1Rate: 0.98, greenOffBy2: 0 });

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** @param {string} ch */
function foldChar(ch) {
  return ch
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

/** Lowercase, strip Vietnamese diacritics (đ → d), collapse whitespace. */
export function fold(/** @type {unknown} */ value) {
  return foldChar(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Same as fold() per character but keeps the UTF-16 length, so match indexes map back. */
function foldKeepingLength(/** @type {string} */ text) {
  let out = "";
  for (const ch of text) {
    const folded = foldChar(ch);
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

export function slug(/** @type {unknown} */ value) {
  return fold(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {string} text */
function detectDelimiter(text) {
  let inQuotes = false;
  /** @type {Record<string, number>} */
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  const [best, seen] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return seen > 0 ? best : ",";
}

/**
 * RFC 4180 CSV (Google Sheets export): quoted fields may hold newlines and "".
 * @param {string} text
 * @param {string} [delimiter] auto-detected from the header line when omitted
 * @returns {string[][]}
 */
export function parseCsv(text, delimiter) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delim = delimiter ?? detectDelimiter(src);
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** @param {Array<Array<unknown>>} rows */
export function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? "" : String(value);
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\r\n");
}

// ---------------------------------------------------------------------------
// Scores (owner decisions 2026-10-17, plan §4.5)
// ---------------------------------------------------------------------------

/** Below .5 rounds down, .5 and above rounds up (7.5 → 8, 7.25 → 7). */
export function roundHalfUp(/** @type {number} */ value) {
  return Math.floor(value + 0.5 + 1e-9);
}

/**
 * Each question is all or nothing.
 * @param {AnswerKey} key
 * @param {Record<string, Verdict>} verdicts
 */
export function rawScore(key, verdicts) {
  return key.questions.reduce((sum, q) => sum + (verdicts[q.label] === "correct" ? q.max_points : 0), 0);
}

/** Round first, then +1 bonus, capped at 10. */
export function finalScore(/** @type {number} */ raw, /** @type {boolean} */ bonus) {
  return Math.min(10, roundHalfUp(raw) + (bonus ? 1 : 0));
}

export function rankLabel(/** @type {number} */ score, bands = DEFAULT_RANK_BANDS) {
  const band = bands.find((b) => score >= b.min - 1e-9);
  return band ? band.label : bands[bands.length - 1].label;
}

/** "7,5", "8đ", "8 điểm", "9/10" → number in [0, 10]; anything else → null. */
export function parseScore(/** @type {unknown} */ value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
  const text = fold(value).replace(",", ".").replace(/\s*\/\s*10$/, "").replace(/[a-z\s]+$/, "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const score = Number(text);
  return score >= 0 && score <= 10 ? score : null;
}

/** Tick-like cells → true, empty/"không" → false, anything else → null (unknown). */
export function parseBonus(/** @type {unknown} */ value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const text = fold(value);
  if (["x", "co", "yes", "true", "1", "+1", "v", "✓", "✔", "tick"].includes(text)) return true;
  if (["", "0", "khong", "no", "false", "-"].includes(text)) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Privacy: nothing that identifies a student leaves `prepare`
// ---------------------------------------------------------------------------

const PHONE_PATTERN = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g;

/**
 * Replace phone numbers and multi-word names in a typed answer. Single-word names
 * are left alone on purpose: "Bằng" is also "=" in Vietnamese maths.
 * @param {string} text
 * @param {string[]} names
 */
export function scrubPersonalInfo(text, names = []) {
  let out = String(text ?? "").normalize("NFC");
  let replaced = 0;
  out = out.replace(PHONE_PATTERN, () => {
    replaced += 1;
    return "[SĐT]";
  });
  const candidates = new Set();
  for (const name of names) {
    const words = fold(name).split(" ").filter(Boolean);
    if (words.length >= 2) {
      candidates.add(words.join(" "));
      candidates.add(words.slice(-2).join(" "));
    }
  }
  for (const candidate of [...candidates].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(candidate).replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`,
      "gu",
    );
    const matches = [...foldKeepingLength(out).matchAll(pattern)].reverse();
    for (const match of matches) {
      const start = match.index ?? 0;
      out = `${out.slice(0, start)}[TÊN]${out.slice(start + match[0].length)}`;
      replaced += 1;
    }
  }
  return { text: out, replaced };
}

// ---------------------------------------------------------------------------
// prepare: sheet rows → anonymised submissions
// ---------------------------------------------------------------------------

/**
 * Header aliases after fold(). "=x" matches only the whole header.
 * Order matters: specific fields claim their column before generic ones.
 */
const COLUMN_ALIASES = Object.freeze({
  testId: ["test_id", "ma de", "=de"],
  bonus: ["diem cong", "cong diem", "tich cuc tuong tac", "=khen", "bonus", "praise"],
  phone: ["sdt phu huynh", "sdt cua bo", "so dien thoai phu huynh", "so dien thoai", "=sdt", "phone"],
  givenName: ["=ten", "=ten hs", "=ten goi", "given_name"],
  fullName: ["ho va ten", "ho ten", "full_name"],
  birthYear: ["nam sinh", "birth_year"],
  classOption: ["lop hom nay", "=lop", "class_option"],
  timestamp: ["dau thoi gian", "timestamp", "thoi gian nop", "thoi diem nop", "=thoi gian", "submitted_at", "ngay nop"],
  // The center's sheet: "Bài thi đầu ra học sinh" (Data tab), "Bài thi đầu ra của HS" (grade tabs).
  answer: ["bai lam", "bai thi", "answer_text", "noi dung bai lam", "=answer"],
  score: [
    "=diem",
    "=diem thi",
    "diem tro giang",
    "diem bai kiem tra",
    "diem kiem tra",
    "diem luyen tap",
    "ta_score",
    "test_score",
    "diem cham",
    "=score",
  ],
});

/** @typedef {keyof typeof COLUMN_ALIASES} ColumnField */

/**
 * @param {string[]} header
 * @param {Partial<Record<ColumnField, string>>} [overrides] field → exact header text
 * @returns {Partial<Record<ColumnField, number>>}
 */
export function findColumns(header, overrides = {}) {
  const folded = header.map((h) => fold(h));
  /** @type {Partial<Record<ColumnField, number>>} */
  const found = {};
  const used = new Set();
  for (const [field, headerText] of Object.entries(overrides)) {
    const index = folded.indexOf(fold(headerText));
    if (index < 0) throw new Error(`Không thấy cột "${headerText}" (cho ${field}).`);
    found[/** @type {ColumnField} */ (field)] = index;
    used.add(index);
  }
  const fields = /** @type {ColumnField[]} */ (Object.keys(COLUMN_ALIASES));
  for (const mode of ["exact", "prefix", "includes"]) {
    for (const field of fields) {
      if (found[field] !== undefined) continue;
      for (const alias of COLUMN_ALIASES[field]) {
        const exactOnly = alias.startsWith("=");
        const text = exactOnly ? alias.slice(1) : alias;
        if (exactOnly && mode !== "exact") continue;
        const index = folded.findIndex(
          (h, i) =>
            !used.has(i) &&
            (mode === "exact" ? h === text : mode === "prefix" ? h.startsWith(text) : h.includes(text)),
        );
        if (index >= 0) {
          found[field] = index;
          used.add(index);
          break;
        }
      }
    }
  }
  return found;
}

/** @param {unknown} value */
function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** @param {number} n */
const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Sheet timestamps → local wall-clock date. xlsx dates come back as UTC-encoded
 * wall time; strings are "dd/mm/yyyy hh:mm:ss" (VN locale) unless dateOrder is "mdy".
 * @param {unknown} value
 * @param {"dmy" | "mdy"} [dateOrder]
 * @returns {{ date: string, sortKey: number } | null}
 */
export function parseTimestamp(value, dateOrder = "dmy") {
  /** @param {number} y @param {number} m @param {number} d @param {number} [hh] @param {number} [mm] @param {number} [ss] */
  const make = (y, m, d, hh = 0, mm = 0, ss = 0) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { date: `${y}-${pad2(m)}-${pad2(d)}`, sortKey: Date.UTC(y, m - 1, d, hh, mm, ss) };
  };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return make(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    );
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    return parseTimestamp(new Date(Math.round((value - 25569) * 86400000)), dateOrder);
  }
  const text = String(value ?? "").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, y, m, d, hh, mm, ss] = match;
    return make(Number(y), Number(m), Number(d), Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0));
  }
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, a, b, y, hh, mm, ss] = match;
    let day = Number(a);
    let month = Number(b);
    if (dateOrder === "mdy" ? day <= 12 || month > 12 : day <= 12 && month > 12) [day, month] = [month, day];
    return make(Number(y), month, day, Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0));
  }
  return null;
}

/** @param {string} text */
function sha256Hex(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Answer cells the grade tabs fill in when there is nothing to grade. */
const PLACEHOLDER_ANSWERS = ["da lam tren lop", "chua co du lieu bai lam"];

/**
 * Keep only what grading needs. A student's later submission for the same test
 * replaces the earlier one (owner decision: the last submission counts).
 * Without a test-id column a test is the submission date plus the birth year:
 * each grade sits one test per session, and students often pick the wrong
 * class option (A/B/CLC), so the class only names the test when there is no
 * birth year.
 * @param {Array<Array<unknown>>} rows first row is the header
 * @param {{
 *   salt: string,
 *   overrides?: Partial<Record<ColumnField, string>>,
 *   aliases?: Record<string, string>,
 *   dateOrder?: "dmy" | "mdy",
 * }} options
 */
export function prepareRows(rows, options) {
  if (rows.length < 2) throw new Error("File không có dòng dữ liệu nào.");
  const [header, ...body] = rows;
  const columns = findColumns(
    header.map((h) => cellText(h)),
    options.overrides,
  );
  if (columns.answer === undefined) throw new Error('Không thấy cột bài làm. Dùng --col answer="<tên cột>".');
  if (columns.score === undefined) throw new Error('Không thấy cột điểm trợ giảng. Dùng --col score="<tên cột>".');
  const dropped = { empty_answer: 0, placeholder_answer: 0, missing_score: 0, invalid_score: 0, missing_test: 0, superseded: 0 };
  /** @type {Map<string, PreparedSubmission & { order: number }>} */
  const latest = new Map();
  let scrubbedRows = 0;
  /** @param {ColumnField} field @param {unknown[]} row */
  const read = (field, row) => (columns[field] === undefined ? "" : cellText(row[/** @type {number} */ (columns[field])]));

  body.forEach((row, index) => {
    const answer = read("answer", row).trim();
    if (!answer) return void (dropped.empty_answer += 1);
    if (PLACEHOLDER_ANSWERS.includes(fold(answer).replace(/[.!]+$/, ""))) return void (dropped.placeholder_answer += 1);
    const scoreCell = row[/** @type {number} */ (columns.score)];
    if (cellText(scoreCell).trim() === "") return void (dropped.missing_score += 1);
    const taScore = parseScore(scoreCell);
    if (taScore === null) return void (dropped.invalid_score += 1);
    const when =
      columns.timestamp === undefined ? null : parseTimestamp(row[columns.timestamp], options.dateOrder);
    let testId = slug(read("testId", row));
    if (!testId) {
      if (!when) return void (dropped.missing_test += 1);
      const birthYear = read("birthYear", row).trim();
      const classSlug = slug(read("classOption", row));
      testId = /^\d{4}$/.test(birthYear)
        ? `${when.date}_sinh-${birthYear}`
        : classSlug
          ? `${when.date}_${classSlug}`
          : when.date;
    }
    testId = options.aliases?.[testId] ?? testId;
    const fullName = read("fullName", row);
    const givenName = read("givenName", row);
    const studentKey = `${fold(fullName || givenName)}|${read("birthYear", row).trim()}`;
    const scrub = scrubPersonalInfo(answer, [fullName, givenName]);
    if (scrub.replaced > 0) scrubbedRows += 1;
    const entry = {
      submission_id: `sub_${sha256Hex(`${options.salt}|${studentKey}|${testId}|${index}`).slice(0, 12)}`,
      test_id: testId,
      answer_text: scrub.text,
      ta_score: taScore,
      bonus: columns.bonus === undefined ? null : parseBonus(row[columns.bonus]),
      submitted_on: when?.date ?? null,
      order: when?.sortKey ?? index,
    };
    const dedupeKey = studentKey === "|" ? `row:${index}` : `${studentKey}|${testId}`;
    const previous = latest.get(dedupeKey);
    if (previous) dropped.superseded += 1;
    if (!previous || entry.order >= previous.order) latest.set(dedupeKey, entry);
  });

  const submissions = [...latest.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rest }) => rest);
  /** @type {Record<string, number>} */
  const perTest = {};
  for (const s of submissions) perTest[s.test_id] = (perTest[s.test_id] ?? 0) + 1;
  /** @type {Record<string, string>} */
  const detected = {};
  for (const [field, index] of Object.entries(columns)) detected[field] = cellText(header[/** @type {number} */ (index)]);
  return {
    submissions,
    stats: { rows: body.length, kept: submissions.length, dropped, scrubbed_rows: scrubbedRows, per_test: perTest, columns: detected },
  };
}

// ---------------------------------------------------------------------------
// Answer keys
// ---------------------------------------------------------------------------

/** @param {number} n */
const viNumber = (n) => String(n).replace(".", ",");

/**
 * @param {AnswerKey} key
 * @returns {string[]} problems; empty when the key can be used for grading
 */
export function validateKey(key) {
  const problems = [];
  if (key?.confirmed !== true) problems.push('Đáp án chưa chốt: cần "confirmed": true sau khi người đã kiểm tra.');
  const questions = Array.isArray(key?.questions) ? key.questions : [];
  if (questions.length === 0) problems.push("Đáp án không có câu nào.");
  const labels = new Set();
  for (const q of questions) {
    if (!q?.label || typeof q.label !== "string") problems.push("Có câu thiếu nhãn (label).");
    else if (labels.has(q.label)) problems.push(`Nhãn câu bị trùng: ${q.label}.`);
    else labels.add(q.label);
    if (typeof q?.max_points !== "number" || !(q.max_points > 0)) problems.push(`Câu ${q?.label}: max_points phải là số > 0.`);
    if (typeof q?.final_answer !== "string" || q.final_answer.trim() === "") problems.push(`Câu ${q?.label}: thiếu final_answer.`);
  }
  const total = questions.reduce((sum, q) => sum + (typeof q?.max_points === "number" ? q.max_points : 0), 0);
  if (questions.length > 0 && Math.abs(total - 10) > 1e-9) problems.push(`Tổng điểm các câu là ${viNumber(total)}, phải bằng 10.`);
  return problems;
}

/** The confirmed key as text for the cached system block. */
export function renderKeyForPrompt(/** @type {AnswerKey} */ key) {
  const lines = [
    "ĐÁP ÁN ĐÃ CHỐT",
    `Đề: ${key.test_id}${key.title ? ` – ${key.title}` : ""}`,
    `Số câu: ${key.questions.length}. Tổng điểm: 10.`,
  ];
  for (const q of key.questions) {
    lines.push(
      "",
      `Câu ${q.label} (${viNumber(q.max_points)} điểm)`,
      `Đề bài: ${q.prompt_text}`,
      `Đáp án cuối: ${q.final_answer}`,
      `Cách viết tương đương: ${q.accepted_equivalents?.length ? q.accepted_equivalents.join("; ") : "không có"}`,
    );
    if (q.solution_steps?.length) lines.push("Lời giải:", ...q.solution_steps);
  }
  return lines.join("\n");
}

const STRING = Object.freeze({ type: "string" });
const NUMBER_OR_NULL = Object.freeze({ anyOf: [{ type: "number" }, { type: "null" }] });

export const KEY_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["title", "questions", "total_points_printed", "transcription_warnings"],
  properties: {
    title: STRING,
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "prompt_text", "max_points", "final_answer", "accepted_equivalents", "solution_steps"],
        properties: {
          label: STRING,
          prompt_text: STRING,
          max_points: NUMBER_OR_NULL,
          final_answer: STRING,
          accepted_equivalents: { type: "array", items: STRING },
          solution_steps: { type: "array", items: STRING },
        },
      },
    },
    total_points_printed: NUMBER_OR_NULL,
    transcription_warnings: { type: "array", items: STRING },
  },
});

/** Labels are an enum per key so the model cannot invent questions. */
export function gradeSchemaForKey(/** @type {AnswerKey} */ key) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions", "flags", "confidence"],
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "label",
            "extracted_final_answer",
            "verdict",
            "error_location",
            "reason_for_teacher",
            "note_for_parent",
          ],
          properties: {
            label: { type: "string", enum: key.questions.map((q) => q.label) },
            extracted_final_answer: STRING,
            verdict: { type: "string", enum: [...VERDICTS] },
            error_location: STRING,
            reason_for_teacher: STRING,
            note_for_parent: STRING,
          },
        },
      },
      flags: { type: "array", items: { type: "string", enum: [...GRADE_FLAGS] } },
      confidence: { type: "string", enum: [...CONFIDENCE] },
    },
  };
}

/** Loose comparison for final answers: no diacritics, spaces or decimal-separator differences. */
export function normalizeAnswer(/** @type {unknown} */ value) {
  return fold(value).replace(/\s+/g, "").replace(/,/g, ".");
}

/**
 * How many confirmed final answers the AI draft already had right (plan bar: ≥ 95%).
 * @param {{ questions?: Array<{ label: string, final_answer: string }> } | null | undefined} draft
 * @param {AnswerKey} confirmed
 */
export function keyDraftAccuracy(draft, confirmed) {
  const draftByLabel = new Map((draft?.questions ?? []).map((q) => [q.label, q]));
  let matched = 0;
  let missing = 0;
  for (const q of confirmed.questions) {
    const d = draftByLabel.get(q.label);
    if (!d) {
      missing += 1;
      continue;
    }
    const answer = normalizeAnswer(d.final_answer);
    if ([q.final_answer, ...(q.accepted_equivalents ?? [])].some((a) => normalizeAnswer(a) === answer)) matched += 1;
  }
  const confirmedLabels = new Set(confirmed.questions.map((q) => q.label));
  const extra = [...draftByLabel.keys()].filter((label) => !confirmedLabels.has(label)).length;
  return { total: confirmed.questions.length, matched, missing, extra };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const CUSTOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function customId(/** @type {string} */ configId, /** @type {number} */ run, /** @type {string} */ submissionId) {
  const id = `${configId}_r${run}_${submissionId}`;
  if (!CUSTOM_ID_PATTERN.test(id)) throw new Error(`custom_id không hợp lệ: ${id}`);
  return id;
}

/** @returns {{ configId: string, run: number, submissionId: string } | null} */
export function parseCustomId(/** @type {string} */ id) {
  const match = id.match(/^(.+)_r(\d+)_(sub_[0-9a-f]+)$/);
  return match ? { configId: match[1], run: Number(match[2]), submissionId: match[3] } : null;
}

/** @param {string} text */
function escapeAnswer(text) {
  return text.replace(/<\/?\s*bai_lam\s*>/gi, "[bai_lam]");
}

/**
 * One grading call. No temperature/top_p/top_k: Haiku 5.5 and Sonnet 5.5 reject
 * non-default sampling values. Thinking is adaptive by default; effort sets depth.
 * @param {{ config: GradeConfig, key: AnswerKey, answerText: string }} input
 * @returns {MessageCreateParamsNonStreaming}
 */
export function buildGradeParams({ config, key, answerText }) {
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    system: [
      { type: "text", text: GRADER_INSTRUCTIONS },
      { type: "text", text: renderKeyForPrompt(key), cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `<bai_lam>\n${escapeAnswer(answerText)}\n</bai_lam>\n\nChấm bài làm trên theo đáp án đã chốt.`,
      },
    ],
    output_config: { effort: config.effort, format: { type: "json_schema", schema: gradeSchemaForKey(key) } },
  };
}

/**
 * Answer-key draft from test photos: Opus 5.5 at high effort, pages labelled and
 * placed before the instruction. Server-side fallback is on (beta); the CLI
 * records which model actually answered.
 * @param {{ pages: Array<{ mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp", base64: string }> }} input
 * @returns {BetaMessageCreateParams}
 */
export function buildKeyExtractionParams({ pages }) {
  return {
    model: MODELS.opus,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: KEY_INSTRUCTIONS,
    output_config: { effort: "high", format: { type: "json_schema", schema: KEY_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...pages.flatMap((page, index) => [
            { type: /** @type {const} */ ("text"), text: `Trang ${index + 1}:` },
            {
              type: /** @type {const} */ ("image"),
              source: { type: /** @type {const} */ ("base64"), media_type: page.mediaType, data: page.base64 },
            },
          ]),
          { type: "text", text: "Soạn bản nháp đáp án cho đề trên theo đúng khuôn JSON." },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * Flatten one line of batch results; keyed by custom_id because order is arbitrary.
 * @param {MessageBatchIndividualResponse} item
 * @returns {BatchResultSummary}
 */
export function summarizeBatchResult(item) {
  const result = item.result;
  if (result.type !== "succeeded") {
    const error =
      result.type === "errored" ? `${result.error.error.type}: ${result.error.error.message}` : result.type;
    return { custom_id: item.custom_id, status: result.type, error };
  }
  const message = result.message;
  const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  return {
    custom_id: item.custom_id,
    status: "succeeded",
    model: message.model,
    stop_reason: message.stop_reason,
    text,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
    },
  };
}

/**
 * Validate one grading output against its key. Structured outputs guarantee the
 * JSON shape, not that every question is answered exactly once.
 * @param {BatchResultSummary | undefined} result
 * @param {AnswerKey} key
 * @returns {ParsedRun}
 */
export function parseGradeResult(result, key) {
  if (!result) return { ok: false, error: "no_result" };
  if (result.status !== "succeeded") return { ok: false, error: result.status, detail: result.error ?? undefined };
  if (result.stop_reason !== "end_turn") return { ok: false, error: `stop_${result.stop_reason}` };
  /** @type {any} */
  let data;
  try {
    data = JSON.parse(result.text ?? "");
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  if (!data || !Array.isArray(data.questions) || !Array.isArray(data.flags)) return { ok: false, error: "invalid_shape" };
  const expected = key.questions.map((q) => q.label);
  /** @type {string[]} */
  const got = data.questions.map((/** @type {any} */ q) => q?.label);
  if (got.length !== expected.length || new Set(got).size !== got.length || !expected.every((label) => got.includes(label))) {
    return { ok: false, error: "label_mismatch", detail: `cần [${expected.join(", ")}], nhận [${got.join(", ")}]` };
  }
  /** @type {Record<string, Verdict>} */
  const verdicts = {};
  for (const q of data.questions) {
    if (!VERDICTS.includes(q.verdict)) return { ok: false, error: "invalid_verdict" };
    verdicts[q.label] = q.verdict;
  }
  if (!CONFIDENCE.includes(data.confidence)) return { ok: false, error: "invalid_shape" };
  return { ok: true, verdicts, questions: data.questions, flags: data.flags, confidence: data.confidence };
}

/**
 * Two runs that agree on every question are green. Otherwise the tiebreak run (if
 * any) gives a third vote per question; a question without a majority stays yellow.
 * Flags or low confidence also make an item yellow (plan §4.5).
 * @param {AnswerKey} key
 * @param {ParsedRun[]} runs
 * @param {ParsedRun} [tiebreak]
 */
export function combineRuns(key, runs, tiebreak) {
  const labels = key.questions.map((q) => q.label);
  const valid = /** @type {Array<Extract<ParsedRun, { ok: true }>>} */ (runs.filter((r) => r.ok));
  const runsAgree =
    valid.length === runs.length &&
    valid.length >= 2 &&
    labels.every((label) => valid.every((r) => r.verdicts[label] === valid[0].verdicts[label]));
  /** @type {Array<Extract<ParsedRun, { ok: true }>>} */
  const voters = runsAgree ? valid : tiebreak?.ok ? [...valid, tiebreak] : valid;
  if (voters.length === 0) return { verdicts: null, color: /** @type {const} */ ("red"), runsAgree, usedTiebreak: false };
  /** @type {Record<string, Verdict>} */
  const verdicts = {};
  let undecided = false;
  for (const label of labels) {
    /** @type {Map<Verdict, number>} */
    const counts = new Map();
    for (const r of voters) counts.set(r.verdicts[label], (counts.get(r.verdicts[label]) ?? 0) + 1);
    const [best, votes] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (votes * 2 > voters.length) verdicts[label] = best;
    else {
      undecided = true;
      verdicts[label] = voters[0].verdicts[label];
    }
  }
  const flagged = voters.some((r) => r.flags.length > 0 || r.confidence === "low");
  const color = voters.length < 2 || undecided || flagged ? "yellow" : "green";
  return {
    verdicts,
    color: /** @type {"green" | "yellow"} */ (color),
    runsAgree,
    usedTiebreak: !runsAgree && Boolean(tiebreak?.ok),
  };
}

/**
 * @param {TokenUsage | undefined} usage
 * @param {string | undefined} model
 */
export function costUsd(usage, model, { batch = true } = {}) {
  const price = model ? PRICES_PER_MTOK[model] : undefined;
  if (!usage || !price) return 0;
  const tokens =
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite;
  return (tokens / 1e6) * (batch ? BATCH_DISCOUNT : 1);
}

/** Vietnamese with diacritics runs at roughly 2.5 characters per token. */
export function estimateTextTokens(/** @type {string} */ text) {
  return Math.ceil(text.length / 2.5);
}

/**
 * Upper-bound estimate for one batch grading call (no cache discount).
 * @param {{ config: GradeConfig, key: AnswerKey, answerText: string }} input
 */
export function estimateGradeCall({ config, key, answerText }) {
  const input = estimateTextTokens(GRADER_INSTRUCTIONS + renderKeyForPrompt(key) + answerText) + 400;
  const output = OUTPUT_TOKEN_GUESS[config.effort];
  return { input, output, usd: costUsd({ input_tokens: input, output_tokens: output }, config.model) };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   submission: PreparedSubmission,
 *   expected: number,
 *   score: number | null,
 *   diff: number | null,
 *   strictDiff: number | null,
 *   bonusExplains: boolean,
 *   color: "green" | "yellow" | "red",
 *   runsAgree: boolean,
 *   usedTiebreak: boolean,
 *   runScores: Array<number | null>,
 *   verdicts: Record<string, Verdict> | null,
 *   reasons: string,
 *   rankMatch: boolean,
 *   bonusUnknown: boolean,
 * }} ScoredItem
 */

/**
 * Score one configuration (optionally with a tiebreak configuration) against the
 * teaching assistants' scores.
 * @param {{
 *   submissions: PreparedSubmission[],
 *   keys: Map<string, AnswerKey>,
 *   results: Map<string, BatchResultSummary>,
 *   configId: string,
 *   tiebreakId?: string,
 *   runs?: number,
 *   scoreIncludesBonus?: boolean,
 * }} input
 * @returns {ScoredItem[]}
 */
export function scoreConfig({ submissions, keys, results, configId, tiebreakId, runs = DEFAULT_RUNS, scoreIncludesBonus = true }) {
  /** @type {ScoredItem[]} */
  const items = [];
  for (const submission of submissions) {
    const key = keys.get(submission.test_id);
    if (!key) continue;
    const parsed = Array.from({ length: runs }, (_, i) =>
      parseGradeResult(results.get(customId(configId, i + 1, submission.submission_id)), key),
    );
    const tiebreak = tiebreakId
      ? parseGradeResult(results.get(customId(tiebreakId, 1, submission.submission_id)), key)
      : undefined;
    const combined = combineRuns(key, parsed, tiebreak);
    const bonus = scoreIncludesBonus && submission.bonus === true;
    const toScore = (/** @type {Record<string, Verdict>} */ v) => finalScore(rawScore(key, v), bonus);
    const expected = Math.min(10, roundHalfUp(submission.ta_score));
    const score = combined.verdicts ? toScore(combined.verdicts) : null;
    const bonusUnknown = scoreIncludesBonus && submission.bonus === null;
    const strictDiff = score === null ? null : score - expected;
    // The Sheet does not record who got the +1 ("tích cực tương tác"), and the AI cannot see it:
    // a TA score exactly one above the AI's is counted as a match, but kept apart in strictDiff.
    const bonusExplains = bonusUnknown && score !== null && score !== expected && Math.min(10, score + 1) === expected;
    const voters = [...parsed, ...(combined.usedTiebreak && tiebreak ? [tiebreak] : [])];
    items.push({
      submission,
      expected,
      score,
      diff: bonusExplains ? 0 : strictDiff,
      strictDiff,
      bonusExplains,
      color: combined.color,
      runsAgree: combined.runsAgree,
      usedTiebreak: combined.usedTiebreak,
      runScores: parsed.map((r) => (r.ok ? toScore(r.verdicts) : null)),
      verdicts: combined.verdicts,
      reasons: voters
        .flatMap((r, i) =>
          r.ok
            ? r.questions
                .filter((q) => q.verdict !== "correct")
                .map((q) => `[${i + 1}] ${q.label}: ${q.reason_for_teacher}`)
            : [`[${i + 1}] lỗi ${r.error}${r.detail ? ` (${r.detail})` : ""}`],
        )
        .join(" | "),
      rankMatch: score !== null && rankLabel(bonusExplains ? expected : score) === rankLabel(expected),
      bonusUnknown,
    });
  }
  return items;
}

/** @param {ScoredItem[]} items */
export function summarizeItems(items) {
  const n = items.length;
  const count = (/** @type {(i: ScoredItem) => boolean} */ predicate) => items.filter(predicate).length;
  const exact = count((i) => i.diff === 0);
  const within1 = count((i) => i.diff !== null && Math.abs(i.diff) <= 1);
  const green = count((i) => i.color === "green");
  const greenOffBy2 = count((i) => i.color === "green" && i.diff !== null && Math.abs(i.diff) >= 2);
  const rate = (/** @type {number} */ x) => (n === 0 ? 0 : x / n);
  return {
    n,
    exact,
    within1,
    green,
    yellow: count((i) => i.color === "yellow"),
    red: count((i) => i.color === "red"),
    greenOffBy2,
    runsAgree: count((i) => i.runsAgree),
    usedTiebreak: count((i) => i.usedTiebreak),
    rankMatch: count((i) => i.rankMatch),
    bonusUnknown: count((i) => i.bonusUnknown),
    bonusExplained: count((i) => i.bonusExplains),
    exactStrictRate: rate(count((i) => i.strictDiff === 0)),
    exactRate: rate(exact),
    within1Rate: rate(within1),
    greenRate: rate(green),
    passes:
      n > 0 &&
      rate(exact) >= CRITERIA.exactRate &&
      rate(within1) >= CRITERIA.within1Rate &&
      greenOffBy2 <= CRITERIA.greenOffBy2,
  };
}

/**
 * Average USD per succeeded call of one configuration, from real usage.
 * @param {Map<string, BatchResultSummary>} results
 * @param {string} configId
 */
export function configCost(results, configId) {
  let total = 0;
  let calls = 0;
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const [id, result] of results) {
    if (parseCustomId(id)?.configId !== configId || result.status !== "succeeded" || !result.usage) continue;
    total += costUsd(result.usage, result.model);
    calls += 1;
    tokens.input += result.usage.input_tokens;
    tokens.output += result.usage.output_tokens;
    tokens.cacheRead += result.usage.cache_read_input_tokens ?? 0;
    tokens.cacheWrite += result.usage.cache_creation_input_tokens ?? 0;
  }
  return { total, calls, perCall: calls === 0 ? 0 : total / calls, tokens };
}
