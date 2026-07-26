"use server";

import { revalidatePath } from "next/cache";

import type {
  AllocatePaymentInput,
  CreatePaymentRequestInput,
  FinanceActionFieldErrors,
  FinanceActionResultState,
  ProcessRefundInput,
} from "@/features/finance/forms/finance-action-types";
import {
  allocatePaymentSchema,
  createPaymentRequestSchema,
  processRefundSchema,
} from "@/features/finance/forms/finance-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type CreatePaymentRequestRpcArgs = Database["public"]["Functions"]["create_student_payment_request"]["Args"];
type AllocatePaymentRpcArgs = Database["public"]["Functions"]["allocate_payment_to_students"]["Args"];
type ProcessRefundRpcArgs = Database["public"]["Functions"]["process_student_refund"]["Args"];

function createErrorState(
  message: string,
  fieldErrors?: FinanceActionFieldErrors,
): FinanceActionResultState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

function getFinanceRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ALLOCATION_EXCEEDS_TRANSACTION:
      "Tổng số tiền phân bổ vượt quá số tiền của giao dịch SePay.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    EMPTY_ALLOCATIONS:
      "Vui lòng chọn ít nhất 1 học viên để phân bổ học phí.",

    INVALID_EXPECTED_AMOUNT:
      "Số tiền dự kiến nạp không hợp lệ.",

    INVALID_PURCHASED_SESSIONS:
      "Số buổi nạp phải từ 1 buổi trở lên.",

    INVALID_REFUND_AMOUNT:
      "Số tiền hoàn trả không hợp lệ.",

    INVALID_REFUND_SESSIONS:
      "Số buổi hoàn trả phải lớn hơn 0.",

    PAYMENTS_MANAGE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý thanh toán (payments.manage).",

    REFUNDS_MANAGE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền duyệt hoàn phí (refunds.manage).",

    STUDENT_NOT_FOUND:
      "Không tìm thấy học viên trong hệ thống.",

    TRANSACTION_NOT_FOUND:
      "Giao dịch SePay không tồn tại.",
  };

  for (const [dbMsg, userMsg] of Object.entries(knownMessages)) {
    if (message.includes(dbMsg)) {
      return userMsg;
    }
  }

  return "Không thể xử lý giao dịch tài chính. Vui lòng thử lại sau.";
}

export async function createPaymentRequestAction(
  input: CreatePaymentRequestInput,
): Promise<FinanceActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("payments.manage")) {
    return createErrorState("Tài khoản hiện tại không có quyền payments.manage.");
  }

  const parsed = createPaymentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin yêu cầu nạp tiền.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpcArgs = {
      p_bonus_sessions: parsed.data.bonusSessions,
      p_calculated_unit_price_vnd: parsed.data.calculatedUnitPriceVnd,
      p_expected_amount_vnd: parsed.data.expectedAmountVnd,
      p_notes: parsed.data.notes ?? null,
      p_purchased_sessions: parsed.data.purchasedSessions,
      p_student_id: parsed.data.studentId,
      p_topup_type: parsed.data.topupType,
    } as unknown as CreatePaymentRequestRpcArgs;

    const { data: rawData, error } = await supabase.rpc("create_student_payment_request", rpcArgs);

    if (error) {
      return createErrorState(getFinanceRpcErrorMessage(error.message));
    }

    const data = rawData as unknown as { id?: string; transfer_code?: string } | null;

    if (!data?.id) {
      return createErrorState("Database không trả về thông tin yêu cầu nạp tiền.");
    }

    revalidatePath("/finance");
    revalidatePath(`/students/${parsed.data.studentId}`);

    return {
      id: data.id,
      message: `Đã tạo Yêu cầu Nạp tiền thành công! (Mã chuyển khoản: ${data.transfer_code ?? ""})`,
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống tài chính.");
  }
}

export async function allocatePaymentAction(
  input: AllocatePaymentInput,
): Promise<FinanceActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("payments.manage")) {
    return createErrorState("Tài khoản hiện tại không có quyền payments.manage.");
  }

  const parsed = allocatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin phân bổ học phí.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rawAllocations = parsed.data.allocations.map((a) => ({
      allocated_amount_vnd: a.allocatedAmountVnd,
      allocated_sessions: a.allocatedSessions,
      bonus_sessions: a.bonusSessions,
      notes: a.notes ?? "",
      student_id: a.studentId,
      unit_price_vnd: a.unitPriceVnd,
    }));

    const rpcArgs = {
      p_allocations: rawAllocations,
      p_guardian_id: parsed.data.guardianId,
      p_sepay_transaction_id: parsed.data.sepayTransactionId,
    } as unknown as AllocatePaymentRpcArgs;

    const { error } = await supabase.rpc("allocate_payment_to_students", rpcArgs);

    if (error) {
      return createErrorState(getFinanceRpcErrorMessage(error.message));
    }

    revalidatePath("/finance");
    revalidatePath("/finance/sepay");

    return {
      id: parsed.data.sepayTransactionId,
      message: "Đã phân bổ học phí cho các con thành công!",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống phân bổ học phí.");
  }
}

export async function processRefundAction(
  input: ProcessRefundInput,
): Promise<FinanceActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("refunds.manage")) {
    return createErrorState("Tài khoản hiện tại không có quyền refunds.manage.");
  }

  const parsed = processRefundSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin hoàn phí.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpcArgs = {
      p_reason: parsed.data.reason,
      p_refund_amount_vnd: parsed.data.refundAmountVnd,
      p_refund_sessions: parsed.data.refundSessions,
      p_student_id: parsed.data.studentId,
    } as unknown as ProcessRefundRpcArgs;

    const { data: rawData, error } = await supabase.rpc("process_student_refund", rpcArgs);

    if (error) {
      return createErrorState(getFinanceRpcErrorMessage(error.message));
    }

    const data = rawData as unknown as { reference_code?: string } | null;

    revalidatePath("/finance");
    revalidatePath(`/students/${parsed.data.studentId}`);

    return {
      id: parsed.data.studentId,
      message: `Đã xử lý hoàn phí thành công! (Mã chứng từ: ${data?.reference_code ?? ""})`,
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống hoàn phí.");
  }
}
