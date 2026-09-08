"use client";

import { useId, useState, useTransition } from "react";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  FileSpreadsheet,
  MapPin,
  Plus,
  Search,
  UserCheck,
  Users,
  Wifi,
  X,
} from "lucide-react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AdminAdjustTimeEntryDialog } from "@/features/timekeeping/components/admin-adjust-time-entry-dialog";
import { AdminCreateTimeEntryDialog } from "@/features/timekeeping/components/admin-create-time-entry-dialog";
import {
  fetchCenterMonthlyOverviewAction,
  fetchStaffMonthlyTimesheetAction,
} from "@/features/timekeeping/timekeeping-admin-actions";
import { formatVietnamDate } from "@/features/timekeeping/timekeeping-adjustment-utils";
import type {
  TimekeepingCenterMonthlyOverviewEntry,
  TimekeepingMonthlyEntry,
  TimekeepingStaffOption,
} from "@/features/timekeeping/types";

interface CenterMonthlyTimesheetManagementProps {
  canApproveAdjustments: boolean;
  canManage: boolean;
  initialMonth?: number;
  initialOverview: readonly TimekeepingCenterMonthlyOverviewEntry[];
  initialYear?: number;
  staffOptions: readonly TimekeepingStaffOption[];
}

function formatMinutesToHours(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} phút`;
  if (remainingMinutes === 0) return `${hours} giờ`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimeOnly(isoString: string | null): string {
  if (!isoString) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(isoString));
}

export function CenterMonthlyTimesheetManagement({
  canApproveAdjustments,
  canManage,
  initialMonth,
  initialOverview,
  initialYear,
  staffOptions,
}: CenterMonthlyTimesheetManagementProps) {
  const today = new Date();
  const currentMonth = initialMonth ?? today.getMonth() + 1;
  const currentYear = initialYear ?? today.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [overview, setOverview] = useState<readonly TimekeepingCenterMonthlyOverviewEntry[]>(
    initialOverview,
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal create entry
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [createForStaffId, setCreateForStaffId] = useState<string | undefined>(undefined);

  // Drilldown modal state
  const [activeStaff, setActiveStaff] = useState<TimekeepingCenterMonthlyOverviewEntry | null>(
    null,
  );
  const [staffEntries, setStaffEntries] = useState<readonly TimekeepingMonthlyEntry[]>([]);
  const [isStaffDetailPending, startStaffDetailTransition] = useTransition();

  // Adjust dialog state
  const [entryToAdjust, setEntryToAdjust] = useState<TimekeepingMonthlyEntry | null>(null);

  const loadOverview = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await fetchCenterMonthlyOverviewAction(month, year);
      if (result.ok) {
        setOverview(result.overview);
      } else {
        setErrorMessage(result.error.message);
      }
    });
  };

  const openStaffDetail = (staff: TimekeepingCenterMonthlyOverviewEntry) => {
    setActiveStaff(staff);
    setStaffEntries([]);

    startStaffDetailTransition(async () => {
      const result = await fetchStaffMonthlyTimesheetAction(
        staff.staffId,
        selectedMonth,
        selectedYear,
      );
      if (result.ok) {
        setStaffEntries(result.entries);
      }
    });
  };

  const refreshActiveStaffDetail = () => {
    if (!activeStaff) return;
    // Refresh both staff detail and the overview table
    startStaffDetailTransition(async () => {
      const result = await fetchStaffMonthlyTimesheetAction(
        activeStaff.staffId,
        selectedMonth,
        selectedYear,
      );
      if (result.ok) {
        setStaffEntries(result.entries);
      }
    });

    startTransition(async () => {
      const result = await fetchCenterMonthlyOverviewAction(selectedMonth, selectedYear);
      if (result.ok) {
        setOverview(result.overview);
      }
    });
  };

  // Filter overview by search
  const filteredOverview = overview.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.staffDisplayName.toLowerCase().includes(query) ||
      (item.staffEmployeeCode && item.staffEmployeeCode.toLowerCase().includes(query)) ||
      item.primaryRoleName.toLowerCase().includes(query)
    );
  });

  // KPI Calculations
  const totalStaffCount = overview.length;
  const totalCenterHours = overview.reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(1);
  const totalAutoEnded = overview.reduce((acc, curr) => acc + curr.autoEndedCount, 0);
  const totalPendingAdjustments = overview.reduce(
    (acc, curr) => acc + curr.pendingAdjustmentCount,
    0,
  );

  return (
    <section
      aria-labelledby="center-monthly-timesheet-heading"
      className="grid min-w-0 gap-6 rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6"
    >
      {/* Header with Title, Month/Year and Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-primary" size={22} />
            <h2
              className="font-display text-xl font-bold tracking-tight text-ink"
              id="center-monthly-timesheet-heading"
            >
              Bảng công toàn trung tâm theo tháng
            </h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Theo dõi tổng hợp số ngày, tổng giờ công của toàn bộ nhân sự và điều chỉnh ngày/giờ công trực tiếp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month & Year Selectors */}
          <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-ink-muted">Tháng:</span>
            <select
              aria-label="Chọn tháng quản lý"
              className="cursor-pointer bg-transparent text-sm font-bold text-ink outline-none"
              disabled={isPending}
              onChange={(e) => loadOverview(Number(e.target.value), selectedYear)}
              value={selectedMonth}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-ink-muted">Năm:</span>
            <select
              aria-label="Chọn năm quản lý"
              className="cursor-pointer bg-transparent text-sm font-bold text-ink outline-none"
              disabled={isPending}
              onChange={(e) => loadOverview(selectedMonth, Number(e.target.value))}
              value={selectedYear}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {(canManage || canApproveAdjustments) ? (
            <Button
              onClick={() => {
                setCreateForStaffId(undefined);
                setIsCreateDialogOpen(true);
              }}
              size="sm"
            >
              <Plus size={16} /> Bổ sung công bù
            </Button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger">
          {errorMessage}
        </div>
      ) : null}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-subtle">
            <Users size={14} /> Nhân sự có công
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-ink">
            {totalStaffCount} <span className="text-sm font-normal text-ink-muted">người</span>
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-subtle">
            <Clock size={14} /> Tổng giờ làm việc
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-primary">
            {totalCenterHours} <span className="text-sm font-normal text-ink-muted">giờ</span>
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-subtle">
            <AlertTriangle size={14} /> Ca tự động ngắt
          </div>
          <p
            className={`mt-1.5 font-display text-2xl font-bold ${
              totalAutoEnded > 0 ? "text-amber-600" : "text-ink"
            }`}
          >
            {totalAutoEnded}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-subtle">
            <UserCheck size={14} /> Yêu cầu chờ duyệt
          </div>
          <p
            className={`mt-1.5 font-display text-2xl font-bold ${
              totalPendingAdjustments > 0 ? "text-primary" : "text-ink"
            }`}
          >
            {totalPendingAdjustments}
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-3 py-2">
        <Search className="text-ink-subtle" size={16} />
        <input
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle outline-none"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm nhân sự theo họ tên, mã nhân viên, vai trò..."
          type="text"
          value={searchQuery}
        />
        {searchQuery ? (
          <button
            aria-label="Xóa tìm kiếm"
            className="text-ink-subtle hover:text-ink"
            onClick={() => setSearchQuery("")}
            type="button"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {/* Overview Table */}
      <div className="relative">
        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface-1/60 backdrop-blur-xs">
            <span className="text-sm font-semibold text-primary">
              Đang tải dữ liệu tháng {selectedMonth}/{selectedYear}…
            </span>
          </div>
        ) : null}

        <div className="hidden md:block">
          <DataTableFrame
            caption={`Tổng hợp công tháng ${selectedMonth}/${selectedYear}`}
            tableClassName="min-w-[960px] text-sm"
            header={
              <tr>
                <th className="px-5 py-3 font-semibold">Nhân sự</th>
                <th className="px-5 py-3 font-semibold">Vai trò</th>
                <th className="px-5 py-3 font-semibold">Số ngày làm việc</th>
                <th className="px-5 py-3 font-semibold">Tổng số giờ</th>
                <th className="px-5 py-3 font-semibold">Tình trạng công</th>
                <th className="px-5 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            }
            body={
              filteredOverview.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={6}>
                    {overview.length === 0
                      ? `Chưa có dữ liệu chấm công trong Tháng ${selectedMonth}/${selectedYear}.`
                      : "Không tìm thấy nhân sự phù hợp với từ khóa tìm kiếm."}
                  </td>
                </tr>
              ) : (
                filteredOverview.map((row) => (
                  <tr className="align-middle hover:bg-[var(--table-row-hover)]" key={row.staffId}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{row.staffDisplayName}</p>
                      {row.staffEmployeeCode ? (
                        <p className="mt-0.5 font-mono text-xs text-ink-muted">
                          {row.staffEmployeeCode}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-ink-muted">
                        {row.primaryRoleName}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-semibold text-ink">{row.totalWorkDays}</span>{" "}
                      <span className="text-xs text-ink-muted">ngày</span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-display font-bold text-primary">
                        {row.totalHours}
                      </span>{" "}
                      <span className="text-xs text-ink-muted">giờ</span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.autoEndedCount > 0 ? (
                          <Badge tone="warning">{row.autoEndedCount} ca tự ngắt</Badge>
                        ) : null}
                        {row.pendingAdjustmentCount > 0 ? (
                          <Badge tone="info">{row.pendingAdjustmentCount} chờ duyệt</Badge>
                        ) : null}
                        {row.autoEndedCount === 0 && row.pendingAdjustmentCount === 0 ? (
                          <Badge tone="success">Bình thường</Badge>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Button
                        onClick={() => openStaffDetail(row)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye size={15} /> Chi tiết bảng công
                      </Button>
                    </td>
                  </tr>
                ))
              )
            }
          />
        </div>

        {/* Mobile View */}
        <ResponsiveRecordList
          className="md:hidden"
          label={`Tổng hợp công tháng ${selectedMonth}/${selectedYear}`}
        >
          {filteredOverview.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
              {overview.length === 0
                ? `Chưa có dữ liệu chấm công trong Tháng ${selectedMonth}/${selectedYear}.`
                : "Không tìm thấy nhân sự phù hợp."}
            </p>
          ) : (
            filteredOverview.map((row) => (
              <article
                className="rounded-xl border border-hairline bg-surface-2 p-4 shadow-2xs"
                key={row.staffId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-ink">{row.staffDisplayName}</h3>
                    <p className="text-xs text-ink-muted">
                      {row.primaryRoleName} {row.staffEmployeeCode ? `· ${row.staffEmployeeCode}` : ""}
                    </p>
                  </div>
                  <Button
                    onClick={() => openStaffDetail(row)}
                    size="sm"
                    variant="outline"
                  >
                    <Eye size={15} /> Chi tiết
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs">
                  <div>
                    <span className="text-ink-muted">Số ngày công:</span>{" "}
                    <span className="font-semibold text-ink">{row.totalWorkDays} ngày</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Tổng giờ:</span>{" "}
                    <span className="font-display font-bold text-primary">
                      {row.totalHours} giờ
                    </span>
                  </div>
                </div>

                {row.autoEndedCount > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-amber-600">
                    Có {row.autoEndedCount} lượt tự động ngắt cần kiểm tra.
                  </p>
                ) : null}
              </article>
            ))
          )}
        </ResponsiveRecordList>
      </div>

      {/* Drill-down Detail Modal for Selected Staff */}
      {activeStaff ? (
        <Dialog
          ariaDescribedBy="staff-timesheet-detail-desc"
          ariaLabelledBy="staff-timesheet-detail-title"
          className="max-w-4xl p-6"
          isOpen={Boolean(activeStaff)}
          onClose={() => setActiveStaff(null)}
        >
          <div className="flex flex-col gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3
                className="font-display text-lg font-bold text-ink"
                id="staff-timesheet-detail-title"
              >
                Chi tiết chấm công: {activeStaff.staffDisplayName}
              </h3>
              <p className="text-xs text-ink-muted" id="staff-timesheet-detail-desc">
                {activeStaff.primaryRoleName}
                {activeStaff.staffEmployeeCode ? ` (${activeStaff.staffEmployeeCode})` : ""} ·
                Tháng {selectedMonth}/{selectedYear}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setCreateForStaffId(activeStaff.staffId);
                  setIsCreateDialogOpen(true);
                }}
                size="sm"
              >
                <Plus size={15} /> Thêm công bù
              </Button>
              <button
                aria-label="Đóng chi tiết"
                className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
                onClick={() => setActiveStaff(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="relative mt-4 max-h-[60vh] overflow-y-auto">
            {isStaffDetailPending ? (
              <div className="flex h-36 items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  Đang tải chi tiết chấm công…
                </span>
              </div>
            ) : staffEntries.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-muted">
                Không tìm thấy lượt chấm công nào của nhân sự này trong tháng {selectedMonth}/{selectedYear}.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-hairline bg-surface-2 text-ink-muted">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Ngày</th>
                    <th className="px-3 py-2.5 font-semibold">Ca làm</th>
                    <th className="px-3 py-2.5 font-semibold">Giờ vào</th>
                    <th className="px-3 py-2.5 font-semibold">Giờ ra</th>
                    <th className="px-3 py-2.5 font-semibold">Thời lượng</th>
                    <th className="px-3 py-2.5 font-semibold">Hình thức</th>
                    <th className="px-3 py-2.5 font-semibold">Trạng thái</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Điều chỉnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {staffEntries.map((entry) => {
                    const isApproved = entry.adjustmentStatus === "approved";
                    return (
                      <tr className="hover:bg-surface-2/60" key={entry.id}>
                        <td className="px-3 py-3 font-semibold text-ink">
                          {formatVietnamDate(entry.workDate)}
                        </td>

                        <td className="px-3 py-3 text-ink-muted">
                          {entry.workShiftName ?? "Ngoài ca"}
                        </td>

                        <td className="px-3 py-3 font-mono">
                          {isApproved && entry.adjustedCheckInAt ? (
                            <div>
                              <span className="text-ink-subtle line-through">
                                {formatTimeOnly(entry.checkInAt)}
                              </span>
                              <p className="font-bold text-emerald-600">
                                {formatTimeOnly(entry.adjustedCheckInAt)}
                              </p>
                            </div>
                          ) : (
                            formatTimeOnly(entry.checkInAt)
                          )}
                        </td>

                        <td className="px-3 py-3 font-mono">
                          {entry.status === "open" ? (
                            <Badge tone="warning">Đang diễn ra</Badge>
                          ) : isApproved && entry.adjustedCheckOutAt ? (
                            <div>
                              <span className="text-ink-subtle line-through">
                                {formatTimeOnly(entry.checkOutAt)}
                              </span>
                              <p className="font-bold text-emerald-600">
                                {formatTimeOnly(entry.adjustedCheckOutAt)}
                              </p>
                            </div>
                          ) : (
                            formatTimeOnly(entry.checkOutAt)
                          )}
                        </td>

                        <td className="px-3 py-3 font-medium text-ink">
                          {entry.status === "open" ? "—" : formatMinutesToHours(entry.totalMinutes)}
                        </td>

                        <td className="px-3 py-3">
                          <Badge tone={entry.checkInMode === "offline" ? "info" : "neutral"}>
                            {entry.checkInMode === "offline" ? "Tại trung tâm" : "Trực tuyến"}
                          </Badge>
                        </td>

                        <td className="px-3 py-3">
                          {entry.status === "open" ? (
                            <Badge tone="warning">Đang mở</Badge>
                          ) : entry.status === "auto_ended" ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge tone="danger">Tự ngắt</Badge>
                              <span className="text-[10px] text-red-600 font-medium">
                                {entry.clockOutReason === "left_geofence"
                                  ? "Rời trung tâm"
                                  : entry.clockOutReason === "location_lost"
                                    ? "Mất GPS"
                                    : "Hết ngày"}
                              </span>
                            </div>
                          ) : (
                            <Badge tone="success">Hoàn thành</Badge>
                          )}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <Button
                            onClick={() => setEntryToAdjust(entry)}
                            size="sm"
                            variant="outline"
                          >
                            Sửa giờ
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Dialog>
      ) : null}

      {/* Adjust Entry Dialog */}
      {entryToAdjust ? (
        <AdminAdjustTimeEntryDialog
          entry={entryToAdjust}
          isOpen={Boolean(entryToAdjust)}
          onClose={() => setEntryToAdjust(null)}
          onSuccess={() => {
            refreshActiveStaffDetail();
          }}
          staffDisplayName={activeStaff?.staffDisplayName}
        />
      ) : null}

      {/* Create Manual Entry Dialog */}
      <AdminCreateTimeEntryDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setCreateForStaffId(undefined);
        }}
        onSuccess={() => {
          loadOverview(selectedMonth, selectedYear);
          if (activeStaff) {
            refreshActiveStaffDetail();
          }
        }}
        preselectedStaffId={createForStaffId}
        staffOptions={staffOptions}
      />
    </section>
  );
}
