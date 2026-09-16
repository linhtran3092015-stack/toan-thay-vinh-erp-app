import { z } from "zod";

import type { AttendanceHeartbeatResult } from "@/features/timekeeping/time-entry-action-types";

const heartbeatResponseSchema = z.object({
  session_active: z.boolean(),
  verified_inside: z.boolean().optional(),
  signal_degraded: z.boolean().optional(),
  ambiguous_sample: z.boolean().optional(),
  closed_by_server: z.boolean().optional(),
  distance_m: z.number().finite().nonnegative().optional(),
  reason: z.string().optional(),
  message_vi: z.string().optional(),
});

export function parseAttendanceHeartbeatResult(value: unknown): AttendanceHeartbeatResult {
  const parsed = heartbeatResponseSchema.safeParse(value);
  if (!parsed.success) {
    return { sessionActive: true, signalDegraded: true, messageVi: "Chưa xác minh được trạng thái ca. Vui lòng tải lại trang." };
  }
  const data = parsed.data;
  if (!data.session_active) {
    return { sessionActive: false, closedByServer: data.closed_by_server, reason: data.reason, messageVi: data.message_vi };
  }
  return {
    sessionActive: true,
    verifiedInside: data.verified_inside,
    signalDegraded: data.signal_degraded,
    ambiguousSample: data.ambiguous_sample,
    distanceM: data.distance_m,
    messageVi: data.message_vi,
  };
}
