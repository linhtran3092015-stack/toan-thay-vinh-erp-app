// Value: protects=only roles holding students.view and students.manage_status can search never-enrolled students, and bad input never reaches the query;
// fails_when=a permission check is removed/reordered, a failed permission lookup falls through, a 1-char or over-long query hits the DB or loses its own message, or a null loader result is shown as empty success;
// why_new=new public server endpoint, existing tests mock it; the length bounds now come from class-detail-models and each has its own message;
// seam=none; no_claim=does not prove RLS on students
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  searchClassEnrollmentCandidates: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/classes/detail/class-detail-data", () => ({
  searchClassEnrollmentCandidates: dependencies.searchClassEnrollmentCandidates,
}));

import { searchEnrollmentCandidatesAction } from "@/features/classes/actions/class-enrollment-search-actions";
import { ENROLLMENT_SEARCH_MAX_LENGTH } from "@/features/classes/detail/class-detail-models";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

const candidate = { fullName: "Ngọc", grade: 9, id: "s-1", lifecycleStatus: "trial", publicCode: "HS1", registeredMode: null };

beforeEach(() => {
  dependencies.getCachedDatabasePermissions.mockReset();
  dependencies.searchClassEnrollmentCandidates.mockReset();
});

describe("searchEnrollmentCandidatesAction", () => {
  it("returns an error and skips the search when the permission lookup fails", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: false });

    const result = await searchEnrollmentCandidatesAction("Ngọc");

    expect(result.status).toBe("error");
    expect(dependencies.searchClassEnrollmentCandidates).not.toHaveBeenCalled();
  });

  it.each([
    [["students.manage_status"], "students.view"],
    [["students.view"], "students.manage_status"],
  ])("denies a role holding only %j", async (permissions, missing) => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });

    const result = await searchEnrollmentCandidatesAction("Ngọc");

    expect(result).toEqual({ message: permissionDeniedMessage(missing), status: "error" });
    expect(dependencies.searchClassEnrollmentCandidates).not.toHaveBeenCalled();
  });

  it("rejects a one-character query without searching students", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.manage_status"] });

    const result = await searchEnrollmentCandidatesAction("  N ");

    expect(result).toEqual({ message: "Nhập ít nhất 2 ký tự để tìm học sinh.", status: "error" });
    expect(dependencies.searchClassEnrollmentCandidates).not.toHaveBeenCalled();
  });

  it("rejects a query over the maximum length with its own message", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.manage_status"] });
    dependencies.searchClassEnrollmentCandidates.mockResolvedValue({ candidates: [], truncated: false });

    const atLimit = await searchEnrollmentCandidatesAction("a".repeat(ENROLLMENT_SEARCH_MAX_LENGTH));
    expect(atLimit.status).toBe("success");
    dependencies.searchClassEnrollmentCandidates.mockClear();

    const result = await searchEnrollmentCandidatesAction("a".repeat(ENROLLMENT_SEARCH_MAX_LENGTH + 1));

    expect(result).toEqual({ message: "Từ khóa tìm kiếm tối đa 100 ký tự.", status: "error" });
    expect(dependencies.searchClassEnrollmentCandidates).not.toHaveBeenCalled();
  });

  it("reports a failed search as an error, not an empty list", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.manage_status"] });
    dependencies.searchClassEnrollmentCandidates.mockResolvedValue(null);

    const result = await searchEnrollmentCandidatesAction("Ngọc");

    expect(result.status).toBe("error");
    expect(result).not.toHaveProperty("candidates");
  });

  it("searches with the trimmed query and returns the candidates", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["students.view", "students.manage_status"] });
    dependencies.searchClassEnrollmentCandidates.mockResolvedValue({ candidates: [candidate], truncated: true });

    const result = await searchEnrollmentCandidatesAction("  Ngọc  ");

    expect(dependencies.searchClassEnrollmentCandidates).toHaveBeenCalledTimes(1);
    expect(dependencies.searchClassEnrollmentCandidates).toHaveBeenCalledWith("Ngọc");
    expect(result).toEqual({ candidates: [candidate], status: "success", truncated: true });
  });
});
