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
    expect(res.message).toContain("quản lý buổi học");
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

  it("surfaces an RPC rejection as an error and never falls back to the service role", async () => {
    const mockClient = createMockServerClient({
      rpcResult: {
        data: null,
        error: { message: "P0001: CLASS_NOT_ACTIVE" },
      },
    });
    mocks.server.mockResolvedValue(mockClient);

    const res = await createBatchSessionsAction(samplePayload);
    expect(res.status).toBe("error");
    expect(res.message).toBe(
      "Lớp học chưa ở trạng thái đang hoạt động nên không thể tạo buổi.",
    );
    expect(res.createdCount).toBeUndefined();
    // The RPC's permission and validation checks are the only write path.
    expect(mocks.service).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  // Value: protects=a batch rejected because the class is a linked composite parent (future links included) explains where sessions belong;
  // fails_when=either composite-parent code falls through to the generic database message;
  // why_new=componentClasses now includes links that start later, and a link added after the page loaded still makes the trigger raise;
  // seam=none; no_claim=does not prove create_batch_class_sessions raises these codes
  it.each([
    // One wording on every screen (compositeParentRpcMessages).
    ["COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION", "Lớp ghép không có buổi học riêng. Hãy tạo buổi trên lớp thành phần."],
    ["COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE", "Lớp ghép không có lịch cố định riêng; lịch học nằm ở các lớp thành phần."],
  ])("explains the composite-parent rejection %s", async (databaseMessage, userMessage) => {
    mocks.server.mockResolvedValue(createMockServerClient({ rpcResult: { data: null, error: { message: databaseMessage } } }));

    const res = await createBatchSessionsAction(samplePayload);

    expect(res.status).toBe("error");
    expect(res.message).toBe(userMessage);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps unknown RPC failures to a generic message without leaking raw SQL text", async () => {
    const mockClient = createMockServerClient({
      rpcResult: {
        data: null,
        error: { message: 'relation "class_sessions" violates constraint xyz' },
      },
    });
    mocks.server.mockResolvedValue(mockClient);

    const res = await createBatchSessionsAction(samplePayload);
    expect(res.status).toBe("error");
    expect(res.message).not.toContain("relation");
    expect(mocks.service).not.toHaveBeenCalled();
  });
});
