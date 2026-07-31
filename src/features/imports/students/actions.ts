"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import {
  commitStudentImportInputSchema,
  studentImportCommitResultSchema,
  studentImportValidationResultSchema,
  validateStudentImportInputSchema,
} from "@/features/imports/students/schemas";
import type {
  CommitStudentImportInput,
  StudentImportActionErrorCode,
  StudentImportActionFailure,
  StudentImportActionResult,
  StudentImportCommitResult,
  StudentImportRowInput,
  StudentImportValidationResult,
  ValidateStudentImportInput,
} from "@/features/imports/students/types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

function createFailure(
  code: StudentImportActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): StudentImportActionFailure {
  return {
    code,
    fieldErrors,
    message,
    ok: false,
  };
}

function getZodFieldErrors(
  error: ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const fieldName =
      issue.path.length > 0
        ? issue.path.map(String).join(".")
        : "request";

    fieldErrors[fieldName] ??= [];
    fieldErrors[fieldName].push(issue.message);
  }

  return fieldErrors;
}

function rowsToJson(
  rows: StudentImportRowInput[],
): Json {
  return JSON.parse(
    JSON.stringify(rows),
  ) as Json;
}

async function requirePermissions(
  requiredPermissions: readonly PermissionCode[],
): Promise<StudentImportActionFailure | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return createFailure(
      "session_required",
      "Không thể xác minh quyền import. Vui lòng đăng nhập lại.",
    );
  }

  const missingPermission = requiredPermissions.find(
    (permission) =>
      !permissionResult.permissions.includes(permission),
  );

  if (!missingPermission) {
    return null;
  }

  if (missingPermission === "imports.students") {
    return createFailure(
      "forbidden",
      "Tài khoản hiện tại không có quyền import học viên.",
    );
  }

  if (missingPermission === "students.create") {
    return createFailure(
      "forbidden",
      "Tài khoản hiện tại không có quyền tạo học viên.",
    );
  }

  return createFailure(
    "forbidden",
    "Tài khoản hiện tại không có đủ quyền thực hiện thao tác.",
  );
}

function getRpcFailure(
  databaseMessage: string,
): StudentImportActionFailure {
  const knownErrors: Array<{
    code: StudentImportActionErrorCode;
    databaseCode: string;
    message: string;
  }> = [
    {
      code: "session_required",
      databaseCode: "AUTHENTICATED_USER_REQUIRED",
      message:
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    },
    {
      code: "forbidden",
      databaseCode: "IMPORTS_STUDENTS_PERMISSION_REQUIRED",
      message:
        "Tài khoản hiện tại không có quyền import học viên.",
    },
    {
      code: "forbidden",
      databaseCode: "STUDENTS_CREATE_PERMISSION_REQUIRED",
      message:
        "Tài khoản hiện tại không có quyền tạo học viên.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_ROWS_MUST_BE_ARRAY",
      message:
        "Danh sách dòng import không hợp lệ.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_ROWS_REQUIRED",
      message:
        "File import không có dòng dữ liệu.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_MAXIMUM_500_ROWS",
      message:
        "Mỗi lần chỉ được import tối đa 500 dòng.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_SOURCE_FILENAME_INVALID",
      message:
        "Tên hoặc định dạng file import không hợp lệ.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_SOURCE_SHA256_INVALID",
      message:
        "Không thể xác minh nội dung file import.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_REASON_INVALID",
      message:
        "Lý do import không hợp lệ.",
    },
    {
      code: "conflict",
      databaseCode: "STUDENT_IMPORT_FILE_ALREADY_COMMITTED",
      message:
        "File này đã được import thành công trước đó.",
    },
    {
      code: "invalid_request",
      databaseCode: "STUDENT_IMPORT_VALIDATION_FAILED",
      message:
        "Dữ liệu đã thay đổi hoặc còn dòng lỗi. Hãy kiểm tra lại trước khi xác nhận import.",
    },
    {
      code: "conflict",
      databaseCode: "STUDENT_DUPLICATE_OVERRIDE_REASON_REQUIRED",
      message:
        "Phát hiện học viên trùng dữ liệu. Import hàng loạt không cho phép bỏ qua cảnh báo này.",
    },
  ];

  const knownError = knownErrors.find(
    ({ databaseCode }) =>
      databaseMessage.includes(databaseCode),
  );

  if (knownError) {
    return createFailure(
      knownError.code,
      knownError.message,
    );
  }

  return createFailure(
    "database_error",
    "Không thể xử lý import học viên. Dữ liệu chưa được thay đổi.",
  );
}

export async function validateStudentImportRowsAction(
  input: ValidateStudentImportInput,
): Promise<
  StudentImportActionResult<StudentImportValidationResult>
> {
  const permissionFailure = await requirePermissions([
    "imports.students",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput =
    validateStudentImportInputSchema.safeParse(input);

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
      "validate_student_import_rows",
      {
        p_rows: rowsToJson(parsedInput.data.rows),
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    const parsedResult =
      studentImportValidationResultSchema.safeParse(data);

    if (!parsedResult.success) {
      return createFailure(
        "invalid_response",
        "Database trả về kết quả kiểm tra import không hợp lệ.",
      );
    }

    return {
      data: parsedResult.data,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể kết nối tới hệ thống kiểm tra import.",
    );
  }
}

export async function commitStudentImportRowsAction(
  input: CommitStudentImportInput,
): Promise<
  StudentImportActionResult<StudentImportCommitResult>
> {
  const permissionFailure = await requirePermissions([
    "imports.students",
    "students.create",
  ]);

  if (permissionFailure) {
    return permissionFailure;
  }

  const parsedInput =
    commitStudentImportInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createFailure(
      "invalid_request",
      "Thông tin xác nhận import không hợp lệ.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "commit_student_import_rows",
      {
        p_reason: parsedInput.data.reason.trim(),
        p_rows: rowsToJson(parsedInput.data.rows),
        p_source_filename:
          parsedInput.data.sourceFilename.trim(),
        p_source_sha256:
          parsedInput.data.sourceSha256
            .trim()
            .toLowerCase(),
      },
    );

    if (error) {
      return getRpcFailure(error.message);
    }

    const parsedResult =
      studentImportCommitResultSchema.safeParse(data);

    if (!parsedResult.success) {
      return createFailure(
        "invalid_response",
        "Database trả về kết quả import không hợp lệ.",
      );
    }

    revalidatePath("/students");
    revalidatePath("/audit");

    return {
      data: parsedResult.data,
      ok: true,
    };
  } catch {
    return createFailure(
      "database_error",
      "Không thể kết nối tới hệ thống import học viên.",
    );
  }
}
