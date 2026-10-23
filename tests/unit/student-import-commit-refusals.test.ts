// Value: protects=the student commit action turns the RPC's STUDENT_IMPORT_VALIDATION_FAILED and STUDENT_IMPORT_FILE_ALREADY_COMMITTED errors into the code and words the confirm step tells apart ("Kiểm tra lại" and "File này đã được nhập."), while another refusal stays a plain "Chưa nhập.";
// fails_when=actions.ts changes the code or the message of either entry in its knownErrors table, or toStudentImportCommitError stops matching them, so the confirm step silently loses its "Kiểm tra lại" or already-imported reading;
// why_new=testing review of the re-check change: the component tests mock the action's answer, so only the message was pinned (by reading actions.ts as text), never the code it is sent with;
// seam=supabase client, permissions and next/cache are mocked at module boundaries; no_claim=does not prove which errors the commit RPC raises for which data
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permissions: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: mocks.permissions }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));

import { commitStudentImportRowsAction } from "@/features/imports/students/actions";
import {
  STUDENT_IMPORT_ALREADY_COMMITTED_MESSAGE,
  STUDENT_IMPORT_VALIDATION_FAILED_MESSAGE,
  toStudentImportCommitError,
} from "@/features/imports/students/student-import-commit-panel";

const commit = () =>
  commitStudentImportRowsAction({
    reason: "Nhập học sinh khối 7",
    rows: [{ row_number: 2, student_full_name: "Học sinh 2" }],
    sourceFilename: "hoc-sinh.xlsx",
    sourceSha256: "a".repeat(64),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions.mockResolvedValue({ ok: true, permissions: ["imports.students", "students.create"] });
});

describe("student import commit refusals", () => {
  it.each([
    {
      databaseError: "STUDENT_IMPORT_VALIDATION_FAILED",
      expected: { kind: "needs_recheck", message: STUDENT_IMPORT_VALIDATION_FAILED_MESSAGE },
    },
    {
      databaseError: "STUDENT_IMPORT_FILE_ALREADY_COMMITTED",
      expected: { kind: "already_committed", message: STUDENT_IMPORT_ALREADY_COMMITTED_MESSAGE },
    },
    {
      databaseError: "STUDENT_IMPORT_REASON_INVALID",
      expected: { kind: "error", message: "Lý do import không hợp lệ." },
    },
  ])("reads $databaseError as a $expected.kind refusal", async ({ databaseError, expected }) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: databaseError } });

    const result = await commit();

    expect(mocks.rpc).toHaveBeenCalledWith("commit_student_import_rows", expect.objectContaining({ p_source_filename: "hoc-sinh.xlsx" }));
    if (result.ok) throw new Error("expected a refusal");
    expect(toStudentImportCommitError(result)).toEqual(expected);
  });
});
