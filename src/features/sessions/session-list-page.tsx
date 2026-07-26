"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  SessionDirectoryItem,
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";

interface SessionListPageProps {
  canManageSessions: boolean;
  canViewAttendance: boolean;
  canViewResults: boolean;
  sessions: SessionDirectoryItem[];
}

interface SessionFiltersState {
  classId: string;
  dateFrom: string;
  dateTo: string;
  kind: string;
  search: string;
  status: string;
}

const PAGE_SIZE = 20;

const defaultFilters: SessionFiltersState = {
  classId: "all",
  dateFrom: "",
  dateTo: "",
  kind: "all",
  search: "",
  status: "all",
};

export function SessionListPage({
  canManageSessions,
  canViewAttendance,
  canViewResults,
  sessions,
}: SessionListPageProps) {
  const [filters, setFilters] =
    useState<SessionFiltersState>(
      defaultFilters,
    );

  const [page, setPage] = useState(1);

  const classOptions = useMemo(() => {
    const classes = new Map<
      string,
      {
        code: string;
        name: string;
      }
    >();

    for (const session of sessions) {
      classes.set(session.classId, {
        code: session.classCode,
        name: session.className,
      });
    }

    return Array.from(classes.entries()).sort(
      ([, left], [, right]) =>
        left.code.localeCompare(
          right.code,
          "vi",
        ),
    );
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const search = normalize(filters.search);

    return sessions.filter((session) => {
      const matchesSearch =
        search.length === 0 ||
        normalize(session.classCode).includes(
          search,
        ) ||
        normalize(session.className).includes(
          search,
        ) ||
        normalize(
          session.componentCode ?? "",
        ).includes(search);

      const matchesClass =
        filters.classId === "all" ||
        session.classId === filters.classId;

      const matchesStatus =
        filters.status === "all" ||
        session.status === filters.status;

      const matchesKind =
        filters.kind === "all" ||
        session.sessionKind === filters.kind;

      const matchesDateFrom =
        filters.dateFrom.length === 0 ||
        session.sessionDate >= filters.dateFrom;

      const matchesDateTo =
        filters.dateTo.length === 0 ||
        session.sessionDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesClass &&
        matchesStatus &&
        matchesKind &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters, sessions]);

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredSessions.length / PAGE_SIZE,
    ),
  );

  const safePage = Math.min(page, pageCount);
  const startIndex =
    (safePage - 1) * PAGE_SIZE;

  const rows = filteredSessions.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const updateFilter = (
    key: keyof SessionFiltersState,
    value: string,
  ) => {
    setPage(1);

    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const hasActiveFilters =
    Object.entries(filters).some(
      ([key, value]) =>
        ["classId", "kind", "status"].includes(
          key,
        )
          ? value !== "all"
          : value.trim().length > 0,
    );

  const scheduledCount = sessions.filter(
    (session) =>
      session.status === "scheduled",
  ).length;

  const inProgressCount = sessions.filter(
    (session) =>
      session.status === "in_progress",
  ).length;

  const completedCount = sessions.filter(
    (session) =>
      session.status === "completed",
  ).length;

  const lockedCount = sessions.filter(
    (session) => session.lockedAt !== null,
  ).length;

  return (
    <div className="grid min-w-0 gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Buổi học
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Hiển thị {filteredSessions.length} trên
            tổng số {sessions.length} buổi gần nhất.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageSessions ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
              href="/sessions/new"
            >
              Tạo buổi học
            </Link>
          ) : null}

          <Badge
            tone={
              canManageSessions
                ? "success"
                : "neutral"
            }
          >
            {canManageSessions
              ? "Có quyền quản lý"
              : "Chỉ được xem"}
          </Badge>

          <Badge tone="info">
            Dữ liệu Supabase
          </Badge>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Đã lên lịch"
          value={scheduledCount}
        />

        <SummaryCard
          label="Đang học"
          value={inProgressCount}
        />

        <SummaryCard
          label="Đã hoàn thành"
          value={completedCount}
        />

        <SummaryCard
          label="Đã khóa"
          value={lockedCount}
        />
      </section>

      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(5,minmax(135px,1fr))_auto]">
          <FilterLabel label="Tìm kiếm">
            <input
              className={inputClassName}
              onChange={(event) =>
                updateFilter(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Tên lớp, mã lớp, thành phần"
              type="search"
              value={filters.search}
            />
          </FilterLabel>

          <FilterSelect
            label="Lớp"
            onChange={(value) =>
              updateFilter("classId", value)
            }
            value={filters.classId}
          >
            <option value="all">
              Tất cả lớp
            </option>

            {classOptions.map(
              ([classId, classData]) => (
                <option
                  key={classId}
                  value={classId}
                >
                  {classData.code} –{" "}
                  {classData.name}
                </option>
              ),
            )}
          </FilterSelect>

          <FilterSelect
            label="Trạng thái"
            onChange={(value) =>
              updateFilter("status", value)
            }
            value={filters.status}
          >
            <option value="all">
              Tất cả trạng thái
            </option>
            <option value="scheduled">
              Đã lên lịch
            </option>
            <option value="in_progress">
              Đang học
            </option>
            <option value="completed">
              Đã hoàn thành
            </option>
            <option value="cancelled">
              Đã hủy
            </option>
          </FilterSelect>

          <FilterSelect
            label="Loại buổi"
            onChange={(value) =>
              updateFilter("kind", value)
            }
            value={filters.kind}
          >
            <option value="all">
              Tất cả loại
            </option>
            <option value="regular">
              Buổi chính
            </option>
            <option value="makeup">
              Buổi bù
            </option>
            <option value="additional">
              Buổi bổ sung
            </option>
          </FilterSelect>

          <FilterLabel label="Từ ngày">
            <input
              className={inputClassName}
              onChange={(event) =>
                updateFilter(
                  "dateFrom",
                  event.target.value,
                )
              }
              type="date"
              value={filters.dateFrom}
            />
          </FilterLabel>

          <FilterLabel label="Đến ngày">
            <input
              className={inputClassName}
              onChange={(event) =>
                updateFilter(
                  "dateTo",
                  event.target.value,
                )
              }
              type="date"
              value={filters.dateTo}
            />
          </FilterLabel>

          <div className="flex items-end">
            <Button
              className="min-h-11 w-full"
              disabled={!hasActiveFilters}
              onClick={() => {
                setFilters(defaultFilters);
                setPage(1);
              }}
              variant="ghost"
            >
              Xóa lọc
            </Button>
          </div>
        </div>
      </section>

      {filteredSessions.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline bg-surface-1 p-8 text-center shadow-card">
          <h2 className="font-semibold text-ink">
            Không có buổi học phù hợp
          </h2>

          <p className="mt-2 text-sm text-ink-muted">
            Thay đổi điều kiện lọc hoặc tạo buổi
            học mới khi chức năng quản lý được mở.
          </p>
        </section>
      ) : (
        <>
          <SessionDesktopTable
            canViewAttendance={
              canViewAttendance
            }
            canViewResults={canViewResults}
            sessions={rows}
          />

          <div className="grid gap-3 md:hidden">
            {rows.map((session) => (
              <SessionMobileCard
                canViewAttendance={
                  canViewAttendance
                }
                canViewResults={
                  canViewResults
                }
                key={session.id}
                session={session}
              />
            ))}
          </div>

          <Pagination
            onPageChange={setPage}
            page={safePage}
            pageCount={pageCount}
          />
        </>
      )}
    </div>
  );
}

function SessionDesktopTable({
  canViewAttendance,
  canViewResults,
  sessions,
}: {
  canViewAttendance: boolean;
  canViewResults: boolean;
  sessions: SessionDirectoryItem[];
}) {
  return (
    <section className="hidden overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] border-collapse text-left text-sm">
          <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">
                Ngày và giờ
              </th>
              <th className="px-4 py-3">
                Lớp học
              </th>
              <th className="px-4 py-3">
                Loại buổi
              </th>
              <th className="px-4 py-3">
                Hình thức
              </th>
              <th className="px-4 py-3">
                Trạng thái
              </th>

              {canViewAttendance ? (
                <th className="px-4 py-3">
                  Điểm danh
                </th>
              ) : null}

              {canViewResults ? (
                <th className="px-4 py-3">
                  Kết quả
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {sessions.map((session) => (
              <tr
                className="border-t border-hairline align-top"
                key={session.id}
              >
                <td className="whitespace-nowrap px-4 py-4">
                  <Link
                    className="font-semibold text-primary hover:underline"
                    href={`/sessions/${session.id}`}
                  >
                    {formatDate(
                      session.sessionDate,
                    )}
                  </Link>

                  <p className="mt-1 text-xs text-ink-muted">
                    {formatTime(
                      session.startTime,
                    )}
                    {" – "}
                    {formatTime(session.endTime)}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <Link
                    className="font-semibold text-primary hover:underline"
                    href={`/classes/${session.classId}`}
                  >
                    {session.classCode}
                  </Link>

                  <p className="mt-1 text-xs text-ink-muted">
                    {session.className}
                  </p>

                  <p className="mt-1 text-xs text-ink-muted">
                    Khối {session.grade} · Mức{" "}
                    {session.level}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <SessionKindBadge
                    kind={session.sessionKind}
                  />

                  {session.componentCode ? (
                    <p className="mt-2 font-mono text-xs text-ink-muted">
                      {session.componentCode}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-4">
                  <p className="font-medium text-ink">
                    {formatMode(
                      session.learningMode,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-ink-muted">
                    {session.roomName ??
                      "Chưa có phòng"}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <SessionStatusBadge
                    lockedAt={session.lockedAt}
                    status={session.status}
                  />
                </td>

                {canViewAttendance ? (
                  <td className="px-4 py-4 font-semibold text-ink">
                    {session.attendanceCount ?? 0}
                  </td>
                ) : null}

                {canViewResults ? (
                  <td className="px-4 py-4 font-semibold text-ink">
                    {session.resultCount ?? 0}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SessionMobileCard({
  canViewAttendance,
  canViewResults,
  session,
}: {
  canViewAttendance: boolean;
  canViewResults: boolean;
  session: SessionDirectoryItem;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            className="font-semibold text-primary hover:underline"
            href={`/sessions/${session.id}`}
          >
            {formatDate(session.sessionDate)}
          </Link>

          <p className="mt-1 text-xs text-ink-muted">
            {formatTime(session.startTime)}
            {" – "}
            {formatTime(session.endTime)}
          </p>
        </div>

        <SessionStatusBadge
          lockedAt={session.lockedAt}
          status={session.status}
        />
      </div>

      <div className="mt-4">
        <Link
          className="font-semibold text-primary hover:underline"
          href={`/classes/${session.classId}`}
        >
          {session.classCode}
        </Link>

        <p className="mt-1 text-sm text-ink-muted">
          {session.className}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <SessionKindBadge
          kind={session.sessionKind}
        />

        <Badge tone="neutral">
          {formatMode(session.learningMode)}
        </Badge>

        {session.componentCode ? (
          <Badge tone="neutral">
            {session.componentCode}
          </Badge>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {canViewAttendance ? (
          <InfoItem
            label="Điểm danh"
            value={String(
              session.attendanceCount ?? 0,
            )}
          />
        ) : null}

        {canViewResults ? (
          <InfoItem
            label="Kết quả"
            value={String(
              session.resultCount ?? 0,
            )}
          />
        ) : null}

        <InfoItem
          label="Phòng học"
          value={
            session.roomName ??
            "Chưa xác định"
          }
        />
      </dl>
    </article>
  );
}

function SessionStatusBadge({
  lockedAt,
  status,
}: {
  lockedAt: string | null;
  status: SessionStatus;
}) {
  if (lockedAt) {
    return (
      <Badge tone="neutral">
        Đã khóa
      </Badge>
    );
  }

  switch (status) {
    case "scheduled":
      return (
        <Badge tone="purple">
          Đã lên lịch
        </Badge>
      );

    case "in_progress":
      return (
        <Badge tone="info">
          Đang học
        </Badge>
      );

    case "completed":
      return (
        <Badge tone="success">
          Đã hoàn thành
        </Badge>
      );

    case "cancelled":
      return (
        <Badge tone="neutral">
          Đã hủy
        </Badge>
      );
  }
}

function SessionKindBadge({
  kind,
}: {
  kind: SessionKind;
}) {
  const labels: Record<SessionKind, string> = {
    additional: "Buổi bổ sung",
    makeup: "Buổi bù",
    regular: "Buổi chính",
  };

  return (
    <Badge
      tone={
        kind === "regular"
          ? "info"
          : "neutral"
      }
    >
      {labels[kind]}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm font-medium text-ink-muted">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-ink">
        {value}
      </p>
    </section>
  );
}

function FilterLabel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FilterLabel label={label}>
      <select
        className={inputClassName}
        onChange={(event) =>
          onChange(event.target.value)
        }
        value={value}
      >
        {children}
      </select>
    </FilterLabel>
  );
}

function Pagination({
  onPageChange,
  page,
  pageCount,
}: {
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-3 shadow-card">
      <p className="text-sm text-ink-muted">
        Trang {page} / {pageCount}
      </p>

      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          onClick={() =>
            onPageChange(page - 1)
          }
          variant="ghost"
        >
          Trang trước
        </Button>

        <Button
          disabled={page >= pageCount}
          onClick={() =>
            onPageChange(page + 1)
          }
          variant="ghost"
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">
        {value}
      </dd>
    </div>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    year: "numeric",
  }).format(
    new Date(`${value}T00:00:00+07:00`),
  );
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatMode(
  value: SessionLearningMode,
): string {
  const labels: Record<
    SessionLearningMode,
    string
  > = {
    hybrid: "Kết hợp",
    offline: "Offline",
    online: "Online",
  };

  return labels[value];
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20";
