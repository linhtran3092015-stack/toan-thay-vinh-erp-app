export type SettingsActionField =
  | "email"
  | "invitationId"
  | "permissionIds"
  | "reason"
  | "roleId"
  | "roleIds"
  | "userId";

export interface SettingsActionState {
  fieldErrors?: Partial<Record<SettingsActionField, string[]>>;
  message: string;
  status: "error" | "idle" | "success";
}

export const initialSettingsActionState: SettingsActionState = {
  message: "",
  status: "idle",
};
