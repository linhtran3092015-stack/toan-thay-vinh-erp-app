"use server";

import { revalidatePath } from "next/cache";

import type {
  AdvanceActionState,
  ApproveSalaryAdvanceInput,
  RequestSalaryAdvanceInput,
  ReviewSalaryAdvanceInput,
} from "@/features/advances/forms/advance-action-types";
import {
  approveSalaryAdvanceSchema,
  requestSalaryAdvanceSchema,
  reviewSalaryAdvanceSchema,
} from "@/features/advances/forms/advance-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type ApproveSalaryAdvanceArgs =
  Database["public"]["Functions"]["approve_salary_advance"]["Args"];
type RequestSalaryAdvanceArgs =
  Database["public"]["Functions"]["request_salary_advance"]["Args"];
type ReviewSalaryAdvanceArgs =
  Database["public"]["Functions"]["review_salary_advance"]["Args"];

function createErrorState(
  message: string,
  fieldErrors?: AdvanceActionState["fieldErrors"],
): AdvanceActionState {
  return { fieldErrors, message, status: "error" };
}

async function requirePermission(
  permission: PermissionCode,
): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền tạm ứng. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes(permission)) {
    return `Tài khoản hiện tại không có quyền ${permission}.`;
  }

  return null;
}

function getAdvanceRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ADVANCES_OWNER_APPROVE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền duyệt tạm ứng.",
    ADVANCES_REQUEST_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền yêu cầu tạm ứng.",
    ADVANCES_REVIEW_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền đối soát tạm ứng.",
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    SALARY_ADVANCE_AMOUNT_INVALID: "Số tiền tạm ứng không hợp lệ.",
    SALARY_ADVANCE_APPROVAL_DECISION_INVALID: "Quyết định duyệt tạm ứng không hợp lệ.",
    SALARY_ADVANCE_DEDUCTION_MONTH_IN_PAST:
      "Kỳ khấu trừ không thể là tháng đã qua.",
    SALARY_ADVANCE_DEDUCTION_MONTH_INVALID: "Kỳ khấu trừ không hợp lệ.",
    SALARY_ADVANCE_NOT_REQUESTED:
      "Yêu cầu này không còn chờ đối soát.",
    SALARY_ADVANCE_NOT_REVIEWED:
      "Yêu cầu này cần được đối soát trước khi duyệt.",
    SALARY_ADVANCE_REJECTION_REASON_REQUIRED: "Cần nêu lý do từ chối.",
    SALARY_ADVANCE_REQUEST_NOTE_INVALID: "Lý do tạm ứng không hợp lệ.",
    SALARY_ADVANCE_REVIEW_DECISION_INVALID: "Quyết định đối soát không hợp lệ.",
    SALARY_ADVANCE_SELF_DECISION_FORBIDDEN:
      "Không thể tự đối soát hoặc tự duyệt tạm ứng của chính mình.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật yêu cầu tạm ứng. Dữ liệu chưa được thay đổi.";
}

export async function requestSalaryAdvanceAction(
  input: RequestSalaryAdvanceInput,
): Promise<AdvanceActionState> {
  const permissionError = await requirePermission("advances.request");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = requestSalaryAdvanceSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại yêu cầu tạm ứng.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "request_salary_advance",
      {
        p_amount_vnd: parsed.data.amountVnd,
        p_deduction_period_month: parsed.data.deductionPeriodMonth,
        p_request_note: parsed.data.requestNote,
      } as RequestSalaryAdvanceArgs,
    );

    if (error) {
      return createErrorState(getAdvanceRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về yêu cầu tạm ứng vừa tạo.");
    }

    revalidatePath("/advances");
    return { message: "Đã gửi yêu cầu tạm ứng để đối soát.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống tạm ứng.");
  }
}

export async function reviewSalaryAdvanceAction(
  input: ReviewSalaryAdvanceInput,
): Promise<AdvanceActionState> {
  const permissionError = await requirePermission("advances.review");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = reviewSalaryAdvanceSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại quyết định đối soát.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "review_salary_advance",
      {
        p_decision: parsed.data.decision,
        p_note: parsed.data.note,
        p_salary_advance_id: parsed.data.salaryAdvanceId,
      } as ReviewSalaryAdvanceArgs,
    );

    if (error) {
      return createErrorState(getAdvanceRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về trạng thái đối soát.");
    }

    revalidatePath("/advances");
    return {
      message:
        parsed.data.decision === "review"
          ? "Đã chuyển yêu cầu sang bước chủ trung tâm duyệt."
          : "Đã từ chối yêu cầu tạm ứng.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống tạm ứng.");
  }
}

export async function approveSalaryAdvanceAction(
  input: ApproveSalaryAdvanceInput,
): Promise<AdvanceActionState> {
  const permissionError = await requirePermission("advances.owner_approve");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = approveSalaryAdvanceSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại quyết định duyệt.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "approve_salary_advance",
      {
        p_decision: parsed.data.decision,
        p_note: parsed.data.note,
        p_salary_advance_id: parsed.data.salaryAdvanceId,
      } as ApproveSalaryAdvanceArgs,
    );

    if (error) {
      return createErrorState(getAdvanceRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về trạng thái duyệt.");
    }

    revalidatePath("/advances");
    return {
      message:
        parsed.data.decision === "approved"
          ? "Đã duyệt tạm ứng. Khoản này sẽ được khấu trừ ở kỳ đã chọn."
          : "Đã từ chối yêu cầu tạm ứng.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống tạm ứng.");
  }
}
