"use server";

import { revalidatePath } from "next/cache";

import {
  getMyMonthlyTimekeepingEntries,
  getCenterMonthlyTimekeepingOverview,
  getStaffMonthlyTimekeepingEntries,
} from "@/features/timekeeping/data";
import {
  adminAdjustTimeEntrySchema,
  adminCreateTimeEntrySchema,
  adminDeleteTimeEntrySchema,
  type AdminAdjustTimeEntryInput,
  type AdminCreateTimeEntryInput,
  type AdminDeleteTimeEntryInput,
} from "@/features/timekeeping/timekeeping-admin-schemas";
import type {
  TimekeepingCenterMonthlyOverviewResult,
  TimekeepingMonthlyEntriesResult,
} from "@/features/timekeeping/types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AdminTimekeepingActionState } from "@/features/timekeeping/timekeeping-admin-action-types";

function createErrorState(
  message: string,
  fieldErrors?: AdminTimekeepingActionState["fieldErrors"],
): AdminTimekeepingActionState {
  return { fieldErrors, message, status: "error" };
}

async function hasAnyPermission(requiredPermissions: PermissionCode[]): Promise<boolean> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok) return false;
  return requiredPermissions.some((perm) => permissionResult.permissions.includes(perm));
}

function getAdminRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    STAFF_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ nhân sự được chỉ định.",
    TIME_ENTRY_ADJUSTMENT_NO_CHANGE: "Giờ và hình thức không thay đổi so với hiện tại.",
    TIME_ENTRY_ADJUSTMENT_REASON_REQUIRED: "Vui lòng nhập lý do điều chỉnh công.",
    TIME_ENTRY_CHECK_IN_AND_OUT_REQUIRED: "Thời điểm vào và ra là bắt buộc.",
    TIME_ENTRY_CHECK_OUT_MUST_BE_AFTER_CHECK_IN: "Thời điểm ra phải sau hoặc bằng thời điểm vào.",
    TIME_ENTRY_DELETE_REASON_REQUIRED: "Vui lòng nhập lý do xóa lượt chấm công.",
    TIME_ENTRY_DELETE_WOULD_RESTORE_IMPORTED_TIMEKEEPING:
      "Ngày này có công import từ Excel; xóa lượt chấm công cuối cùng sẽ làm bảng lương tính lại công import. Hãy sửa giờ thay vì xóa.",
    TIME_ENTRY_ADJUSTMENT_CANNOT_USE_FUTURE_TIME: "Không thể điều chỉnh sang thời điểm trong tương lai.",
    TIME_ENTRY_ADJUSTMENT_WORK_DATE_INVALID:
      "Giờ vào phải thuộc ngày làm việc của lượt chấm công và giờ ra không quá ngày hôm sau.",
    TIME_ENTRY_LOCKED_BY_PAYROLL:
      "Lượt chấm công thuộc kỳ lương đã khoá (đang duyệt hoặc đã duyệt). Hãy mở lại kỳ lương về nháp trước khi thay đổi công; kỳ đã chi trả thì không mở lại được, hãy bù trừ ở kỳ sau.",
    TIME_ENTRY_MODE_INVALID: "Hình thức chấm công không hợp lệ.",
    TIME_ENTRY_NOT_FOUND: "Không tìm thấy lượt chấm công.",
    TIME_ENTRY_OPEN_CANNOT_BE_DELETED:
      "Ca đang diễn ra không thể xóa. Hãy sửa giờ ra hoặc chờ ca kết thúc.",
    TIME_ENTRY_REFERENCED_BY_PAYROLL_HISTORY:
      "Lượt chấm công đã nằm trong bảng lương tính trước đây nên không thể xóa.",
    TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED:
      "Tài khoản không có quyền điều chỉnh công của nhân sự.",
    TIMEKEEPING_MANAGE_PERMISSION_REQUIRED:
      "Tài khoản không có quyền điều chỉnh công của nhân sự.",
    WORK_DATE_REQUIRED: "Ngày làm việc là bắt buộc.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể hoàn tất thao tác. Dữ liệu chưa được cập nhật.";
}

export async function adminAdjustTimeEntryAction(
  input: AdminAdjustTimeEntryInput,
): Promise<AdminTimekeepingActionState> {
  const hasPermission = await hasAnyPermission([
    "timekeeping.approve_adjustment",
    "staff.manage",
  ]);

  if (!hasPermission) {
    return createErrorState(
      "Tài khoản hiện tại không có quyền điều chỉnh trực tiếp lượt chấm công.",
    );
  }

  const parsed = adminAdjustTimeEntrySchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Dữ liệu điều chỉnh chưa hợp lệ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_adjust_time_entry", {
      p_check_in_at: parsed.data.checkInAt,
      p_check_out_at: parsed.data.checkOutAt,
      p_mode: parsed.data.mode,
      p_reason: parsed.data.reason,
      p_time_entry_id: parsed.data.timeEntryId,
    });

    if (error) {
      return createErrorState(getAdminRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về lượt chấm công vừa cập nhật.");
    }

    revalidatePath("/timekeeping");
    return {
      message: "Đã cập nhật giờ chấm công thành công.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới máy chủ để điều chỉnh công. Vui lòng thử lại.",
    );
  }
}

export async function adminCreateTimeEntryAction(
  input: AdminCreateTimeEntryInput,
): Promise<AdminTimekeepingActionState> {
  const hasPermission = await hasAnyPermission([
    "timekeeping.approve_adjustment",
    "staff.manage",
  ]);

  if (!hasPermission) {
    return createErrorState(
      "Tài khoản hiện tại không có quyền bổ sung lượt công cho nhân sự.",
    );
  }

  const parsed = adminCreateTimeEntrySchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Dữ liệu công bổ sung chưa hợp lệ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_create_time_entry", {
      p_check_in_at: parsed.data.checkInAt,
      p_check_out_at: parsed.data.checkOutAt,
      p_mode: parsed.data.mode,
      p_notes: parsed.data.notes || "",
      p_staff_id: parsed.data.staffId,
      p_work_date: parsed.data.workDate,
    });

    if (error) {
      return createErrorState(getAdminRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về lượt chấm công vừa tạo.");
    }

    revalidatePath("/timekeeping");
    return {
      message: "Đã bổ sung lượt chấm công thành công.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới máy chủ để tạo công. Vui lòng thử lại.",
    );
  }
}

export async function adminDeleteTimeEntryAction(
  input: AdminDeleteTimeEntryInput,
): Promise<AdminTimekeepingActionState> {
  // Same check as admin_delete_time_entry, so the action never promises more than the RPC allows.
  const hasPermission = await hasAnyPermission(["timekeeping.approve_adjustment"]);

  if (!hasPermission) {
    return createErrorState(
      "Tài khoản hiện tại không có quyền xóa lượt chấm công.",
    );
  }

  const parsed = adminDeleteTimeEntrySchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Dữ liệu xóa lượt chấm công chưa hợp lệ.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_delete_time_entry", {
      p_reason: parsed.data.reason,
      p_time_entry_id: parsed.data.timeEntryId,
    });

    if (error) {
      return createErrorState(getAdminRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về lượt chấm công vừa xóa.");
    }

    revalidatePath("/timekeeping");
    return {
      message: "Đã xóa lượt chấm công.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới máy chủ để xóa lượt chấm công. Vui lòng thử lại.",
    );
  }
}

export async function fetchStaffMonthlyTimesheetAction(
  staffId: string,
  month: number,
  year: number,
): Promise<TimekeepingMonthlyEntriesResult> {
  try {
    const hasPermission = await hasAnyPermission([
      "timekeeping.view",
      "timekeeping.approve_adjustment",
      "staff.manage",
    ]);

    if (!hasPermission) {
      return {
        error: {
          code: "monthly_entries_query_failed",
          message: "Bạn không có quyền xem chi tiết bảng công của nhân sự này.",
        },
        ok: false,
      };
    }

    return getStaffMonthlyTimekeepingEntries(staffId, month, year);
  } catch {
    return {
      error: {
        code: "monthly_entries_query_failed",
        message: "Không thể tải chi tiết chấm công. Vui lòng thử lại.",
      },
      ok: false,
    };
  }
}

export async function fetchCenterMonthlyOverviewAction(
  month: number,
  year: number,
): Promise<TimekeepingCenterMonthlyOverviewResult> {
  try {
    const hasPermission = await hasAnyPermission([
      "timekeeping.view",
      "timekeeping.approve_adjustment",
      "staff.manage",
    ]);

    if (!hasPermission) {
      return {
        error: {
          code: "center_monthly_overview_failed",
          message: "Bạn không có quyền xem bảng tổng hợp công toàn trung tâm.",
        },
        ok: false,
      };
    }

    return getCenterMonthlyTimekeepingOverview(month, year);
  } catch {
    return {
      error: {
        code: "center_monthly_overview_failed",
        message: "Không thể tải bảng công toàn trung tâm. Vui lòng thử lại.",
      },
      ok: false,
    };
  }
}

export async function fetchMyMonthlyTimesheetAction(
  month: number,
  year: number,
): Promise<TimekeepingMonthlyEntriesResult> {
  try {
    const hasPermission = await hasAnyPermission(["timekeeping.check"]);

    if (!hasPermission) {
      return {
        error: {
          code: "monthly_entries_query_failed",
          message: "Bạn không có quyền chấm công hoặc xem bảng công cá nhân.",
        },
        ok: false,
      };
    }

    return getMyMonthlyTimekeepingEntries(month, year);
  } catch {
    return {
      error: {
        code: "monthly_entries_query_failed",
        message: "Không thể tải bảng công cá nhân. Vui lòng thử lại.",
      },
      ok: false,
    };
  }
}
