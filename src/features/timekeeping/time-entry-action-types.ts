import type { TimeEntryMode } from "@/features/timekeeping/types";

export type TimekeepingEntryActionStatus = "idle" | "error" | "success";

export interface TimekeepingEntryActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: TimekeepingEntryActionStatus;
}

export const initialTimekeepingEntryActionState: TimekeepingEntryActionState = {
  message: "",
  status: "idle",
};

export interface TimeEntryEvidenceInput {
  gpsAccuracyMeters: number | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  wifiBssid: string;
  wifiSsid: string;
}

export interface TimeEntryActionInput extends TimeEntryEvidenceInput {
  mode: TimeEntryMode;
}

export interface AttendanceHeartbeatInput {
  gpsAccuracyMeters: number;
  gpsLatitude: number;
  gpsLongitude: number;
}

export type AttendanceHeartbeatResult =
  | {
      ambiguousSample?: boolean;
      distanceM?: number;
      sessionActive: true;
      signalDegraded?: boolean;
      messageVi?: string;
      verifiedInside?: boolean;
    }
  | {
      closedByServer?: boolean;
      messageVi?: string;
      reason?: string;
      sessionActive: false;
    };
