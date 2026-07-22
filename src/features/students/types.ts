import type { StudentLifecycleStatus } from "@/types/domain";

export type LearningLevel = "A" | "B" | "CLC";
export type RegisteredMode = "online" | "offline";
export type LeadSourceGroup = "mma" | "other" | "sandbox";
export type BalanceFilter = "all" | "negative" | "positive" | "zero";
export type AlertFilter = "all" | "has_alert";
export type CommunicationGroupFilter = "all" | "has_group" | "no_group";

export interface Student {
  id: string;
  publicCode: string;
  fullName: string;
  nickname: string;
  birthYear: number;
  guardianName: string;
  guardianPhone: string;
  currentGrade: number;
  mainClassName: string;
  learningLevel: LearningLevel;
  registeredMode: RegisteredMode;
  sessionBalance: number;
  leadSourceName: string;
  leadSourceGroup: LeadSourceGroup;
  saleOwnerName: string;
  lifecycleStatus: StudentLifecycleStatus;
  hasCommunicationGroup: boolean;
  alertCount: number;
}

export interface StudentFiltersState {
  search: string;
  grade: string;
  className: string;
  status: string;
  learningLevel: string;
  registeredMode: string;
  leadSourceGroup: string;
  saleOwnerName: string;
  balance: BalanceFilter;
  alert: AlertFilter;
  communicationGroup: CommunicationGroupFilter;
}

export type StudentListDemoState = "default" | "denied" | "empty" | "error" | "loading";

export interface StudentStatusMeta {
  label: string;
  tone: "danger" | "info" | "neutral" | "purple" | "success" | "warning";
}
