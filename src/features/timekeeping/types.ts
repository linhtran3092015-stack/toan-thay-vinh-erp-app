export interface TimekeepingScheduleEntry {
  assignmentId: string;
  breakMinutes: number;
  crossesMidnight: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  staffDisplayName: string | null;
  staffEmployeeCode: string | null;
  staffEmploymentStatus: string;
  staffId: string;
  weekday: number;
  workShiftCode: string;
  workShiftId: string;
  workShiftName: string;
  endTime: string;
  startTime: string;
}

export type TimekeepingScheduleErrorCode = "schedule_query_failed";

export interface TimekeepingScheduleError {
  code: TimekeepingScheduleErrorCode;
  message: string;
}

export type TimekeepingScheduleResult =
  | {
      ok: true;
      entries: readonly TimekeepingScheduleEntry[];
    }
  | {
      ok: false;
      error: TimekeepingScheduleError;
    };

export interface TimekeepingWorkShift {
  breakMinutes: number;
  code: string;
  crossesMidnight: boolean;
  endTime: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string | null;
  startTime: string;
}

export type TimekeepingWorkShiftsResult =
  | {
      ok: true;
      workShifts: readonly TimekeepingWorkShift[];
    }
  | {
      ok: false;
      error: TimekeepingScheduleError;
    };

export interface TimekeepingStaffOption {
  employeeCode: string | null;
  id: string;
  displayName: string | null;
}

export type TimekeepingStaffOptionsResult =
  | {
      ok: true;
      staffOptions: readonly TimekeepingStaffOption[];
    }
  | {
      ok: false;
      error: TimekeepingScheduleError;
    };

export type TimeEntryMode = "online" | "offline";

export type TimeEntryStatus = "open" | "checked_out" | "auto_ended";

export type ClockOutReason = "manual" | "left_geofence" | "location_lost" | "daily_cutoff";

export interface TimekeepingEntryEvidence {
  hasCheckInGpsEvidence: boolean;
  hasCheckInWifiEvidence: boolean;
  hasCheckOutGpsEvidence: boolean;
  hasCheckOutWifiEvidence: boolean;
}

export interface TimekeepingMyEntry extends TimekeepingEntryEvidence {
  autoEndedAt: string | null;
  checkInAt: string;
  checkInMode: TimeEntryMode;
  checkOutAt: string | null;
  checkOutMode: TimeEntryMode | "auto_end" | null;
  clockOutReason?: ClockOutReason | null;
  id: string;
  isUnscheduled?: boolean;
  lastLocationAt?: string | null;
  scheduledEndTime: string | null;
  scheduledStartTime: string | null;
  status: TimeEntryStatus;
  workDate: string;
  workShiftCode: string | null;
  workShiftName: string | null;
}

export interface TimekeepingDayEntry extends TimekeepingMyEntry {
  staffDisplayName: string | null;
  staffEmployeeCode: string | null;
  staffId: string;
}

export type TimekeepingEntriesErrorCode =
  | "day_entries_query_failed"
  | "my_entries_query_failed"
  | "adjustable_entries_query_failed"
  | "my_adjustment_requests_query_failed"
  | "adjustment_approval_queue_query_failed";

export interface TimekeepingEntriesError {
  code: TimekeepingEntriesErrorCode;
  message: string;
}

export type TimekeepingMyEntriesResult =
  | {
      ok: true;
      entries: readonly TimekeepingMyEntry[];
    }
  | {
      ok: false;
      error: TimekeepingEntriesError;
    };

export type TimekeepingDayEntriesResult =
  | {
      ok: true;
      entries: readonly TimekeepingDayEntry[];
    }
  | {
      ok: false;
      error: TimekeepingEntriesError;
    };

export type TimekeepingAdjustmentStatus = "pending" | "approved" | "rejected";

export interface TimekeepingAdjustableEntry {
  adjustmentStatus: TimekeepingAdjustmentStatus | null;
  checkInAt: string;
  checkInMode: TimeEntryMode;
  checkOutAt: string;
  checkOutMode: TimeEntryMode | "auto_end";
  id: string;
  status: Exclude<TimeEntryStatus, "open">;
  workDate: string;
  workShiftCode: string;
  workShiftName: string;
}

export interface TimekeepingAdjustmentRequest {
  createdAt: string;
  decisionReason: string | null;
  id: string;
  originalCheckInAt: string;
  originalCheckInMode: TimeEntryMode;
  originalCheckOutAt: string;
  originalCheckOutMode: TimeEntryMode | "auto_end";
  requestReason: string;
  requestedCheckInAt: string;
  requestedCheckInMode: TimeEntryMode;
  requestedCheckOutAt: string;
  requestedCheckOutMode: TimeEntryMode;
  reviewedAt: string | null;
  reviewerDisplayName: string | null;
  status: TimekeepingAdjustmentStatus;
  timeEntryId: string;
  workDate: string;
}

export interface TimekeepingAdjustmentApprovalQueueEntry {
  createdAt: string;
  id: string;
  originalCheckInAt: string;
  originalCheckInMode: TimeEntryMode;
  originalCheckOutAt: string;
  originalCheckOutMode: TimeEntryMode | "auto_end";
  requestReason: string;
  requestedCheckInAt: string;
  requestedCheckInMode: TimeEntryMode;
  requestedCheckOutAt: string;
  requestedCheckOutMode: TimeEntryMode;
  requesterDisplayName: string | null;
  requesterEmployeeCode: string | null;
  requesterId: string;
  timeEntryId: string;
  workDate: string;
}

export type TimekeepingAdjustableEntriesResult =
  | {
      ok: true;
      entries: readonly TimekeepingAdjustableEntry[];
    }
  | {
      ok: false;
      error: TimekeepingEntriesError;
    };

export type TimekeepingAdjustmentRequestsResult =
  | {
      ok: true;
      requests: readonly TimekeepingAdjustmentRequest[];
    }
  | {
      ok: false;
      error: TimekeepingEntriesError;
    };

export type TimekeepingAdjustmentApprovalQueueResult =
  | {
      ok: true;
      requests: readonly TimekeepingAdjustmentApprovalQueueEntry[];
    }
  | {
      ok: false;
      error: TimekeepingEntriesError;
    };
