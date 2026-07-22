"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  attendanceKindMeta,
  attendanceStatusMeta,
} from "@/features/students/detail/helpers";
import type {
  DetailAttendanceKind,
  DetailAttendanceStatus,
  StudentAttendanceRecord,
} from "@/features/students/detail/types";

interface StudentAttendanceTabProps {
  records: StudentAttendanceRecord[];
}

export function StudentAttendanceTab({ records }: StudentAttendanceTabProps) {
  const [status, setStatus] = useState<"all" | DetailAttendanceStatus>("all");
  const [kind, setKind] = useState<"all" | DetailAttendanceKind>("all");

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const matchesStatus = status === "all" || record.status === status;
        const matchesKind = kind === "all" || record.kind === kind;

        return matchesStatus && matchesKind;
      }),
    [kind, records, status],
  );

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Điểm danh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
              Khoảng ngày
              <input
                className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink"
                readOnly
                value="10/07/2026 - 19/07/2026"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
              Trạng thái
              <select
                className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink"
                onChange={(event) =>
                  setStatus(event.target.value as "all" | DetailAttendanceStatus)
                }
                value={status}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="present">Có mặt</option>
                <option value="excused_absence">Vắng CP</option>
                <option value="unexcused_absence">Vắng KP</option>
                <option value="additional_study">Học thêm</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
              Loại buổi
              <select
                className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink"
                onChange={(event) =>
                  setKind(event.target.value as "all" | DetailAttendanceKind)
                }
                value={kind}
              >
                <option value="all">Học chính/học thêm</option>
                <option value="main">Học chính</option>
                <option value="additional">Học thêm</option>
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="hidden max-w-full overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
        <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
            <tr>
              <TableHeader>Ngày</TableHeader>
              <TableHeader>Lớp</TableHeader>
              <TableHeader>Buổi số</TableHeader>
              <TableHeader>Loại</TableHeader>
              <TableHeader>Trạng thái</TableHeader>
              <TableHeader>Hình thức thực tế</TableHeader>
              <TableHeader>Số buổi bị trừ</TableHeader>
              <TableHeader>Người điểm danh</TableHeader>
              <TableHeader>Cập nhật muộn</TableHeader>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr className="hover:bg-[#F8FAFF]" key={record.id}>
                <TableCell>{record.date}</TableCell>
                <TableCell>{record.className}</TableCell>
                <TableCell>Buổi {record.sessionNumber}</TableCell>
                <TableCell>{attendanceKindMeta[record.kind]}</TableCell>
                <TableCell>
                  <AttendanceStatusBadge status={record.status} />
                </TableCell>
                <TableCell>
                  {record.actualMode === "online" ? "Online" : "Offline"}
                </TableCell>
                <TableCell>{record.deductedSessions}</TableCell>
                <TableCell>{record.markedBy}</TableCell>
                <TableCell>
                  <Badge tone={record.isLateUpdate ? "warning" : "neutral"}>
                    {record.isLateUpdate ? "Có" : "Không"}
                  </Badge>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filteredRecords.map((record) => (
          <article
            className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card"
            key={record.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">{record.date}</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {record.className} · Buổi {record.sessionNumber}
                </p>
              </div>
              <AttendanceStatusBadge status={record.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Info label="Loại" value={attendanceKindMeta[record.kind]} />
              <Info
                label="Hình thức"
                value={record.actualMode === "online" ? "Online" : "Offline"}
              />
              <Info label="Trừ buổi" value={String(record.deductedSessions)} />
              <Info label="Người điểm danh" value={record.markedBy} />
              <Info
                label="Cập nhật muộn"
                value={record.isLateUpdate ? "Có" : "Không"}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AttendanceStatusBadge({
  status,
}: {
  status: DetailAttendanceStatus;
}) {
  const meta = attendanceStatusMeta[status];

  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b border-hairline px-4 py-3 font-semibold">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return (
    <td className="border-b border-hairline px-4 py-3 align-middle text-ink">
      {children}
    </td>
  );
}
