"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import {
  sendParentMessageAction,
  skipParentMessageAction,
  updateParentMessageContentAction,
} from "@/features/parent-messages/actions";
import type { ParentMessageQueueItem, ParentMessageStatus } from "@/features/parent-messages/data";
import { formatDateTime, formatIsoDate, formatTime } from "@/lib/datetime";

const statusMeta: Record<ParentMessageStatus, { label: string; tone: "danger" | "info" | "neutral" | "success" | "warning" }> = {
  expired: { label: "Hết hạn", tone: "neutral" },
  failed: { label: "Gửi lỗi", tone: "danger" },
  queued: { label: "Chờ gửi", tone: "warning" },
  sent: { label: "Đã gửi", tone: "success" },
  skipped: { label: "Bỏ qua", tone: "neutral" },
};

const eventLabel: Record<ParentMessageQueueItem["eventCode"], string> = {
  "attendance.unexcused_absence": "Vắng không phép",
  "session.comment": "Nhận xét cuối buổi",
};

const filters: { label: string; value: ParentMessageStatus | "all" }[] = [
  { label: "Chờ gửi", value: "queued" },
  { label: "Gửi lỗi", value: "failed" },
  { label: "Đã gửi", value: "sent" },
  { label: "Bỏ qua", value: "skipped" },
  { label: "Tất cả", value: "all" },
];

export function ParentMessageQueue({
  canSend,
  configured,
  items,
  status,
}: {
  canSend: boolean;
  configured: boolean;
  items: ParentMessageQueueItem[];
  status: ParentMessageStatus | "all";
}) {
  const queuedCount = items.filter((item) => item.status === "queued").length;
  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Tin nhắn phụ huynh">
        <p className="mt-1 text-secondary text-text-muted">
          Tin được tạo tự động từ điểm danh vắng không phép và nhận xét cuối buổi, gửi vào nhóm Zalo sổ liên lạc của học sinh
          qua nick trung tâm. Trợ giảng kiểm tra nội dung rồi bấm Gửi.
        </p>
      </PageHeader>

      {!configured ? (
        <ResultBanner
          description="Đặt ZALOCRM_BASE_URL và ZALOCRM_API_KEY trên máy chủ, rồi chọn nick trung tâm trong Cài đặt → Chung. Tin vẫn được xếp hàng nhưng chưa gửi được."
          title="Chưa kết nối ZaloCRM"
          tone="warning"
        />
      ) : null}

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            aria-current={status === filter.value ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-md border px-3 text-control font-semibold transition-colors ${status === filter.value ? "border-action-primary bg-action-primary text-text-on-primary" : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover hover:text-text-strong"}`}
            href={filter.value === "queued" ? "/parent-messages" : `/parent-messages?status=${filter.value}`}
            key={filter.value}
          >
            {filter.label}
            {filter.value === "queued" && status === "queued" && queuedCount > 0 ? ` (${queuedCount})` : ""}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          description={status === "queued" ? "Không có tin nào đang chờ gửi." : "Không có tin ở trạng thái này."}
          title="Hàng đợi trống"
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <ParentMessageCard canSend={canSend && configured} item={item} key={item.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ParentMessageCard({ canSend, item }: { canSend: boolean; item: ParentMessageQueueItem }) {
  const router = useRouter();
  const [content, setContent] = useState(item.content);
  const [isEditing, setIsEditing] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [isSkipping, setIsSkipping] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const actionable = item.status === "queued" || item.status === "failed";
  const meta = statusMeta[item.status];

  const run = (work: () => Promise<{ message: string; ok: boolean }>) => {
    if (isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await work();
      setFeedback(result);
      if (result.ok) {
        setIsEditing(false);
        setIsSkipping(false);
        router.refresh();
      }
    });
  };

  return (
    <li className="rounded-lg border border-border-subtle bg-surface-base p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-text-strong">
            <Link className="text-action-link hover:underline" href={`/students/${item.studentId}`}>{item.studentName}</Link>
            <span className="ml-2 font-normal text-text-muted">{item.studentPublicCode}</span>
          </p>
          <p className="mt-0.5 text-caption text-text-muted">
            {eventLabel[item.eventCode]}
            {item.classCode ? ` · ${item.classCode}` : ""}
            {item.sessionDate ? ` · ${formatIsoDate(item.sessionDate)}${item.startTime ? ` ${formatTime(item.startTime)}` : ""}` : ""}
            {" · Nhóm: "}
            {item.zaloGroupName ?? item.threadId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-caption text-text-muted">{formatDateTime(item.createdAt)}</span>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-3 grid gap-2">
          <Textarea className="min-h-28" disabled={isPending} maxLength={2000} onChange={(event) => setContent(event.target.value)} value={content} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending || content.trim().length === 0} onClick={() => run(() => updateParentMessageContentAction({ content, messageId: item.id }))} size="sm" type="button">
              Lưu nội dung
            </Button>
            <Button disabled={isPending} onClick={() => { setContent(item.content); setIsEditing(false); }} size="sm" type="button" variant="ghost">
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-sunken px-3 py-2 text-body text-text-default">{item.content}</p>
      )}

      {item.status === "failed" && item.errorMessage ? (
        <p className="mt-2 text-caption text-danger">Lỗi lần gửi trước: {item.errorMessage}</p>
      ) : null}
      {item.status === "sent" ? (
        <p className="mt-2 text-caption text-text-muted">Đã gửi {formatDateTime(item.sentAt)}{item.sentByName ? ` bởi ${item.sentByName}` : ""}.</p>
      ) : null}
      {(item.status === "skipped" || item.status === "expired") && item.skipReason ? (
        <p className="mt-2 text-caption text-text-muted">Lý do: {item.skipReason}</p>
      ) : null}

      {feedback ? (
        <div className="mt-3">
          <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} />
        </div>
      ) : null}

      {actionable && canSend && !isEditing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button disabled={isPending} isLoading={isPending} onClick={() => run(() => sendParentMessageAction({ messageId: item.id }))} size="sm" type="button">
            {item.status === "failed" ? "Gửi lại" : "Gửi vào nhóm Zalo"}
          </Button>
          <Button disabled={isPending} onClick={() => setIsEditing(true)} size="sm" type="button" variant="outline">
            Sửa nội dung
          </Button>
          {isSkipping ? (
            <span className="flex flex-wrap items-center gap-2">
              <input
                className="h-9 rounded-md border border-border-subtle bg-surface-base px-3 text-control"
                disabled={isPending}
                maxLength={500}
                onChange={(event) => setSkipReason(event.target.value)}
                placeholder="Lý do bỏ qua"
                value={skipReason}
              />
              <Button disabled={isPending || skipReason.trim().length < 2} onClick={() => run(() => skipParentMessageAction({ messageId: item.id, reason: skipReason }))} size="sm" type="button" variant="danger">
                Xác nhận bỏ qua
              </Button>
              <Button disabled={isPending} onClick={() => setIsSkipping(false)} size="sm" type="button" variant="ghost">Hủy</Button>
            </span>
          ) : (
            <Button disabled={isPending} onClick={() => setIsSkipping(true)} size="sm" type="button" variant="ghost">
              Bỏ qua
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
