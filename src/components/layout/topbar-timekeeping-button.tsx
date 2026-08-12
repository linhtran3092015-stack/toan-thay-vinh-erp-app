"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

interface TopbarTimekeepingButtonProps {
  hasOpenEntry?: boolean;
}

export function TopbarTimekeepingButton({
  hasOpenEntry = false,
}: TopbarTimekeepingButtonProps) {
  const label = hasOpenEntry ? "Đang chấm công" : "Chấm công";
  const title = hasOpenEntry
    ? "Đang trong ca chấm công - Xem chi tiết"
    : "Chấm công ngay";

  return (
    <Link
      aria-label={title}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-action-primary px-2.5 text-xs font-semibold text-white transition-colors hover:bg-action-primary-hover hover:text-white focus:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring sm:px-3 sm:text-sm"
      href="/timekeeping"
      title={title}
    >
      <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
      <span className="text-white font-semibold">{label}</span>
      {hasOpenEntry ? (
        <span
          aria-hidden="true"
          className="relative flex h-2 w-2 shrink-0 items-center justify-center"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      ) : null}
    </Link>
  );
}
