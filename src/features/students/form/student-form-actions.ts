"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type {
  CreateStudentActionInput,
  StudentDuplicateLookupInput,
  StudentDuplicateLookupResult,
  StudentFormActionState,
  StudentWriteFields,
  UpdateStudentActionInput,
} from "@/features/students/form/student-form-action-types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

const vietnamPhoneSchema = z
  .string()
  .trim()
  .min(1, "Số điện thoại phụ huynh là bắt buộc.")
  .refine(
    (value) => {
      const compact = value.replace(/[\s.-]/g, "");
      const normalized = compact.startsWith("+84")
        ? `0${compact.slice(3)}`
        : compact.startsWith("84")
          ? `0${compact.slice(2)}`
          : compact;

      return /^0(3|5|7|8|9)\d{8}$/.test(normalized);
    },
    {
      message:
        "Số điện thoại cần là số Việt Nam hợp lệ, ví dụ 0901234125.",
    },
  );

const studentWriteFieldsSchema = z.object({
  birthYear: z
    .number()
    .int("Năm sinh phải là số nguyên.")
    .min(1990, "Năm sinh chưa hợp lệ.")
    .max(2100, "Năm sinh chưa hợp lệ."),
  currentGrade: z
    .number()
    .int("Khối phải là số nguyên.")
    .min(1, "Khối phải từ 1 đến 12.")
    .max(12, "Khối phải từ 1 đến 12."),
  duplicateOverrideReason: z.string().trim().max(2000),
  fullName: z
    .string()
    .trim()
    .min(1, "Họ và tên học viên không được để trống.")
    .max(200, "Họ và tên học viên quá dài."),
  guardianEmail: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Email phụ huynh chưa đúng định dạng.",
    ),
  guardianFullName: z
    .string()
    .trim()
    .min(1, "Họ tên phụ huynh không được để trống.")
    .max(200, "Họ tên phụ huynh quá dài."),
  guardianNote: z.string().trim().max(5000),
  guardianPhone: vietnamPhoneSchema,
  guardianRelationship: z
    .string()
    .trim()
    .min(1, "Quan hệ với học sinh là bắt buộc.")
    .max(100, "Thông tin quan hệ quá dài."),
  guardianZalo: z.string().trim().max(200),
  internalNote: z.string().trim().max(10000),
  learningGoal: z.string().trim().max(5000),
  learningLevel: z.enum(["A", "B", "CLC"]),
  nickname: z.string().trim().max(100),
  provinceName: z.string().trim().max(200),
  reason: z
    .string()
    .trim()
    .min(1, "Bắt buộc nhập lý do tạo hoặc cập nhật hồ sơ.")
    .max(2000, "Lý do thao tác quá dài."),
  registeredMode: z.enum(["online", "offline"]),
});

const createStudentSchema = studentWriteFieldsSchema;

const updateStudentSchema = studentWriteFieldsSchema.extend({
  studentId: z.string().uuid("Mã học viên không hợp lệ."),
});

const duplicateLookupSchema = z.object({
  birthYear: z
    .number()
    .int()
    .min(1990)
    .max(2100),
  fullName: z.string().trim().min(1).max(200),
  guardianPhone: vietnamPhoneSchema,
  studentId: z.string().uuid().optional(),
});

const mutationResultSchema = z.array(
  z.object({
    guardian_id: z.string().uuid(),
    guardian_reused: z.boolean(),
    student_id: z.string().uuid(),
    student_public_code: z.string(),
  }),
);

const duplicateRowsSchema = z.array(
  z.object({
    guardian_full_name: z.string(),
    guardian_id: z.string().uuid(),
    guardian_phone: z.string(),
    is_exact_student_duplicate: z.boolean(),
    linked_student_birth_year: z.number().nullable(),
    linked_student_full_name: z.string().nullable(),
    linked_student_id: z.string().uuid().nullable(),
    linked_student_lifecycle_status: z.string().nullable(),
    linked_student_public_code: z.string().nullable(),
  }),
);

function createErrorState(
  message: string,
  fieldErrors?: StudentFormActionState["fieldErrors"],
): StudentFormActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ACTIVE_STUDENT_REGISTERED_MODE_MANAGED_BY_ENROLLMENT:
      "Học viên đang có lớp hoạt động. Hình thức học phải được thay đổi qua nghiệp vụ lớp học.",
    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    GUARDIAN_EMAIL_INVALID:
      "Email phụ huynh chưa đúng định dạng.",
    GUARDIAN_FULL_NAME_REQUIRED:
      "Họ tên phụ huynh không được để trống.",
    GUARDIAN_PHONE_INVALID:
      "Số điện thoại phụ huynh chưa hợp lệ.",
    GUARDIAN_RELATIONSHIP_REQUIRED:
      "Quan hệ với học sinh không được để trống.",
    STUDENT_BIRTH_YEAR_INVALID:
      "Năm sinh học viên chưa hợp lệ.",
    STUDENT_CREATE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền tạo học viên.",
    STUDENT_CREATE_REASON_REQUIRED:
      "Bắt buộc nhập lý do tạo hồ sơ.",
    STUDENT_CURRENT_GRADE_INVALID:
      "Khối hiện tại phải từ 1 đến 12.",
    STUDENT_DUPLICATE_OVERRIDE_REASON_REQUIRED:
      "Có học viên trùng thông tin. Cần nhập lý do để tiếp tục lưu.",
    STUDENT_FORM_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền kiểm tra hồ sơ học viên.",
    STUDENT_FULL_NAME_REQUIRED:
      "Họ và tên học viên không được để trống.",
    STUDENT_ID_REQUIRED:
      "Thiếu mã học viên cần cập nhật.",
    STUDENT_LEARNING_LEVEL_INVALID:
      "Mức học tập phải là A, B hoặc CLC.",
    STUDENT_NOT_FOUND:
      "Không tìm thấy hồ sơ học viên cần cập nhật.",
    STUDENT_REGISTERED_MODE_INVALID:
      "Hình thức học phải là online hoặc offline.",
    STUDENT_UPDATE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền cập nhật học viên.",
    STUDENT_UPDATE_REASON_REQUIRED:
      "Bắt buộc nhập lý do cập nhật hồ sơ.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(
    knownMessages,
  )) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể lưu hồ sơ học viên. Dữ liệu chưa được thay đổi.";
}

async function getPermissionError(
  requiredPermission: "students.create" | "students.update",
): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền thao tác. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes(requiredPermission)) {
    return requiredPermission === "students.create"
      ? "Tài khoản hiện tại không có quyền students.create."
      : "Tài khoản hiện tại không có quyền students.update.";
  }

  return null;
}

async function getDuplicateLookupPermissionError(): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền kiểm tra trùng hồ sơ.";
  }

  const allowed =
    permissionResult.permissions.includes("students.create") ||
    permissionResult.permissions.includes("students.update");

  return allowed
    ? null
    : "Tài khoản hiện tại không có quyền kiểm tra trùng hồ sơ học viên.";
}

function toRpcArguments(values: StudentWriteFields) {
  return {
    p_birth_year: values.birthYear,
    p_current_grade: values.currentGrade,
    p_duplicate_override_reason: values.duplicateOverrideReason,
    p_full_name: values.fullName,
    p_guardian_email: values.guardianEmail,
    p_guardian_full_name: values.guardianFullName,
    p_guardian_notes: values.guardianNote,
    p_guardian_phone: values.guardianPhone,
    p_guardian_relationship: values.guardianRelationship,
    p_guardian_zalo: values.guardianZalo,
    p_internal_notes: values.internalNote,
    p_learning_goal: values.learningGoal,
    p_learning_level: values.learningLevel,
    p_nickname: values.nickname,
    p_province_city: values.provinceName,
    p_reason: values.reason,
    p_registered_mode: values.registeredMode,
  };
}

export async function findStudentFormDuplicatesAction(
  input: StudentDuplicateLookupInput,
): Promise<StudentDuplicateLookupResult> {
  const parsed = duplicateLookupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message:
        "Cần nhập họ tên, năm sinh và số điện thoại hợp lệ để kiểm tra trùng.",
      ok: false,
    };
  }

  const permissionError = await getDuplicateLookupPermissionError();

  if (permissionError) {
    return {
      message: permissionError,
      ok: false,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "find_student_form_duplicates",
      {
        p_birth_year: parsed.data.birthYear,
        p_full_name: parsed.data.fullName,
        p_guardian_phone: parsed.data.guardianPhone,
        p_student_id: parsed.data.studentId ?? EMPTY_UUID,
      },
    );

    if (error) {
      return {
        message: getRpcErrorMessage(error.message),
        ok: false,
      };
    }

    const rows = duplicateRowsSchema.safeParse(data ?? []);

    if (!rows.success) {
      return {
        message: "Database trả về kết quả kiểm tra trùng không hợp lệ.",
        ok: false,
      };
    }

    const firstRow = rows.data[0];

    if (!firstRow) {
      return {
        guardian: null,
        hasExactStudentDuplicate: false,
        ok: true,
      };
    }

    const children = rows.data.flatMap((row) => {
      if (
        !row.linked_student_id ||
        !row.linked_student_full_name ||
        row.linked_student_birth_year === null ||
        !row.linked_student_lifecycle_status ||
        !row.linked_student_public_code
      ) {
        return [];
      }

      return [
        {
          birthYear: row.linked_student_birth_year,
          fullName: row.linked_student_full_name,
          id: row.linked_student_id,
          isExactDuplicate: row.is_exact_student_duplicate,
          lifecycleStatus: row.linked_student_lifecycle_status,
          publicCode: row.linked_student_public_code,
        },
      ];
    });

    return {
      guardian: {
        children,
        fullName: firstRow.guardian_full_name,
        id: firstRow.guardian_id,
        phone: firstRow.guardian_phone,
      },
      hasExactStudentDuplicate: children.some(
        (student) => student.isExactDuplicate,
      ),
      ok: true,
    };
  } catch {
    return {
      message: "Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.",
      ok: false,
    };
  }
}

export async function createStudentWithPrimaryGuardianAction(
  input: CreateStudentActionInput,
): Promise<StudentFormActionState> {
  const parsed = createStudentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin học viên và phụ huynh.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const permissionError = await getPermissionError("students.create");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "create_student_with_primary_guardian",
      toRpcArguments(parsed.data),
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    const result = mutationResultSchema.safeParse(data ?? []);

    if (!result.success || result.data.length !== 1) {
      return createErrorState(
        "Database không trả về kết quả tạo học viên hợp lệ.",
      );
    }

    const createdStudent = result.data[0];

    revalidatePath("/students");
    revalidatePath(`/students/${createdStudent.student_id}`);

    return {
      guardianReused: createdStudent.guardian_reused,
      message: "Đã tạo hồ sơ học viên thành công.",
      redirectTo: `/students/${createdStudent.student_id}`,
      status: "success",
      studentId: createdStudent.student_id,
      studentPublicCode: createdStudent.student_public_code,
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lưu hồ sơ. Vui lòng thử lại.",
    );
  }
}

export async function updateStudentWithPrimaryGuardianAction(
  input: UpdateStudentActionInput,
): Promise<StudentFormActionState> {
  const parsed = updateStudentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin học viên và phụ huynh.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const permissionError = await getPermissionError("students.update");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { studentId, ...writeFields } = parsed.data;
    const { data, error } = await supabase.rpc(
      "update_student_with_primary_guardian",
      {
        ...toRpcArguments(writeFields),
        p_student_id: studentId,
      },
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    const result = mutationResultSchema.safeParse(data ?? []);

    if (!result.success || result.data.length !== 1) {
      return createErrorState(
        "Database không trả về kết quả cập nhật học viên hợp lệ.",
      );
    }

    const updatedStudent = result.data[0];

    revalidatePath("/students");
    revalidatePath(`/students/${updatedStudent.student_id}`);
    revalidatePath(`/students/${updatedStudent.student_id}/edit`);

    return {
      guardianReused: updatedStudent.guardian_reused,
      message: "Đã cập nhật hồ sơ học viên thành công.",
      redirectTo: `/students/${updatedStudent.student_id}`,
      status: "success",
      studentId: updatedStudent.student_id,
      studentPublicCode: updatedStudent.student_public_code,
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống lưu hồ sơ. Vui lòng thử lại.",
    );
  }
}
