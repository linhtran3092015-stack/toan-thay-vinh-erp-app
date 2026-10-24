import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: dependencies.from,
    rpc: dependencies.rpc,
  })),
}));

import { getSessionDetail } from "@/features/sessions/detail-data";

describe("Session detail composite roster transport", () => {
  beforeEach(() => {
    dependencies.from.mockReset();
    dependencies.rpc.mockReset();
    dependencies.from.mockImplementation((table: string) => {
      if (table !== "class_sessions") {
        throw new Error(`Unexpected table query: ${table}`);
      }

      const sessionQuery = {
        eq: vi.fn(),
        maybeSingle: vi.fn(async () => ({
          data: {
            cancellation_reason: null,
            cancelled_at: null,
            class: {
              code: "5A",
              grade: 5,
              id: "component-5a",
              level: "A",
              name: "5A",
              status: "active",
            },
            class_id: "component-5a",
            completed_at: null,
            component_code: null,
            end_time: "19:30:00",
            id: "session-5a",
            learning_mode: "offline",
            locked_at: null,
            lock_reason: null,
            meeting_url: null,
            notes: null,
            room_name: "P. 5A",
            session_date: "2030-08-05",
            session_kind: "regular",
            started_at: null,
            start_time: "18:00:00",
            status: "scheduled",
          },
          error: null,
        })),
        select: vi.fn(),
      };
      sessionQuery.select.mockReturnValue(sessionQuery);
      sessionQuery.eq.mockReturnValue(sessionQuery);
      return sessionQuery;
    });
  });

  it("maps the canonical resolver's real composite enrollment identity", async () => {
    dependencies.rpc.mockResolvedValue({
      data: [{
        enrollment_class_id: "official-5a1",
        registered_mode: "offline",
        student_enrollment_id: "enrollment-5a1",
        student_id: "student-5a1",
      }],
      error: null,
    });

    const result = await getSessionDetail("session-5a", {
      includeRoster: true,
    });

    expect(dependencies.rpc).toHaveBeenCalledWith(
      "resolve_class_session_roster",
      { p_class_session_id: "session-5a" },
    );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new Error("Expected session detail result");
    }
    expect(result.detail.rosterCount).toBe(1);
    expect(result.detail.participants).toEqual([
      expect.objectContaining({
        enrollmentClassId: "official-5a1",
        enrollmentId: "enrollment-5a1",
        registeredMode: "offline",
        studentId: "student-5a1",
      }),
    ]);
  });

  // Value: protects=the session page's attendance and result roster lists students by given name (last word), then family and middle names;
  // fails_when=getSessionDetail goes back to full-name (family-first) order or keeps the roster RPC's order;
  // why_new=the existing cases load one participant, so no test saw the roster order;
  // seam=none; no_claim=mocked Supabase client; does not prove the attendance/result components keep this order
  it("lists the session roster by given name, not by family name", async () => {
    const roster = (studentId: string) => ({
      enrollment_class_id: "official-5a1",
      registered_mode: "offline",
      student_enrollment_id: `enrollment-${studentId}`,
      student_id: studentId,
    });
    dependencies.rpc.mockResolvedValue({
      data: [roster("student-yen"), roster("student-an"), roster("student-binh")],
      error: null,
    });
    const sessionTable = dependencies.from.getMockImplementation();
    dependencies.from.mockImplementation((table: string) => {
      if (table !== "students") return sessionTable?.(table);
      const studentQuery = {
        in: vi.fn(async () => ({
          // The database hands names back in full_name order, i.e. by family name.
          data: [
            { current_grade: 5, full_name: "Bùi Thị Yến", id: "student-yen", public_code: "TTV-1" },
            { current_grade: 5, full_name: "Lê Văn Bình", id: "student-binh", public_code: "TTV-2" },
            { current_grade: 5, full_name: "Trần Minh An", id: "student-an", public_code: "TTV-3" },
          ],
          error: null,
        })),
        select: vi.fn(),
      };
      studentQuery.select.mockReturnValue(studentQuery);
      return studentQuery;
    });

    const result = await getSessionDetail("session-5a", {
      includeRoster: true,
      includeStudentIdentity: true,
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new Error("Expected session detail result");
    }
    expect(result.detail.participants.map((participant) => participant.studentName)).toEqual([
      "Trần Minh An",
      "Lê Văn Bình",
      "Bùi Thị Yến",
    ]);
  });

  it("returns a roster-specific failure without fabricating direct enrollment data", async () => {
    dependencies.rpc.mockResolvedValue({
      data: null,
      error: { message: "SESSION_ROSTER_VIEW_PERMISSION_DENIED" },
    });

    await expect(getSessionDetail("session-5a", {
      includeRoster: true,
    })).resolves.toMatchObject({
      error: { code: "query_failed" },
      ok: false,
    });
  });

  type QueryResponse = { data: unknown; error: unknown };
  const failed = (message: string): QueryResponse => ({ data: null, error: { message } });

  /** Answers the session's other tables; any table left out falls back to the session-only mock above (which throws). */
  function routeTables(tables: { attendance?: QueryResponse; results?: QueryResponse; session?: QueryResponse; students?: QueryResponse }) {
    const sessionOnly = dependencies.from.getMockImplementation();
    dependencies.from.mockImplementation((table: string) => {
      if (table === "class_sessions" && tables.session) {
        const sessionQuery = { eq: vi.fn(), maybeSingle: vi.fn(async () => tables.session), select: vi.fn() };
        sessionQuery.select.mockReturnValue(sessionQuery);
        sessionQuery.eq.mockReturnValue(sessionQuery);
        return sessionQuery;
      }
      const response = ({ session_attendance: tables.attendance, session_results: tables.results, students: tables.students } as Record<string, QueryResponse | undefined>)[table];
      if (!response) return sessionOnly?.(table);
      const query = { eq: vi.fn(async () => response), in: vi.fn(async () => response), select: vi.fn() };
      query.select.mockReturnValue(query);
      return query;
    });
  }

  const rosterRow = (studentId: string, registeredMode: string) => ({
    enrollment_class_id: "official-5a1",
    registered_mode: registeredMode,
    student_enrollment_id: `enrollment-${studentId}`,
    student_id: studentId,
  });

  // Generated by /ship test audit (Claude Opus 5.5) — 2026-10-24
  // Value: protects=getSessionDetail's parallel load gives each student their own attendance row (status, mode, notes, late flag) and result row (scores, notebook, comment);
  // fails_when=the Promise.all responses are destructured in the wrong order or read from the wrong response, so attendance shows result data or a student gets another's row;
  // why_new=the cases above load the roster only; no test fed attendance or result rows through getSessionDetail; seam=none;
  // no_claim=mocked Supabase client; does not prove the real queries, RLS or the roster RPC
  it("puts each student's attendance and result rows on that student", async () => {
    dependencies.rpc.mockResolvedValue({ data: [rosterRow("student-an", "offline"), rosterRow("student-binh", "online")], error: null });
    routeTables({
      attendance: {
        data: [
          { actual_learning_mode: "online", attendance_status: "present", id: "att-an", is_late_update: true, notes: "Học online hôm nay", student_enrollment_id: "enrollment-student-an", student_id: "student-an" },
          { actual_learning_mode: "offline", attendance_status: "excused_absence", id: "att-binh", is_late_update: false, notes: null, student_enrollment_id: "enrollment-student-binh", student_id: "student-binh" },
        ],
        error: null,
      },
      results: {
        data: [{ comment: "Làm bài tốt", id: "result-an", notebook_score: 9, notebook_status: "submitted", student_id: "student-an", test_score: 8.5 }],
        error: null,
      },
      students: {
        data: [
          { current_grade: 5, full_name: "Lê Văn Bình", id: "student-binh", public_code: "TTV-2" },
          { current_grade: 5, full_name: "Trần Minh An", id: "student-an", public_code: "TTV-3" },
        ],
        error: null,
      },
    });

    const result = await getSessionDetail("session-5a", {
      includeAttendance: true,
      includeResults: true,
      includeRoster: true,
      includeStudentIdentity: true,
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new Error("Expected session detail result");
    }
    expect(result.detail).toMatchObject({ attendanceCount: 2, resultCount: 1, rosterCount: 2 });
    expect(result.detail.participants).toEqual([
      expect.objectContaining({
        actualLearningMode: "online",
        attendanceId: "att-an",
        attendanceNotes: "Học online hôm nay",
        attendanceStatus: "present",
        isLateUpdate: true,
        notebookScore: 9,
        notebookStatus: "submitted",
        registeredMode: "offline",
        resultComment: "Làm bài tốt",
        resultId: "result-an",
        studentId: "student-an",
        studentName: "Trần Minh An",
        testScore: 8.5,
      }),
      expect.objectContaining({
        actualLearningMode: "offline",
        attendanceId: "att-binh",
        attendanceStatus: "excused_absence",
        isLateUpdate: false,
        registeredMode: "online",
        resultId: null,
        studentId: "student-binh",
        studentName: "Lê Văn Bình",
        testScore: null,
      }),
    ]);
  });

  // Generated by /ship test audit (Claude Opus 5.5) — 2026-10-24
  // Value: protects=with all queries sent at once, errors keep the old order (session error, not found, roster, attendance, results), each with its own message;
  // fails_when=a sub-query error is checked before the session row (a missing session shows a load error instead of "not found") or the checks swap messages;
  // why_new=before the parallel load a missing session never ran the other queries; only the roster failure was tested; seam=none;
  // no_claim=mocked Supabase client; does not prove which queries fail together in production
  it.each([
    {
      expected: { code: "session_not_found", message: "Không tìm thấy buổi học cần xem." },
      name: "a missing session ahead of failing roster, attendance and results queries",
      tables: { attendance: failed("boom"), results: failed("boom"), session: { data: null, error: null } },
      roster: failed("boom"),
    },
    {
      expected: { code: "query_failed", message: "Không thể tải thông tin buổi học từ database." },
      name: "a failed session query ahead of failing roster, attendance and results queries",
      tables: { attendance: failed("boom"), results: failed("boom"), session: failed("timeout") },
      roster: failed("boom"),
    },
    {
      expected: { code: "query_failed", message: "Không thể tải danh sách học viên của buổi học." },
      name: "the roster ahead of failing attendance and results queries",
      tables: { attendance: failed("boom"), results: failed("boom") },
      roster: failed("boom"),
    },
    {
      expected: { code: "query_failed", message: "Không thể tải dữ liệu điểm danh của buổi học." },
      name: "attendance ahead of a failing results query",
      tables: { attendance: failed("boom"), results: failed("boom") },
      roster: { data: [], error: null },
    },
    {
      expected: { code: "query_failed", message: "Không thể tải kết quả cuối buổi." },
      name: "a failing results query on its own",
      tables: { attendance: { data: [], error: null }, results: failed("boom") },
      roster: { data: [], error: null },
    },
  ])("reports $name", async ({ expected, roster, tables }) => {
    dependencies.rpc.mockResolvedValue(roster);
    routeTables(tables);

    await expect(getSessionDetail("session-5a", {
      includeAttendance: true,
      includeResults: true,
      includeRoster: true,
    })).resolves.toEqual({ error: expected, ok: false });
  });

  // Generated by /ship review fixes (Claude) — 2026-10-24
  // Value: protects=the session row, roster, attendance and results queries go out together, so the page re-rendered after every save
  // pays one round trip for them; fails_when=one of them is awaited before the others start again (the speed-up quietly comes undone);
  // why_new=the mapping and error-order tests pass either way; seam=none; no_claim=mocked Supabase client; does not time the real queries
  it("sends the roster, attendance and results queries before the session row answers", async () => {
    let answerSession: (value: QueryResponse) => void = () => {};
    const sessionRow = new Promise<QueryResponse>((resolve) => { answerSession = resolve; });
    dependencies.rpc.mockResolvedValue({ data: [], error: null });
    routeTables({ attendance: { data: [], error: null }, results: { data: [], error: null }, session: sessionRow as unknown as QueryResponse });

    const pending = getSessionDetail("session-5a", { includeAttendance: true, includeResults: true, includeRoster: true });

    await vi.waitFor(() => {
      expect(dependencies.rpc).toHaveBeenCalledWith("resolve_class_session_roster", { p_class_session_id: "session-5a" });
      expect(dependencies.from).toHaveBeenCalledWith("session_attendance");
      expect(dependencies.from).toHaveBeenCalledWith("session_results");
    });
    answerSession({ data: null, error: null });
    await expect(pending).resolves.toMatchObject({ error: { code: "session_not_found" }, ok: false });
  });
});
