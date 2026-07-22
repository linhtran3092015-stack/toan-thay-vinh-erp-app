import type { LearningLevel, RegisteredMode } from "@/features/students/types";
import type { PermissionCode, StudentLifecycleStatus } from "@/types/domain";

export type StudentFormMode = "create" | "edit";

export type StudentFormDemoState =
  | "default"
  | "denied"
  | "error"
  | "loading"
  | "not-found";

export type StudentFormStepId =
  | "student"
  | "guardian"
  | "enrollment"
  | "source"
  | "review";

export type FeeArea = "hanoi_hcm" | "province";
export type GuardianLinkMode = "existing" | "new";
export type CommunicationGroupStatus =
  | "created"
  | "not_created"
  | "not_required"
  | "pending";

export interface StudentFormStep {
  id: StudentFormStepId;
  label: string;
  shortLabel: string;
}

export interface MockClassSchedule {
  classInUrl?: string;
  roomName: string;
  scheduleText: string;
  teacherName: string;
}

export interface MockClass {
  grade: number;
  id: string;
  learningLevel: LearningLevel;
  mode: RegisteredMode | "hybrid";
  name: string;
  schedule: MockClassSchedule;
}

export interface MockLeadSource {
  defaultPartnerName?: string;
  id: string;
  label: string;
}

export interface MockSaleOwner {
  id: string;
  name: string;
}

export interface ChecklistItemDefinition {
  accountingPermission?: PermissionCode;
  id:
    | "accountantTransactionConfirmed"
    | "assistantSessionsConfirmed"
    | "classSelected"
    | "communicationGroupReady"
    | "feeConfirmed"
    | "modeConfirmed"
    | "officialStartDateEntered"
    | "paymentReceived"
    | "saleConfirmed"
    | "sourceConfirmed";
  label: string;
}

export interface PhoneNormalizationResult {
  isValid: boolean;
  normalized: string;
  warning?: string;
}

export interface GuardianLinkedStudent {
  className: string;
  fullName: string;
  id: string;
  publicCode: string;
  statusLabel: string;
}

export interface GuardianDuplicateResult {
  children: GuardianLinkedStudent[];
  guardianName: string;
  normalizedPhone: string;
}

export interface StudentDuplicateCandidate {
  className: string;
  fullName: string;
  id: string;
  publicCode: string;
  reason: string;
}

export interface StudentDuplicateResult {
  candidates: StudentDuplicateCandidate[];
}

export interface StudentFormPermissionSet {
  canAccountantConfirm: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canManageSale: boolean;
  canManageSource: boolean;
}

export const studentFormSteps: StudentFormStep[] = [
  { id: "student", label: "Thông tin học viên", shortLabel: "1" },
  { id: "guardian", label: "Phụ huynh", shortLabel: "2" },
  { id: "enrollment", label: "Lớp và học phí", shortLabel: "3" },
  { id: "source", label: "Nguồn và sổ liên lạc", shortLabel: "4" },
  { id: "review", label: "Checklist và xem lại", shortLabel: "5" },
];

export const formLifecycleStatusOptions: Array<{
  label: string;
  value: StudentLifecycleStatus;
}> = [
  { label: "Đang quan tâm", value: "interested" },
  { label: "Đã đặt lịch học thử", value: "trial_booked" },
  { label: "Đã học thử", value: "trial_completed" },
  {
    label: "Chờ xác nhận nhập học",
    value: "pending_enrollment_confirmation",
  },
  { label: "Đang học", value: "active" },
  { label: "Bảo lưu", value: "reserved" },
  { label: "Quay lại học", value: "resumed" },
  { label: "Chờ chọn lớp", value: "waiting_class" },
  { label: "Hoàn thành", value: "completed" },
];
