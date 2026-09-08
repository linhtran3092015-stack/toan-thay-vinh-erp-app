export interface AdminTimekeepingActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "idle" | "success" | "error";
}

export const initialAdminTimekeepingActionState: AdminTimekeepingActionState = {
  message: "",
  status: "idle",
};

