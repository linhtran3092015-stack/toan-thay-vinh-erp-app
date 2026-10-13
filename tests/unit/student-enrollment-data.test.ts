// Value: protects=the class roster's "Chuyển lớp" targets are the active classes other than the class itself, mapped to the dialog's option shape, and a failed class list is null (the menu says the list failed) rather than an empty list;
// fails_when=the current class or a draft/closed class is offered as a target, the class directory is read with student counts, or a failed directory read returns [] ("no other active class") instead of null;
// why_new=getTransferClassOptions is new for the class page; the route test mocks it and no test exercised its filter;
// seam=getClassDirectory is mocked at its module; no_claim=does not prove the transfer RPC rejects an inactive target class
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getClassDirectory: vi.fn() }));

vi.mock("@/features/classes/data", () => ({ getClassDirectory: dependencies.getClassDirectory }));

import type { ClassDirectoryItem } from "@/features/classes/read-models";
import { getTransferClassOptions } from "@/features/students/enrollment/student-enrollment-data";

const year = { code: "NH2627", endsOn: "2027-05-31", id: "year", isCurrent: true, name: "2026–2027", startsOn: "2026-09-01", status: "active" };

function directoryClass(id: string, status: string, overrides: Partial<ClassDirectoryItem> = {}): ClassDirectoryItem {
  return {
    academicYear: year,
    activeScheduleCount: 1,
    activeStudentCount: null,
    code: `L-${id}`,
    defaultLearningMode: "offline",
    grade: 9,
    id,
    level: "A",
    name: `Toán ${id}`,
    notes: null,
    status,
    weeklySessionCount: 3,
    ...overrides,
  };
}

beforeEach(() => {
  dependencies.getClassDirectory.mockReset();
});

describe("getTransferClassOptions", () => {
  it("keeps active classes other than the current one", async () => {
    dependencies.getClassDirectory.mockResolvedValue({
      classes: [
        directoryClass("current", "active"),
        directoryClass("9b", "active"),
        directoryClass("draft", "draft"),
        directoryClass("closed", "closed"),
        directoryClass("9c", "active", { academicYear: null, defaultLearningMode: "online", grade: 8, level: "B" }),
      ],
      ok: true,
    });

    await expect(getTransferClassOptions("current")).resolves.toEqual([
      { academicYearName: "2026–2027", code: "L-9b", defaultLearningMode: "offline", grade: 9, id: "9b", level: "A", name: "Toán 9b" },
      { academicYearName: null, code: "L-9c", defaultLearningMode: "online", grade: 8, id: "9c", level: "B", name: "Toán 9c" },
    ]);
    expect(dependencies.getClassDirectory).toHaveBeenCalledWith({ includeStudentCounts: false });
  });

  it("returns null when the class directory fails", async () => {
    dependencies.getClassDirectory.mockResolvedValue({ error: { code: "classes_query_failed", message: "denied" }, ok: false });

    await expect(getTransferClassOptions("current")).resolves.toBeNull();
  });
});
