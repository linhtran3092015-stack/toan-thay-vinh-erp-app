import { describe, expect, it } from "vitest";

import {
  getClockOutReasonLabel,
  getTimekeepingEntryStatusPresentation,
} from "@/features/timekeeping/components/my-timekeeping-panel";

// Pure Haversine distance calculator (matching PL/pgSQL implementation)
function calculateHaversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371000;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dlon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeofenceState = "INSIDE" | "AMBIGUOUS" | "OUTSIDE";

// Strict three-state geofence evaluation matching updated PL/pgSQL RPC
function evaluateGeofenceState(
  distanceM: number,
  accuracyM: number,
  radiusM: number,
  toleranceM = 15,
): GeofenceState {
  const lowerBound = distanceM - accuracyM;
  const upperBound = distanceM + accuracyM;

  if (lowerBound > radiusM + toleranceM) {
    return "OUTSIDE";
  }

  if (upperBound <= radiusM + toleranceM) {
    return "INSIDE";
  }

  return "AMBIGUOUS";
}

// Watchdog effective timestamp & reason calculator matching PL/pgSQL watchdog
function evaluateEarliestAutomaticTermination(
  lastLocationAtMs: number,
  checkInAtMs: number,
  dailyCutoffMs: number,
): { effectiveEndMs: number; reason: "location_lost" | "daily_cutoff" } {
  const locationLossAtMs = (lastLocationAtMs || checkInAtMs) + 90 * 1000;

  if (locationLossAtMs <= dailyCutoffMs) {
    return { effectiveEndMs: locationLossAtMs, reason: "location_lost" };
  }

  return { effectiveEndMs: dailyCutoffMs, reason: "daily_cutoff" };
}

describe("Teaching Assistant Attendance Redesign", () => {
  describe("Strict Three-State Accuracy-Aware Geofence Evaluation", () => {
    it("classifies sample as INSIDE only when position AND uncertainty are within radius + tolerance", () => {
      // 50m distance + 10m accuracy = 60m <= 115m -> INSIDE
      expect(evaluateGeofenceState(50, 10, 100)).toBe("INSIDE");
      // 90m distance + 5m accuracy = 95m <= 115m -> INSIDE
      expect(evaluateGeofenceState(90, 5, 100)).toBe("INSIDE");
      // 100m distance + 15m accuracy = 115m <= 115m -> INSIDE
      expect(evaluateGeofenceState(100, 15, 100)).toBe("INSIDE");
    });

    it("classifies sample as OUTSIDE when lower bound exceeds radius + tolerance", () => {
      // 150m distance - 15m accuracy = 135m > 115m -> OUTSIDE
      expect(evaluateGeofenceState(150, 15, 100)).toBe("OUTSIDE");
    });

    it("classifies sample as AMBIGUOUS when distance is inside radius but uncertainty extends outside tolerance", () => {
      // 80m distance + 40m accuracy = 120m > 115m, but lower bound 40m <= 115m -> AMBIGUOUS
      expect(evaluateGeofenceState(80, 40, 100)).toBe("AMBIGUOUS");
      // 100m distance + 20m accuracy = 120m > 115m, lower bound 80m <= 115m -> AMBIGUOUS
      expect(evaluateGeofenceState(100, 20, 100)).toBe("AMBIGUOUS");
    });
  });

  describe("Deterministic Earliest Automatic Termination Precedence", () => {
    it("selects location_lost when location loss occurs before 23:30 cutoff", () => {
      const checkInAtMs = new Date("2026-08-12T14:00:00+07:00").getTime();
      const lastLocationAtMs = new Date("2026-08-12T14:30:00+07:00").getTime();
      const dailyCutoffMs = new Date("2026-08-12T23:30:00+07:00").getTime();

      const result = evaluateEarliestAutomaticTermination(
        lastLocationAtMs,
        checkInAtMs,
        dailyCutoffMs,
      );

      expect(result.reason).toBe("location_lost");
      expect(result.effectiveEndMs).toBe(lastLocationAtMs + 90 * 1000);
    });

    it("selects daily_cutoff exact timestamp when session remains active until 23:30", () => {
      const checkInAtMs = new Date("2026-08-12T22:00:00+07:00").getTime();
      const lastLocationAtMs = new Date("2026-08-12T23:29:40+07:00").getTime();
      const dailyCutoffMs = new Date("2026-08-12T23:30:00+07:00").getTime();

      const result = evaluateEarliestAutomaticTermination(
        lastLocationAtMs,
        checkInAtMs,
        dailyCutoffMs,
      );

      expect(result.reason).toBe("daily_cutoff");
      expect(result.effectiveEndMs).toBe(dailyCutoffMs);
    });
  });

  describe("Haversine Distance Accuracy", () => {
    it("computes 0 meters for identical coordinates", () => {
      expect(calculateHaversineDistanceM(10.776, 106.700, 10.776, 106.700)).toBe(0);
    });

    it("computes accurate distance for ~100m offset", () => {
      const dist = calculateHaversineDistanceM(10.776, 106.700, 10.7769, 106.700);
      expect(Math.round(dist)).toBeGreaterThan(90);
      expect(Math.round(dist)).toBeLessThan(110);
    });
  });

  describe("UI Labels & Status Formatting", () => {
    it("returns correct Vietnamese clock out reason labels", () => {
      expect(getClockOutReasonLabel("manual")).toBe("Tự check-out");
      expect(getClockOutReasonLabel("left_geofence")).toBe("Rời khỏi Trung tâm");
      expect(getClockOutReasonLabel("location_lost")).toBe("Mất kết nối vị trí (>90s)");
      expect(getClockOutReasonLabel("daily_cutoff")).toBe("Hết giờ ca (23:30)");
    });

    it("presents open attendance status", () => {
      const presentation = getTimekeepingEntryStatusPresentation("open");
      expect(presentation.label).toBe("Đang trong ca");
      expect(presentation.tone).toBe("info");
    });
  });

  describe("Teaching Assistant Check-in Business Rules Matrix", () => {
    function evaluateCheckIn(input: {
      isTeachingAssistant: boolean;
      hasShift: boolean;
      hasGps: boolean;
      gpsAccuracyMeters?: number;
      distanceM?: number;
      centerRadiusM?: number;
    }) {
      const {
        isTeachingAssistant,
        hasShift,
        hasGps,
        gpsAccuracyMeters = 10,
        distanceM = 20,
        centerRadiusM = 100,
      } = input;

      if (isTeachingAssistant) {
        if (!hasGps) {
          return { allowed: false, errorCode: "TIME_ENTRY_GPS_REQUIRED_FOR_TEACHING_ASSISTANT", assignedShiftId: null };
        }
        if (gpsAccuracyMeters > 100) {
          return { allowed: false, errorCode: "TIME_ENTRY_GPS_ACCURACY_TOO_LOW", assignedShiftId: null };
        }
        if (distanceM + gpsAccuracyMeters > centerRadiusM + 15) {
          return { allowed: false, errorCode: "TIME_ENTRY_OUTSIDE_GEOFENCE", assignedShiftId: null };
        }
        return { allowed: true, assignedShiftId: hasShift ? "shift-123" : null };
      }

      return { allowed: true, assignedShiftId: hasShift ? "shift-123" : null };
    }

    it("allows TA with no shift, valid GPS, and inside geofence to check in with null shift ID", () => {
      const res = evaluateCheckIn({ isTeachingAssistant: true, hasShift: false, hasGps: true });
      expect(res.allowed).toBe(true);
      expect(res.assignedShiftId).toBeNull();
    });

    it("fails TA with no shift outside geofence with TIME_ENTRY_OUTSIDE_GEOFENCE (not shift error)", () => {
      const res = evaluateCheckIn({ isTeachingAssistant: true, hasShift: false, hasGps: true, distanceM: 200 });
      expect(res.allowed).toBe(false);
      expect(res.errorCode).toBe("TIME_ENTRY_OUTSIDE_GEOFENCE");
    });

    it("fails TA with no shift and missing GPS with TIME_ENTRY_GPS_REQUIRED_FOR_TEACHING_ASSISTANT (not shift error)", () => {
      const res = evaluateCheckIn({ isTeachingAssistant: true, hasShift: false, hasGps: false });
      expect(res.allowed).toBe(false);
      expect(res.errorCode).toBe("TIME_ENTRY_GPS_REQUIRED_FOR_TEACHING_ASSISTANT");
    });

    it("allows TA with active shift to check in and attach shift assignment ID", () => {
      const res = evaluateCheckIn({ isTeachingAssistant: true, hasShift: true, hasGps: true });
      expect(res.allowed).toBe(true);
      expect(res.assignedShiftId).toBe("shift-123");
    });

    it("allows Non-TA without an active shift and leaves the assignment null", () => {
      const res = evaluateCheckIn({ isTeachingAssistant: false, hasShift: false, hasGps: true });
      expect(res.allowed).toBe(true);
      expect(res.assignedShiftId).toBeNull();
    });
  });
});
