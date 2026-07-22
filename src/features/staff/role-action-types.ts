export type StaffRoleActionStatus = "idle" | "error" | "success";

export interface StaffRoleActionState {
  fieldErrors?: {
    assignmentId?: string[];
    reason?: string[];
    roleCode?: string[];
    userId?: string[];
  };
  message: string;
  status: StaffRoleActionStatus;
}

export const initialStaffRoleActionState: StaffRoleActionState = {
  message: "",
  status: "idle",
};
