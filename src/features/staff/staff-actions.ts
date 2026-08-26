"use server";

import { revalidatePath } from "next/cache";

import type {
  ConfigureStaffPayrollCompensationActionInput,
  DecideStaffBankAccountChangeActionInput,
  CreateStaffGradeAssignmentActionInput,
  CreateStaffPayrollTaskVersionActionInput,
  CreateStaffRateVersionActionInput,
  StaffManagementActionState,
  SubmitStaffBankAccountChangeActionInput,
  UpdateStaffProfileActionInput,
} from "@/features/staff/staff-action-types";
import {
  configureStaffPayrollCompensationSchema,
  decideStaffBankAccountChangeSchema,
  createStaffGradeAssignmentSchema,
  createStaffPayrollTaskVersionSchema,
  createStaffRateVersionSchema,
  submitStaffBankAccountChangeSchema,
  updateStaffProfileSchema,
} from "@/features/staff/staff-management-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createErrorState(
  message: string,
  fieldErrors?: StaffManagementActionState["fieldErrors"],
): StaffManagementActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getPermissionError(
  permission: PermissionCode,
): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản trị nhân sự. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes(permission)) {
    return `Tài khoản hiện tại không có quyền ${permission}.`;
  }

  return null;
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    ACTIVE_OR_SUSPENDED_STAFF_LEFT_AT_FORBIDDEN:
      "Chỉ nhập ngày nghỉ khi trạng thái là Đã nghỉ.",
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn.",
    INACTIVE_STAFF_LEFT_AT_REQUIRED:
      "Cần nhập ngày nghỉ khi nhân sự đã nghỉ.",
    LAST_ACTIVE_OWNER_CANNOT_BE_DEACTIVATED:
      "Không thể vô hiệu hóa Owner đang hoạt động cuối cùng.",
    STAFF_DISPLAY_NAME_INVALID: "Tên hiển thị không hợp lệ.",
    STAFF_EMPLOYEE_CODE_INVALID: "Mã nhân sự không hợp lệ.",
    STAFF_EMPLOYMENT_DATES_INVALID:
      "Ngày nghỉ không thể trước ngày vào làm.",
    STAFF_EMPLOYMENT_STATUS_INVALID: "Trạng thái làm việc không hợp lệ.",
    STAFF_MANAGE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền staff.manage.",
    STAFF_MANAGE_RATES_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền staff.manage_rates.",
    STAFF_PAYROLL_PROFILE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền cấu hình lương nhân sự.",
    STAFF_DAILY_RATE_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền thiết lập mức lương ngày.",
    STAFF_DAILY_RATE_INVALID: "Mức lương ngày không hợp lệ.",
    STAFF_DAILY_RATE_EFFECTIVE_DATE_EXISTS:
      "Đã có mức lương ngày bắt đầu từ ngày này.",
    STAFF_PAYROLL_POSITION_EFFECTIVE_DATE_EXISTS:
      "Đã có vị trí tính lương bắt đầu từ ngày này.",
    STAFF_GRADE_ASSIGNMENT_OVERLAPS:
      "Khối này đã được phân công cho một trợ lý trong khoảng thời gian đã chọn.",
    STAFF_GRADE_ASSIGNMENT_REQUIRES_OPERATIONS_POSITION:
      "Chỉ có thể phân khối cho nhân sự ở vị trí Trợ lý vận hành.",
    PAYROLL_CONFIGURATION_BACKDATE_LOCKED:
      "Không thể áp dụng hồi tố vì đã có kỳ lương được đối soát hoặc phê duyệt.",
    STAFF_BANK_ACCOUNT_REQUEST_ALREADY_PENDING:
      "Nhân sự đang có một yêu cầu thay đổi ngân hàng chờ duyệt.",
    STAFF_BANK_ACCOUNT_REQUEST_INVALID:
      "Thông tin tài khoản ngân hàng không hợp lệ.",
    STAFF_BANK_ACCOUNT_DECISION_INVALID:
      "Quyết định hoặc nội dung phản hồi không hợp lệ.",
    STAFF_BANK_ACCOUNT_REQUEST_NOT_PENDING:
      "Yêu cầu thay đổi ngân hàng đã được xử lý.",
    STAFF_BANK_ACCOUNT_SELF_APPROVAL_FORBIDDEN:
      "Không thể tự duyệt thông tin ngân hàng của chính mình.",
    STAFF_OFFLINE_HOURLY_RATE_INVALID:
      "Đơn giá offline phải là số chẵn, không âm.",
    STAFF_PHONE_INVALID: "Số điện thoại không hợp lệ.",
    STAFF_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ nhân sự.",
    STAFF_PROFILE_UPDATE_REASON_REQUIRED: "Bắt buộc nhập lý do cập nhật.",
    STAFF_RATE_EFFECTIVE_FROM_REQUIRED:
      "Bắt buộc chọn ngày hiệu lực.",
    STAFF_RATE_VERSION_EFFECTIVE_DATE_ALREADY_EXISTS:
      "Đã có phiên bản đơn giá với ngày hiệu lực này.",
    STAFF_RATE_VERSION_REASON_REQUIRED:
      "Bắt buộc nhập lý do thêm phiên bản đơn giá.",
    STAFF_RATE_VERSION_REQUIRES_ACTIVE_PROFILE:
      "Chỉ có thể thêm đơn giá cho nhân sự đang làm việc.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  if (message.includes("profiles_employee_code_lower_unique_idx")) {
    return "Mã nhân sự này đã được sử dụng.";
  }

  return "Không thể lưu thay đổi. Dữ liệu chưa được cập nhật.";
}

function revalidateStaffRoutes(staffId: string): void {
  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
}

export async function updateStaffProfileAction(
  input: UpdateStaffProfileActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = updateStaffProfileSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin hồ sơ nhân sự.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_staff_profile", {
      p_display_name: parsed.data.displayName,
      p_employee_code: parsed.data.employeeCode,
      p_employment_status: parsed.data.employmentStatus,
      p_phone: parsed.data.phone,
      p_reason: parsed.data.reason,
      p_staff_id: parsed.data.staffId,
      ...(parsed.data.joinedAt
        ? { p_joined_at: parsed.data.joinedAt }
        : {}),
      ...(parsed.data.leftAt ? { p_left_at: parsed.data.leftAt } : {}),
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data) {
      return createErrorState(
        "Database không trả về hồ sơ nhân sự vừa cập nhật.",
      );
    }

    revalidateStaffRoutes(parsed.data.staffId);

    return {
      message: "Đã cập nhật hồ sơ nhân sự.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống nhân sự. Vui lòng thử lại.",
    );
  }
}

export async function createStaffRateVersionAction(
  input: CreateStaffRateVersionActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage_rates");

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createStaffRateVersionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại phiên bản đơn giá.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpcClient = supabase as unknown as UntypedRpcClient;
    const { data, error } = await rpcClient.rpc(
      "create_staff_daily_rate_version",
      {
        p_effective_from: parsed.data.effectiveFrom,
        p_note: parsed.data.note,
        p_offline_daily_rate_vnd: parsed.data.offlineDailyRateVnd,
        p_reason: parsed.data.reason,
        p_staff_id: parsed.data.staffId,
      },
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data) {
      return createErrorState(
        "Database không trả về phiên bản đơn giá vừa tạo.",
      );
    }

    revalidateStaffRoutes(parsed.data.staffId);

    return {
      message: "Đã thêm mức lương ngày mới.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống đơn giá. Vui lòng thử lại.",
    );
  }
}

interface UntypedRpcClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

async function runStaffPayrollRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<StaffManagementActionState | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
      name,
      args,
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data) {
      return createErrorState("Database không trả về dữ liệu vừa cập nhật.");
    }

    return null;
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống cấu hình lương. Vui lòng thử lại.",
    );
  }
}

export async function configureStaffPayrollCompensationAction(
  input: ConfigureStaffPayrollCompensationActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage_payroll_profile");
  if (permissionError) return createErrorState(permissionError);

  const parsed = configureStaffPayrollCompensationSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại vị trí và mức lương ngày.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const error = await runStaffPayrollRpc("configure_staff_payroll_compensation", {
    p_effective_from: parsed.data.effectiveFrom,
    p_note: parsed.data.note,
    p_offline_daily_rate_vnd: parsed.data.offlineDailyRateVnd,
    p_position_code: parsed.data.positionCode,
    p_reason: parsed.data.reason,
    p_staff_id: parsed.data.staffId,
  });
  if (error) return error;

  revalidateStaffRoutes(parsed.data.staffId);
  revalidatePath("/payroll");
  return { message: "Đã thêm cấu hình lương mới.", status: "success" };
}

export async function createStaffGradeAssignmentAction(
  input: CreateStaffGradeAssignmentActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage_payroll_profile");
  if (permissionError) return createErrorState(permissionError);

  const parsed = createStaffGradeAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại phân công khối.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const error = await runStaffPayrollRpc("create_staff_grade_assignment", {
    p_effective_from: parsed.data.effectiveFrom,
    p_effective_to: parsed.data.effectiveTo || null,
    p_grade: parsed.data.grade,
    p_reason: parsed.data.reason,
    p_staff_id: parsed.data.staffId,
  });
  if (error) return error;

  revalidateStaffRoutes(parsed.data.staffId);
  revalidatePath("/payroll");
  return { message: "Đã lưu phân công khối.", status: "success" };
}

export async function createStaffPayrollTaskVersionAction(
  input: CreateStaffPayrollTaskVersionActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.manage_payroll_profile");
  if (permissionError) return createErrorState(permissionError);

  const parsed = createStaffPayrollTaskVersionSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại nhiệm vụ tính lương.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const error = await runStaffPayrollRpc("create_staff_payroll_task_version", {
    p_effective_from: parsed.data.effectiveFrom,
    p_is_enabled: parsed.data.isEnabled,
    p_reason: parsed.data.reason,
    p_staff_id: parsed.data.staffId,
    p_task_code: parsed.data.taskCode,
  });
  if (error) return error;

  revalidateStaffRoutes(parsed.data.staffId);
  revalidatePath("/payroll");
  return { message: "Đã lưu trạng thái nhiệm vụ.", status: "success" };
}

export async function submitStaffBankAccountChangeAction(
  input: SubmitStaffBankAccountChangeActionInput,
): Promise<StaffManagementActionState> {
  const parsed = submitStaffBankAccountChangeSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin ngân hàng.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const error = await runStaffPayrollRpc("submit_staff_bank_account_change", {
    p_account_holder_name: parsed.data.accountHolderName,
    p_account_number: parsed.data.accountNumber,
    p_bank_name: parsed.data.bankName,
    p_effective_from: parsed.data.effectiveFrom,
    p_reason: parsed.data.reason,
    p_staff_id: parsed.data.staffId,
  });
  if (error) return error;

  revalidateStaffRoutes(parsed.data.staffId);
  return { message: "Đã gửi thông tin ngân hàng để duyệt.", status: "success" };
}

export async function decideStaffBankAccountChangeAction(
  input: DecideStaffBankAccountChangeActionInput,
): Promise<StaffManagementActionState> {
  const permissionError = await getPermissionError("staff.bank.manage");
  if (permissionError) return createErrorState(permissionError);
  const parsed = decideStaffBankAccountChangeSchema.safeParse(input);
  if (!parsed.success) return createErrorState("Vui lòng kiểm tra nội dung duyệt.", parsed.error.flatten().fieldErrors);

  const error = await runStaffPayrollRpc("decide_staff_bank_account_change", {
    p_decision: parsed.data.decision,
    p_request_id: parsed.data.requestId,
    p_review_note: parsed.data.reviewNote,
  });
  if (error) return error;
  revalidateStaffRoutes(parsed.data.staffId);
  return { message: "Đã xử lý thông tin ngân hàng.", status: "success" };
}
