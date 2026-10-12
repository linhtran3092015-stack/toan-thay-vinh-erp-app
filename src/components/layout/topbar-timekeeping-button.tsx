"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import type { AttendanceVerificationPolicy } from "@/features/timekeeping/types";

interface TopbarTimekeepingButtonProps {
  /** When provided the pill opens the check-in/out dialog directly (one tap). */
  attendancePolicy?: AttendanceVerificationPolicy;
  hasOpenEntry?: boolean;
  openEntryId?: string | null;
}

const pillClassName =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-action-primary px-3 text-control font-medium text-white shadow-[var(--action-primary-shadow)] hover:bg-action-primary-hover hover:text-white focus:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus sm:px-[14px]";

export function TopbarTimekeepingButton({
  attendancePolicy,
  hasOpenEntry = false,
  openEntryId = null,
}: TopbarTimekeepingButtonProps) {
  const label = hasOpenEntry ? "Đang chấm công" : "Chấm công";
  const title = hasOpenEntry
    ? "Đang trong ca chấm công - Ra ca"
    : "Chấm công ngay";

  const content = (
    <>
      <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
      <span className="sr-only font-semibold text-white sm:not-sr-only">{label}</span>
      {hasOpenEntry ? (
        <span
          aria-hidden="true"
          className="relative flex h-2 w-2 shrink-0 items-center justify-center"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      ) : null}
    </>
  );

  if (attendancePolicy) {
    return (
      <TimekeepingEntryDialog
        attendancePolicy={attendancePolicy}
        operation={hasOpenEntry ? "check-out" : "check-in"}
        timeEntryId={hasOpenEntry && openEntryId ? openEntryId : undefined}
        triggerChildren={content}
        triggerClassName={pillClassName}
        triggerTitle={title}
      />
    );
  }

  return (
    <Link aria-label={title} className={pillClassName} href="/timekeeping" title={title}>
      {content}
    </Link>
  );
}
