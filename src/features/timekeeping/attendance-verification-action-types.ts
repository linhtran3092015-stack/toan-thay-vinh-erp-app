export type AttendanceVerificationActionState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "error" | "success";
};
