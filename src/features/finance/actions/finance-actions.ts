"use server";

import { revalidatePath } from "next/cache";

import type {
  AllocatePaymentInput,
  CreatePaymentRequestInput,
  FinanceActionFieldErrors,
  FinanceActionResultState,
} from "@/features/finance/forms/finance-action-types";
import {
  allocatePaymentSchema,
  createPaymentRequestSchema,
} from "@/features/finance/forms/finance-schemas";
import { buildVietQrPaymentDetails } from "@/features/finance/vietqr";
import { getSepayPaymentEnv } from "@/lib/env";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type CreatePaymentRequestRpcArgs = Database["public"]["Functions"]["create_student_payment_request"]["Args"];
type AllocatePaymentRpcArgs = Database["public"]["Functions"]["allocate_payment_to_students"]["Args"];

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

    ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION:
      "Tổng số tiền phân bổ phải bằng đúng số tiền của giao dịch SePay.",

    ALLOCATION_ALREADY_EXISTS:
      "Giao dịch này đã có phân bổ học phí.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    EMPTY_ALLOCATIONS:
      "Vui lòng chọn ít nhất 1 học viên để phân bổ học phí.",

    DUPLICATE_ALLOCATION_STUDENT:
      "Một học viên chỉ được phân bổ một lần trong cùng giao dịch.",

    GUARDIAN_ID_REQUIRED:
      "Vui lòng chọn phụ huynh cho giao dịch phân bổ.",

    INVALID_ALLOCATION_ITEM:
      "Dữ liệu phân bổ học phí không hợp lệ.",

    INVALID_EXPECTED_AMOUNT:
      "Số tiền dự kiến nạp không hợp lệ.",

    INVALID_PURCHASED_SESSIONS:
      "Số buổi nạp phải từ 1 buổi trở lên.",

    INVALID_REFUND_AMOUNT:
      "Số tiền hoàn trả không hợp lệ.",

    INVALID_REFUND_SESSIONS:
      "Số buổi hoàn trả phải lớn hơn 0.",

    PAYMENTS_CREATE_REQUEST_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền tạo yêu cầu nạp tiền.",

    SEPAY_ALLOCATE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền phân bổ giao dịch SePay.",

    STUDENT_NOT_FOUND:
      "Không tìm thấy học viên trong hệ thống.",

    STUDENT_GUARDIAN_MISMATCH:
      "Có học viên không thuộc phụ huynh đã chọn.",

    STUDENT_PRIMARY_GUARDIAN_NOT_FOUND:
      "Học viên chưa có phụ huynh chính đang hoạt động.",

    TRANSACTION_NOT_AVAILABLE_FOR_ALLOCATION:
      "Giao dịch này đã được xử lý hoặc đang cần đối soát.",

    TRANSACTION_NOT_INBOUND:
      "Chỉ giao dịch chuyển vào mới được phân bổ học phí.",

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
  if (
    !permissionResult.ok ||
    (!permissionResult.permissions.includes("payments.create_request") &&
      !permissionResult.permissions.includes("payments.manage"))
  ) {
    return createErrorState("Tài khoản hiện tại không có quyền tạo yêu cầu nạp tiền.");
  }

  const parsed = createPaymentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin yêu cầu nạp tiền.",
      parsed.error.flatten().fieldErrors,
    );
  }

  let paymentConfig: ReturnType<typeof getSepayPaymentEnv>;
  try {
    paymentConfig = getSepayPaymentEnv();
  } catch {
    return createErrorState(
      "Chưa cấu hình tài khoản nhận tiền VietQR. Vui lòng liên hệ quản trị hệ thống.",
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

    const data = rawData as unknown as {
      expected_amount_vnd?: number;
      id?: string;
      public_code?: string;
      transfer_code?: string;
    } | null;

    if (!data?.id || !data.public_code || !data.transfer_code) {
      return createErrorState("Database không trả về thông tin yêu cầu nạp tiền.");
    }

    const expectedAmountVnd = Number(
      data.expected_amount_vnd ?? parsed.data.expectedAmountVnd,
    );
    const qrDetails = buildVietQrPaymentDetails(paymentConfig, {
      amountVnd: expectedAmountVnd,
      transferCode: data.transfer_code,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/payment-requests");
    revalidatePath(`/students/${parsed.data.studentId}`);

    return {
      id: data.id,
      message: "Đã tạo yêu cầu thanh toán và mã VietQR.",
      paymentRequest: {
        accountHolder: qrDetails.accountHolder,
        accountNumber: qrDetails.accountNumber,
        bankCode: qrDetails.bankCode,
        expectedAmountVnd,
        publicCode: data.public_code,
        qrImageUrl: qrDetails.imageUrl,
        transferCode: data.transfer_code,
        transferDescription: qrDetails.transferDescription,
      },
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
  if (
    !permissionResult.ok ||
    (!permissionResult.permissions.includes("sepay.allocate") &&
      !permissionResult.permissions.includes("payments.manage"))
  ) {
    return createErrorState("Tài khoản hiện tại không có quyền phân bổ giao dịch SePay.");
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
