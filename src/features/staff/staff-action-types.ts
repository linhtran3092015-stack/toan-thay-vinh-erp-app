export type StaffManagementActionStatus = "idle" | "error" | "success";

export interface StaffManagementActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: StaffManagementActionStatus;
}

export interface UpdateStaffProfileActionInput {
  displayName: string;
  employeeCode: string;
  employmentStatus: "active" | "inactive" | "suspended";
  joinedAt: string;
  leftAt: string;
  phone: string;
  reason: string;
  staffId: string;
}

export interface CreateStaffRateVersionActionInput {
  effectiveFrom: string;
  note: string;
  offlineHourlyRateVnd: number;
  reason: string;
  staffId: string;
}

export const initialStaffManagementActionState: StaffManagementActionState = {
  message: "",
  status: "idle",
};
