import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  alert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getGradingFormEnv: vi.fn(() => ({ secret: "test-secret-0123456789abcdef0123456789" })),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ rpc: harness.rpc })),
}));
vi.mock("@/lib/ops-alerts", () => ({ raiseOpsAlert: harness.alert }));

import { GET } from "@/app/api/integrations/grading-roster/route";
import { POST } from "@/app/api/webhooks/grading-submissions/route";
import { signGradingMessage } from "@/features/grading-submissions/signature";
import { getGradingFormEnv } from "@/lib/env";

const SECRET = "test-secret-0123456789abcdef0123456789";
const NOW = new Date("2026-10-18T12:40:00.000Z"); // 19:40 in Vietnam
const STUDENT_ID = "3a000000-0000-4000-8000-000000000041";
const SESSION_ID = "3a000000-0000-4000-8000-000000000031";
const SUBMISSION_ID = "3a000000-0000-4000-8000-000000000071";

const payload = {
  answerText: "13. x=18",
  birthYear: 2014,
  classOption: null,
  classOptionOther: null,
  classSessionId: SESSION_ID,
  externalId: "0b8f6c1e-5d2a-4c1b-9a3e-7f2d1c0b9a8e",
  fullName: "Nguyễn Minh Anh",
  studentCode: "TV-2026-00001",
  submittedAt: "2026-10-18T19:35:00+07:00",
  version: 1,
};

function webhookRequest(body: string, { signature, timestamp }: { signature?: string; timestamp?: number } = {}) {
  const ts = timestamp ?? Math.floor(NOW.getTime() / 1000);
  return new Request("https://erp.example/api/webhooks/grading-submissions", {
    body,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-ttv-signature": signature ?? signGradingMessage(SECRET, ts, body),
      "x-ttv-timestamp": String(ts),
    },
    method: "POST",
  });
}

function rosterRequest(query: string, signedQuery = query) {
  const ts = Math.floor(NOW.getTime() / 1000);
  return new Request(`https://erp.example/api/integrations/grading-roster${query}`, {
    headers: {
      "x-ttv-signature": signGradingMessage(SECRET, ts, `GET /api/integrations/grading-roster${signedQuery}`),
      "x-ttv-timestamp": String(ts),
    },
  });
}

function mockRpc(results: Record<string, { data?: unknown; error?: unknown }>) {
  harness.rpc.mockImplementation(async (name: string) => results[name] ?? { data: null, error: { message: `unexpected ${name}` } });
}

const happyRpc = {
  get_grading_session_candidates: {
    data: [
      { attendance_status: null, class_code: "7CLC1", class_level: "CLC", class_session_id: SESSION_ID, end_time: "19:30:00", on_roster: true, session_date: "2026-10-18", session_status: "in_progress", start_time: "18:00:00" },
    ],
    error: null,
  },
  get_grading_student_candidates: {
    data: [{ birth_year: 2014, candidate_source: "code", full_name: "Nguyễn Minh Anh", public_code: "TV-2026-00001", student_id: STUDENT_ID }],
    error: null,
  },
  record_grading_submission: {
    data: [{ counts_for_score: true, inserted: true, match_status: "matched", submission_id: SUBMISSION_ID }],
    error: null,
  },
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.mocked(getGradingFormEnv).mockReturnValue({ secret: SECRET });
  harness.rpc.mockReset();
  harness.alert.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/webhooks/grading-submissions", () => {
  it("matches and records a signed submission", async () => {
    mockRpc(happyRpc);
    const response = await POST(webhookRequest(JSON.stringify(payload)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ duplicate: false, matchStatus: "matched", ok: true });
    expect(harness.rpc).toHaveBeenCalledWith("get_grading_student_candidates", { p_birth_year: 2014, p_on: "2026-10-18", p_student_code: "TV-2026-00001" });
    expect(harness.rpc).toHaveBeenCalledWith("get_grading_session_candidates", { p_on: "2026-10-18", p_student_id: STUDENT_ID });
    expect(harness.rpc).toHaveBeenCalledWith(
      "record_grading_submission",
      expect.objectContaining({
        p_class_session_id: SESSION_ID,
        p_external_id: payload.externalId,
        p_match_issues: [],
        p_match_status: "matched",
        p_session_match_method: "claimed_session",
        p_student_id: STUDENT_ID,
        p_student_match_method: "student_code",
        p_submitted_at: "2026-10-18T12:35:00.000Z",
      }),
    );
  });

  it("uses the Vietnam date of the submission for candidates (00:30 in Vietnam is still the previous UTC day)", async () => {
    mockRpc({ ...happyRpc, get_grading_session_candidates: { data: [], error: null } });
    const response = await POST(webhookRequest(JSON.stringify({ ...payload, submittedAt: "2026-10-18T17:30:00Z" })));

    expect(response.status).toBe(200);
    expect(harness.rpc).toHaveBeenCalledWith("get_grading_session_candidates", { p_on: "2026-10-19", p_student_id: STUDENT_ID });
    expect(harness.rpc).toHaveBeenCalledWith(
      "record_grading_submission",
      expect.objectContaining({ p_class_session_id: null, p_match_issues: ["claimed_session_mismatch", "no_session_today"], p_match_status: "needs_review" }),
    );
  });

  it("skips session lookup when the student is not found and records for review", async () => {
    mockRpc({ ...happyRpc, get_grading_student_candidates: { data: [], error: null } });
    const response = await POST(webhookRequest(JSON.stringify({ ...payload, studentCode: null })));

    expect(response.status).toBe(200);
    expect(harness.rpc).not.toHaveBeenCalledWith("get_grading_session_candidates", expect.anything());
    expect(harness.rpc).toHaveBeenCalledWith(
      "record_grading_submission",
      expect.objectContaining({ p_match_issues: ["student_not_found"], p_match_status: "needs_review", p_student_id: null }),
    );
  });

  it("answers 200 duplicate for a resend", async () => {
    mockRpc({ ...happyRpc, record_grading_submission: { data: [{ counts_for_score: true, inserted: false, match_status: "matched", submission_id: SUBMISSION_ID }], error: null } });
    const response = await POST(webhookRequest(JSON.stringify(payload)));
    expect(await response.json()).toEqual({ duplicate: true, matchStatus: "matched", ok: true });
  });

  it("rejects a bad signature, a stale timestamp, a non-JSON request, an invalid body and a missing secret", async () => {
    mockRpc(happyRpc);
    const body = JSON.stringify(payload);

    expect((await POST(webhookRequest(body, { signature: "sha256=00" }))).status).toBe(401);
    expect((await POST(webhookRequest(body, { timestamp: Math.floor(NOW.getTime() / 1000) - 301 }))).status).toBe(401);
    expect(
      (await POST(new Request("https://erp.example/api/webhooks/grading-submissions", { body, headers: { "content-type": "text/plain" }, method: "POST" }))).status,
    ).toBe(415);
    expect((await POST(webhookRequest(JSON.stringify({ ...payload, externalId: "x" })))).status).toBe(400);

    vi.mocked(getGradingFormEnv).mockImplementation(() => {
      throw new Error("missing");
    });
    expect((await POST(webhookRequest(body))).status).toBe(503);
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("accepts a long Vietnamese answer (cut later) but rejects a body over 256 KB", async () => {
    mockRpc(happyRpc);
    const long = await POST(webhookRequest(JSON.stringify({ ...payload, answerText: "Câu ước lượng ".repeat(2_000) })));
    expect(long.status).toBe(200);
    expect(harness.rpc).toHaveBeenCalledWith("record_grading_submission", expect.objectContaining({ p_answer_truncated: true }));

    harness.rpc.mockClear();
    const response = await POST(webhookRequest(JSON.stringify({ ...payload, answerText: "x".repeat(270_000) })));
    expect(response.status).toBe(413);
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("answers 422 without an alert when the database refuses the data itself, so Apps Script stops resending", async () => {
    mockRpc({ ...happyRpc, record_grading_submission: { data: null, error: { code: "23514", message: "check" } } });
    const response = await POST(webhookRequest(JSON.stringify(payload)));

    expect(response.status).toBe(422);
    expect(harness.alert).not.toHaveBeenCalled();
  });

  it("answers 500 and raises one ops alert per day when the database fails, so Apps Script resends", async () => {
    mockRpc({ ...happyRpc, record_grading_submission: { data: null, error: { message: "boom" } } });
    const response = await POST(webhookRequest(JSON.stringify(payload)));

    expect(response.status).toBe(500);
    expect(harness.alert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: "grading_submission_ingest_failed", dedupeKey: "ops.grading_submission_ingest_failed:2026-10-18" }),
    );
  });
});

describe("GET /api/integrations/grading-roster", () => {
  it("lists birth years without a query", async () => {
    mockRpc({ get_grading_form_birth_years: { data: [{ birth_year: 2014, student_count: 30 }, { birth_year: 2013, student_count: 25 }], error: null } });
    const response = await GET(rosterRequest(""));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ birthYears: [2014, 2013], date: "2026-10-18", ok: true });
    expect(harness.rpc).toHaveBeenCalledWith("get_grading_form_birth_years", { p_on: "2026-10-18" });
  });

  it("returns the sorted roster of one birth year with masked namesake hints", async () => {
    mockRpc({
      get_grading_form_roster: {
        data: [
          { full_name: "Trần Văn Bình", guardian_phone_last4: "1111", nickname: null, public_code: "TV-2026-00003", sessions: [], student_id: STUDENT_ID },
          { full_name: "Nguyễn Minh Anh", guardian_phone_last4: "4828", nickname: null, public_code: "TV-2026-00001", sessions: [{ class_code: "7CLC1", end_time: "19:30:00", id: SESSION_ID, start_time: "18:00:00" }], student_id: "3a000000-0000-4000-8000-000000000042" },
          { full_name: "Nguyễn Minh Anh", guardian_phone_last4: "2020", nickname: "Bông", public_code: "TV-2026-00002", sessions: [], student_id: "3a000000-0000-4000-8000-000000000043" },
        ],
        error: null,
      },
    });
    const response = await GET(rosterRequest("?birthYear=2014"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(harness.rpc).toHaveBeenCalledWith("get_grading_form_roster", { p_birth_year: 2014, p_on: "2026-10-18" });
    expect(body.students.map((student: { label: string }) => student.label)).toEqual([
      "Nguyễn Minh Anh (PH ***4828)",
      "Nguyễn Minh Anh (PH ***2020)",
      "Trần Văn Bình",
    ]);
    expect(body.students[0]).toMatchObject({ code: "TV-2026-00001", givenName: "Anh", sessions: [{ id: SESSION_ID, label: "7CLC1 · 18:00–19:30" }] });
    expect(body.students[1].givenName).toBe("Bông");
    expect(JSON.stringify(body)).not.toContain("1111");
  });

  it("rejects a signature made for another query and a malformed birth year", async () => {
    mockRpc({});
    expect((await GET(rosterRequest("?birthYear=2013", "?birthYear=2014"))).status).toBe(401);
    expect((await GET(rosterRequest("?birthYear=20x4"))).status).toBe(400);
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
