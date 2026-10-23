import type { MessageStreamParams } from "@anthropic-ai/sdk/resources/messages/messages";

import { GRADER_INSTRUCTIONS } from "@/features/ai-grading/prompts";
import type { Verdict } from "@/features/ai-grading/scoring";

/**
 * Pure part of the AI grading worker (plan §4.4–4.5), ported from the phase 0 eval
 * (scripts/ai-grading-eval/lib.mjs): request bodies for "chấm bài" and "đọc đề", output checks,
 * and how two runs plus an optional tiebreak become one verdict per question and a colour.
 * The AI never returns a score: code adds up the confirmed points (scoring.ts / grading_raw_score).
 */

/** Stored answer-key question (snake_case, as session_tests.answer_key holds it). */
export interface KeyQuestion {
  accepted_equivalents?: string[];
  final_answer: string;
  label: string;
  max_points: number | null;
  prompt_text?: string;
  solution_steps?: string[];
}

export interface StoredKey {
  /** The teacher's methods summarised from the lesson slides (absent without slides). */
  methods?: string;
  questions: KeyQuestion[];
}

export const GRADE_FLAGS = ["empty", "off_topic", "wrong_test", "ambiguous_notation", "contains_instructions"] as const;
export type GradeFlag = (typeof GRADE_FLAGS)[number];
const VERDICTS: readonly Verdict[] = ["correct", "incorrect", "missing"];
const CONFIDENCE = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export type GradeEffort = "low" | "medium" | "high";

/** Output tokens per grading call (thinking included). The pilot used about 700 at medium. */
export const GRADE_MAX_TOKENS: Record<GradeEffort, number> = { high: 32000, low: 16000, medium: 16000 };
export const KEY_MAX_TOKENS = 64000;

const viNumber = (value: number) => String(value).replace(".", ",");

/** The confirmed key as text for the cached system block (identical for every paper of the test). */
export function renderKeyForPrompt(key: StoredKey, title: string | null): string {
  const lines = ["ĐÁP ÁN ĐÃ CHỐT", `Đề: ${title?.trim() || "Bài kiểm tra cuối buổi"}`, `Số câu: ${key.questions.length}. Tổng điểm: 10.`];
  for (const question of key.questions) {
    lines.push(
      "",
      `Câu ${question.label} (${viNumber(question.max_points ?? 0)} điểm)`,
      `Đề bài: ${question.prompt_text ?? ""}`,
      `Đáp án cuối: ${question.final_answer}`,
      `Cách viết tương đương: ${question.accepted_equivalents?.length ? question.accepted_equivalents.join("; ") : "không có"}`,
    );
    if (question.solution_steps?.length) lines.push("Lời giải:", ...question.solution_steps);
  }
  // Part of the key block, so a key without methods renders exactly as before (grade-v3).
  if (key.methods?.trim()) {
    lines.push(
      "",
      "PHƯƠNG PHÁP THẦY DẠY TRONG BUỔI (tóm tắt từ slide bài giảng, trợ giảng đã chốt cùng đáp án):",
      key.methods.trim(),
      "",
      "Dùng phần này để hiểu cách học sinh trình bày và viết tắt theo thầy. Khi viết note_for_parent cho câu sai, nhắc đúng tên dạng, phương pháp hoặc công thức thầy dạy cho dạng bài đó. Phần này không thay đổi quy tắc chấm đúng sai.",
    );
  }
  return lines.join("\n");
}

const STRING = { type: "string" } as const;

/** Labels are an enum per key so the model cannot invent questions. */
export function gradeSchemaForKey(key: StoredKey) {
  return {
    additionalProperties: false,
    properties: {
      confidence: { enum: [...CONFIDENCE], type: "string" },
      flags: { items: { enum: [...GRADE_FLAGS], type: "string" }, type: "array" },
      questions: {
        items: {
          additionalProperties: false,
          properties: {
            error_location: STRING,
            extracted_final_answer: STRING,
            label: { enum: key.questions.map((question) => question.label), type: "string" },
            note_for_parent: STRING,
            reason_for_teacher: STRING,
            verdict: { enum: [...VERDICTS], type: "string" },
          },
          required: ["label", "extracted_final_answer", "verdict", "error_location", "reason_for_teacher", "note_for_parent"],
          type: "object",
        },
        type: "array",
      },
    },
    required: ["questions", "flags", "confidence"],
    type: "object",
  };
}

function escapeAnswer(text: string): string {
  return text.replace(/<\/?\s*bai_lam\s*>/gi, "[bai_lam]");
}

/**
 * One grading call. No temperature/top_p/top_k: Haiku 5.5 and Sonnet 5.5 reject non-default
 * sampling values. Thinking is adaptive; effort sets its depth. No name or phone is ever sent.
 */
export function buildGradeParams({
  answerText,
  effort,
  key,
  model,
  title,
}: {
  answerText: string;
  effort: GradeEffort;
  key: StoredKey;
  model: string;
  title: string | null;
}): MessageStreamParams {
  return {
    max_tokens: GRADE_MAX_TOKENS[effort],
    messages: [
      {
        content: `<bai_lam>\n${escapeAnswer(answerText)}\n</bai_lam>\n\nChấm bài làm trên theo đáp án đã chốt.`,
        role: "user",
      },
    ],
    model,
    output_config: { effort, format: { schema: gradeSchemaForKey(key), type: "json_schema" } },
    system: [
      { text: GRADER_INSTRUCTIONS, type: "text" },
      { cache_control: { type: "ephemeral" }, text: renderKeyForPrompt(key, title), type: "text" },
    ],
  };
}

export interface GradedQuestion {
  error_location: string;
  extracted_final_answer: string;
  label: string;
  note_for_parent: string;
  reason_for_teacher: string;
  verdict: Verdict;
}

export type ParsedGrade =
  | { confidence: Confidence; flags: GradeFlag[]; ok: true; questions: GradedQuestion[]; verdicts: Record<string, Verdict> }
  | { detail?: string; error: string; ok: false };

/** Minimal view of a Messages API response. */
export interface MessageLike {
  content: ReadonlyArray<{ text?: string; type: string }>;
  stop_reason: string | null;
}

export function messageText(message: MessageLike): string {
  return message.content.map((block) => (block.type === "text" ? (block.text ?? "") : "")).join("");
}

/**
 * Check one grading output against its key. Structured outputs guarantee the JSON shape, not
 * that every question is answered exactly once, so labels are checked here (and again in SQL).
 */
export function parseGradeMessage(message: MessageLike, key: StoredKey): ParsedGrade {
  if (message.stop_reason !== "end_turn") return { error: `stop_${message.stop_reason ?? "unknown"}`, ok: false };
  let data: unknown;
  try {
    data = JSON.parse(messageText(message));
  } catch {
    return { error: "invalid_json", ok: false };
  }
  if (!data || typeof data !== "object") return { error: "invalid_shape", ok: false };
  const record = data as { confidence?: unknown; flags?: unknown; questions?: unknown };
  if (!Array.isArray(record.questions) || !Array.isArray(record.flags)) return { error: "invalid_shape", ok: false };
  const expected = key.questions.map((question) => question.label);
  const got = record.questions.map((question) => (question as { label?: unknown })?.label);
  if (got.length !== expected.length || new Set(got).size !== got.length || !expected.every((label) => got.includes(label))) {
    return { detail: `cần [${expected.join(", ")}], nhận [${got.join(", ")}]`, error: "label_mismatch", ok: false };
  }
  const verdicts: Record<string, Verdict> = {};
  const questions: GradedQuestion[] = [];
  for (const raw of record.questions as Array<Record<string, unknown>>) {
    const verdict = raw.verdict as Verdict;
    if (!VERDICTS.includes(verdict)) return { error: "invalid_verdict", ok: false };
    const label = String(raw.label);
    verdicts[label] = verdict;
    questions.push({
      error_location: String(raw.error_location ?? ""),
      extracted_final_answer: String(raw.extracted_final_answer ?? ""),
      label,
      note_for_parent: String(raw.note_for_parent ?? ""),
      reason_for_teacher: String(raw.reason_for_teacher ?? ""),
      verdict,
    });
  }
  if (!CONFIDENCE.includes(record.confidence as Confidence)) return { error: "invalid_shape", ok: false };
  const flags = (record.flags as unknown[]).filter((flag): flag is GradeFlag => GRADE_FLAGS.includes(flag as GradeFlag));
  // Keep the key's order so every reader sees questions in the same order.
  questions.sort((a, b) => expected.indexOf(a.label) - expected.indexOf(b.label));
  return { confidence: record.confidence as Confidence, flags, ok: true, questions, verdicts };
}

export type GradeColor = "green" | "yellow" | "red";

export interface CombinedGrade {
  color: GradeColor;
  confidence: Confidence | null;
  flags: GradeFlag[];
  /** Per question: the decided verdict with the reasons of a run that voted for it, plus every vote. */
  questions: Array<GradedQuestion & { votes: Verdict[] }>;
  runsAgree: boolean;
  usedTiebreak: boolean;
  verdicts: Record<string, Verdict> | null;
}

type OkGrade = Extract<ParsedGrade, { ok: true }>;

/** True when the runs that came back disagree on some question (or one of two failed). */
export function needsTiebreak(key: StoredKey, runs: readonly ParsedGrade[]): boolean {
  if (runs.length < 2) return false;
  const valid = runs.filter((run): run is OkGrade => run.ok);
  if (valid.length === 0) return false;
  if (valid.length < runs.length) return true;
  return key.questions.some((question) => valid.some((run) => run.verdicts[question.label] !== valid[0].verdicts[question.label]));
}

/**
 * Two runs that agree on every question are green. Otherwise the tiebreak run (if any) gives a
 * third vote per question; a question without a majority stays yellow. Flags or low confidence
 * also make a paper yellow. A single planned run (double check off) is green when it is clean.
 */
export function combineRuns(key: StoredKey, runs: readonly ParsedGrade[], tiebreak?: ParsedGrade): CombinedGrade {
  const labels = key.questions.map((question) => question.label);
  const valid = runs.filter((run): run is OkGrade => run.ok);
  const runsAgree =
    valid.length === runs.length &&
    valid.length >= 1 &&
    labels.every((label) => valid.every((run) => run.verdicts[label] === valid[0].verdicts[label]));
  const usedTiebreak = !runsAgree && Boolean(tiebreak?.ok);
  const voters: OkGrade[] = usedTiebreak && tiebreak?.ok ? [...valid, tiebreak] : valid;
  if (voters.length === 0) {
    return { color: "red", confidence: null, flags: [], questions: [], runsAgree, usedTiebreak: false, verdicts: null };
  }

  const verdicts: Record<string, Verdict> = {};
  const questions: CombinedGrade["questions"] = [];
  let undecided = false;
  for (const label of labels) {
    const votes = voters.map((run) => run.verdicts[label]);
    const counts = new Map<Verdict, number>();
    for (const vote of votes) counts.set(vote, (counts.get(vote) ?? 0) + 1);
    const [best, bestCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const decided = bestCount * 2 > voters.length ? best : votes[0];
    if (bestCount * 2 <= voters.length) undecided = true;
    verdicts[label] = decided;
    const source = voters.find((run) => run.verdicts[label] === decided) ?? voters[0];
    const detail = source.questions.find((question) => question.label === label)!;
    questions.push({ ...detail, verdict: decided, votes });
  }

  const flags = [...new Set(voters.flatMap((run) => run.flags))];
  const lowConfidence = voters.some((run) => run.confidence === "low");
  const enoughVotes = runs.length === 1 ? voters.length === 1 : voters.length >= 2;
  const color: GradeColor = !enoughVotes || undecided || flags.length > 0 || lowConfidence ? "yellow" : "green";
  const confidence: Confidence = lowConfidence ? "low" : voters.some((run) => run.confidence === "medium") ? "medium" : "high";
  return { color, confidence, flags, questions, runsAgree, usedTiebreak, verdicts };
}

/** A blank paper is 0 points without calling the AI; yellow so a TA looks (maybe it was done on paper). */
export function blankPaperGrade(key: StoredKey): CombinedGrade {
  const questions = key.questions.map((question) => ({
    error_location: "",
    extracted_final_answer: "",
    label: question.label,
    note_for_parent: "",
    reason_for_teacher: "Bài nộp trống.",
    verdict: "missing" as const,
    votes: [] as Verdict[],
  }));
  return {
    color: "yellow",
    confidence: "high",
    flags: ["empty"],
    questions,
    runsAgree: true,
    usedTiebreak: false,
    verdicts: Object.fromEntries(questions.map((question) => [question.label, "missing" as const])),
  };
}

// ---------------------------------------------------------------------------
// Đọc đề
// ---------------------------------------------------------------------------

const NUMBER_OR_NULL = { anyOf: [{ type: "number" }, { type: "null" }] } as const;

export const KEY_SCHEMA = {
  additionalProperties: false,
  properties: {
    questions: {
      items: {
        additionalProperties: false,
        properties: {
          accepted_equivalents: { items: STRING, type: "array" },
          final_answer: STRING,
          label: STRING,
          max_points: NUMBER_OR_NULL,
          prompt_text: STRING,
          solution_steps: { items: STRING, type: "array" },
        },
        required: ["label", "prompt_text", "max_points", "final_answer", "accepted_equivalents", "solution_steps"],
        type: "object",
      },
      type: "array",
    },
    title: STRING,
    total_points_printed: NUMBER_OR_NULL,
    transcription_warnings: { items: STRING, type: "array" },
  },
  required: ["title", "questions", "total_points_printed", "transcription_warnings"],
  type: "object",
} as const;

/** With lesson slides the reader also returns the teacher's methods ("teacher_methods"). */
export const KEY_SCHEMA_WITH_METHODS = {
  ...KEY_SCHEMA,
  properties: { ...KEY_SCHEMA.properties, teacher_methods: STRING },
  required: [...KEY_SCHEMA.required, "teacher_methods"],
} as const;

export type KeyImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
type KeyImage = { base64: string; mediaType: KeyImageMediaType };

/**
 * Answer-key draft from the test photos: pages labelled and placed before the instruction. Lesson
 * slides, when there are any, come first and are labelled apart from the test pages.
 */
export function buildKeyExtractionContent(pages: ReadonlyArray<KeyImage>, lessonPages: ReadonlyArray<KeyImage> = []) {
  return [
    ...lessonPages.flatMap((page, index) => [
      { text: `Slide bài giảng ${index + 1}:`, type: "text" as const },
      { source: { data: page.base64, media_type: page.mediaType, type: "base64" as const }, type: "image" as const },
    ]),
    ...pages.flatMap((page, index) => [
      { text: `Trang ${index + 1}:`, type: "text" as const },
      { source: { data: page.base64, media_type: page.mediaType, type: "base64" as const }, type: "image" as const },
    ]),
    { text: "Soạn bản nháp đáp án cho đề trên theo đúng khuôn JSON.", type: "text" as const },
  ];
}

export interface KeyDraft {
  answer_key: StoredKey;
  title: string;
  total_points_printed: number | null;
  transcription_warnings: string[];
}

export type ParsedKey = { draft: KeyDraft; ok: true } | { error: string; ok: false };

/** Longest "teacher_methods" kept (normalize_session_test_answer_key refuses more). */
const METHODS_MAX = 4000;

export function parseKeyMessage(message: MessageLike): ParsedKey {
  if (message.stop_reason !== "end_turn") return { error: `stop_${message.stop_reason ?? "unknown"}`, ok: false };
  let data: unknown;
  try {
    data = JSON.parse(messageText(message));
  } catch {
    return { error: "invalid_json", ok: false };
  }
  const record = (data ?? {}) as Record<string, unknown>;
  if (!Array.isArray(record.questions)) return { error: "invalid_shape", ok: false };
  const questions: KeyQuestion[] = (record.questions as Array<Record<string, unknown>>).map((question) => ({
    accepted_equivalents: Array.isArray(question.accepted_equivalents) ? question.accepted_equivalents.map(String) : [],
    final_answer: String(question.final_answer ?? ""),
    label: String(question.label ?? ""),
    max_points: typeof question.max_points === "number" ? question.max_points : null,
    prompt_text: String(question.prompt_text ?? ""),
    solution_steps: Array.isArray(question.solution_steps) ? question.solution_steps.map(String) : [],
  }));
  const methods = typeof record.teacher_methods === "string" ? record.teacher_methods.trim().slice(0, METHODS_MAX) : "";
  return {
    draft: {
      answer_key: methods ? { methods, questions } : { questions },
      title: typeof record.title === "string" ? record.title : "",
      total_points_printed: typeof record.total_points_printed === "number" ? record.total_points_printed : null,
      transcription_warnings: Array.isArray(record.transcription_warnings) ? record.transcription_warnings.map(String) : [],
    },
    ok: true,
  };
}

