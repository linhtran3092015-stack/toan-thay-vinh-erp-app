import "server-only";

import { cache } from "react";

import type {
  NotificationEntry,
  NotificationReadResult,
} from "@/features/notifications/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NOTIFICATION_COLUMNS =
  "id,event_code,title,message,href,entity_type,entity_id,read_at,created_at";

function normalizeInternalHref(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  return value;
}

export async function getNotificationsResult(page = 1): Promise<
  NotificationReadResult<readonly NotificationEntry[]>
> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((Math.max(1, Math.min(100000, page)) - 1) * 50, Math.max(1, Math.min(100000, page)) * 50 - 1);

    if (error || !data) {
      return { ok: false };
    }

    return {
      data: data.map((notification) => ({
        createdAt: notification.created_at,
        entityId: notification.entity_id,
        entityType: notification.entity_type,
        eventCode: notification.event_code,
        href: normalizeInternalHref(notification.href),
        id: notification.id,
        message: notification.message,
        readAt: notification.read_at,
        title: notification.title,
      })),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export async function getUnreadNotificationCountResult(): Promise<
  NotificationReadResult<number>
> {
  try {
    const supabase = await createSupabaseServerClient();

    const { count, error } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .is("read_at", null);

    if (error || count === null) {
      return { ok: false };
    }

    return {
      data: count,
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export const getCachedUnreadNotificationCountResult = cache(
  getUnreadNotificationCountResult,
);
