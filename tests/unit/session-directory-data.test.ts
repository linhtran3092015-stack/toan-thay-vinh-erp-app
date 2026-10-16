// Value: protects=getSessionDirectory's counts are exact past PostgREST's 1000-row cap (150-id chunks, each paged), attendance is split into the lock-rule marks (present + absences) and result-eligible students (present + additional_study) while attendanceCount keeps counting every row for the reports export, the attendance and result reads start together, the cancel reason is read and the meeting link reaches the list only as a flag;
// fails_when=a single unpaged `in` read silently undercounts, more than 150 ids go into one URL, additional_study inflates the roster marks, attendanceCount changes meaning, an attendance or result page failure shows zeros instead of an error, the result read waits for every attendance page, the meeting URL string is passed on, or the counts are read without the permission;
// why_new=step 14a (D4) changes the loader; Supabase is faked at its client boundary; seam=createSupabaseServerClient; no_claim=does not prove PostgREST accepts these filters or that RLS returns these rows
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => supabase) }));

import { getSessionDirectory } from "@/features/sessions/data";

type Call = [string, unknown[]];
interface Row { class_session_id: string; id: number; [key: string]: unknown }

const sessionIds = Array.from({ length: 200 }, (_, index) => `s-${String(index).padStart(3, "0")}`);
const sessionRows = sessionIds.map((id, index) => ({
  cancellation_reason: index === 0 ? "Trùng lịch thi" : null,
  class: { code: "7A", grade: 7, id: "class-1", level: "A", name: "Toán 7A" },
  class_id: "class-1",
  component_code: null,
  end_time: "10:00:00",
  id,
  learning_mode: index === 1 ? "online" : "offline",
  locked_at: null,
  meeting_url: index === 1 ? "https://meet.example/7a" : index === 2 ? "   " : null,
  room_name: "P.102",
  session_date: "2026-10-12",
  session_kind: "regular",
  start_time: "08:00:00",
  status: index === 0 ? "cancelled" : "completed",
}));
// 8 marks per session: 4 present, 2 absences, 2 walk-ins (additional_study) → 1 200 rows in the first 150-id chunk.
const attendanceStatuses = ["present", "present", "present", "present", "excused_absence", "unexcused_absence", "additional_study", "additional_study"];
const attendanceRows: Row[] = sessionIds.flatMap((sessionId, sessionIndex) =>
  attendanceStatuses.map((status, index) => ({ attendance_status: status, class_session_id: sessionId, id: sessionIndex * 10 + index })),
);
// 7 results per session → 1 050 rows in the first chunk, two pages.
const resultRows: Row[] = sessionIds.flatMap((sessionId, sessionIndex) =>
  Array.from({ length: 7 }, (_, index) => ({ class_session_id: sessionId, id: sessionIndex * 10 + index })),
);

// Every builder call in order, across tables, to see which reads start before others finish.
const order: string[] = [];

function builder(table: string, calls: Call[], failRange?: (from: number) => boolean) {
  const state: { ids: string[] | null; range: [number, number] | null } = { ids: null, range: null };
  const self: Record<string, unknown> = {};
  for (const method of ["select", "order", "gte", "lte", "limit", "in", "range"]) {
    self[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      if (method === "range") order.push(`${table}:range:${String(args[0])}`);
      if (method === "in") state.ids = args[1] as string[];
      if (method === "range") state.range = [args[0] as number, args[1] as number];
      return self;
    });
  }
  self.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    if (table === "class_sessions") return Promise.resolve({ data: sessionRows, error: null }).then(resolve, reject);
    const source = table === "session_attendance" ? attendanceRows : resultRows;
    const [from, to] = state.range ?? [0, Number.MAX_SAFE_INTEGER];
    if (failRange?.(from)) return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve, reject);
    // PostgREST caps every response at 1000 rows, whatever the range asks for.
    const matching = source.filter((row) => state.ids?.includes(row.class_session_id)).sort((left, right) => left.id - right.id);
    const page = matching.slice(from, Math.min(to + 1, from + 1000));
    return Promise.resolve({ data: page.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id"))), error: null }).then(resolve, reject);
  };
  return self;
}

function tables(options: { failAttendanceRange?: (from: number) => boolean; failResultsRange?: (from: number) => boolean } = {}) {
  const calls: Record<string, Call[]> = {};
  supabase.from.mockImplementation((table: string) => {
    calls[table] ??= [];
    const failRange = table === "session_attendance" ? options.failAttendanceRange : table === "session_results" ? options.failResultsRange : undefined;
    return builder(table, calls[table], failRange);
  });
  return calls;
}

beforeEach(() => {
  supabase.from.mockReset();
  order.length = 0;
});

describe("getSessionDirectory counts (step 14a, D4)", () => {
  it("reads attendance and results in 150-id chunks, paged past 1000 rows, with exact per-session counts", async () => {
    const calls = tables();
    const result = await getSessionDirectory({ includeAttendanceCounts: true, includeResultCounts: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions).toHaveLength(200);
    for (const item of result.sessions) {
      expect(item).toMatchObject({ attendanceCount: 8, markedRosterCount: 6, resultCount: 7, resultEligibleCount: 6 });
    }

    const attendanceIn = calls.session_attendance.filter(([method]) => method === "in").map(([, args]) => (args[1] as string[]).length);
    expect(Math.max(...attendanceIn)).toBe(150);
    expect(new Set(attendanceIn)).toEqual(new Set([150, 50]));
    expect(calls.session_attendance).toContainEqual(["range", [1000, 1999]]);
    expect(calls.session_attendance).toContainEqual(["select", ["class_session_id, attendance_status"]]);
    expect(calls.session_results).toContainEqual(["range", [1000, 1999]]);
    expect(calls.session_attendance.filter(([method]) => method === "order")).toContainEqual(["order", ["id", { ascending: true }]]);
    // The result reads start before the attendance read reaches its second page: they run together.
    expect(order.indexOf("session_results:range:0")).toBeGreaterThan(-1);
    expect(order.indexOf("session_results:range:0")).toBeLessThan(order.indexOf("session_attendance:range:1000"));
  });

  it("reads the cancel reason and the meeting link with the session", async () => {
    const calls = tables();
    const result = await getSessionDirectory({});

    const select = String(calls.class_sessions.find(([method]) => method === "select")?.[1][0]);
    expect(select).toContain("cancellation_reason");
    expect(select).toContain("meeting_url");
    expect(result.ok && result.sessions[0]).toMatchObject({ cancellationReason: "Trùng lịch thi", status: "cancelled" });
    expect(result.ok && result.sessions[1]).toMatchObject({ hasMeetingUrl: true, learningMode: "online" });
    // A blank link is no link, and the URL string itself never leaves the loader.
    expect(result.ok && result.sessions[2]).toMatchObject({ hasMeetingUrl: false });
    expect(result.ok && result.sessions[1]).not.toHaveProperty("meetingUrl");
    expect(JSON.stringify(result)).not.toContain("meet.example");
    // Without the permissions the counts are not read and stay null, never 0.
    expect(calls.session_attendance).toBeUndefined();
    expect(calls.session_results).toBeUndefined();
    expect(result.ok && result.sessions[2]).toMatchObject({ attendanceCount: null, markedRosterCount: null, resultCount: null, resultEligibleCount: null });
  });

  it("fails the directory instead of showing undercounts when a page of attendance fails", async () => {
    tables({ failAttendanceRange: (from) => from === 1000 });
    const result = await getSessionDirectory({ includeAttendanceCounts: true });

    expect(result).toEqual({ error: { code: "query_failed", message: "Không thể tải số lượng điểm danh của các buổi học." }, ok: false });
  });

  it("fails the directory instead of showing undercounts when a page of results fails", async () => {
    tables({ failResultsRange: (from) => from === 1000 });
    const result = await getSessionDirectory({ includeAttendanceCounts: true, includeResultCounts: true });

    expect(result).toEqual({ error: { code: "query_failed", message: "Không thể tải số lượng kết quả của các buổi học." }, ok: false });
  });
});
