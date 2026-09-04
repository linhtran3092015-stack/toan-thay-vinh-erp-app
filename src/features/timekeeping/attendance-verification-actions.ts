"use server";

import { revalidatePath } from "next/cache";

import type { AttendanceVerificationActionState } from "@/features/timekeeping/attendance-verification-action-types";
import {
  attendanceVerificationConfigSchema,
  type AttendanceVerificationConfigInput,
} from "@/features/timekeeping/attendance-verification-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function errorState(
  message: string,
  fieldErrors?: AttendanceVerificationActionState["fieldErrors"],
): AttendanceVerificationActionState {
  return { fieldErrors, message, status: "error" };
}

const databaseErrorMessages: Record<string, string> = {
  TIMEKEEPING_CENTER_COORDINATES_INVALID: "Tọa độ Trung tâm không hợp lệ.",
  TIMEKEEPING_CENTER_NAME_INVALID: "Tên Trung tâm không hợp lệ.",
  TIMEKEEPING_CENTER_RADIUS_INVALID: "Bán kính chấm công phải từ 20 đến 2.000 m.",
  TIMEKEEPING_GPS_ACCURACY_POLICY_INVALID: "Sai số GPS cho phép phải từ 20 đến 200 m.",
  TIMEKEEPING_VERIFICATION_MANAGE_PERMISSION_REQUIRED: "Chỉ tài khoản được cấp quyền cấu hình xác minh chấm công mới có thể lưu.",
  TIMEKEEPING_WIFI_NETWORK_LIMIT_EXCEEDED: "Chỉ được cấu hình tối đa 20 mạng Wi-Fi.",
  TIMEKEEPING_WIFI_NETWORK_REQUIRED: "Cần thêm ít nhất một mạng khi bật xác minh Wi-Fi.",
  TIMEKEEPING_WIFI_NETWORKS_INVALID: "Danh sách Wi-Fi có SSID hoặc BSSID không hợp lệ.",
};

function translateDatabaseError(message: string): string {
  for (const [code, translated] of Object.entries(databaseErrorMessages)) {
    if (message.includes(code)) return translated;
  }
  return "Không thể lưu cấu hình xác minh chấm công. Dữ liệu chưa được thay đổi.";
}

export async function updateAttendanceVerificationConfigAction(
  input: AttendanceVerificationConfigInput,
): Promise<AttendanceVerificationActionState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("timekeeping.manage_verification")) {
    return errorState("Tài khoản hiện tại không có quyền cấu hình xác minh chấm công.");
  }

  const parsed = attendanceVerificationConfigSchema.safeParse(input);
  if (!parsed.success) {
    return errorState(
      "Vui lòng kiểm tra lại cấu hình GPS và Wi-Fi.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("set_attendance_verification_config", {
      p_attendance_radius_m: parsed.data.attendanceRadiusM,
      p_center_latitude: parsed.data.centerLatitude,
      p_center_longitude: parsed.data.centerLongitude,
      p_center_name: parsed.data.centerName,
      p_gps_max_accuracy_m: parsed.data.gpsMaxAccuracyM,
      p_wifi_networks: parsed.data.wifiNetworks,
      p_wifi_required_for_offline: parsed.data.wifiRequiredForOffline,
    });

    if (error) return errorState(translateDatabaseError(error.message));
    if (!data || typeof data !== "object") {
      return errorState("Database không xác nhận được cấu hình vừa lưu.");
    }

    revalidatePath("/timekeeping");
    return { message: "Đã cập nhật điều kiện xác minh chấm công.", status: "success" };
  } catch {
    return errorState("Không thể kết nối hệ thống cấu hình chấm công.");
  }
}
