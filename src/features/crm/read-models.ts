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
}

export interface CrmTrialBookingReadModel {
  classSessionId: string | null;
  createdAt: string;
  id: string;
  learningMode: string;
  saleNotes: string | null;
  status: string;
  teacherFeedback: string | null;
  trialDate: string;
}

export interface CrmAssignmentHistoryReadModel {
  assignedByName: string | null;
  assignmentMethod: string;
  createdAt: string;
  id: string;
  newSaleOwnerName: string;
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
  provinceCity: string | null;
  publicCode: string;
  saleOwnerId: string | null;
  saleOwnerName: string | null;
  status: CrmCaseStatus;
  studentId: string | null;
  trialBookings: CrmTrialBookingReadModel[];
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
