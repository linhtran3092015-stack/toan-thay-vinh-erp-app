import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { UnlockedSessionQueue } from "@/features/sessions/components/unlocked-session-queue";
import { getSessionDirectory } from "@/features/sessions/data";
import { SESSION_QUEUE_LIMIT, type SessionQueueStatus } from "@/features/sessions/session-directory-models";
import { parseSessionAttendanceFilter, parseSessionDirectoryViewState } from "@/features/sessions/session-directory-url-state";
import { getUnlockedSessionQueueResult } from "@/features/sessions/unlocked-sessions-data";
import { SessionListPage } from "@/features/sessions/session-list-page";
import { getVietnamTime, getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";

interface SessionsRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SessionsRoute({ searchParams }: SessionsRouteProps) {
  const resolvedSearchParams = await searchParams;
  const requestParams = new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  );
  // Only real calendar dates bound the query (the same validation as the list's URL state).
  const { filters: requested } = parseSessionDirectoryViewState(requestParams, []);

  // The "Chờ khóa" (completed, unlocked) and "Chưa điểm danh" sets only hold sessions on or
  // before today. Their undated form (the stored daily lock-queue digest links to
  // `status=completed&lock=unlocked`) would spend the newest-first row cap on scheduled future
  // sessions, so it is bounded at today first: the chips write the same `…&to=<today>`.
  const isUntilTodaySet =
    (requested.status === "completed" && requested.lock === "unlocked") ||
    parseSessionAttendanceFilter(requestParams) === "missing";
  if (isUntilTodaySet && !requested.dateFrom && !requested.dateTo) {
    requestParams.set("to", getVietnamToday());
    redirect(`/sessions?${requestParams.toString()}`);
  }
  const dateFrom = requested.dateFrom || null;
  const dateTo = requested.dateTo || null;

  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập buổi học."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "sessions.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("sessions.view")}
        title="Không có quyền xem buổi học"
      />
    );
  }

  const permissions = permissionResult.permissions;

  const canViewAttendance =
    permissions.includes(
      "attendance.view",
    );

  const canViewResults =
    permissions.includes(
      "results.view",
    );

  const canLock = permissions.includes("sessions.lock");
  const canMarkAttendance = permissions.includes("attendance.mark");

  // One instant for both, so the date and the time never straddle midnight.
  const now = new Date();
  const today = getVietnamToday(now);

  // A requested range bounds the query before the row cap, so the range is read in full.
  const [directoryResult, queueResult] = await Promise.all([
    getSessionDirectory({
      dateFrom,
      dateTo,
      includeAttendanceCounts:
        canViewAttendance,
      includeResultCounts: canViewResults,
    }),
    // The RPC's maximum (oldest completed first); the dashboard reads its own, smaller cap.
    getUnlockedSessionQueueResult(SESSION_QUEUE_LIMIT),
  ]);

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={
          directoryResult.error.message
        }
        title="Không tải được danh sách buổi học"
      />
    );
  }

  // A failed queue leaves every completed, unlocked row unknown; a full page may miss the newest ones.
  const queueStatus: SessionQueueStatus = !queueResult.ok
    ? "failed"
    : queueResult.data.items.length >= SESSION_QUEUE_LIMIT
      ? "partial"
      : "ok";

  return (
    <Suspense>
      <SessionListPage
        canLock={canLock}
        canManageSessions={
          permissions.includes(
            "sessions.manage",
          )
        }
        canMarkAttendance={canMarkAttendance}
        canViewAttendance={canViewAttendance}
        canViewClasses={permissions.includes("classes.view")}
        canViewResults={canViewResults}
        loadedRange={{ dateFrom, dateTo }}
        nowTime={getVietnamTime(now)}
        queueItems={
          queueResult.ok
            ? queueResult.data.items.map(({ id, missingAttendanceCount, rosterCount }) => ({ id, missingAttendanceCount, rosterCount }))
            : undefined
        }
        queuePanel={
          queueResult.ok ? (
            <UnlockedSessionQueue
              canLock={canLock}
              canMarkAttendance={canMarkAttendance}
              limit={SESSION_QUEUE_LIMIT}
              queue={queueResult.data}
              today={today}
            />
          ) : null
        }
        queueStatus={queueStatus}
        sessions={directoryResult.sessions}
        today={today}
      />
    </Suspense>
  );
}
