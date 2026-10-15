import type {
  decideAttendanceExceptionAction,
  getAttendanceExceptionReviewsAction,
  requestAttendanceExceptionAction,
} from "./attendance-exception-actions";
import type {
  checkInTimeEntryAction,
  checkOutTimeEntryAction,
  submitAttendanceHeartbeatAction,
} from "./time-entry-actions";
import type { fetchMyMonthlyTimesheetAction } from "./timekeeping-admin-actions";
import type { requestTimeEntryAdjustmentAction } from "./timekeeping-adjustment-actions";

/** The browser geolocation calls the staff check-in flow and heartbeat use. */
export type TimekeepingGeolocation = Pick<
  Geolocation,
  "clearWatch" | "getCurrentPosition" | "watchPosition"
>;

/**
 * Optional replacements for the server actions (and the device geolocation)
 * behind the staff side of /timekeeping. Each component takes the ones it
 * calls and falls back to the real action, so the real page passes nothing
 * while the /dev/timekeeping preview passes inert stubs (it runs on localhost
 * where .env.local may point at the production database). Type-only imports:
 * no server module enters a bundle through this file.
 */
export interface TimekeepingActionOverrides {
  checkInTimeEntry?: typeof checkInTimeEntryAction;
  checkOutTimeEntry?: typeof checkOutTimeEntryAction;
  /** Managers only; listed so the preview stub set is complete. */
  decideAttendanceException?: typeof decideAttendanceExceptionAction;
  fetchMyMonthlyTimesheet?: typeof fetchMyMonthlyTimesheetAction;
  /** `null` = the device has no geolocation (same as a browser without it). */
  geolocation?: TimekeepingGeolocation | null;
  getAttendanceExceptionReviews?: typeof getAttendanceExceptionReviewsAction;
  requestAttendanceException?: typeof requestAttendanceExceptionAction;
  requestTimeEntryAdjustment?: typeof requestTimeEntryAdjustmentAction;
  submitAttendanceHeartbeat?: typeof submitAttendanceHeartbeatAction;
}

/** The overridden geolocation, else the browser's (undefined when unsupported). */
export function resolveTimekeepingGeolocation(
  actions: TimekeepingActionOverrides | undefined,
): TimekeepingGeolocation | undefined {
  if (actions && "geolocation" in actions) {
    return actions.geolocation ?? undefined;
  }

  return typeof navigator === "undefined" ? undefined : navigator.geolocation ?? undefined;
}
