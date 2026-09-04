"use server";

import { revalidatePath } from "next/cache";

import type {
  AttendanceHeartbeatInput,
  AttendanceHeartbeatResult,
  TimeEntryActionInput,
  TimekeepingEntryActionState,
} from "@/features/timekeeping/time-entry-action-types";
import { timeEntryActionSchema } from "@/features/timekeeping/time-entry-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createErrorState(
  message: string,
  fieldErrors?: TimekeepingEntryActionState["fieldErrors"],
): TimekeepingEntryActionState {
  return { fieldErrors, message, status: "error" };
}

async function getPermissionError(): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền chấm công. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes("timekeeping.check")) {
    return "Tài khoản hiện tại không có quyền timekeeping.check.";
  }

  return null;
}

function getRpcErrorMessage(message: string, isCheckIn: boolean): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    STAFF_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ nhân sự đang hoạt động.",
    TIMEKEEPING_CHECK_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền timekeeping.check.",
    TIME_ENTRY_CENTER_CONFIG_NOT_FOUND:
      "Hệ thống chưa được cấu hình tọa độ vị trí Trung tâm. Vui lòng liên hệ Quản trị viên.",
    TIME_ENTRY_GPS_ACCURACY_TOO_LOW:
      "Dữ liệu vị trí GPS chưa đạt độ chính xác theo cấu hình Trung tâm. Vui lòng thử lại ở vị trí thông thoáng hơn.",
    TIME_ENTRY_GPS_EVIDENCE_INVALID: "Dữ liệu GPS chưa hợp lệ.",
    TIME_ENTRY_GPS_REQUIRED_FOR_TEACHING_ASSISTANT:
      "Trợ giảng cần bật định vị GPS để thực hiện chấm công tại Trung tâm.",
    TIME_ENTRY_GPS_REQUIRED_FOR_OFFLINE:
      "Cần lấy vị trí GPS trước khi chấm công tại Trung tâm.",
    TIME_ENTRY_MODE_INVALID: "Hình thức chấm công chưa hợp lệ.",
    TIME_ENTRY_OPEN_ENTRY_ALREADY_EXISTS:
      "Bạn đang có một lượt chấm công chưa kết thúc.",
    TIME_ENTRY_OPEN_ENTRY_NOT_FOUND: "Không tìm thấy lượt chấm công đang mở.",
    TIME_ENTRY_OUTSIDE_GEOFENCE:
      "Bạn đang ở ngoài khu vực Trung tâm. Vui lòng di chuyển vào Trung tâm để chấm công.",
    TIME_ENTRY_REQUIRES_ACTIVE_STAFF:
      "Chỉ nhân sự đang làm việc mới có thể chấm công.",
    TIME_ENTRY_TEACHING_ASSISTANT_CHECKIN_CUTOFF_REACHED:
      "Trợ giảng không thể bắt đầu chấm công sau 23:30.",
    TIME_ENTRY_WIFI_EVIDENCE_INVALID: "Dữ liệu Wi-Fi chưa hợp lệ.",
    TIME_ENTRY_WIFI_NOT_ALLOWED:
      "Wi-Fi không khớp danh sách mạng Trung tâm đã đăng ký.",
    TIME_ENTRY_WIFI_REQUIRED_FOR_OFFLINE:
      "Cần nhập tên Wi-Fi và BSSID trước khi chấm công tại Trung tâm.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return isCheckIn
    ? "Không thể ghi nhận check-in. Dữ liệu chưa được cập nhật."
    : "Không thể ghi nhận check-out. Dữ liệu chưa được cập nhật.";
}

async function submitTimeEntryAction(
  input: TimeEntryActionInput,
  isCheckIn: boolean,
): Promise<TimekeepingEntryActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = timeEntryActionSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin chấm công.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    // The generated RPC types model required SQL parameters as non-null even
    // though the workflow intentionally accepts null optional evidence.
    const rpcArguments = {
      p_gps_accuracy_meters: parsed.data.gpsAccuracyMeters,
      p_gps_latitude: parsed.data.gpsLatitude,
      p_gps_longitude: parsed.data.gpsLongitude,
      p_mode: parsed.data.mode,
      p_wifi_bssid: parsed.data.wifiBssid || null,
      p_wifi_ssid: parsed.data.wifiSsid || null,
    };
    const { data, error } = isCheckIn
      ? await supabase.rpc("check_in_time_entry", rpcArguments as never)
      : await supabase.rpc("check_out_time_entry", rpcArguments as never);

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message, isCheckIn));
    }

    if (!data?.id) {
      return createErrorState(
        isCheckIn
          ? "Database không trả về lượt check-in vừa tạo."
          : "Database không trả về lượt check-out vừa cập nhật.",
      );
    }

    revalidatePath("/timekeeping");

    return {
      message: isCheckIn ? "Đã ghi nhận check-in." : "Đã ghi nhận check-out.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống chấm công. Vui lòng thử lại.",
    );
  }
}

export async function checkInTimeEntryAction(
  input: TimeEntryActionInput,
): Promise<TimekeepingEntryActionState> {
  return await submitTimeEntryAction(input, true);
}

export async function checkOutTimeEntryAction(
  input: TimeEntryActionInput,
): Promise<TimekeepingEntryActionState> {
  return await submitTimeEntryAction(input, false);
}

export async function submitAttendanceHeartbeatAction(
  input: AttendanceHeartbeatInput,
): Promise<AttendanceHeartbeatResult> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return { messageVi: permissionError, reason: permissionError, sessionActive: false };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpcFn = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpcFn("submit_attendance_heartbeat", {
      p_gps_accuracy_meters: input.gpsAccuracyMeters,
      p_gps_latitude: input.gpsLatitude,
      p_gps_longitude: input.gpsLongitude,
    });

    if (error) {
      return { sessionActive: true, signalDegraded: true };
    }

    return (data as unknown as AttendanceHeartbeatResult) ?? { sessionActive: true };
  } catch {
    return { sessionActive: true, signalDegraded: true };
  }
}
