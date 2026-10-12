import type {
  SessionAttendanceStatus,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";

/** Statuses lock_class_session_internal accepts as a recorded roster attendance. */
const LOCK_COUNTED_ATTENDANCE_STATUSES: ReadonlySet<SessionAttendanceStatus> = new Set([
  "present",
  "excused_absence",
  "unexcused_absence",
]);

export interface SessionLockReadiness {
  /** Roster students with present or an absence. */
  markedCount: number;
  /** Roster students (walk-ins have no enrollmentClassId and are not counted). */
  rosterCount: number;
  /** Roster students whose only status is additional_study, which the lock does not accept. */
  rosterAdditionalStudy: SessionParticipantReadModel[];
}

/**
 * Client-side preview of lock_class_session_internal's attendance rule: the roster must be
 * non-empty and every roster student needs present or an absence. Results are not a condition.
 */
export function getSessionLockReadiness(participants: SessionParticipantReadModel[]): SessionLockReadiness {
  const roster = participants.filter((participant) => participant.enrollmentClassId !== null);

  return {
    markedCount: roster.filter(
      (participant) => participant.attendanceStatus !== null && LOCK_COUNTED_ATTENDANCE_STATUSES.has(participant.attendanceStatus),
    ).length,
    rosterAdditionalStudy: roster.filter((participant) => participant.attendanceStatus === "additional_study"),
    rosterCount: roster.length,
  };
}

/** Display name that respects student masking: without students.view, students are numbered by roster position. */
export function getParticipantDisplayName(
  participant: SessionParticipantReadModel,
  participants: SessionParticipantReadModel[],
  canViewStudents: boolean,
): string {
  const fallback = `Học viên ${participants.indexOf(participant) + 1}`;

  return canViewStudents ? participant.studentName ?? participant.studentCode ?? fallback : fallback;
}
