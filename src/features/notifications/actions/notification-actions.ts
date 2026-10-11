"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { NotificationActionResult } from "@/features/notifications/read-models";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
type MarkNotificationReadArgs =
  Database["public"]["Functions"]["mark_notification_read"]["Args"];

const notificationIdSchema = z.string().uuid();

async function requireNotificationPermission(): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền thông báo. Vui lòng đăng nhập lại.";
  }

  if (!permissionResult.permissions.includes("notifications.view")) {
    return permissionDeniedMessage("notifications.view");
  }

  return null;
}

function getNotificationRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATED_USER_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    NOTIFICATION_NOT_FOUND:
      "Thông báo không tồn tại hoặc không thuộc tài khoản hiện tại.",
    NOTIFICATIONS_VIEW_PERMISSION_REQUIRED:
      "Tài khoản hiện tại không có quyền xem thông báo.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(
    knownMessages,
  )) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật trạng thái thông báo.";
}

function revalidateNotifications(): void {
  revalidatePath("/notifications");
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  const permissionError = await requireNotificationPermission();

  if (permissionError) {
    return {
      message: permissionError,
      status: "error",
    };
  }

  const parsed = notificationIdSchema.safeParse(notificationId);

  if (!parsed.success) {
    return {
      message: "Mã thông báo không hợp lệ.",
      status: "error",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "mark_notification_read",
      {
        p_notification_id: parsed.data,
      } as MarkNotificationReadArgs,
    );

    if (error) {
      return {
        message: getNotificationRpcErrorMessage(error.message),
        status: "error",
      };
    }

    if (!data?.id) {
      return {
        message: "Database không trả về thông báo vừa cập nhật.",
        status: "error",
      };
    }

    revalidateNotifications();

    return {
      message: "Đã đánh dấu thông báo là đã đọc.",
      status: "success",
    };
  } catch {
    return {
      message: "Không thể kết nối tới hệ thống thông báo.",
      status: "error",
    };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const permissionError = await requireNotificationPermission();

  if (permissionError) {
    return {
      message: permissionError,
      status: "error",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "mark_all_notifications_read",
    );

    if (error) {
      return {
        message: getNotificationRpcErrorMessage(error.message),
        status: "error",
      };
    }

    if (typeof data !== "number") {
      return {
        message: "Database không trả về số thông báo vừa cập nhật.",
        status: "error",
      };
    }

    revalidateNotifications();

    return {
      message:
        data > 0
          ? `Đã đánh dấu ${data} thông báo là đã đọc.`
          : "Không còn thông báo chưa đọc.",
      status: "success",
    };
  } catch {
    return {
      message: "Không thể kết nối tới hệ thống thông báo.",
      status: "error",
    };
  }
}
