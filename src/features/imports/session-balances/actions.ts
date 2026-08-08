"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import {
  approveSessionBalanceImportBatchInputSchema,
  createSessionBalanceImportBatchInputSchema,
  dryRunSessionBalanceImportInputSchema,
  dryRunSessionBalanceImportResultSchema,
  excludeSessionBalanceImportRowInputSchema,
  postSessionBalanceImportBatchInputSchema,
  reconcileSessionBalanceImportBatchInputSchema,
} from "@/features/imports/session-balances/schemas";
import type {
  ApproveSessionBalanceImportBatchInput,
  CreateSessionBalanceImportBatchInput,
  ExcludeSessionBalanceImportRowInput,
  PostSessionBalanceImportBatchInput,
  ReconcileSessionBalanceImportBatchInput,
  SessionBalanceImportActionErrorCode,
  SessionBalanceImportActionFailure,
  SessionBalanceImportActionResult,
  SessionBalanceImportBatchRecord,
  SessionBalanceImportDryRunResult,
  SessionBalanceImportRowInput,
  SessionBalanceImportRowRecord,
  ValidateSessionBalanceImportInput,
} from "@/features/imports/session-balances/types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

function createFailure(
  code: SessionBalanceImportActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): SessionBalanceImportActionFailure {
  return {
    code,
    fieldErrors,
    message,
    ok: false,
  };
}

function getZodFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const fieldName =
      issue.path.length > 0 ? issue.path.map(String).join(".") : "request";

    fieldErrors[fieldName] ??= [];
    fieldErrors[fieldName].push(issue.message);
  }

  return fieldErrors;
}

function rowsToJson(rows: SessionBalanceImportRowInput[]): Json {
  return JSON.parse(JSON.stringify(rows)) as Json;
}

async function requirePermissions(
  requiredPermissions: readonly PermissionCode[],
): Promise<SessionBalanceImportActionFailure | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return createFailure(
      "session_required",
      "Không thể xác minh quyền import. Vui lòng đăng nhập lại.",
    );
  }

  const missingPermission = requiredPermissions.find(
    (permission) => !permissionResult.permissions.includes(permission),
  );

  if (!missingPermission) {
    return null;
  }

  if (missingPermission === "imports.session_balances") {
    return createFailure(
      "forbidden",
      "Tài khoản hiện tại không có quyền import số dư buổi.",
    );
  }

  if (missingPermission === "imports.session_balances.approve") {
    return createFailure(
      "forbidden",
      "Tài khoản hiện tại không có quyền phê duyệt/ghi sổ số dư buổi.",
    );
  }

  return createFailure(
    "forbidden",
    "Tài khoản hiện tại không có đủ quyền thực hiện thao tác.",
  );
}

function getRpcFailure(
  databaseMessage: string,
): SessionBalanceImportActionFailure {
  const knownErrors: Array<{
    code: SessionBalanceImportActionErrorCode;
    databaseCode: string;
    message: string;
  }> = [
    {
      code: "session_required",
      databaseCode: "AUTHENTICATED_USER_REQUIRED",
      message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    },
    {
      code: "forbidden",
      databaseCode: "IMPORTS_SESSION_BALANCES_PERMISSION_REQUIRED",
      message: "Tài khoản hiện tại không có quyền import số dư buổi.",
    },
    {
      code: "forbidden",
      databaseCode: "IMPORTS_SESSION_BALANCES_APPROVE_PERMISSION_REQUIRED",
      message: "Tài khoản hiện tại không có quyền phê duyệt/ghi sổ số dư buổi.",
    },
    {
      code: "conflict",
      databaseCode: "SESSION_BALANCE_IMPORT_BATCH_SHA256_ALREADY_EXISTS",
      message:
        "File này đã được tạo batch trước đó. Không thể tạo batch trùng từ cùng một file nguồn.",
    },
    {
      code: "invalid_request",
      databaseCode: "APPROVER_MUST_DIFFER_FROM_CREATOR_FOUR_EYES_PRINCIPLE_REQUIRED",
      message:
        "Người tạo batch không được tự phê duyệt. Vui lòng sử dụng tài khoản phê duyệt khác.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_HAS_INVALID_ROWS_MUST_EXCLUDE_OR_FIX_BEFORE_RECONCILIATION",
      message:
        "Batch còn dòng không hợp lệ. Vui lòng kiểm tra lại hoặc sửa file nguồn.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_HAS_REVIEW_ROWS_MUST_EXCLUDE_OR_FIX_BEFORE_RECONCILIATION",
      message:
        "Batch còn dòng cần xem lại. Vui lòng loại khỏi batch hoặc xử lý trước khi đối soát.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_HAS_INVALID_ROWS_CANNOT_APPROVE",
      message:
        "Batch còn dòng không hợp lệ. Không thể phê duyệt.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_HAS_REVIEW_ROWS_CANNOT_APPROVE",
      message:
        "Batch còn dòng chưa xem lại. Không thể phê duyệt.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_MUST_BE_APPROVED_BEFORE_POSTING",
      message:
        "Batch phải ở trạng thái Đã phê duyệt mới được ghi vào sổ buổi.",
    },
    {
      code: "invalid_request",
      databaseCode: "ONLY_REVIEW_OR_INVALID_ROWS_MAY_BE_EXCLUDED",
      message:
        "Chỉ các dòng ở trạng thái Cần xem lại hoặc Không hợp lệ mới được loại khỏi batch.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_STATUS_DOES_NOT_ALLOW_ROW_EXCLUSION",
      message:
        "Trạng thái batch hiện tại không cho phép loại dòng.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_MUST_BE_AWAITING_RECONCILIATION",
      message:
        "Batch phải ở trạng thái Đang chờ đối soát.",
    },
    {
      code: "invalid_request",
      databaseCode: "BATCH_MUST_BE_AWAITING_APPROVAL",
      message:
        "Batch phải ở trạng thái Đang chờ phê duyệt.",
    },
  ];

  const knownError = knownErrors.find(({ databaseCode }) =>
    databaseMessage.includes(databaseCode),
  );

  if (knownError) {
    return createFailure(knownError.code, knownError.message);
  }

  return createFailure(
    "database_error",
    "Không thể xử lý thao tác với số dư buổi. Dữ liệu chưa được ghi nhận.",
  );
}

export async function dryRunSessionBalanceImportAction(
  input: ValidateSessionBalanceImportInput,
): Promise<SessionBalanceImportActionResult<SessionBalanceImportDryRunResult>> {
  const permissionFailure = await requirePermissions([
    "imports.session_balances",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput = dryRunSessionBalanceImportInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Dữ liệu gửi lên để kiểm tra không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "dry_run_session_balance_import_rows",
      {
        p_effective_on: parsedInput.data.effective_on,
        p_rows: rowsToJson(parsedInput.data.rows),
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    const parsedResult = dryRunSessionBalanceImportResultSchema.safeParse(data);

    if (!parsedResult.success) {
      return createFailure(
        "invalid_response",
        "Database trả về kết quả dry-run không hợp lệ.",
      );
    }

    return {
      data: parsedResult.data,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể kết nối tới hệ thống kiểm tra dry-run.",
    );
  }
}

export async function createSessionBalanceImportBatchAction(
  input: CreateSessionBalanceImportBatchInput,
): Promise<SessionBalanceImportActionResult<SessionBalanceImportBatchRecord>> {
  const permissionFailure = await requirePermissions([
    "imports.session_balances",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput = createSessionBalanceImportBatchInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Thông tin tạo batch không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "create_session_balance_import_batch",
      {
        p_effective_on: parsedInput.data.effectiveOn,
        p_reason: parsedInput.data.reason.trim(),
        p_rows: rowsToJson(parsedInput.data.rows),
        p_source_filename: parsedInput.data.sourceFilename.trim(),
        p_source_sha256: parsedInput.data.sourceSha256.trim().toLowerCase(),
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    if (!data) {
      return createFailure(
        "invalid_response",
        "Database không trả về thông tin batch vừa tạo.",
      );
    }

    const batchRecord: SessionBalanceImportBatchRecord = {
      approved_at: data.approved_at,
      approved_by: data.approved_by,
      created_at: data.created_at,
      created_by: data.created_by,
      effective_on: data.effective_on,
      excluded_count: data.excluded_count,
      id: data.id,
      invalid_count: data.invalid_count,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      no_change_count: data.no_change_count,
      posted_at: data.posted_at,
      posted_by: data.posted_by,
      posted_count: data.posted_count,
      reason: data.reason,
      reconciled_at: data.reconciled_at,
      reconciled_by: data.reconciled_by,
      review_count: data.review_count,
      row_count: data.row_count,
      source_filename: data.source_filename,
      source_sha256: data.source_sha256,
      status: data.status as SessionBalanceImportBatchRecord["status"],
      valid_count: data.valid_count,
    };

    revalidatePath("/imports/session-balances");

    return {
      data: batchRecord,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể tạo batch đối soát số dư.",
    );
  }
}

export async function excludeSessionBalanceImportRowAction(
  input: ExcludeSessionBalanceImportRowInput,
): Promise<SessionBalanceImportActionResult<SessionBalanceImportRowRecord>> {
  const permissionFailure = await requirePermissions([
    "imports.session_balances",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput = excludeSessionBalanceImportRowInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Thông tin loại dòng không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "exclude_session_balance_import_row",
      {
        p_excluded_reason: parsedInput.data.excludedReason.trim(),
        p_row_id: parsedInput.data.rowId,
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    if (!data) {
      return createFailure(
        "invalid_response",
        "Database không trả về thông tin dòng vừa loại.",
      );
    }

    const rowRecord: SessionBalanceImportRowRecord = {
      batch_id: data.batch_id,
      created_at: data.created_at,
      current_balance_before: data.current_balance_before,
      delta_sessions: data.delta_sessions,
      excluded_reason: data.excluded_reason,
      expected_balance_after: data.expected_balance_after,
      id: data.id,
      ledger_entry_id: data.ledger_entry_id,
      source_balance: Number(data.source_balance),
      source_row_number: data.source_row_number,
      source_student_name: data.source_student_name,
      student_enrollment_id: data.student_enrollment_id,
      student_id: data.student_id,
      student_public_code: data.student_public_code,
      validation_code: data.validation_code,
      validation_message: data.validation_message,
      validation_status: data.validation_status as SessionBalanceImportRowRecord["validation_status"],
    };

    revalidatePath("/imports/session-balances");
    revalidatePath(`/imports/session-balances/${data.batch_id}`);

    return {
      data: rowRecord,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể loại dòng khỏi batch.",
    );
  }
}

export async function reconcileSessionBalanceImportBatchAction(
  input: ReconcileSessionBalanceImportBatchInput,
): Promise<SessionBalanceImportActionResult<SessionBalanceImportBatchRecord>> {
  const permissionFailure = await requirePermissions([
    "imports.session_balances",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput = reconcileSessionBalanceImportBatchInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Thông tin hoàn tất đối soát không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "reconcile_session_balance_import_batch",
      {
        p_batch_id: parsedInput.data.batchId,
        p_reason: parsedInput.data.reason.trim(),
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    if (!data) {
      return createFailure(
        "invalid_response",
        "Database không trả về thông tin batch sau đối soát.",
      );
    }

    const batchRecord: SessionBalanceImportBatchRecord = {
      approved_at: data.approved_at,
      approved_by: data.approved_by,
      created_at: data.created_at,
      created_by: data.created_by,
      effective_on: data.effective_on,
      excluded_count: data.excluded_count,
      id: data.id,
      invalid_count: data.invalid_count,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      no_change_count: data.no_change_count,
      posted_at: data.posted_at,
      posted_by: data.posted_by,
      posted_count: data.posted_count,
      reason: data.reason,
      reconciled_at: data.reconciled_at,
      reconciled_by: data.reconciled_by,
      review_count: data.review_count,
      row_count: data.row_count,
      source_filename: data.source_filename,
      source_sha256: data.source_sha256,
      status: data.status as SessionBalanceImportBatchRecord["status"],
      valid_count: data.valid_count,
    };

    revalidatePath("/imports/session-balances");
    revalidatePath(`/imports/session-balances/${data.id}`);

    return {
      data: batchRecord,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể hoàn tất đối soát batch.",
    );
  }
}

export async function approveSessionBalanceImportBatchAction(
  input: ApproveSessionBalanceImportBatchInput,
): Promise<SessionBalanceImportActionResult<SessionBalanceImportBatchRecord>> {
  const permissionFailure = await requirePermissions([
    "imports.session_balances.approve",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput = approveSessionBalanceImportBatchInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Thông tin phê duyệt không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "approve_session_balance_import_batch",
      {
        p_batch_id: parsedInput.data.batchId,
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    if (!data) {
      return createFailure(
        "invalid_response",
        "Database không trả về thông tin batch sau khi duyệt.",
      );
    }

    const batchRecord: SessionBalanceImportBatchRecord = {
      approved_at: data.approved_at,
      approved_by: data.approved_by,
      created_at: data.created_at,
      created_by: data.created_by,
      effective_on: data.effective_on,
      excluded_count: data.excluded_count,
      id: data.id,
      invalid_count: data.invalid_count,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      no_change_count: data.no_change_count,
      posted_at: data.posted_at,
      posted_by: data.posted_by,
      posted_count: data.posted_count,
      reason: data.reason,
      reconciled_at: data.reconciled_at,
      reconciled_by: data.reconciled_by,
      review_count: data.review_count,
      row_count: data.row_count,
      source_filename: data.source_filename,
      source_sha256: data.source_sha256,
      status: data.status as SessionBalanceImportBatchRecord["status"],
      valid_count: data.valid_count,
    };

    revalidatePath("/imports/session-balances");
    revalidatePath(`/imports/session-balances/${data.id}`);

    return {
      data: batchRecord,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể phê duyệt batch.",
    );
  }
}

export async function postSessionBalanceImportBatchAction(
  input: PostSessionBalanceImportBatchInput,
): Promise<SessionBalanceImportActionResult<SessionBalanceImportBatchRecord>> {
  const permissionFailure = await requirePermissions([
    "imports.session_balances.approve",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput = postSessionBalanceImportBatchInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Thông tin xác nhận ghi sổ không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "post_session_balance_import_batch",
      {
        p_batch_id: parsedInput.data.batchId,
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    if (!data) {
      return createFailure(
        "invalid_response",
        "Database không trả về thông tin batch sau khi ghi sổ.",
      );
    }

    const batchRecord: SessionBalanceImportBatchRecord = {
      approved_at: data.approved_at,
      approved_by: data.approved_by,
      created_at: data.created_at,
      created_by: data.created_by,
      effective_on: data.effective_on,
      excluded_count: data.excluded_count,
      id: data.id,
      invalid_count: data.invalid_count,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      no_change_count: data.no_change_count,
      posted_at: data.posted_at,
      posted_by: data.posted_by,
      posted_count: data.posted_count,
      reason: data.reason,
      reconciled_at: data.reconciled_at,
      reconciled_by: data.reconciled_by,
      review_count: data.review_count,
      row_count: data.row_count,
      source_filename: data.source_filename,
      source_sha256: data.source_sha256,
      status: data.status as SessionBalanceImportBatchRecord["status"],
      valid_count: data.valid_count,
    };

    revalidatePath("/imports/session-balances");
    revalidatePath(`/imports/session-balances/${data.id}`);
    revalidatePath("/finance/session-ledger");

    return {
      data: batchRecord,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể ghi số dư vào sổ buổi.",
    );
  }
}
