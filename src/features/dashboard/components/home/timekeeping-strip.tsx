import { CircleCheck, MapPin } from "lucide-react";

import { getButtonClassName } from "@/components/ui/button";
import { BlockError, IconTile } from "@/features/dashboard/components/home/home-block";
import type { DashboardHomeReadModel } from "@/features/dashboard/home-models";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import { getVietnamTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/**
 * The viewer's own shift state, in both layouts (staff in the centre layout
 * check in too): warning-soft before the first check-in today, success-soft
 * while a shift is open, neutral once today's shift is checked out (a later
 * shift can still start). The check-in/out button is
 * secondary (never the page's primary) and opens the
 * existing timekeeping dialog, which owns GPS/Wi-Fi verification. Hidden
 * without timekeeping.check.
 */
export function TimekeepingStrip({ model, retryHref }: { model: DashboardHomeReadModel; retryHref: string }) {
  const feed = model.timekeeping;
  if (feed.status === "unavailable" && feed.reason === "forbidden") return null;

  if (feed.status === "unavailable") {
    return (
      <section aria-label="Chấm công" className="overflow-hidden rounded-lg border border-warning-border">
        <BlockError message="Chưa tải được trạng thái chấm công hôm nay." retryHref={retryHref} />
      </section>
    );
  }

  const { lastCheckOutAt, openEntry, policy } = feed.value;
  const triggerClassName = cn(getButtonClassName({ variant: "secondary" }), "max-md:h-11");
  // Checked out earlier today: neutral, not a "not checked in" warning; a later shift can still start.
  const tone = openEntry ? "success" : lastCheckOutAt ? "neutral" : "warning";
  const hhmm = (iso: string) => getVietnamTime(new Date(iso)).slice(0, 5);

  return (
    <section
      aria-label="Chấm công"
      className={cn(
        "panel-rise flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        tone === "success"
          ? "border-success-border bg-success-bg text-success-ink"
          : tone === "neutral"
            ? "border-border-subtle bg-surface-base text-text-strong"
            : "border-warning-border bg-warning-bg text-warning-ink",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <IconTile tone={tone}>{openEntry || lastCheckOutAt ? <CircleCheck /> : <MapPin />}</IconTile>
        <div className="min-w-0">
          <p className="text-body font-semibold">
            {openEntry ? `Đang trong ca từ ${hhmm(openEntry.checkInAt)}` : lastCheckOutAt ? `Đã ra ca lúc ${hhmm(lastCheckOutAt)}` : "Chưa chấm công vào ca"}
          </p>
          <p className={cn("text-secondary", tone === "neutral" && "text-text-muted")}>
            {openEntry
              ? [openEntry.checkInMode === "online" ? "Trực tuyến" : "Tại trung tâm", openEntry.workShiftName].filter(Boolean).join(" · ")
              : lastCheckOutAt
                ? "Ca hôm nay đã ghi nhận. Nếu bạn có ca khác, chấm công vào ca mới."
                : policy
                ? `Chấm công tại trung tâm cần vị trí GPS trong bán kính ${policy.attendanceRadiusM} m quanh ${policy.centerName}. Nút chỉ xác nhận được khi bạn ở trong bán kính.`
                : "Chấm công tại trung tâm cần vị trí GPS; hộp chấm công sẽ kiểm tra điều kiện trước khi ghi nhận."}
          </p>
        </div>
      </div>
      <div className="shrink-0 pl-9 sm:pl-0">
        <TimekeepingEntryDialog
          attendancePolicy={policy ?? undefined}
          operation={openEntry ? "check-out" : "check-in"}
          timeEntryId={openEntry?.id}
          triggerChildren={openEntry ? "Chấm công ra ca" : "Chấm công vào ca"}
          triggerClassName={triggerClassName}
        />
      </div>
    </section>
  );
}
