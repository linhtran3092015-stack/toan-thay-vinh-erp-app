import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { MessageStreamParams } from "@anthropic-ai/sdk/resources/messages/messages";
import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyApiError, type ApiErrorClass } from "@/features/ai-grading/api-errors";
import {
  blankPaperGrade,
  buildGradeParams,
  buildKeyExtractionContent,
  combineRuns,
  KEY_MAX_TOKENS,
  KEY_SCHEMA,
  KEY_SCHEMA_WITH_METHODS,
  needsTiebreak,
  parseGradeMessage,
  parseKeyMessage,
  type CombinedGrade,
  type GradeEffort,
  type KeyImageMediaType,
  type MessageLike,
  type ParsedGrade,
  type StoredKey,
} from "@/features/ai-grading/grading";
import { estimateCostUsd, type TokenUsage } from "@/features/ai-grading/models";
import { KEY_INSTRUCTIONS, KEY_PROMPT_VERSION, LESSON_KEY_INSTRUCTIONS, LESSON_PROMPT_VERSION } from "@/features/ai-grading/prompts";
import { storedAnswerKeySchema } from "@/features/session-tests/answer-key";
import { SESSION_TEST_BUCKET } from "@/features/session-tests/storage";
import { getAnthropicApiKey } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database, Json } from "@/types/database.generated";

/**
 * AI grading worker (plan §4.6). Claims a few runs with claim_grading_runs, calls Claude, and
 * hands each result to complete_grading_run, which owns every state change (retries, pausing the
 * queue, applying a key draft, writing the AI result on the submission). It runs from after() in
 * the app and from the GitHub Actions schedule; several workers may run at once because claims
 * use FOR UPDATE SKIP LOCKED.
 */

type ServiceClient = SupabaseClient<Database>;
export type ClaimedRun = Database["public"]["Functions"]["claim_grading_runs"]["Returns"][number];

export interface ClaudeMessage extends MessageLike {
  model: string;
  usage: TokenUsage & { iterations?: ReadonlyArray<{ type?: string }> | null };
}

/** Narrow seam over the SDK so tests can stub the API. */
export interface ClaudeCaller {
  grade(params: MessageStreamParams): Promise<{ message: ClaudeMessage; requestId: string | null }>;
  readKey(params: BetaMessageStreamParams): Promise<{ message: ClaudeMessage; requestId: string | null }>;
}

export function createClaudeCaller(apiKey: string): ClaudeCaller {
  // The SDK retries 429/5xx/network twice with backoff; anything left is classified by the worker.
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return {
    async grade(params) {
      const stream = client.messages.stream(params);
      const message = await stream.finalMessage();
      return { message: message as unknown as ClaudeMessage, requestId: stream.request_id ?? null };
    },
    async readKey(params) {
      const stream = client.beta.messages.stream(params);
      const message = await stream.finalMessage();
      return { message: message as unknown as ClaudeMessage, requestId: stream.request_id ?? null };
    },
  };
}

interface CallRecord {
  costUsd: number;
  effort: string;
  error?: ApiErrorClass;
  latencyMs: number;
  message?: ClaudeMessage;
  requestId: string | null;
  requestedModel: string;
  role: "primary" | "tiebreak" | "key";
}

interface RunOutcome {
  errorCode?: string;
  errorMessage?: string;
  outcome: "succeeded" | "failed" | "retry" | "paused";
  result?: Json;
  retryAfterSeconds?: number | null;
}

async function callOnce<P>(
  fn: (params: P) => Promise<{ message: ClaudeMessage; requestId: string | null }>,
  params: P,
  meta: Pick<CallRecord, "effort" | "requestedModel" | "role">,
): Promise<CallRecord> {
  const started = Date.now();
  try {
    const { message, requestId } = await fn(params);
    return { ...meta, costUsd: estimateCostUsd(message.model, message.usage), latencyMs: Date.now() - started, message, requestId };
  } catch (error) {
    return { ...meta, costUsd: 0, error: classifyApiError(error), latencyMs: Date.now() - started, requestId: null };
  }
}

function usageSummary(calls: readonly CallRecord[]) {
  const done = calls.filter((call) => call.message);
  const sum = (pick: (usage: TokenUsage) => number | null | undefined) =>
    done.reduce((total, call) => total + (pick(call.message!.usage) ?? 0), 0);
  return {
    cache_creation_tokens: sum((usage) => usage.cache_creation_input_tokens),
    cache_read_tokens: sum((usage) => usage.cache_read_input_tokens),
    cost_usd: Number(calls.reduce((total, call) => total + call.costUsd, 0).toFixed(6)),
    input_tokens: sum((usage) => usage.input_tokens),
    latency_ms: calls.reduce((longest, call) => Math.max(longest, call.latencyMs), 0),
    model: done[0]?.message?.model ?? calls[0]?.requestedModel ?? null,
    output_tokens: sum((usage) => usage.output_tokens),
    request_id: done[0]?.requestId ?? null,
    stop_reason: done[0]?.message?.stop_reason ?? null,
  };
}

function callLog(call: CallRecord, parsed?: ParsedGrade) {
  return {
    cache_creation_tokens: call.message?.usage.cache_creation_input_tokens ?? 0,
    cache_read_tokens: call.message?.usage.cache_read_input_tokens ?? 0,
    confidence: parsed?.ok ? parsed.confidence : null,
    cost_usd: Number(call.costUsd.toFixed(6)),
    effort: call.effort,
    error_code: call.error?.code ?? (parsed && !parsed.ok ? parsed.error : null),
    flags: parsed?.ok ? parsed.flags : [],
    input_tokens: call.message?.usage.input_tokens ?? 0,
    latency_ms: call.latencyMs,
    model: call.message?.model ?? null,
    output_tokens: call.message?.usage.output_tokens ?? 0,
    request_id: call.requestId,
    requested_model: call.requestedModel,
    role: call.role,
    stop_reason: call.message?.stop_reason ?? null,
    verdicts: parsed?.ok ? parsed.verdicts : null,
  };
}

function failureFromCalls(calls: readonly CallRecord[]): RunOutcome | null {
  const pause = calls.find((call) => call.error?.kind === "pause");
  if (pause) {
    return { errorCode: pause.error!.code, errorMessage: pause.error!.message, outcome: "paused" };
  }
  if (calls.some((call) => call.message)) return null;
  const retry = calls.find((call) => call.error?.kind === "retry");
  const first = (retry ?? calls[0])?.error;
  const waits = calls.map((call) => (call.error?.kind === "retry" ? call.error.retryAfterSeconds : null)).filter((n): n is number => n !== null);
  return {
    errorCode: first?.code ?? "unknown",
    errorMessage: first?.message,
    outcome: retry ? "retry" : "failed",
    retryAfterSeconds: waits.length ? Math.max(...waits) : null,
  };
}

function isEffort(value: string): value is GradeEffort {
  return value === "low" || value === "medium" || value === "high";
}

function gradeResult(combined: CombinedGrade, calls: ReadonlyArray<ReturnType<typeof callLog>>): Json {
  return {
    calls,
    color: combined.color,
    confidence: combined.confidence,
    flags: combined.flags,
    questions: combined.questions,
    runs_agree: combined.runsAgree,
    used_tiebreak: combined.usedTiebreak,
    verdicts: combined.verdicts,
  } as unknown as Json;
}

interface GradePayload {
  answer_key?: unknown;
  answer_text?: string | null;
  counts_for_score?: boolean;
  current_key_version?: number;
  double_check?: boolean;
  test_title?: string | null;
  tiebreak_model?: string | null;
}

export async function gradeRun(run: ClaimedRun, caller: ClaudeCaller): Promise<RunOutcome & { usage?: Json }> {
  const payload = (run.payload ?? {}) as GradePayload;
  if (!payload.counts_for_score || payload.current_key_version !== run.answer_key_version) {
    // complete_grading_run sees the change too and queues a fresh run when needed.
    return { outcome: "succeeded", result: { skipped: "stale" } };
  }
  const parsedKey = storedAnswerKeySchema.safeParse(payload.answer_key);
  if (!parsedKey.success || parsedKey.data.questions.length === 0) {
    return { errorCode: "invalid_key", errorMessage: "Đáp án đã chốt không đọc được.", outcome: "failed" };
  }
  const key: StoredKey = parsedKey.data;
  const answerText = String(payload.answer_text ?? "");
  if (!answerText.trim()) {
    return { outcome: "succeeded", result: gradeResult(blankPaperGrade(key), []) };
  }

  const effort: GradeEffort = isEffort(run.effort) ? run.effort : "medium";
  const params = buildGradeParams({ answerText, effort, key, model: run.model, title: payload.test_title ?? null });
  const planned = payload.double_check === false ? 1 : 2;
  const primary = await Promise.all(
    Array.from({ length: planned }, () => callOnce(caller.grade, params, { effort, requestedModel: run.model, role: "primary" })),
  );
  const failed = failureFromCalls(primary);
  if (failed) return { ...failed, usage: usageSummary(primary) as unknown as Json };

  const parsed = primary.map((call) => (call.message ? parseGradeMessage(call.message, key) : { error: call.error!.code, ok: false as const }));
  const calls = [...primary];
  let tiebreak: ParsedGrade | undefined;
  if (planned === 2 && payload.tiebreak_model && needsTiebreak(key, parsed)) {
    const call = await callOnce(caller.grade, { ...params, model: payload.tiebreak_model }, {
      effort,
      requestedModel: payload.tiebreak_model,
      role: "tiebreak",
    });
    calls.push(call);
    tiebreak = call.message ? parseGradeMessage(call.message, key) : { error: call.error!.code, ok: false };
  }

  const combined = combineRuns(key, parsed, tiebreak);
  const logs = calls.map((call, index) => callLog(call, index < parsed.length ? parsed[index] : tiebreak));
  const usage = usageSummary(calls) as unknown as Json;
  if (combined.color === "red" && run.attempt_count < 2) {
    const reason = parsed.find((item) => !item.ok);
    return { errorCode: reason && !reason.ok ? reason.error : "invalid_output", errorMessage: "AI trả kết quả không dùng được.", outcome: "retry", usage };
  }
  return { outcome: "succeeded", result: gradeResult(combined, logs), usage };
}

const KEY_MEDIA_TYPES = new Set<KeyImageMediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

interface KeyPayload {
  pages?: Array<{ mime_type?: string; page_no?: number; storage_path?: string }>;
  test_status?: string;
}

export async function extractRun(supabase: ServiceClient, run: ClaimedRun, caller: ClaudeCaller): Promise<RunOutcome & { usage?: Json }> {
  const payload = (run.payload ?? {}) as KeyPayload;
  if (payload.test_status === "key_confirmed") {
    return { outcome: "succeeded", result: { skipped: "key_confirmed" } };
  }
  const pages = payload.pages ?? [];
  if (pages.length === 0) {
    return { errorCode: "no_pages", errorMessage: "Đề chưa có trang ảnh.", outcome: "failed" };
  }

  // Lesson slides (optional): read with the test so the key follows the teacher's methods.
  const { data: lessonRows, error: lessonError } = await supabase
    .from("session_test_lesson_pages")
    .select("storage_path, mime_type, page_no")
    .eq("test_id", run.test_id)
    .order("page_no");
  if (lessonError) {
    return { errorCode: "storage_error", errorMessage: "Không đọc được danh sách ảnh bài giảng.", outcome: "retry" };
  }
  const lessonImages: Array<{ base64: string; mediaType: KeyImageMediaType }> = [];
  for (const page of lessonRows ?? []) {
    const mediaType = page.mime_type as KeyImageMediaType;
    if (!KEY_MEDIA_TYPES.has(mediaType)) continue;
    const { data, error } = await supabase.storage.from(SESSION_TEST_BUCKET).download(page.storage_path);
    if (error || !data) {
      return { errorCode: "storage_error", errorMessage: `Không tải được ảnh bài giảng ${page.page_no}.`, outcome: "retry" };
    }
    lessonImages.push({ base64: Buffer.from(await data.arrayBuffer()).toString("base64"), mediaType });
  }
  const withLesson = lessonImages.length > 0;

  const images: Array<{ base64: string; mediaType: KeyImageMediaType }> = [];
  for (const page of pages) {
    const mediaType = page.mime_type as KeyImageMediaType;
    if (!page.storage_path || !KEY_MEDIA_TYPES.has(mediaType)) {
      return { errorCode: "invalid_page", errorMessage: `Trang ${page.page_no ?? "?"} không đọc được.`, outcome: "failed" };
    }
    const { data, error } = await supabase.storage.from(SESSION_TEST_BUCKET).download(page.storage_path);
    if (error || !data) {
      return { errorCode: "storage_error", errorMessage: `Không tải được trang ${page.page_no ?? "?"}.`, outcome: "retry" };
    }
    images.push({ base64: Buffer.from(await data.arrayBuffer()).toString("base64"), mediaType });
  }

  const params: BetaMessageStreamParams = {
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: KEY_MAX_TOKENS,
    messages: [{ content: buildKeyExtractionContent(images, lessonImages), role: "user" }],
    model: run.model,
    output_config: {
      effort: "high",
      format: { schema: (withLesson ? KEY_SCHEMA_WITH_METHODS : KEY_SCHEMA) as unknown as Record<string, unknown>, type: "json_schema" },
    },
    system: withLesson ? KEY_INSTRUCTIONS + LESSON_KEY_INSTRUCTIONS : KEY_INSTRUCTIONS,
  };
  const call = await callOnce(caller.readKey, params, { effort: "high", requestedModel: run.model, role: "key" });
  const usage = usageSummary([call]) as unknown as Json;
  const failed = failureFromCalls([call]);
  if (failed) return { ...failed, usage };

  const parsed = parseKeyMessage(call.message!);
  if (!parsed.ok) {
    return { errorCode: parsed.error, errorMessage: "AI trả bản nháp không dùng được.", outcome: run.attempt_count < 2 ? "retry" : "failed", usage };
  }
  const fallbackUsed = (call.message!.usage.iterations ?? []).some((entry) => entry?.type === "fallback_message");
  return {
    outcome: "succeeded",
    result: {
      ...parsed.draft,
      fallback_used: fallbackUsed,
      lesson_pages: lessonImages.length,
      prompt_version: withLesson ? `${KEY_PROMPT_VERSION}+${LESSON_PROMPT_VERSION}` : KEY_PROMPT_VERSION,
      served_by: call.message!.model,
    } as unknown as Json,
    usage,
  };
}

async function processRun(supabase: ServiceClient, caller: ClaudeCaller, run: ClaimedRun): Promise<string> {
  let outcome: RunOutcome & { usage?: Json };
  try {
    outcome = run.run_type === "grade" ? await gradeRun(run, caller) : await extractRun(supabase, run, caller);
  } catch (error) {
    outcome = { errorCode: "worker_error", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Lỗi không rõ", outcome: "retry" };
  }
  const { data, error } = await supabase.rpc("complete_grading_run", {
    p_error_code: outcome.errorCode,
    p_error_message: outcome.errorMessage,
    p_outcome: outcome.outcome,
    p_result: outcome.result ?? null,
    p_retry_after_seconds: outcome.retryAfterSeconds ?? undefined,
    p_run_id: run.run_id,
    p_usage: outcome.usage ?? null,
  });
  if (error) {
    // The run stays "running" until its lock expires, then another worker claims it again.
    console.error("[ai-grading] complete_grading_run failed", run.run_id, error.message);
    return "complete_failed";
  }
  return data ?? outcome.outcome;
}

export interface WorkerSummary {
  claimed: number;
  outcomes: Record<string, number>;
  stopped: "idle" | "time" | "paused" | "no_api_key" | "claim_failed";
}

export async function runGradingWorker(
  options: {
    batchSize?: number;
    caller?: ClaudeCaller;
    /** Total time this invocation may use (keep below the route's maxDuration). */
    deadlineMs?: number;
    /** Stop claiming when less than this is left, so a claimed batch can finish. */
    reserveMs?: number;
    supabase?: ServiceClient;
  } = {},
): Promise<WorkerSummary> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey && !options.caller) return { claimed: 0, outcomes: {}, stopped: "no_api_key" };
  const supabase = options.supabase ?? createSupabaseServiceRoleClient();
  const caller = options.caller ?? createClaudeCaller(apiKey!);
  const deadline = Date.now() + (options.deadlineMs ?? 240_000);
  const reserve = options.reserveMs ?? 120_000;
  const summary: WorkerSummary = { claimed: 0, outcomes: {}, stopped: "idle" };

  while (true) {
    if (Date.now() > deadline - reserve) {
      summary.stopped = "time";
      break;
    }
    const { data, error } = await supabase.rpc("claim_grading_runs", { p_limit: options.batchSize ?? 4, p_lock_seconds: 330 });
    if (error) {
      console.error("[ai-grading] claim_grading_runs failed", error.message);
      summary.stopped = "claim_failed";
      break;
    }
    if (!data || data.length === 0) break;
    summary.claimed += data.length;
    const outcomes = await Promise.all(data.map((run) => processRun(supabase, caller, run)));
    for (const outcome of outcomes) summary.outcomes[outcome] = (summary.outcomes[outcome] ?? 0) + 1;
    if (outcomes.includes("paused")) {
      summary.stopped = "paused";
      break;
    }
  }
  return summary;
}
