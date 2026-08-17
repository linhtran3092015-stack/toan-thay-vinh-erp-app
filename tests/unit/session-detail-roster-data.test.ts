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
});
