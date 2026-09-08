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
  type AdminAdjustTimeEntryInput,
  type AdminCreateTimeEntryInput,
} from "@/features/timekeeping/timekeeping-admin-schemas";
import type {
  TimekeepingCenterMonthlyOverviewResult,
  TimekeepingMonthlyEntriesResult,
} from "@/features/timekeeping/types";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import type { PermissionCode } from "@/lib/permissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminTimekeepingActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "idle" | "success" | "error";
}

export const initialAdminTimekeepingActionState: AdminTimekeepingActionState = {
  message: "",
  status: "idle",
};

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
    TIME_ENTRY_ADJUSTMENT_REASON_REQUIRED: "Vui lòng nhập lý do điều chỉnh công.",
    TIME_ENTRY_CHECK_IN_AND_OUT_REQUIRED: "Thời điểm vào và ra là bắt buộc.",
    TIME_ENTRY_CHECK_OUT_MUST_BE_AFTER_CHECK_IN: "Thời điểm ra phải sau hoặc bằng thời điểm vào.",
    TIME_ENTRY_NOT_FOUND: "Không tìm thấy lượt chấm công cần điều chỉnh.",
    TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED:
      "Tài khoản không có quyền điều chỉnh công của nhân sự.",
    WORK_DATE_REQUIRED: "Ngày làm việc là bắt buộc.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể hoàn tất thao tác điều chỉnh. Dữ liệu chưa được cập nhật.";
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

export async function fetchStaffMonthlyTimesheetAction(
  staffId: string,
  month: number,
  year: number,
): Promise<TimekeepingMonthlyEntriesResult> {
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
}

export async function fetchCenterMonthlyOverviewAction(
  month: number,
  year: number,
): Promise<TimekeepingCenterMonthlyOverviewResult> {
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
}

export async function fetchMyMonthlyTimesheetAction(
  month: number,
  year: number,
): Promise<TimekeepingMonthlyEntriesResult> {
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
}
