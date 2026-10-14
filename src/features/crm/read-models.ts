export type CrmCaseStatus =
  | "interested"
  | "trial_booked"
  | "trial_completed"
  | "pending_enrollment_confirmation"
  | "converted"
  | "dropped";

export interface CrmLeadItemReadModel {
  birthYear: number;
  createdAt: string;
  expectedGrade: number;
  expectedLevel: string | null;
  expectedMode: string | null;
  fullName: string;
  guardianFullName: string;
  guardianPhone: string;
  id: string;
  leadSourceName: string;
  publicCode: string;
  saleOwnerId: string | null;
  saleOwnerName: string | null;
  status: CrmCaseStatus;
  studentId: string | null;
  /** When the case entered its current status (badge suffix). Optional: older fixtures omit it. */
  statusChangedAt?: string | null;
  /** Drop reason for a dropped case (badge suffix). */
  dropReason?: string | null;
  /** Earliest still-scheduled trial date (`YYYY-MM-DD`) for a trial_booked case. */
  nextTrialDate?: string | null;
}

export interface CrmTrialBookingReadModel {
  classSessionId: string | null;
  createdAt: string;
  id: string;
  learningMode: string;
  /** When attended / no-show / cancelled was recorded (lifecycle rail). */
  resultRecordedAt?: string | null;
  saleNotes: string | null;
  status: string;
  teacherFeedback: string | null;
  trialDate: string;
}

export interface CrmCaseNoteReadModel {
  createdAt: string;
  createdBy: string;
  createdByName: string | null;
  followUpAt: string | null;
  followUpDoneAt: string | null;
  followUpDoneByName: string | null;
  id: string;
  note: string;
}

export interface CrmAssignmentHistoryReadModel {
  assignedByName: string | null;
  assignmentMethod: string;
  createdAt: string;
  id: string;
  newSaleOwnerName: string;
  /** Set on a transfer; `null` on the first assignment. */
  previousSaleOwnerId: string | null;
  /** `null` when there is no previous owner or profiles RLS hides the name. */
  previousSaleOwnerName: string | null;
  reason: string;
}

export interface EnrollmentChecklistReadModel {
  completedAt: string | null;
  completedByName: string | null;
  id: string;
  isFullyCompleted: boolean;
  item1PaymentReceived: boolean;
  item2SourceConfirmed: boolean;
  item3SaleConfirmed: boolean;
  item4ClassSelected: boolean;
  item5ModeConfirmed: boolean;
  item6FeeConfirmed: boolean;
  item7AssistantSessionsConfirmed: boolean;
  item8AccountantTransactionConfirmed: boolean;
  item9OfficialStartDateEntered: boolean;
  item10CommunicationGroupReady: boolean;
}

export interface CrmCaseDetailReadModel {
  assignmentHistory: CrmAssignmentHistoryReadModel[];
  birthYear: number;
  checklist: EnrollmentChecklistReadModel | null;
  createdAt: string;
  discountNotes: string | null;
  dropReason: string | null;
  droppedAt: string | null;
  expectedGrade: number;
  expectedLevel: string | null;
  expectedMode: string | null;
  expectedOfficialStartDate: string | null;
  expectedTuitionFeeVnd: number | null;
  fullName: string;
  guardianFullName: string;
  guardianId: string | null;
  guardianPhone: string;
  guardianRelationship: string;
  id: string;
  leadSourceCode: string;
  leadSourceName: string;
  nickname: string | null;
  notes: string | null;
  /** Working notes and follow-ups, newest first. */
  caseNotes: CrmCaseNoteReadModel[];
  provinceCity: string | null;
  publicCode: string;
  saleOwnerId: string | null;
  saleOwnerName: string | null;
  status: CrmCaseStatus;
  /** When the case entered its current status (lifecycle rail). */
  statusChangedAt?: string | null;
  studentId: string | null;
  trialBookings: CrmTrialBookingReadModel[];
}

/** Per-status lead counts for the quick filter chips (the loader returns `null` when any count failed). */
export type CrmStatusCounts = Record<CrmCaseStatus, number>;

/** Header context line of the lead list. Counts are `null` when they failed to load. */
export interface CrmDirectoryOverview {
  /** `MM/YYYY` in Vietnam time. */
  monthLabel: string;
  newLeadsThisMonth: number | null;
  pendingConfirmation: number | null;
}

export interface LeadSourceOption {
  code: string;
  groupCode: string;
  id: string;
  name: string;
}

export interface SaleOwnerOption {
  fullName: string;
  id: string;
}
