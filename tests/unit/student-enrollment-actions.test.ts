// Value: protects=transfer and reserve actions given expectedEnrollmentId refuse (without calling the RPC) when the student's active enrolment is no longer the one the user saw, or cannot be read, and behave as before when it matches or no id is given;
// fails_when=a different active enrolment lets the RPC run, a failed read falls through to the RPC, the check reads when no id was passed, the query stops filtering on the student's active open enrolment, or the id is dropped from the schema;
// why_new=the pre-landing review added expectedEnrollmentId so a class roster left open cannot move or reserve the student's new class; no unit test covered these actions;
// seam=supabase client, permissions and next/cache are mocked at module boundaries; no_claim=does not prove the RPCs reject a concurrent change after the read (the check narrows the race, it does not close it)
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  permissions: vi.fn(),
  revalidate: vi.fn(),
  rpc: vi.fn(),
}));

// A chainable query that records each call, ending in maybeSingle().
const queryCalls: Array<[string, ...unknown[]]> = [];
vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: mocks.permissions }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is"]) {
      builder[method] = (...args: unknown[]) => {
        queryCalls.push([method, ...args]);
        return builder;
      };
    }
    builder.maybeSingle = mocks.maybeSingle;
    return {
      from: (table: string) => {
        queryCalls.push(["from", table]);
        return builder;
      },
      rpc: mocks.rpc,
    };
  },
}));

import { reserveStudentEnrollmentAction, transferStudentClassAction } from "@/features/students/enrollment/student-enrollment-actions";

const STUDENT_ID = "91000000-0000-4000-8000-000000000001";
const CLASS_ID = "92000000-0000-4000-8000-000000000001";
const SEEN_ENROLLMENT_ID = "93000000-0000-4000-8000-000000000001";
const OTHER_ENROLLMENT_ID = "93000000-0000-4000-8000-000000000002";

const rpcRow = {
  class_id: CLASS_ID,
  effective_from: "2026-10-14",
  effective_to: null,
  id: OTHER_ENROLLMENT_ID,
  registered_mode: "offline",
  status: "active",
  student_id: STUDENT_ID,
  transition_kind: "transfer",
};

const calls = {
  reserve: (expectedEnrollmentId?: string) =>
    reserveStudentEnrollmentAction({ expectedEnrollmentId, reason: "Gia đình đi xa", reservedFrom: "2026-10-14", studentId: STUDENT_ID }),
  transfer: (expectedEnrollmentId?: string) =>
    transferStudentClassAction({ effectiveFrom: "2026-10-14", expectedEnrollmentId, reason: "Đổi lịch học", registeredMode: "offline", studentId: STUDENT_ID, targetClassId: CLASS_ID }),
};

const cases = [
  { name: "transferStudentClassAction", permission: "students.transfer_class", rpc: "transfer_student_class", run: calls.transfer },
  { name: "reserveStudentEnrollmentAction", permission: "students.reserve", rpc: "reserve_student_enrollment", run: calls.reserve },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.length = 0;
  mocks.permissions.mockResolvedValue({ ok: true, permissions: ["students.transfer_class", "students.reserve"] });
  mocks.rpc.mockResolvedValue({ data: rpcRow, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { id: SEEN_ENROLLMENT_ID }, error: null });
});

describe.each(cases)("$name with expectedEnrollmentId", ({ rpc, run }) => {
  it("refuses and skips the RPC when the active enrolment is a different one", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: OTHER_ENROLLMENT_ID }, error: null });

    const result = await run(SEEN_ENROLLMENT_ID);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Ghi danh của học sinh đã thay đổi");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("refuses when the student no longer has an active open enrolment", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await run(SEEN_ENROLLMENT_ID);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Ghi danh của học sinh đã thay đổi");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC when the active enrolment matches, reading only the student's active open enrolment", async () => {
    const result = await run(SEEN_ENROLLMENT_ID);

    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe(rpc);
    expect(queryCalls).toEqual([
      ["from", "student_enrollments"],
      ["select", "id"],
      ["eq", "student_id", STUDENT_ID],
      ["eq", "status", "active"],
      ["is", "effective_to", null],
    ]);
  });

  it("refuses with its own message and skips the RPC when the read fails", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await run(SEEN_ENROLLMENT_ID);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Không kiểm tra được ghi danh hiện tại");
    expect(result.message).not.toContain("đã thay đổi");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not read the enrolment and calls the RPC when no expectedEnrollmentId is given", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: OTHER_ENROLLMENT_ID }, error: null });

    const result = await run(undefined);

    expect(result.status).toBe("success");
    expect(queryCalls).toEqual([]);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-uuid expectedEnrollmentId before any read or RPC", async () => {
    const result = await run("not-a-uuid");

    expect(result.status).toBe("error");
    expect(queryCalls).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
