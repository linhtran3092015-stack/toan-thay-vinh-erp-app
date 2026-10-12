import type { SessionAttendanceStatus } from "@/features/sessions/detail-read-models";

/**
 * Plain read models and pure summaries for the student profile activity feeds.
 * No server imports here: client components and tests consume this file.
 */

export interface StudentAttendanceHistoryItem {
  actualLearningMode: string | null;
  classCode: string;
  classId: string;
  className: string;
  componentCode: string | null;
  id: string;
  isLateUpdate: boolean;
  markedAt: string;
  notebookStatus: string | null;
  notes: string | null;
  sessionDate: string;
  sessionId: string;
  sessionLockedAt: string | null;
  startTime: string;
  status: SessionAttendanceStatus;
  testScore: number | null;
}

export interface StudentAttendanceClassSummary {
  classId: string;
  className: string;
  count: number;
}

export interface StudentAttendanceHistory {
  classes: StudentAttendanceClassSummary[];
  counts: Record<SessionAttendanceStatus, number>;
  items: StudentAttendanceHistoryItem[];
  total: number;
}

export const attendanceStatuses: readonly SessionAttendanceStatus[] = [
  "present",
  "additional_study",
  "excused_absence",
  "unexcused_absence",
];

export function isAttendanceStatus(value: string): value is SessionAttendanceStatus {
  return (attendanceStatuses as readonly string[]).includes(value);
}

export function summarizeAttendance(
  items: StudentAttendanceHistoryItem[],
): StudentAttendanceHistory {
  const counts: Record<SessionAttendanceStatus, number> = {
    additional_study: 0,
    excused_absence: 0,
    present: 0,
    unexcused_absence: 0,
  };
  const classMap = new Map<string, StudentAttendanceClassSummary>();

  for (const item of items) {
    counts[item.status] += 1;
    const existing = classMap.get(item.classId);

    if (existing) {
      existing.count += 1;
    } else {
      classMap.set(item.classId, { classId: item.classId, className: item.className, count: 1 });
    }
  }

  return {
    classes: [...classMap.values()].sort((left, right) => right.count - left.count),
    counts,
    items,
    total: items.length,
  };
}

/** Attendance rate in percent over marked sessions; `null` when nothing is marked. */
export function getAttendanceRate(history: StudentAttendanceHistory): number | null {
  if (history.total === 0) {
    return null;
  }

  const attended = history.counts.present + history.counts.additional_study;

  return Math.round((attended / history.total) * 100);
}

export type StudentPaymentRequestStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "expired";

export const paymentRequestStatuses: readonly StudentPaymentRequestStatus[] = [
  "pending",
  "partially_paid",
  "paid",
  "cancelled",
  "expired",
];

export interface StudentPaymentRequestItem {
  bonusSessions: number;
  createdAt: string;
  expectedAmountVnd: number;
  id: string;
  notes: string | null;
  paidAmountVnd: number;
  paidAt: string | null;
  publicCode: string;
  purchasedSessions: number;
  status: StudentPaymentRequestStatus;
  topupType: "new" | "renewal";
}

export interface StudentPaymentSummary {
  /** Pending + partially paid requests. */
  openCount: number;
  /** Expected minus paid across open requests. */
  outstandingVnd: number;
  requests: StudentPaymentRequestItem[];
  totalExpectedVnd: number;
  totalPaidVnd: number;
}

export function summarizePaymentRequests(
  requests: StudentPaymentRequestItem[],
): StudentPaymentSummary {
  let openCount = 0;
  let outstandingVnd = 0;
  let totalExpectedVnd = 0;
  let totalPaidVnd = 0;

  for (const request of requests) {
    if (request.status === "cancelled" || request.status === "expired") {
      continue;
    }

    totalExpectedVnd += request.expectedAmountVnd;
    totalPaidVnd += request.paidAmountVnd;

    if (request.status === "pending" || request.status === "partially_paid") {
      openCount += 1;
      outstandingVnd += Math.max(request.expectedAmountVnd - request.paidAmountVnd, 0);
    }
  }

  return { openCount, outstandingVnd, requests, totalExpectedVnd, totalPaidVnd };
}

export interface StudentUpcomingSession {
  classCode: string;
  className: string;
  endTime: string;
  id: string;
  learningMode: string;
  roomName: string | null;
  sessionDate: string;
  startTime: string;
  status: string;
}
