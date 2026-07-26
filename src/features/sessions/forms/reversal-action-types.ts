export interface ReverseSessionChargeActionInput {
  reason: string;
  sessionAttendanceId: string;
}

export type ReversalActionFieldErrors = Record<string, string[] | undefined>;

export type ReverseSessionChargeActionState =
  | {
      fieldErrors?: ReversalActionFieldErrors;
      message: string;
      status: "error";
    }
  | {
      entryType: string;
      id: string;
      message: string;
      sessionAttendanceId: string;
      status: "success";
    };
