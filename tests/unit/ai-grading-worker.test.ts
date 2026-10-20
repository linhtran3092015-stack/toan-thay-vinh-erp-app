// Value: protects=how the AI grading worker talks to Claude and to the queue: API errors sorted into pause (no credit, workspace or monthly limit, bad key, missing model), retry (rate limit with retry-after, overload, 5xx, network) or fatal; a graded paper sent as one result (two calls, a tiebreak only on disagreement, usage and cost summed); blank or stale papers never call the API; the queue stops on a pause; key reading downloads the pages and sends them with the fallback beta; the CRON_SECRET route refuses anyone else;
// fails_when=a billing error is retried every minute, a 429 is treated as fatal, a tiebreak runs when both runs agree, a blank paper spends money, a stale run calls Claude, the worker keeps claiming after a pause, a page is sent without its media type, or the worker route runs without the exact bearer secret;
// why_new=phase 3a worker; seam=Supabase client and the Claude caller are fakes; no_claim=the SQL state machine (pgTAP ai-grading-worker) or real API behaviour
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({ cron: vi.fn(), key: vi.fn(), run: vi.fn() }));

import { classifyApiError } from "@/features/ai-grading/api-errors";
import { KEY_INSTRUCTIONS } from "@/features/ai-grading/prompts";
import { runGradingWorker, type ClaimedRun, type ClaudeCaller, type ClaudeMessage } from "@/features/ai-grading/worker";

const KEY = {
  questions: [
    { accepted_equivalents: [], final_answer: "54", label: "13", max_points: 5, prompt_text: "", solution_steps: [] },
    { accepted_equivalents: [], final_answer: "8", label: "14", max_points: 5, prompt_text: "", solution_steps: [] },
  ],
};

function headers(values: Record<string, string> = {}) {
  return new Headers(values);
}

function apiError(status: number, type: string, message: string, extraHeaders: Record<string, string> = {}) {
  return Anthropic.APIError.generate(status, { error: { message, type }, type: "error" }, message, headers(extraHeaders));
}

describe("classifyApiError", () => {
  it("pauses the queue when retrying soon cannot help", () => {
    expect(classifyApiError(apiError(401, "authentication_error", "invalid x-api-key"))).toMatchObject({ code: "auth_failed", kind: "pause" });
    expect(classifyApiError(apiError(403, "permission_error", "not allowed"))).toMatchObject({ code: "auth_failed", kind: "pause" });
    expect(classifyApiError(apiError(400, "billing_error", "billing"))).toMatchObject({ code: "credit_exhausted", kind: "pause" });
    expect(classifyApiError(apiError(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."))).toMatchObject({
      code: "credit_exhausted",
      kind: "pause",
    });
    expect(classifyApiError(apiError(400, "invalid_request_error", "You have reached your specified workspace API usage limits."))).toMatchObject({
      code: "workspace_limit",
      kind: "pause",
    });
    expect(classifyApiError(apiError(429, "rate_limit_error", "enforced_spend_limit_reached"))).toMatchObject({ code: "spend_limit", kind: "pause" });
    expect(classifyApiError(apiError(404, "not_found_error", "model: claude-x"))).toMatchObject({ code: "model_unavailable", kind: "pause" });
  });

  it("retries temporary errors, honouring retry-after", () => {
    expect(classifyApiError(apiError(429, "rate_limit_error", "Number of requests exceeded", { "retry-after": "42" }))).toEqual({
      code: "rate_limited",
      kind: "retry",
      message: expect.any(String),
      retryAfterSeconds: 42,
    });
    expect(classifyApiError(apiError(529, "overloaded_error", "Overloaded"))).toMatchObject({ code: "overloaded", kind: "retry" });
    expect(classifyApiError(apiError(500, "api_error", "Internal"))).toMatchObject({ code: "server_error", kind: "retry" });
    expect(classifyApiError(new Anthropic.APIConnectionTimeoutError())).toMatchObject({ code: "timeout", kind: "retry" });
    expect(classifyApiError(new Anthropic.APIConnectionError({ message: "reset" }))).toMatchObject({ code: "connection", kind: "retry" });
    expect(classifyApiError(new Error("boom"))).toMatchObject({ code: "unexpected", kind: "retry" });
  });

  it("treats other request errors as fatal", () => {
    expect(classifyApiError(apiError(422, "invalid_request_error", "bad schema"))).toMatchObject({ code: "http_422", kind: "fatal" });
  });
});

function graded(verdicts: Record<string, string>, model = "claude-haiku-5-5"): { message: ClaudeMessage; requestId: string } {
  return {
    message: {
      content: [
        {
          text: JSON.stringify({
            confidence: "high",
            flags: [],
            questions: Object.entries(verdicts).map(([label, verdict]) => ({
              error_location: "",
              extracted_final_answer: "",
              label,
              note_for_parent: "",
              reason_for_teacher: verdict,
              verdict,
            })),
          }),
          type: "text",
        },
      ],
      model,
      stop_reason: "end_turn",
      usage: { cache_creation_input_tokens: 0, cache_read_input_tokens: 2000, input_tokens: 300, output_tokens: 700 },
    },
    requestId: `req_${model}`,
  };
}

function gradeRun(id: string, payload: Record<string, unknown>, attempt = 1): ClaimedRun {
  return {
    answer_key_version: 1,
    attempt_count: attempt,
    effort: "medium",
    model: "claude-haiku-5-5",
    payload: { answer_key: KEY, counts_for_score: true, current_key_version: 1, double_check: true, test_title: "Đề", tiebreak_model: "claude-sonnet-5-5", ...payload } as never,
    prompt_version: "grade-v2",
    run_id: id,
    run_type: "grade",
    submission_id: `sub-${id}`,
    test_id: "test-1",
  };
}

function fakeSupabase(batches: ClaimedRun[][], completeReturns: (args: Record<string, unknown>) => string = (args) => (args.p_outcome === "paused" ? "paused" : "applied")) {
  const queue = [...batches];
  const completed: Array<Record<string, unknown>> = [];
  const download = vi.fn(async (path: string) => ({ data: new Blob([`image:${path}`]), error: null }));
  const supabase = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_grading_runs") return { data: queue.shift() ?? [], error: null };
      if (name === "complete_grading_run") {
        completed.push(args);
        return { data: completeReturns(args), error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    }),
    storage: { from: vi.fn(() => ({ download })) },
  };
  return { completed, download, supabase: supabase as never };
}

function caller(grade: ClaudeCaller["grade"], readKey: ClaudeCaller["readKey"] = vi.fn()): ClaudeCaller & { grade: ReturnType<typeof vi.fn> } {
  return { grade: vi.fn(grade), readKey: vi.fn(readKey) } as never;
}

describe("runGradingWorker: grading", () => {
  it("grades twice, skips the tiebreak when both agree, and sends one result with summed usage", async () => {
    const fake = fakeSupabase([[gradeRun("a", { answer_text: "13. 54 14. 9" })]]);
    const claude = caller(async () => graded({ "13": "correct", "14": "incorrect" }));
    const summary = await runGradingWorker({ caller: claude, supabase: fake.supabase });

    expect(summary).toEqual({ claimed: 1, outcomes: { applied: 1 }, stopped: "idle" });
    expect(claude.grade).toHaveBeenCalledTimes(2);
    const done = fake.completed[0];
    expect(done).toMatchObject({ p_outcome: "succeeded", p_run_id: "a" });
    expect(done.p_result).toMatchObject({ color: "green", runs_agree: true, used_tiebreak: false, verdicts: { "13": "correct", "14": "incorrect" } });
    expect((done.p_result as { calls: unknown[] }).calls).toHaveLength(2);
    expect(done.p_usage).toMatchObject({ cache_read_tokens: 4000, input_tokens: 600, model: "claude-haiku-5-5", output_tokens: 1400, request_id: "req_claude-haiku-5-5" });
    expect((done.p_usage as { cost_usd: number }).cost_usd).toBeGreaterThan(0);
  });

  it("calls the tiebreak model only when the two runs disagree", async () => {
    const fake = fakeSupabase([[gradeRun("b", { answer_text: "13. 54 14. 8" })]]);
    let call = 0;
    const claude = caller(async (params) => {
      call += 1;
      if (params.model === "claude-sonnet-5-5") return graded({ "13": "correct", "14": "correct" }, "claude-sonnet-5-5");
      return graded(call === 1 ? { "13": "correct", "14": "correct" } : { "13": "correct", "14": "incorrect" });
    });
    await runGradingWorker({ caller: claude, supabase: fake.supabase });
    expect(claude.grade).toHaveBeenCalledTimes(3);
    expect(claude.grade.mock.calls[2][0].model).toBe("claude-sonnet-5-5");
    expect(fake.completed[0].p_result).toMatchObject({ color: "green", used_tiebreak: true, verdicts: { "14": "correct" } });
  });

  it("never calls Claude for a blank or stale paper", async () => {
    const fake = fakeSupabase([[gradeRun("blank", { answer_text: "   " }), gradeRun("stale", { answer_text: "x", current_key_version: 2 })]]);
    const claude = caller(async () => graded({}));
    await runGradingWorker({ caller: claude, supabase: fake.supabase });
    expect(claude.grade).not.toHaveBeenCalled();
    expect(fake.completed.find((row) => row.p_run_id === "blank")?.p_result).toMatchObject({ color: "yellow", flags: ["empty"] });
    expect(fake.completed.find((row) => row.p_run_id === "stale")?.p_result).toEqual({ skipped: "stale" });
  });

  it("pauses on a billing error and stops claiming", async () => {
    const fake = fakeSupabase([[gradeRun("c", { answer_text: "x" })], [gradeRun("d", { answer_text: "y" })]]);
    const claude = caller(async () => {
      throw apiError(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.");
    });
    const summary = await runGradingWorker({ caller: claude, supabase: fake.supabase });
    expect(summary).toMatchObject({ claimed: 1, stopped: "paused" });
    expect(fake.completed[0]).toMatchObject({ p_error_code: "credit_exhausted", p_outcome: "paused", p_run_id: "c" });
  });

  it("asks for a retry when every call hit a temporary error", async () => {
    const fake = fakeSupabase([[gradeRun("e", { answer_text: "x" })]]);
    const claude = caller(async () => {
      throw apiError(429, "rate_limit_error", "slow down", { "retry-after": "30" });
    });
    await runGradingWorker({ caller: claude, supabase: fake.supabase });
    expect(fake.completed[0]).toMatchObject({ p_error_code: "rate_limited", p_outcome: "retry", p_retry_after_seconds: 30 });
  });

  it("does nothing without an API key, and stops claiming when time runs short", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await runGradingWorker({ supabase: fakeSupabase([]).supabase })).toEqual({ claimed: 0, outcomes: {}, stopped: "no_api_key" });
    const fake = fakeSupabase([[gradeRun("f", { answer_text: "x" })]]);
    expect(await runGradingWorker({ caller: caller(async () => graded({})), deadlineMs: 1000, reserveMs: 5000, supabase: fake.supabase })).toMatchObject({
      claimed: 0,
      stopped: "time",
    });
  });
});

describe("runGradingWorker: key reading", () => {
  const keyRun: ClaimedRun = {
    answer_key_version: 0,
    attempt_count: 1,
    effort: "high",
    model: "claude-opus-5-5",
    payload: { pages: [{ mime_type: "image/jpeg", page_no: 1, storage_path: "t/p1.jpg" }, { mime_type: "image/png", page_no: 2, storage_path: "t/p2.png" }], test_status: "key_review" } as never,
    prompt_version: "key-v1",
    run_id: "k",
    run_type: "extract_key",
    submission_id: null as never,
    test_id: "test-1",
  };

  it("downloads the pages and asks the key model with the fallback beta", async () => {
    const fake = fakeSupabase([[keyRun]]);
    const readKey = vi.fn<ClaudeCaller["readKey"]>(async () => ({
      message: {
        content: [{ text: JSON.stringify({ questions: [{ final_answer: "54", label: "13", max_points: null }], title: "LT", total_points_printed: null, transcription_warnings: ["mờ"] }), type: "text" }],
        model: "claude-opus-5-5",
        stop_reason: "end_turn",
        usage: { input_tokens: 4000, iterations: [{ type: "message" }], output_tokens: 1800 },
      } as ClaudeMessage,
      requestId: "req_k",
    }));
    await runGradingWorker({ caller: { grade: vi.fn(), readKey }, supabase: fake.supabase });

    expect(fake.download.mock.calls.map((call) => call[0])).toEqual(["t/p1.jpg", "t/p2.png"]);
    const params = readKey.mock.calls[0][0] as unknown as Record<string, unknown> & { messages: Array<{ content: Array<Record<string, unknown>> }> };
    expect(params).toMatchObject({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", model: "claude-opus-5-5", system: KEY_INSTRUCTIONS });
    expect(params.messages[0].content.filter((block) => block.type === "image").map((block) => (block.source as { media_type: string }).media_type)).toEqual([
      "image/jpeg",
      "image/png",
    ]);
    expect(fake.completed[0]).toMatchObject({ p_outcome: "succeeded", p_run_id: "k" });
    expect(fake.completed[0].p_result).toMatchObject({ fallback_used: false, served_by: "claude-opus-5-5", title: "LT", transcription_warnings: ["mờ"] });
  });

  it("retries when a page cannot be downloaded", async () => {
    const fake = fakeSupabase([[keyRun]]);
    fake.download.mockResolvedValueOnce({ data: null, error: { message: "not found" } } as never);
    const readKey = vi.fn();
    await runGradingWorker({ caller: { grade: vi.fn(), readKey }, supabase: fake.supabase });
    expect(readKey).not.toHaveBeenCalled();
    expect(fake.completed[0]).toMatchObject({ p_error_code: "storage_error", p_outcome: "retry" });
  });
});

describe("POST /api/internal/ai-grading/worker", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/features/ai-grading/worker");
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadRoute() {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ getAnthropicApiKey: routeMocks.key, getCronSecret: routeMocks.cron }));
    vi.doMock("@/features/ai-grading/worker", () => ({ runGradingWorker: routeMocks.run }));
    return import("@/app/api/internal/ai-grading/worker/route");
  }

  const SECRET = "cron-secret-0123456789abcdef0123456789";
  const request = (authorization?: string) =>
    new Request("https://erp.example/api/internal/ai-grading/worker", { headers: authorization ? { authorization } : {}, method: "POST" });

  it("needs CRON_SECRET and the exact bearer value", async () => {
    const { POST } = await loadRoute();
    routeMocks.cron.mockReturnValue(null);
    expect((await POST(request(`Bearer ${SECRET}`))).status).toBe(503);
    routeMocks.cron.mockReturnValue(SECRET);
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request(`Bearer ${SECRET}x`))).status).toBe(401);
    expect(routeMocks.run).not.toHaveBeenCalled();
  });

  it("runs one batch and reports it", async () => {
    const { POST } = await loadRoute();
    routeMocks.cron.mockReturnValue(SECRET);
    routeMocks.key.mockReturnValue(null);
    expect(await (await POST(request(`Bearer ${SECRET}`))).json()).toEqual({ ok: true, stopped: "no_api_key" });
    expect(routeMocks.run).not.toHaveBeenCalled();
    routeMocks.key.mockReturnValue("sk-ant-test");
    routeMocks.run.mockResolvedValue({ claimed: 3, outcomes: { applied: 3 }, stopped: "idle" });
    const response = await POST(request(`Bearer ${SECRET}`));
    expect(await response.json()).toEqual({ claimed: 3, ok: true, outcomes: { applied: 3 }, stopped: "idle" });
    expect(routeMocks.run).toHaveBeenCalledWith({ deadlineMs: 280_000 });
  });
});
