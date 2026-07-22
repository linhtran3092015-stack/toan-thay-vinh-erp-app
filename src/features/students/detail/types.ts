import type { Student } from "@/features/students/types";
import type { PermissionCode } from "@/types/domain";

export type DetailAttendanceKind = "additional" | "main";
export type DetailAttendanceStatus =
  | "additional_study"
  | "excused_absence"
  | "present"
  | "unexcused_absence";
export type ActualStudyMode = "offline" | "online";
export type ScoreStatus =
  | "absent_not_applicable"
  | "exempt"
  | "not_submitted"
  | "scored";
export type PaymentTopupStatus = "confirmed" | "draft" | "voided";
export type TopupType = "new_enrollment" | "renewal";
export type SessionLedgerType =
  | "adjustment"
  | "bonus_sessions"
  | "cancelled_session_refund"
  | "fee_topup"
  | "refund"
  | "session_charge"
  | "transfer_in"
  | "transfer_out";
export type CoachingPriority = "high" | "low" | "medium";
export type CoachingStatus = "closed" | "in_progress" | "open";
export type AlertSeverity = "danger" | "info" | "warning";

export interface GuardianDetail {
  fullName: string;
  relationship: string;
  phone: string;
  zalo: string;
  email: string;
}

export interface AdmissionSourceDetail {
  sourceName: string;
  partnerName: string;
  saleOwnerName: string;
  recordedAt: string;
}

export interface CommunicationGroupDetail {
  status: "created" | "missing";
  groupName: string;
  createdAt: string;
  createdBy: string;
  note: string;
}

export interface StudentMainClassDetail {
  className: string;
  teacherName: string;
  scheduleText: string;
  roomName: string;
  officialStartDate: string;
}

export interface StudentDetailSummary {
  currentUnitPrice: number;
  latestPaymentDate: string;
  averageScoreLastFourSessions: number;
  consecutiveAbsences: number;
  totalPurchasedSessions: number;
  totalBonusSessions: number;
  totalUsedSessions: number;
}

export interface StudentAttendanceRecord {
  id: string;
  date: string;
  className: string;
  sessionNumber: number;
  kind: DetailAttendanceKind;
  status: DetailAttendanceStatus;
  actualMode: ActualStudyMode;
  deductedSessions: number;
  markedBy: string;
  isLateUpdate: boolean;
}

export interface StudentResultRecord {
  id: string;
  date: string;
  className: string;
  sessionNumber: number;
  quizScore: number | null;
  notebookScore: number | null;
  comment: string;
  gradedBy: string;
  status: ScoreStatus;
}

export interface PaymentTopupRecord {
  id: string;
  date: string;
  amount: number;
  paidSessions: number;
  bonusSessions: number;
  effectiveUnitPrice: number;
  type: TopupType;
  status: PaymentTopupStatus;
}

export interface SessionLedgerRecord {
  id: string;
  date: string;
  type: SessionLedgerType;
  delta: number;
  balanceAfter: number;
  reference: string;
  actorName: string;
  note: string;
}

export interface CoachingRecord {
  id: string;
  campaignName: string;
  openedAt: string;
  reason: string;
  priority: CoachingPriority;
  ownerName: string;
  status: CoachingStatus;
  reviewAt: string;
  outcome: string;
}

export interface AuditTimelineRecord {
  id: string;
  timestamp: string;
  actorName: string;
  module: string;
  action: string;
  oldData: string;
  newData: string;
  reason: string;
}

export interface StudentAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  actionLabel: string;
}

export interface StudentDetail {
  student: Student;
  provinceName: string;
  officialStartDate: string;
  learningGoal: string;
  guardian: GuardianDetail;
  admissionSource: AdmissionSourceDetail;
  communicationGroup: CommunicationGroupDetail;
  mainClass: StudentMainClassDetail;
  summary: StudentDetailSummary;
  attendance: StudentAttendanceRecord[];
  results: StudentResultRecord[];
  topups: PaymentTopupRecord[];
  ledger: SessionLedgerRecord[];
  coaching: CoachingRecord[];
  auditTrail: AuditTimelineRecord[];
  alerts: StudentAlert[];
}

export type StudentDetailDemoState =
  | "default"
  | "denied"
  | "error"
  | "loading"
  | "not-found";

export interface StudentDetailAction {
  label: string;
  permission?: PermissionCode;
}
