"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClassDirectoryItem } from "@/features/classes/read-models";

interface ClassListPageProps {
  classes: ClassDirectoryItem[];
}

interface ClassFiltersState {
  academicYear: string;
  grade: string;
  level: string;
  mode: string;
  search: string;
  status: string;
}

const PAGE_SIZE = 20;

const defaultFilters: ClassFiltersState = {
  academicYear: "all",
  grade: "all",
  level: "all",
  mode: "all",
  search: "",
  status: "all",
};

export function ClassListPage({
  classes,
}: ClassListPageProps) {
  const [filters, setFilters] =
    useState<ClassFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);

  const academicYears = useMemo(
    () =>
      Array.from(
        new Set(
          classes
            .map((item) => item.academicYear?.code)
            .filter(
              (value): value is string =>
                typeof value === "string",
            ),
        ),
      ).sort((left, right) =>
        right.localeCompare(left, "vi"),
      ),
    [classes],
  );

  const filteredClasses = useMemo(() => {
    const search = normalize(filters.search);

    return classes.filter((item) => {
      const matchesSearch =
        search.length === 0 ||
        normalize(item.code).includes(search) ||
        normalize(item.name).includes(search);

      const matchesAcademicYear =
        filters.academicYear === "all" ||
        item.academicYear?.code === filters.academicYear;

      const matchesGrade =
        filters.grade === "all" ||
        String(item.grade) === filters.grade;

      const matchesLevel =
        filters.level === "all" ||
        item.level === filters.level;

      const matchesMode =
        filters.mode === "all" ||
        item.defaultLearningMode === filters.mode;

      const matchesStatus =
        filters.status === "all" ||
        item.status === filters.status;

      return (
        matchesSearch &&
        matchesAcademicYear &&
        matchesGrade &&
        matchesLevel &&
        matchesMode &&
        matchesStatus
      );
    });
  }, [classes, filters]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredClasses.length / PAGE_SIZE),
  );

  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const rows = filteredClasses.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const updateFilter = (
    key: keyof ClassFiltersState,
    value: string,
  ) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) =>
      key === "search"
        ? value.trim().length > 0
        : value !== "all",
  );

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Lớp học &amp; Lịch học
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Hiển thị {filteredClasses.length} trên tổng số{" "}
            {classes.length} lớp.
          </p>
        </div>

        <Badge tone="info">
          Dữ liệu Supabase
        </Badge>
      </section>

      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(5,minmax(130px,1fr))_auto]">
          <FilterLabel label="Tìm kiếm">
            <input
              className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
              onChange={(event) =>
                updateFilter("search", event.target.value)
              }
              placeholder="Tên lớp hoặc mã lớp"
              type="search"
              value={filters.search}
            />
          </FilterLabel>

          <FilterSelect
            label="Năm học"
            onChange={(value) =>
              updateFilter("academicYear", value)
            }
            value={filters.academicYear}
          >
            <option value="all">Tất cả năm học</option>
            {academicYears.map((academicYear) => (
              <option
                key={academicYear}
                value={academicYear}
              >
                {academicYear}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Khối"
            onChange={(value) =>
              updateFilter("grade", value)
            }
            value={filters.grade}
          >
            <option value="all">Khối 1–12</option>
            {Array.from({ length: 12 }).map(
              (_, index) => (
                <option
                  key={index + 1}
                  value={String(index + 1)}
                >
                  Khối {index + 1}
                </option>
              ),
            )}
          </FilterSelect>

          <FilterSelect
            label="Mức"
            onChange={(value) =>
              updateFilter("level", value)
            }
            value={filters.level}
          >
            <option value="all">A/B/CLC</option>
            <option value="A">Mức A</option>
            <option value="B">Mức B</option>
            <option value="CLC">CLC</option>
          </FilterSelect>

          <FilterSelect
            label="Hình thức"
            onChange={(value) =>
              updateFilter("mode", value)
            }
            value={filters.mode}
          >
            <option value="all">Tất cả</option>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
            <option value="hybrid">Kết hợp</option>
          </FilterSelect>

          <FilterSelect
            label="Trạng thái"
            onChange={(value) =>
              updateFilter("status", value)
            }
            value={filters.status}
          >
            <option value="all">Tất cả</option>
            <option value="draft">Nháp</option>
            <option value="active">Đang hoạt động</option>
            <option value="closed">Đã đóng</option>
            <option value="archived">Lưu trữ</option>
          </FilterSelect>

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

      {filteredClasses.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline bg-surface-1 p-8 text-center shadow-card">
          <h2 className="font-semibold text-ink">
            Không có lớp phù hợp
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Chưa có lớp học hoặc không có lớp nào khớp
            với bộ lọc hiện tại.
          </p>
        </section>
      ) : (
        <>
          <ClassTable classes={rows} />

          <div className="grid gap-3 lg:hidden">
            {rows.map((item) => (
              <ClassMobileCard
                item={item}
                key={item.id}
              />
            ))}
          </div>

          <Pagination
            page={safePage}
            pageCount={pageCount}
            setPage={setPage}
            start={
              filteredClasses.length === 0
                ? 0
                : startIndex + 1
            }
            end={Math.min(
              startIndex + PAGE_SIZE,
              filteredClasses.length,
            )}
            total={filteredClasses.length}
          />
        </>
      )}
    </div>
  );
}

function ClassTable({
  classes,
}: {
  classes: ClassDirectoryItem[];
}) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
      <table className="min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
          <tr>
            <TableHeader>Mã lớp</TableHeader>
            <TableHeader>Tên lớp</TableHeader>
            <TableHeader>Năm học</TableHeader>
            <TableHeader>Khối</TableHeader>
            <TableHeader>Mức</TableHeader>
            <TableHeader>Hình thức</TableHeader>
            <TableHeader>Số buổi/tuần</TableHeader>
            <TableHeader>Lịch hiệu lực</TableHeader>
            <TableHeader>Học viên</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader className="text-right">
              Thao tác
            </TableHeader>
          </tr>
        </thead>

        <tbody>
          {classes.map((item) => (
            <tr
              className="transition hover:bg-[#F8FAFF]"
              key={item.id}
            >
              <TableCell>
                <span className="font-mono text-xs font-semibold">
                  {item.code}
                </span>
              </TableCell>

              <TableCell>
                <Link
                  className="font-semibold text-primary hover:underline"
                  href={`/classes/${item.id}`}
                >
                  {item.name}
                </Link>
              </TableCell>

              <TableCell>
                {item.academicYear?.code ??
                  "Chưa xác định"}
              </TableCell>

              <TableCell>Khối {item.grade}</TableCell>

              <TableCell>
                <Badge
                  tone={
                    item.level === "CLC"
                      ? "purple"
                      : "neutral"
                  }
                >
                  {item.level}
                </Badge>
              </TableCell>

              <TableCell>
                <ModeBadge
                  mode={item.defaultLearningMode}
                />
              </TableCell>

              <TableCell>
                {item.weeklySessionCount}
              </TableCell>

              <TableCell>
                {item.activeScheduleCount}
              </TableCell>

              <TableCell>
                {item.activeStudentCount ?? "Không có quyền"}
              </TableCell>

              <TableCell>
                <ClassStatusBadge status={item.status} />
              </TableCell>

              <TableCell className="text-right">
                <Link
                  className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold text-ink-muted hover:bg-canvas hover:text-ink"
                  href={`/classes/${item.id}`}
                >
                  Xem
                </Link>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassMobileCard({
  item,
}: {
  item: ClassDirectoryItem;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            className="font-semibold text-primary hover:underline"
            href={`/classes/${item.id}`}
          >
            {item.name}
          </Link>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {item.code}
          </p>
        </div>

        <ClassStatusBadge status={item.status} />
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <InfoLine
          label="Năm học"
          value={
            item.academicYear?.code ?? "Chưa xác định"
          }
        />
        <InfoLine
          label="Khối & mức"
          value={`Khối ${item.grade} · ${item.level}`}
        />
        <InfoLine
          label="Lịch đang hiệu lực"
          value={String(item.activeScheduleCount)}
        />
        <InfoLine
          label="Học viên đang học"
          value={
            item.activeStudentCount === null
              ? "Không có quyền"
              : String(item.activeStudentCount)
          }
        />
      </div>

      <Link
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-ink hover:border-secondary hover:bg-canvas"
        href={`/classes/${item.id}`}
      >
        Xem lớp học
      </Link>
    </article>
  );
}

function ModeBadge({
  mode,
}: {
  mode: ClassDirectoryItem["defaultLearningMode"];
}) {
  const label =
    mode === "online"
      ? "Online"
      : mode === "offline"
        ? "Offline"
        : "Kết hợp";

  return (
    <Badge
      tone={
        mode === "online"
          ? "purple"
          : mode === "offline"
            ? "info"
            : "warning"
      }
    >
      {label}
    </Badge>
  );
}

function ClassStatusBadge({
  status,
}: {
  status: string;
}) {
  const metadata: Record<
    string,
    {
      label: string;
      tone:
        | "info"
        | "neutral"
        | "success"
        | "warning";
    }
  > = {
    active: {
      label: "Đang hoạt động",
      tone: "success",
    },
    archived: {
      label: "Lưu trữ",
      tone: "neutral",
    },
    closed: {
      label: "Đã đóng",
      tone: "neutral",
    },
    draft: {
      label: "Nháp",
      tone: "warning",
    },
  };

  const value = metadata[status] ?? {
    label: status,
    tone: "neutral" as const,
  };

  return (
    <Badge tone={value.tone}>{value.label}</Badge>
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
      {label}
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
        className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
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

function TableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-hairline px-4 py-3 font-semibold ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-hairline px-4 py-3 align-middle text-ink ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

function Pagination({
  end,
  page,
  pageCount,
  setPage,
  start,
  total,
}: {
  end: number;
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  start: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm shadow-card md:flex-row md:items-center md:justify-between">
      <p className="text-ink-muted">
        Hiển thị {start}-{end} của {total} lớp · Trang{" "}
        {page}/{pageCount}
      </p>

      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          variant="outline"
        >
          Trước
        </Button>

        <Button
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
          variant="outline"
        >
          Sau
        </Button>
      </div>
    </div>
  );
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
