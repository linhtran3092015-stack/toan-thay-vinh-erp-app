"use server";

import { revalidatePath } from "next/cache";

import type {
  AddPayrollManualLineInput,
  CreatePayrollDraftInput,
  CreatePayrollImportBatchInput,
  DecidePayrollImportBatchInput,
  PayrollActionState,
  PayrollPeriodActionInput,
  RecalculatePayrollInput,
  ResolvePayrollCorrectionInput,
  SubmitPayrollCorrectionInput,
} from "@/features/payroll/forms/payroll-action-types";
import {
  addPayrollManualLineSchema,
  createPayrollDraftSchema,
  createPayrollImportBatchSchema,
  decidePayrollImportBatchSchema,
  payrollPeriodActionSchema,
  recalculatePayrollSchema,
  resolvePayrollCorrectionSchema,
  submitPayrollCorrectionSchema,
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
    PAYROLL_IMPORT_FILE_OR_SOURCE_DUPLICATE:
      "Tệp hoặc mã dòng dữ liệu này đã được nhập trước đó.",
    PAYROLL_IMPORT_PAYLOAD_INVALID:
      "Nội dung tệp nhập không đúng định dạng.",
    PAYROLL_IMPORT_SELF_APPROVAL_FORBIDDEN:
      "Người tải tệp không thể tự duyệt tệp đó.",
    PAYROLL_IMPORT_UNRESOLVED_ROWS:
      "Tệp còn dòng lỗi hoặc xung đột chưa được xử lý.",
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
    PAYROLL_CALCULATION_BLOCKING_ISSUES:
      "Kỳ lương còn dữ liệu thiếu cần xử lý trước khi đối soát.",
    PAYROLL_CORRECTION_REQUESTS_PENDING:
      "Kỳ lương còn yêu cầu điều chỉnh chưa được xử lý.",
    PAYROLL_CORRECTION_DECISION_INVALID:
      "Quyết định hoặc nội dung phản hồi không hợp lệ.",
    PAYROLL_CORRECTION_REQUEST_NOT_PENDING:
      "Yêu cầu này đã được xử lý trước đó.",
    PAYROLL_CORRECTION_SELF_APPROVAL_FORBIDDEN:
      "Không thể tự xử lý yêu cầu điều chỉnh của chính mình.",
    PAYROLL_FEEDBACK_MUST_BE_CLOSED:
      "Cần đóng thời gian phản hồi trước khi chuyển sang đối soát.",
    PAYROLL_FEEDBACK_NOT_OPEN:
      "Thời gian phản hồi đã đóng hoặc kỳ lương không còn ở trạng thái nháp.",
    PAYROLL_SELF_APPROVAL_FORBIDDEN:
      "Không thể tự duyệt bảng lương có tên mình.",
    PAYROLL_SELF_RECONCILIATION_FORBIDDEN:
      "Không thể tự đối soát bảng lương có tên mình.",
    PAYROLL_FEEDBACK_WINDOW_CLOSED:
      "Thời gian gửi yêu cầu điều chỉnh đã đóng.",
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

interface UntypedPayrollRpcClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

async function runUntypedPayrollRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<PayrollActionState | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await (supabase as unknown as UntypedPayrollRpcClient).rpc(
      name,
      args,
    );
    if (error) return createErrorState(getPayrollRpcErrorMessage(error.message));
    if (!data) return createErrorState("Database không trả về dữ liệu vừa cập nhật.");
    return null;
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống bảng lương.");
  }
}

export async function closePayrollFeedbackAction(
  input: PayrollPeriodActionInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.feedback.resolve");
  if (permissionError) return createErrorState(permissionError);
  const parsed = payrollPeriodActionSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Kỳ lương không hợp lệ.", parsed.error.flatten().fieldErrors);

  const error = await runUntypedPayrollRpc("close_payroll_feedback", {
    p_payroll_period_id: parsed.data.payrollPeriodId,
  });
  if (error) return error;
  revalidatePath("/payroll");
  return { message: "Đã đóng thời gian phản hồi.", status: "success" };
}

export async function recalculatePayrollAction(
  input: RecalculatePayrollInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.manage");
  if (permissionError) return createErrorState(permissionError);
  const parsed = recalculatePayrollSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Vui lòng kiểm tra lý do tính lại.", parsed.error.flatten().fieldErrors);

  const error = await runUntypedPayrollRpc("generate_payroll_calculation_run", {
    p_payroll_period_id: parsed.data.payrollPeriodId,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  revalidatePath("/payroll");
  return { message: "Đã tạo phiên bản tính lương mới.", status: "success" };
}

export async function submitPayrollCorrectionAction(
  input: SubmitPayrollCorrectionInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.view");
  if (permissionError) return createErrorState(permissionError);
  const parsed = submitPayrollCorrectionSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Vui lòng kiểm tra yêu cầu điều chỉnh.", parsed.error.flatten().fieldErrors);

  const error = await runUntypedPayrollRpc("submit_payroll_correction_request", {
    p_items: [{
      evidence_url: parsed.data.evidenceUrl || null,
      item_label: parsed.data.itemLabel,
      payroll_line_item_id: parsed.data.payrollLineItemId,
      requested_change: parsed.data.requestedChange,
    }],
    p_payroll_statement_id: parsed.data.payrollStatementId,
    p_request_message: parsed.data.requestMessage,
  });
  if (error) return error;
  revalidatePath("/payroll");
  return { message: "Đã gửi yêu cầu điều chỉnh.", status: "success" };
}

export async function resolvePayrollCorrectionAction(
  input: ResolvePayrollCorrectionInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.feedback.resolve");
  if (permissionError) return createErrorState(permissionError);
  const parsed = resolvePayrollCorrectionSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Vui lòng kiểm tra nội dung phản hồi.", parsed.error.flatten().fieldErrors);

  const error = await runUntypedPayrollRpc("resolve_payroll_correction_request", {
    p_decision: parsed.data.decision,
    p_request_id: parsed.data.requestId,
    p_response_message: parsed.data.responseMessage,
  });
  if (error) return error;
  revalidatePath("/payroll");
  return { message: "Đã xử lý yêu cầu điều chỉnh.", status: "success" };
}

export async function createPayrollImportBatchAction(
  input: CreatePayrollImportBatchInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.import");
  if (permissionError) return createErrorState(permissionError);
  const parsed = createPayrollImportBatchSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Vui lòng kiểm tra tệp Excel và dữ liệu xem trước.", parsed.error.flatten().fieldErrors);

  const error = await runUntypedPayrollRpc("create_payroll_import_batch", {
    p_dataset_type: parsed.data.datasetType,
    p_file_name: parsed.data.fileName,
    p_file_sha256: parsed.data.fileSha256,
    p_period_month: parsed.data.periodMonth,
    p_rows: parsed.data.rows.map((row) => ({
      conflict_payload: row.conflictPayload,
      normalized_payload: row.normalizedPayload,
      raw_payload: row.rawPayload,
      row_number: row.rowNumber,
      source_key: row.sourceKey,
      validation_errors: row.validationErrors,
      validation_status: row.validationStatus,
    })),
  });
  if (error) return error;
  revalidatePath("/payroll");
  return { message: "Đã tải dữ liệu lên và chuyển sang chờ duyệt.", status: "success" };
}

export async function decidePayrollImportBatchAction(
  input: DecidePayrollImportBatchInput,
): Promise<PayrollActionState> {
  const permissionError = await requirePermission("payroll.import");
  if (permissionError) return createErrorState(permissionError);
  const parsed = decidePayrollImportBatchSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Vui lòng kiểm tra quyết định duyệt.", parsed.error.flatten().fieldErrors);

  const error = await runUntypedPayrollRpc("decide_payroll_import_batch", {
    p_batch_id: parsed.data.batchId,
    p_decision: parsed.data.decision,
    p_review_note: parsed.data.reviewNote,
  });
  if (error) return error;
  revalidatePath("/payroll");
  return { message: "Đã xử lý tệp dữ liệu.", status: "success" };
}
