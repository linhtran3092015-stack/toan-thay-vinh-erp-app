import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createClient: vi.fn(),
  request: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => dependencies.createClient()),
}));

import { getAttendanceVerificationPolicy } from "@/features/timekeeping/data";

describe("Attendance verification RPC transport", () => {
  beforeEach(() => {
    dependencies.createClient.mockReset();
    dependencies.request.mockReset();
    dependencies.request.mockResolvedValue({
      data: {
        attendance_radius_m: 150,
        center_name: "Trung tâm chính",
        configured: true,
        gps_max_accuracy_m: 80,
        wifi_required_for_offline: false,
      },
      error: null,
    });

    dependencies.createClient.mockReturnValue({
      rest: { request: dependencies.request },
      rpc(this: { rest: { request: typeof dependencies.request } }, name: string) {
        return this.rest.request(name);
      },
    });
  });

  it("keeps the Supabase client context when calling the policy RPC", async () => {
    await expect(getAttendanceVerificationPolicy()).resolves.toEqual({
      ok: true,
      policy: {
        attendanceRadiusM: 150,
        centerName: "Trung tâm chính",
        configured: true,
        continuousGpsTrackingRequired: false,
        gpsMaxAccuracyM: 80,
        gpsRequiredForOffline: true,
        wifiRequiredForOffline: false,
      },
    });
    expect(dependencies.request).toHaveBeenCalledWith(
      "get_attendance_verification_policy",
    );
  });
});
