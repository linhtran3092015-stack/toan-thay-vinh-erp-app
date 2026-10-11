"use server";

import { revalidatePath } from "next/cache";

import type {
  CreateStaffShiftAssignmentActionInput,
  CreateWorkShiftActionInput,
  EndStaffShiftAssignmentActionInput,
  ReplaceStaffShiftAssignmentActionInput,
  RetireWorkShiftActionInput,
  TimekeepingManagementActionState,
  UpdateWorkShiftActionInput,
} from "@/features/timekeeping/timekeeping-action-types";
import {
  createStaffShiftAssignmentSchema,
  createWorkShiftSchema,
  endStaffShiftAssignmentSchema,
  replaceStaffShiftAssignmentSchema,
  retireWorkShiftSchema,
  updateWorkShiftSchema,
} from "@/features/timekeeping/timekeeping-management-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
function createErrorState(
  message: string,
  fieldErrors?: TimekeepingManagementActionState["fieldErrors"],
): TimekeepingManagementActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getPermissionError(): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản lý lịch làm việc. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes("staff.manage")) {
    return permissionDeniedMessage("staff.manage");
  }

  return null;
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    INACTIVE_WORK_SHIFT_IS_IMMUTABLE:
      "Ca đã ngừng sử dụng không thể chỉnh sửa.",
    ONLY_ACTIVE_STAFF_SHIFT_ASSIGNMENT_CAN_BE_ENDED:
      "Chỉ lịch phân công đang hiệu lực mới có thể kết thúc.",
    ONLY_ACTIVE_STAFF_SHIFT_ASSIGNMENT_CAN_BE_REPLACED:
      "Chỉ lịch phân công đang hiệu lực mới có thể thay thế.",
    ONLY_ACTIVE_WORK_SHIFT_CAN_BE_RETIRED:
      "Chỉ ca đang sử dụng mới có thể ngừng dùng.",
    STAFF_MANAGE_PERMISSION_REQUIRED:
      permissionDeniedMessage("staff.manage"),
    STAFF_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ nhân sự.",
    STAFF_SHIFT_ACTIVE_WEEKDAY_ALREADY_EXISTS:
      "Nhân sự này đã có một lịch đang hiệu lực vào thứ đã chọn.",
    STAFF_SHIFT_ASSIGNMENT_ID_REQUIRED: "Thiếu mã lịch phân công.",
    STAFF_SHIFT_ASSIGNMENT_NOT_FOUND: "Không tìm thấy lịch phân công.",
    STAFF_SHIFT_CANNOT_BE_REPLACED_ON_START_DATE:
      "Không thể thay lịch ngay trong ngày lịch bắt đầu có hiệu lực.",
    STAFF_SHIFT_CREATE_REASON_REQUIRED: "Bắt buộc nhập lý do phân công.",
    STAFF_SHIFT_EFFECTIVE_FROM_REQUIRED: "Bắt buộc chọn ngày hiệu lực.",
    STAFF_SHIFT_EFFECTIVE_TO_REQUIRED: "Bắt buộc chọn ngày kết thúc.",
    STAFF_SHIFT_END_DATE_CANNOT_BE_FUTURE:
      "Ngày kết thúc không được lớn hơn ngày hiện tại.",
    STAFF_SHIFT_END_DATE_INVALID:
      "Ngày kết thúc không được trước ngày lịch bắt đầu có hiệu lực.",
    STAFF_SHIFT_END_REASON_REQUIRED: "Bắt buộc nhập lý do kết thúc lịch.",
    STAFF_SHIFT_MUST_START_ON_BUSINESS_DATE:
      "Lịch mới phải bắt đầu từ ngày hiện tại theo giờ Việt Nam.",
    STAFF_SHIFT_REPLACEMENT_MUST_START_TODAY:
      "Lịch thay thế phải bắt đầu từ ngày hiện tại theo giờ Việt Nam.",
    STAFF_SHIFT_REPLACEMENT_REASON_REQUIRED:
      "Bắt buộc nhập lý do thay đổi lịch.",
    STAFF_SHIFT_REPLACEMENT_REQUIRES_DIFFERENT_WORK_SHIFT:
      "Ca thay thế phải khác ca đang được phân công.",
    STAFF_SHIFT_REQUIRES_ACTIVE_STAFF:
      "Chỉ có thể phân công cho nhân sự đang làm việc.",
    STAFF_SHIFT_REQUIRES_ACTIVE_WORK_SHIFT:
      "Chỉ có thể phân công ca đang sử dụng.",
    STAFF_SHIFT_WEEKDAY_INVALID: "Thứ trong tuần phải từ 1 đến 7.",
    WORK_SHIFT_ACTIVE_ASSIGNMENTS_EXIST:
      "Ca này còn lịch phân công đang hiệu lực nên chưa thể ngừng dùng.",
    WORK_SHIFT_BREAK_MINUTES_INVALID:
      "Số phút nghỉ phải là số nguyên không âm.",
    WORK_SHIFT_CODE_INVALID:
      "Mã ca gồm 2-64 ký tự in hoa, số hoặc . _ -.",
    WORK_SHIFT_ID_REQUIRED: "Thiếu mã ca làm.",
    WORK_SHIFT_NAME_INVALID: "Tên ca làm không hợp lệ.",
    WORK_SHIFT_NOT_FOUND: "Không tìm thấy ca làm.",
    WORK_SHIFT_REASON_REQUIRED: "Bắt buộc nhập lý do lưu ca làm.",
    WORK_SHIFT_RETIRE_REASON_REQUIRED: "Bắt buộc nhập lý do ngừng dùng ca.",
    WORK_SHIFT_TIME_INVALID:
      "Thời gian ca chưa hợp lệ với lựa chọn qua ngày.",
    WORK_SHIFT_WITH_ASSIGNMENTS_IMMUTABLE:
      "Ca đã có lịch sử phân công nên không thể chỉnh sửa. Hãy tạo ca mới và thay lịch.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  if (message.includes("work_shifts_code_unique")) {
    return "Mã ca này đã được sử dụng.";
  }

  return "Không thể lưu thay đổi lịch làm việc. Dữ liệu chưa được cập nhật.";
}

function revalidateTimekeepingRoute(): void {
  revalidatePath("/timekeeping");
}

export async function createWorkShiftAction(
  input: CreateWorkShiftActionInput,
): Promise<TimekeepingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createWorkShiftSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin ca làm.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_work_shift", {
      p_break_minutes: parsed.data.breakMinutes,
      p_code: parsed.data.code,
      p_crosses_midnight: parsed.data.crossesMidnight,
      p_end_time: parsed.data.endTime,
      p_name: parsed.data.name,
      p_notes: parsed.data.notes,
      p_reason: parsed.data.reason,
      p_start_time: parsed.data.startTime,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về ca làm vừa tạo.");
    }

    revalidateTimekeepingRoute();

    return { message: "Đã tạo ca làm mới.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống lịch làm việc. Vui lòng thử lại.");
  }
}

export async function updateWorkShiftAction(
  input: UpdateWorkShiftActionInput,
): Promise<TimekeepingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = updateWorkShiftSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin ca làm.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_work_shift", {
      p_break_minutes: parsed.data.breakMinutes,
      p_code: parsed.data.code,
      p_crosses_midnight: parsed.data.crossesMidnight,
      p_end_time: parsed.data.endTime,
      p_name: parsed.data.name,
      p_notes: parsed.data.notes,
      p_reason: parsed.data.reason,
      p_start_time: parsed.data.startTime,
      p_work_shift_id: parsed.data.workShiftId,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về ca làm vừa cập nhật.");
    }

    revalidateTimekeepingRoute();

    return { message: "Đã cập nhật ca làm.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống lịch làm việc. Vui lòng thử lại.");
  }
}

export async function retireWorkShiftAction(
  input: RetireWorkShiftActionInput,
): Promise<TimekeepingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = retireWorkShiftSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại lý do ngừng dùng ca.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("retire_work_shift", {
      p_reason: parsed.data.reason,
      p_work_shift_id: parsed.data.workShiftId,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về ca làm vừa ngừng dùng.");
    }

    revalidateTimekeepingRoute();

    return { message: "Đã ngừng dùng ca làm.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống lịch làm việc. Vui lòng thử lại.");
  }
}

export async function createStaffShiftAssignmentAction(
  input: CreateStaffShiftAssignmentActionInput,
): Promise<TimekeepingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createStaffShiftAssignmentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại lịch phân công.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "create_staff_shift_assignment",
      {
        p_effective_from: parsed.data.effectiveFrom,
        p_reason: parsed.data.reason,
        p_staff_id: parsed.data.staffId,
        p_weekday: parsed.data.weekday,
        p_work_shift_id: parsed.data.workShiftId,
      },
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về lịch phân công vừa tạo.");
    }

    revalidateTimekeepingRoute();

    return { message: "Đã tạo lịch phân công.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống lịch làm việc. Vui lòng thử lại.");
  }
}

export async function replaceStaffShiftAssignmentAction(
  input: ReplaceStaffShiftAssignmentActionInput,
): Promise<TimekeepingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = replaceStaffShiftAssignmentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại lịch thay thế.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "replace_staff_shift_assignment",
      {
        p_effective_from: parsed.data.effectiveFrom,
        p_reason: parsed.data.reason,
        p_staff_shift_assignment_id: parsed.data.staffShiftAssignmentId,
        p_work_shift_id: parsed.data.workShiftId,
      },
    );

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về lịch thay thế vừa tạo.");
    }

    revalidateTimekeepingRoute();

    return { message: "Đã thay lịch phân công và giữ lại lịch sử.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống lịch làm việc. Vui lòng thử lại.");
  }
}

export async function endStaffShiftAssignmentAction(
  input: EndStaffShiftAssignmentActionInput,
): Promise<TimekeepingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = endStaffShiftAssignmentSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin kết thúc lịch.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("end_staff_shift_assignment", {
      p_effective_to: parsed.data.effectiveTo,
      p_reason: parsed.data.reason,
      p_staff_shift_assignment_id: parsed.data.staffShiftAssignmentId,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về lịch phân công vừa kết thúc.");
    }

    revalidateTimekeepingRoute();

    return { message: "Đã kết thúc lịch phân công.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống lịch làm việc. Vui lòng thử lại.");
  }
}
