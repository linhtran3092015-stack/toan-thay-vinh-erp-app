"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions/notification-actions";
import type {
  NotificationActionResult,
  NotificationEntry,
} from "@/features/notifications/read-models";
import { cn } from "@/lib/utils";

interface NotificationListPageProps {
  entries: readonly NotificationEntry[];
  unreadCount: number;
}

type NotificationTone =
  | "danger"
  | "info"
  | "neutral"
  | "success"
  | "warning";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Không xác định";
  }

  return dateTimeFormatter.format(date);
}

function getEventLabel(eventCode: string): string {
  const eventName = eventCode.split(".").pop();

  const labels: Record<string, string> = {
    approved: "Đã duyệt",
    rejected: "Từ chối",
    requested: "Yêu cầu mới",
    review: "Chờ duyệt",
  };

  if (!eventName) {
    return eventCode;
  }

  return Object.hasOwn(labels, eventName)
    ? labels[eventName]
    : `Sự kiện chưa hỗ trợ: ${eventName}`;
}

function getEventTone(eventCode: string): NotificationTone {
  if (eventCode.endsWith(".approved")) {
    return "success";
  }

  if (eventCode.endsWith(".rejected")) {
    return "danger";
  }

  if (eventCode.endsWith(".review")) {
    return "warning";
  }

  if (eventCode.endsWith(".requested")) {
    return "info";
  }

  return "neutral";
}

export function NotificationListPage({
  entries,
  unreadCount,
}: NotificationListPageProps) {
  const router = useRouter();
  const [feedback, setFeedback] =
    useState<NotificationActionResult | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function handleMarkOne(notificationId: string): void {
    setFeedback(null);
    setPendingTarget(notificationId);

    startTransition(async () => {
      const result =
        await markNotificationReadAction(notificationId);

      setFeedback(result);
      setPendingTarget(null);

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  function handleMarkAll(): void {
    setFeedback(null);
    setPendingTarget("all");

    startTransition(async () => {
      const result = await markAllNotificationsReadAction();

      setFeedback(result);
      setPendingTarget(null);

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Thông báo
            </h1>
            <Badge tone={unreadCount > 0 ? "info" : "neutral"}>
              {unreadCount} chưa đọc
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Hiển thị tối đa 50 thông báo mới nhất của tài khoản.
          </p>
        </div>

        <Button
          disabled={unreadCount === 0}
          isLoading={isPending && pendingTarget === "all"}
          onClick={handleMarkAll}
          size="sm"
          variant="outline"
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </header>

      {feedback ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm font-medium",
            feedback.status === "success"
              ? "border-success-border bg-success-bg text-success"
              : "border-danger-border bg-danger-bg text-danger",
          )}
          role="status"
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="space-y-3">
        {entries.map((entry) => {
          const isUnread = entry.readAt === null;

          return (
            <Card
              className={cn(
                "overflow-hidden",
                isUnread &&
                  "border-primary/30 bg-primary-soft/25 shadow-sm",
              )}
              key={entry.id}
            >
              <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                <div
                  aria-hidden="true"
                  className={cn(
                    "mt-1 h-2.5 w-2.5 flex-none rounded-full",
                    isUnread ? "bg-primary" : "bg-hairline-strong",
                  )}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      className={cn(
                        "font-display text-base tracking-tight text-ink",
                        isUnread ? "font-bold" : "font-semibold",
                      )}
                    >
                      {entry.title}
                    </h2>

                    <Badge tone={getEventTone(entry.eventCode)}>
                      {getEventLabel(entry.eventCode)}
                    </Badge>

                    {isUnread ? (
                      <Badge tone="purple">Chưa đọc</Badge>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {entry.message}
                  </p>

                  <p className="mt-3 text-xs font-medium text-ink-subtle">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>

                <div className="flex flex-none flex-wrap items-center gap-2 sm:justify-end">
                  {entry.href ? (
                    <Link
                      className="inline-flex h-8 items-center justify-center rounded-md border border-hairline bg-surface-1 px-3 text-xs font-semibold text-ink transition-colors hover:border-hairline-strong hover:bg-surface-2"
                      href={entry.href}
                    >
                      Xem chi tiết
                    </Link>
                  ) : null}

                  {isUnread ? (
                    <Button
                      isLoading={
                        isPending && pendingTarget === entry.id
                      }
                      onClick={() => handleMarkOne(entry.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Đánh dấu đã đọc
                    </Button>
                  ) : null}
                </div>
              </article>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
