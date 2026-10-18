import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { SESSION_EXPORT_LIMIT } from "@/features/reports/catalog";
import {
  createSessionsCsv,
  filterSessionsForExport,
  type SessionExportFilters,
} from "@/features/reports/session-export";
import { getSessionDirectory } from "@/features/sessions/data";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";

export const dynamic = "force-dynamic";

const allowedQueryKeys =
  new Set(["dateFrom", "dateTo"]);

export async function GET(
  request: NextRequest,
) {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    const status =
      permissionResult.error.code ===
      "not_authenticated"
        ? 401
        : 503;

    return errorResponse(
      status === 401
        ? "Bạn cần đăng nhập để xuất báo cáo."
        : "Không thể kiểm tra quyền xuất báo cáo.",
      status,
    );
  }

  const permissions =
    permissionResult.permissions;

  if (
    !permissions.includes("reports.view") ||
    !permissions.includes("sessions.view")
  ) {
    return errorResponse(
      "Tài khoản không có quyền xuất báo cáo này.",
      403,
    );
  }

  const filterResult = parseFilters(
    request.nextUrl.searchParams,
  );

  if (!filterResult.ok) {
    return errorResponse(
      "Bộ lọc báo cáo không hợp lệ.",
      400,
    );
  }

  const includeAttendanceCounts =
    permissions.includes("attendance.view");

  const includeResultCounts =
    permissions.includes("results.view");

  // Filter in the query so older date ranges are not cut off by the
  // directory's newest-first row limit.
  const directoryResult =
    await getSessionDirectory({
      dateFrom: filterResult.filters.dateFrom,
      dateTo: filterResult.filters.dateTo,
      includeAttendanceCounts,
      includeResultCounts,
      limit: SESSION_EXPORT_LIMIT,
    });

  if (!directoryResult.ok) {
    return errorResponse(
      "Không thể đọc dữ liệu buổi học.",
      500,
    );
  }

  const sessions =
    filterSessionsForExport(
      directoryResult.sessions,
      filterResult.filters,
    );

  const csv = createSessionsCsv(
    sessions,
    {
      includeAttendanceCounts,
      includeResultCounts,
    },
  );

  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition":
        'attachment; filename="bao-cao-buoi-hoc.csv"',
      "Content-Type":
        "text/csv; charset=utf-8",
      "X-Content-Type-Options":
        "nosniff",
    },
    status: 200,
  });
}

type FilterParseResult =
  | {
      filters: SessionExportFilters;
      ok: true;
    }
  | {
      ok: false;
    };

function parseFilters(
  searchParams: URLSearchParams,
): FilterParseResult {
  for (const key of searchParams.keys()) {
    if (!allowedQueryKeys.has(key)) {
      return { ok: false };
    }
  }

  const dateFromValues =
    searchParams.getAll("dateFrom");

  const dateToValues =
    searchParams.getAll("dateTo");

  if (
    dateFromValues.length > 1 ||
    dateToValues.length > 1
  ) {
    return { ok: false };
  }

  const dateFrom =
    normalizeOptionalDate(
      dateFromValues[0],
    );

  const dateTo =
    normalizeOptionalDate(
      dateToValues[0],
    );

  if (
    dateFrom === undefined ||
    dateTo === undefined
  ) {
    return { ok: false };
  }

  if (
    dateFrom !== null &&
    dateTo !== null &&
    dateFrom > dateTo
  ) {
    return { ok: false };
  }

  return {
    filters: {
      dateFrom,
      dateTo,
    },
    ok: true,
  };
}

function normalizeOptionalDate(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return isIsoCalendarDate(normalized)
    ? normalized
    : undefined;
}

function isIsoCalendarDate(
  value: string,
): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function errorResponse(
  message: string,
  status: number,
) {
  return NextResponse.json(
    { error: message },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options":
          "nosniff",
      },
      status,
    },
  );
}
