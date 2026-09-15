import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBatchSessionsAction } from "@/features/sessions/actions/session-batch-actions";

const mocks = vi.hoisted(() => ({
  permissions: vi.fn(),
  server: vi.fn(),
  service: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/permissions/database-permissions", () => ({
  getDatabasePermissions: mocks.permissions,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.server,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.service,
}));

const classId = "4f8219f4-2f39-4833-b596-ad5137ed27a3";
const userId = "user-12345";

const samplePayload = {
  classId,
  reason: "Tạo buổi học hàng loạt",
  sessions: [
    {
      sessionDate: "2026-09-20",
      startTime: "18:00",
      endTime: "19:30",
      learningMode: "offline" as const,
      sessionKind: "regular" as const,
      scheduleTemplateId: "11111111-1111-4111-8111-111111111111",
      roomName: "P.201",
    },
    {
      sessionDate: "2026-09-27",
      startTime: "18:00",
      endTime: "19:30",
      learningMode: "offline" as const,
      sessionKind: "regular" as const,
      scheduleTemplateId: "11111111-1111-4111-8111-111111111111",
      roomName: "P.201",
    },
  ],
};

function createMockServerClient(options?: {
  rpcResult?: { data: unknown; error: unknown };
  existingSessions?: unknown[];
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "classes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: classId,
                  code: "12B",
                  status: "active",
                  academic_years: { id: "ay-1", status: "active" },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "class_sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: options?.existingSessions ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    rpc: vi.fn().mockResolvedValue(
      options?.rpcResult ?? {
        data: { created_count: 2, session_ids: ["s-1", "s-2"] },
        error: null,
      },
    ),
  };
}

describe("createBatchSessionsAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.permissions.mockResolvedValue({
      ok: true,
      permissions: ["sessions.manage"],
    });
  });

  it("denies access when user lacks sessions.manage permission", async () => {
    mocks.permissions.mockResolvedValue({
      ok: true,
      permissions: ["sessions.view"],
    });

    const res = await createBatchSessionsAction(samplePayload);
    expect(res.status).toBe("error");
    expect(res.message).toContain("sessions.manage");
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it("successfully creates sessions via RPC create_batch_class_sessions", async () => {
    const mockClient = createMockServerClient({
      rpcResult: {
        data: { created_count: 2, session_ids: ["sess-1", "sess-2"] },
        error: null,
      },
    });
    mocks.server.mockResolvedValue(mockClient);

    const res = await createBatchSessionsAction(samplePayload);
    expect(res.status).toBe("success");
    expect(res.createdCount).toBe(2);
    expect(res.sessionIds).toEqual(["sess-1", "sess-2"]);
    expect(mockClient.rpc).toHaveBeenCalledWith(
      "create_batch_class_sessions",
      expect.objectContaining({
        p_class_id: classId,
        p_sessions: expect.any(Array),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sessions");
  });

  it("falls back to service role client if RPC encounters an error", async () => {
    const mockClient = createMockServerClient({
      rpcResult: {
        data: null,
        error: { message: "function create_batch_class_sessions does not exist" },
      },
    });
    mocks.server.mockResolvedValue(mockClient);

    const mockServiceClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "class_sessions") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: "fallback-1", session_date: "2026-09-20", start_time: "18:00:00" },
                  { id: "fallback-2", session_date: "2026-09-27", start_time: "18:00:00" },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };
    mocks.service.mockReturnValue(mockServiceClient);

    const res = await createBatchSessionsAction(samplePayload);
    expect(res.status).toBe("success");
    expect(res.createdCount).toBe(2);
    expect(res.sessionIds).toEqual(["fallback-1", "fallback-2"]);
  });
});
