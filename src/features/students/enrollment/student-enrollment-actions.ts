"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type {
  EnrollStudentInput,
  ReserveStudentInput,
  ResumeStudentInput,
  StudentEnrollmentActionState,
  TransferStudentInput,
} from "@/features/students/enrollment/student-enrollment-action-types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EnrollmentPermission =
  | "students.manage_status"
  | "students.reserve"
  | "students.transfer_class";

const uuidSchema = z
  .string()
  .uuid("Mã dữ liệu không hợp lệ.");

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Bắt buộc nhập lý do thao tác.")
  .max(2000, "Lý do thao tác quá dài.");

const isoDateSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Ngày hiệu lực phải có định dạng YYYY-MM-DD.",
  )
  .refine(isValidIsoDate, {
    message: "Ngày hiệu lực không hợp lệ.",
  });

const registeredModeSchema = z.enum([
  "online",
  "offline",
]);

const enrollStudentSchema = z.object({
  classId: uuidSchema,
  effectiveFrom: isoDateSchema,
  reason: reasonSchema,
  registeredMode: registeredModeSchema,
  studentId: uuidSchema,
});

const transferStudentSchema = z.object({
  effectiveFrom: isoDateSchema,
  reason: reasonSchema,
  registeredMode: registeredModeSchema,
  studentId: uuidSchema,
  targetClassId: uuidSchema,
});

const reserveStudentSchema = z.object({
  reason: reasonSchema,
  reservedFrom: isoDateSchema,
  studentId: uuidSchema,
});

const resumeStudentSchema = z.object({
  effectiveFrom: isoDateSchema,
  reason: reasonSchema,
  registeredMode: registeredModeSchema,
  studentId: uuidSchema,
  targetClassId: uuidSchema,
});

const enrollmentResultSchema = z.object({
  class_id: z.string().uuid(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  id: z.string().uuid(),
  registered_mode: z.string(),
  status: z.string(),
  student_id: z.string().uuid(),
  transition_kind: z.string(),
});

function isValidIsoDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function createErrorState(
  message: string,
  fieldErrors?: StudentEnrollmentActionState["fieldErrors"],
): StudentEnrollmentActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getPermissionError(
  requiredPermission: EnrollmentPermission,
): Promise<string | null> {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền thao tác. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (
    !permissionResult.permissions.includes(
      requiredPermission,
    )
  ) {
    return `Tài khoản hiện tại không có quyền ${requiredPermission}.`;
  }

  return null;
}

function parseEnrollmentResult(data: unknown) {
  const candidate = Array.isArray(data)
    ? data[0]
    : data;

  const parsed =
    enrollmentResultSchema.safeParse(candidate);

  return parsed.success ? parsed.data : null;
}

function getRpcErrorMessage(
  message: string,
): string {
  const knownMessages: Record<string, string> = {
    ACTIVE_STUDENT_ENROLLMENT_NOT_FOUND:
      "Học viên hiện không có lớp đang hoạt động.",
    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    CLASS_ID_REQUIRED:
      "Bắt buộc chọn lớp.",
    ENROLLMENT_EFFECTIVE_DATE_REQUIRED:
      "Bắt buộc nhập ngày bắt đầu học.",
    ENROLLMENT_REASON_REQUIRED:
      "Bắt buộc nhập lý do xếp lớp.",
    LATEST_STUDENT_ENROLLMENT_IS_NOT_RESERVED:
      "Lịch sử gần nhất của học viên không ở trạng thái bảo lưu.",
    REGISTERED_MODE_INVALID:
      "Hình thức học phải là online hoặc offline.",
    RESERVED_ENROLLMENT_ALREADY_HAS_SUCCESSOR:
      "Đợt bảo lưu này đã có lần quay lại học.",
    RESERVATION_EFFECTIVE_DATE_INVALID:
      "Ngày bảo lưu phải sau ngày bắt đầu của lớp hiện tại.",
    RESERVATION_EFFECTIVE_DATE_REQUIRED:
      "Bắt buộc nhập ngày bắt đầu bảo lưu.",
    RESERVATION_MUST_TAKE_EFFECT_TODAY:
      "Bảo lưu phải có hiệu lực từ ngày hôm nay.",
    RESERVATION_REASON_REQUIRED:
      "Bắt buộc nhập lý do bảo lưu.",
    RESUME_EFFECTIVE_DATE_INVALID:
      "Ngày quay lại học phải sau ngày kết thúc đợt học trước.",
    RESUME_EFFECTIVE_DATE_REQUIRED:
      "Bắt buộc nhập ngày quay lại học.",
    RESUME_REASON_REQUIRED:
      "Bắt buộc nhập lý do quay lại học.",
    STUDENT_ALREADY_HAS_ACTIVE_ENROLLMENT:
      "Học viên đã có lớp đang hoạt động.",
    STUDENT_ENROLLMENT_HISTORY_ALREADY_EXISTS:
      "Học viên đã có lịch sử xếp lớp. Không thể dùng nghiệp vụ nhập lớp lần đầu.",
    STUDENT_ENROLLMENT_HISTORY_NOT_FOUND:
      "Học viên chưa có lịch sử xếp lớp để quay lại học.",
    STUDENT_ENROLLMENT_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền nhập học viên vào lớp.",
    STUDENT_NOT_FOUND:
      "Không tìm thấy hồ sơ học viên.",
    STUDENT_RESERVE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền bảo lưu học viên.",
    STUDENT_RESUME_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền cho học viên quay lại học.",
    STUDENT_TRANSFER_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền chuyển lớp.",
    TARGET_CLASS_ID_REQUIRED:
      "Bắt buộc chọn lớp đích.",
    TRANSFER_EFFECTIVE_DATE_INVALID:
      "Ngày chuyển lớp phải sau ngày bắt đầu của lớp hiện tại.",
    TRANSFER_EFFECTIVE_DATE_REQUIRED:
      "Bắt buộc nhập ngày chuyển lớp.",
    TRANSFER_MUST_TAKE_EFFECT_TODAY:
      "Chuyển lớp phải có hiệu lực từ ngày hôm nay.",
    TRANSFER_REASON_REQUIRED:
      "Bắt buộc nhập lý do chuyển lớp.",
    TRANSFER_TARGET_CLASS_MUST_DIFFER:
      "Lớp mới phải khác lớp hiện tại.",
  };

  for (const [
    databaseMessage,
    userMessage,
  ] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật trạng thái xếp lớp. Dữ liệu chưa được thay đổi.";
}

function revalidateEnrollmentPaths(
  studentId: string,
  classId?: string,
) {
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/students/${studentId}/edit`);
  revalidatePath("/classes");

  if (classId) {
    revalidatePath(`/classes/${classId}`);
  }
}

function createSuccessState(
  message: string,
  enrollment: z.infer<
    typeof enrollmentResultSchema
  >,
): StudentEnrollmentActionState {
  return {
    classId: enrollment.class_id,
    enrollmentId: enrollment.id,
    message,
    redirectTo: `/students/${enrollment.student_id}`,
    status: "success",
    studentId: enrollment.student_id,
  };
}

export async function enrollStudentInClassAction(
  input: EnrollStudentInput,
): Promise<StudentEnrollmentActionState> {
  const parsed =
    enrollStudentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin nhập lớp.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const permissionError =
    await getPermissionError(
      "students.manage_status",
    );

  if (permissionError) {
    return createErrorState(permissionError);
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "enroll_student_in_class",
      {
        p_class_id: parsed.data.classId,
        p_effective_from:
          parsed.data.effectiveFrom,
        p_reason: parsed.data.reason,
        p_registered_mode:
          parsed.data.registeredMode,
        p_student_id: parsed.data.studentId,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    const enrollment =
      parseEnrollmentResult(data);

    if (
      !enrollment ||
      enrollment.student_id !==
        parsed.data.studentId
    ) {
      return createErrorState(
        "Database không trả về kết quả nhập lớp hợp lệ.",
      );
    }

    revalidateEnrollmentPaths(
      enrollment.student_id,
      enrollment.class_id,
    );

    return createSuccessState(
      "Đã nhập học viên vào lớp thành công.",
      enrollment,
    );
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống xếp lớp. Vui lòng thử lại.",
    );
  }
}

export async function transferStudentClassAction(
  input: TransferStudentInput,
): Promise<StudentEnrollmentActionState> {
  const parsed =
    transferStudentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin chuyển lớp.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const permissionError =
    await getPermissionError(
      "students.transfer_class",
    );

  if (permissionError) {
    return createErrorState(permissionError);
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "transfer_student_class",
      {
        p_effective_from:
          parsed.data.effectiveFrom,
        p_reason: parsed.data.reason,
        p_registered_mode:
          parsed.data.registeredMode,
        p_student_id: parsed.data.studentId,
        p_target_class_id:
          parsed.data.targetClassId,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    const enrollment =
      parseEnrollmentResult(data);

    if (
      !enrollment ||
      enrollment.student_id !==
        parsed.data.studentId
    ) {
      return createErrorState(
        "Database không trả về kết quả chuyển lớp hợp lệ.",
      );
    }

    revalidateEnrollmentPaths(
      enrollment.student_id,
      enrollment.class_id,
    );

    return createSuccessState(
      "Đã chuyển lớp thành công.",
      enrollment,
    );
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống chuyển lớp. Vui lòng thử lại.",
    );
  }
}

export async function reserveStudentEnrollmentAction(
  input: ReserveStudentInput,
): Promise<StudentEnrollmentActionState> {
  const parsed =
    reserveStudentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin bảo lưu.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const permissionError =
    await getPermissionError(
      "students.reserve",
    );

  if (permissionError) {
    return createErrorState(permissionError);
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "reserve_student_enrollment",
      {
        p_reason: parsed.data.reason,
        p_reserved_from:
          parsed.data.reservedFrom,
        p_student_id: parsed.data.studentId,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    const enrollment =
      parseEnrollmentResult(data);

    if (
      !enrollment ||
      enrollment.student_id !==
        parsed.data.studentId
    ) {
      return createErrorState(
        "Database không trả về kết quả bảo lưu hợp lệ.",
      );
    }

    revalidateEnrollmentPaths(
      enrollment.student_id,
      enrollment.class_id,
    );

    return createSuccessState(
      "Đã bảo lưu học viên thành công.",
      enrollment,
    );
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống bảo lưu. Vui lòng thử lại.",
    );
  }
}

export async function resumeStudentEnrollmentAction(
  input: ResumeStudentInput,
): Promise<StudentEnrollmentActionState> {
  const parsed =
    resumeStudentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin quay lại học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const permissionError =
    await getPermissionError(
      "students.reserve",
    );

  if (permissionError) {
    return createErrorState(permissionError);
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "resume_student_enrollment",
      {
        p_effective_from:
          parsed.data.effectiveFrom,
        p_reason: parsed.data.reason,
        p_registered_mode:
          parsed.data.registeredMode,
        p_student_id: parsed.data.studentId,
        p_target_class_id:
          parsed.data.targetClassId,
      },
    );

    if (error) {
      return createErrorState(
        getRpcErrorMessage(error.message),
      );
    }

    const enrollment =
      parseEnrollmentResult(data);

    if (
      !enrollment ||
      enrollment.student_id !==
        parsed.data.studentId
    ) {
      return createErrorState(
        "Database không trả về kết quả quay lại học hợp lệ.",
      );
    }

    revalidateEnrollmentPaths(
      enrollment.student_id,
      enrollment.class_id,
    );

    return createSuccessState(
      "Đã cho học viên quay lại học thành công.",
      enrollment,
    );
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống quay lại học. Vui lòng thử lại.",
    );
  }
}
