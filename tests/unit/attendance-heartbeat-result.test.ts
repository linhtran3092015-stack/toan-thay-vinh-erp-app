import { describe, expect, it } from "vitest";
import { parseAttendanceHeartbeatResult } from "@/features/timekeeping/attendance-heartbeat-result";

describe("SQL heartbeat response boundary", () => {
  it("keeps a valid snake_case active response open", () => {
    expect(parseAttendanceHeartbeatResult({ session_active: true, verified_inside: true, distance_m: 12 }))
      .toMatchObject({ sessionActive: true, verifiedInside: true, distanceM: 12 });
  });
  it("only reports closure from an explicit valid server response", () => {
    expect(parseAttendanceHeartbeatResult({ session_active: false, closed_by_server: true, reason: "daily_cutoff", message_vi: "Hết ngày" }))
      .toEqual({ sessionActive: false, closedByServer: true, reason: "daily_cutoff", messageVi: "Hết ngày" });
  });
  it.each([null, {}, { session_active: "false" }, { sessionActive: false }, { session_active: true, distance_m: -1 }])("does not infer a closed shift from malformed data %j", (input) => {
    expect(parseAttendanceHeartbeatResult(input)).toMatchObject({ sessionActive: true, signalDegraded: true });
  });
  it("preserves ambiguity and server messages", () => {
    expect(parseAttendanceHeartbeatResult({ session_active: true, ambiguous_sample: true, message_vi: "Vùng ranh giới" }))
      .toMatchObject({ sessionActive: true, ambiguousSample: true, messageVi: "Vùng ranh giới" });
  });
});
