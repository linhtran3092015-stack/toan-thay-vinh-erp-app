"use server";

import { revalidatePath } from "next/cache";

import type {
  AddPayrollManualLineInput,
  CreatePayrollDraftInput,
  PayrollActionState,
  PayrollPeriodActionInput,
} from "@/features/payroll/forms/payroll-action-types";
import {
  addPayrollManualLineSchema,
  createPayrollDraftSchema,
  payrollPeriodActionSchema,
} from "@/features/payroll/forms/payroll-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type AddPayrollManualLineArgs =
  Database["public"]["Functions"]["add_payroll_manual_line"]["Args"];
type CreatePayrollDraftArgs =
  Database["public"]["Functions"]["create_payroll_draft"]["Args"];

function createErrorState(
  message: string,
  fieldErrors?: PayrollActionState["fieldErrors"],
): PayrollActionState {
  return { fieldErrors, message, status: "error" };
}

async function requirePermission(
  permission: PermissionCode,
): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền bảng lương. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes(permission)) {
    return `Tài khoản hiện tại không có quyền ${permission}.`;
  }

  return null;
}

function getPayrollRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    PAYROLL_ACCOUNTANT_RECONCILE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền đối soát bảng lương.",
    PAYROLL_MANAGE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền lập bảng lương.",
    PAYROLL_MANUAL_LINE_AMOUNT_INVALID: "Số tiền thưởng hoặc khấu trừ không hợp lệ.",
    PAYROLL_MANUAL_LINE_NOTE_INVALID: "Nội dung thưởng hoặc khấu trừ không hợp lệ.",
    PAYROLL_MANUAL_LINE_TYPE_INVALID: "Loại điều chỉnh lương không hợp lệ.",
    PAYROLL_OWNER_APPROVE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền duyệt bảng lương.",
    PAYROLL_PERIOD_ALREADY_EXISTS: "Kỳ lương này đã được lập.",
    PAYROLL_PERIOD_NOT_CLOSED:
      "Chỉ có thể lập bảng lương cho tháng đã kết thúc.",
    PAYROLL_PERIOD_NOT_DRAFT: "Kỳ lương không còn ở trạng thái nháp.",
    PAYROLL_PERIOD_NOT_REVIEW: "Kỳ lương cần được đối soát trước khi duyệt.",
    PAYROLL_RATE_VERSION_NOT_FOUND:
      "Có lượt công chưa có đơn giá hiệu lực. Hãy bổ sung rate version trước.",
    PAYROLL_STATEMENT_NOT_FOUND: "Không tìm thấy bảng lương nhân sự.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật bảng lương. Dữ liệu chưa được thay đổi.";
}

export async function createPayrollDraftAction(
  input: CreatePayrollDraftInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.manage");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createPayrollDraftSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại kỳ lương.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "create_payroll_draft",
      { p_period_month: parsed.data.periodMonth } as CreatePayrollDraftArgs,
    );

    if (error) {
      return createErrorState(getPayrollRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về kỳ lương vừa tạo.");
    }

    revalidatePath("/payroll");
    return { message: "Đã tạo bảng lương nháp.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống bảng lương.");
  }
}

export async function addPayrollManualLineAction(
  input: AddPayrollManualLineInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.manage");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = addPayrollManualLineSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại khoản thưởng hoặc khấu trừ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "add_payroll_manual_line",
      {
        p_amount_vnd: parsed.data.amountVnd,
        p_line_type: parsed.data.lineType,
        p_note: parsed.data.note,
        p_payroll_statement_id: parsed.data.payrollStatementId,
      } as AddPayrollManualLineArgs,
    );

    if (error) {
      return createErrorState(getPayrollRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về khoản điều chỉnh vừa thêm.");
    }

    revalidatePath("/payroll");
    return { message: "Đã thêm khoản điều chỉnh lương.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống bảng lương.");
  }
}

async function submitPayrollPeriodAction(
  input: PayrollPeriodActionInput,
  action: "approve" | "review",
): Promise<PayrollActionState> {
  const requiredPermission =
    action === "review"
      ? "payroll.accountant_reconcile"
      : "payroll.owner_approve";
  const permissionError = await requirePermission(requiredPermission);

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = payrollPeriodActionSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Kỳ lương không hợp lệ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } =
      action === "review"
        ? await supabase.rpc("submit_payroll_for_review", {
            p_payroll_period_id: parsed.data.payrollPeriodId,
          })
        : await supabase.rpc("approve_payroll_period", {
            p_payroll_period_id: parsed.data.payrollPeriodId,
          });

    if (error) {
      return createErrorState(getPayrollRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về trạng thái kỳ lương.");
    }

    revalidatePath("/payroll");
    return {
      message:
        action === "review"
          ? "Đã chuyển bảng lương sang đối soát."
          : "Đã duyệt và khóa bảng lương.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống bảng lương.");
  }
}

export async function submitPayrollForReviewAction(
  input: PayrollPeriodActionInput,
): Promise<PayrollActionState> {
  return await submitPayrollPeriodAction(input, "review");
}

export async function approvePayrollPeriodAction(
  input: PayrollPeriodActionInput,
): Promise<PayrollActionState> {
  return await submitPayrollPeriodAction(input, "approve");
}
