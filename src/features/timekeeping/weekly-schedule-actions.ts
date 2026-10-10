"use server";

import { revalidatePath } from "next/cache";

import type { TimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { weeklyAssignmentSchema, type WeeklyAssignmentInput } from "@/features/timekeeping/weekly-schedule";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type SaveWeeklyAssignmentArgs =
  Database["public"]["Functions"]["save_weekly_shift_assignment"]["Args"];

const messages: Record<string, string> = {
  WEEKLY_SCHEDULE_CONFLICT: "Lịch đã được người khác cập nhật. Hãy tải lại trang rồi thử lại.",
  WEEKLY_SCHEDULE_PAST_DATE: "Không thể thay đổi lịch của ngày đã qua.",
  WEEKLY_SCHEDULE_HAS_ATTENDANCE: "Ngày này đã có chấm công nên không thể thay đổi ca.",
  STAFF_MANAGE_PERMISSION_REQUIRED: "Bạn không có quyền quản lý lịch phân công.",
  AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  STAFF_SHIFT_REQUIRES_ACTIVE_STAFF: "Chỉ phân công cho nhân sự đang làm việc.",
  STAFF_SHIFT_REQUIRES_ACTIVE_WORK_SHIFT: "Ca đã ngừng sử dụng. Hãy chọn ca khác.",
};

export async function saveWeeklyAssignmentAction(input: WeeklyAssignmentInput): Promise<TimekeepingManagementActionState> {
  try {
    const permission = await getDatabasePermissions();
    if (!permission.ok || !permission.permissions.includes("staff.manage")) {
      return { status: "error", message: messages.STAFF_MANAGE_PERMISSION_REQUIRED };
    }
    const parsed = weeklyAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "error", message: "Vui lòng kiểm tra thông tin phân công.", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const supabase = await createSupabaseServerClient();
    // The SQL function accepts null for shift/expected-* (clear shift, first
    // assignment); generated RPC types cannot express nullable args.
    const args = {
      p_week_start: parsed.data.weekStart,
      p_weekday: parsed.data.weekday,
      p_staff_id: parsed.data.staffId,
      p_work_shift_id: parsed.data.workShiftId,
      p_expected_assignment_id: parsed.data.expectedAssignmentId,
      p_expected_updated_at: parsed.data.expectedUpdatedAt,
      p_reason: parsed.data.reason,
    } satisfies Record<keyof SaveWeeklyAssignmentArgs, string | number | null>;
    const { data, error } = await supabase.rpc(
      "save_weekly_shift_assignment",
      args as SaveWeeklyAssignmentArgs,
    );
    if (error) {
      return { status: "error", message: Object.entries(messages).find(([code]) => error.message.includes(code))?.[1] ?? "Không thể lưu lịch. Vui lòng thử lại." };
    }
    if (!data) return { status: "error", message: "Hệ thống chưa xác nhận lưu lịch. Hãy tải lại trang để kiểm tra." };
    revalidatePath("/timekeeping");
    return { status: "success", message: parsed.data.workShiftId ? "Đã lưu phân công cho tuần đang chọn." : "Đã bỏ ca trong tuần đang chọn." };
  } catch {
    return { status: "error", message: "Không thể kết nối hệ thống. Vui lòng thử lại." };
  }
}
