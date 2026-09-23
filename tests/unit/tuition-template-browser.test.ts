import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadTuitionRateExcel, downloadTuitionSourceExcel } from "@/features/tuition/tuition-template-browser";

const { write, toFile } = vi.hoisted(() => ({ write: vi.fn(), toFile: vi.fn() }));
vi.mock("write-excel-file/browser", () => ({ default: write }));
beforeEach(() => {
  vi.clearAllMocks();
  toFile.mockResolvedValue(undefined);
  write.mockReturnValue({ toFile });
});

describe("tuition preparation exports", () => {
  it("leaves an unknown price empty on an actual student's exported row", async () => {
    await downloadTuitionRateExcel([{ publicCode: "HV1", fullName: "Student", effectiveFrom: "2026-08-22" }]);
    const row = write.mock.calls[0][0][1];
    expect(row[2].value).toBeNull();
    expect(row[3].value).toBe("2026-08-22");
    expect(row[4].value).toBe("");
  });

  it("does not assign the first available acquisition source to actual students", async () => {
    await downloadTuitionSourceExcel([{ code: "sandbox", name: "Sandbox" }], [{ publicCode: "HV1", fullName: "Student" }]);
    const row = write.mock.calls[0][0][1];
    expect(row[2].value).toBe("");
    expect(row[3].value).toBe("");
  });
});
