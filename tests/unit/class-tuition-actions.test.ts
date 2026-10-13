// Value: protects=the class tuition period-switch action reads a period only for valid ids and a role holding classes.view, sessions.view, students.view and tuition_periods.view, and asks for payment columns only with payments.view;
// fails_when=a permission check is dropped, a failed permission lookup falls through, a non-uuid id reaches the loader, payments are read without payments.view, or a missing period or failed read is returned as success;
// why_new=new public server endpoint; class-detail-tabs.test.tsx mocks it, so no test exercised its gate;
// seam=none; no_claim=does not prove RLS on tuition tables (permissions and loaders mocked at their modules; unit only)
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getClassTuitionPeriod: vi.fn(),
  getClassTuitionView: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/classes/detail/class-tuition-data", () => ({
  getClassTuitionPeriod: dependencies.getClassTuitionPeriod,
  getClassTuitionView: dependencies.getClassTuitionView,
}));

import { loadClassTuitionPeriodAction } from "@/features/classes/actions/class-tuition-actions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

const CLASS_ID = "8f9c2a4e-1b2c-4d3e-8f00-123456789abc";
const PERIOD_ID = "1a2b3c4d-1b2c-4d3e-8f00-123456789abc";
const TUITION = ["classes.view", "sessions.view", "students.view", "tuition_periods.view"];
const period = { dueOn: null, endsOn: "2026-09-30", id: PERIOD_ID, name: "Học phí tháng 9", startsOn: "2026-09-01", status: "locked" as const };
const view = { paymentsVisible: true, period, rows: [] };

beforeEach(() => {
  dependencies.getCachedDatabasePermissions.mockReset();
  dependencies.getClassTuitionPeriod.mockReset();
  dependencies.getClassTuitionView.mockReset();
});

describe("loadClassTuitionPeriodAction", () => {
  it("rejects a non-uuid id before checking permissions or reading data", async () => {
    const result = await loadClassTuitionPeriodAction(CLASS_ID, "period-sep");

    expect(result).toEqual({ message: "Kỳ thu không hợp lệ.", status: "error" });
    expect(dependencies.getCachedDatabasePermissions).not.toHaveBeenCalled();
    expect(dependencies.getClassTuitionPeriod).not.toHaveBeenCalled();
  });

  it("returns an error and reads nothing when the permission lookup fails", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: false });

    const result = await loadClassTuitionPeriodAction(CLASS_ID, PERIOD_ID);

    expect(result.status).toBe("error");
    expect(dependencies.getClassTuitionPeriod).not.toHaveBeenCalled();
  });

  it.each(TUITION)("denies a role missing %s", async (missing) => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: TUITION.filter((code) => code !== missing) });

    const result = await loadClassTuitionPeriodAction(CLASS_ID, PERIOD_ID);

    expect(result).toEqual({ message: permissionDeniedMessage(missing), status: "error" });
    expect(dependencies.getClassTuitionPeriod).not.toHaveBeenCalled();
    expect(dependencies.getClassTuitionView).not.toHaveBeenCalled();
  });

  it("reports a missing period and a failed view read as errors, not empty success", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: TUITION });

    dependencies.getClassTuitionPeriod.mockResolvedValue(null);
    expect(await loadClassTuitionPeriodAction(CLASS_ID, PERIOD_ID)).toEqual({ message: "Không tìm thấy kỳ thu này.", status: "error" });
    expect(dependencies.getClassTuitionView).not.toHaveBeenCalled();

    dependencies.getClassTuitionPeriod.mockResolvedValue(period);
    dependencies.getClassTuitionView.mockResolvedValue(null);
    expect(await loadClassTuitionPeriodAction(CLASS_ID, PERIOD_ID)).toEqual({ message: "Chưa tải được học phí của kỳ này, thử lại.", status: "error" });
  });

  it("asks for payment columns only with payments.view", async () => {
    dependencies.getClassTuitionPeriod.mockResolvedValue(period);
    dependencies.getClassTuitionView.mockResolvedValue(view);

    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: TUITION });
    expect(await loadClassTuitionPeriodAction(CLASS_ID, PERIOD_ID)).toEqual({ status: "success", view });
    expect(dependencies.getClassTuitionPeriod).toHaveBeenCalledWith(PERIOD_ID);
    expect(dependencies.getClassTuitionView).toHaveBeenLastCalledWith(CLASS_ID, period, { canViewPayments: false });

    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: [...TUITION, "payments.view"] });
    await loadClassTuitionPeriodAction(CLASS_ID, PERIOD_ID);
    expect(dependencies.getClassTuitionView).toHaveBeenLastCalledWith(CLASS_ID, period, { canViewPayments: true });
  });
});
