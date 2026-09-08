"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { useAttendanceHeartbeat } from "@/features/timekeeping/hooks/use-attendance-heartbeat";

interface AttendanceHeartbeatWatcherProps {
  activeSessionId: string | null;
}

export function AttendanceHeartbeatWatcher({
  activeSessionId,
}: AttendanceHeartbeatWatcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [closedNotification, setClosedNotification] = useState<string | null>(null);

  // When on /timekeeping, MyTimekeepingPanel handles the heartbeat with live status UI.
  // When anywhere else in the app, this background watcher maintains continuous geofence tracking.
  const isTimekeepingPage = pathname === "/timekeeping";
  const shouldTrack = Boolean(activeSessionId) && !isTimekeepingPage;

  const { status } = useAttendanceHeartbeat({
    activeSessionId: shouldTrack ? activeSessionId : null,
    enabled: shouldTrack,
    onSessionClosed: (result) => {
      const message =
        ("messageVi" in result && result.messageVi) ||
        "Bạn đã rời khỏi khu vực Trung tâm. Hệ thống đã tự động kết thúc ca chấm công.";
      setClosedNotification(message);
      router.refresh();
    },
  });

  if (!closedNotification) {
    return null;
  }

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border border-danger/30 bg-white p-4 shadow-xl text-ink animate-in fade-in slide-in-from-bottom-5"
      role="alert"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
        <AlertTriangle size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-display text-sm font-bold text-ink">
          Tự động ngắt chấm công
        </h4>
        <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
          {closedNotification}
        </p>
      </div>
      <button
        aria-label="Đóng thông báo"
        className="text-ink-subtle hover:text-ink"
        onClick={() => setClosedNotification(null)}
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}
