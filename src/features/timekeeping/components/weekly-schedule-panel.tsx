"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getVietnamBusinessDate, WEEKDAY_OPTIONS } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingScheduleEntry, TimekeepingStaffOption, TimekeepingWorkShift } from "@/features/timekeeping/types";
import { addScheduleDays, formatScheduleDate, getScheduleWeek, resolveScheduleWeek } from "@/features/timekeeping/weekly-schedule";
import { saveWeeklyAssignmentAction } from "@/features/timekeeping/weekly-schedule-actions";
import type { TimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";

const control = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring disabled:bg-disabled-bg disabled:text-text-disabled";
const weekUrl = (week: string) => `/timekeeping?week=${week}#weekly-schedule`;
const staffName = (entry: TimekeepingScheduleEntry) => entry.staffDisplayName?.trim() || entry.staffEmployeeCode || "Nhân sự trung tâm";

export function WeeklySchedulePanel({ weekStart, entries, staffOptions, workShifts, canManage }: {
  weekStart: string;
  entries: readonly TimekeepingScheduleEntry[];
  staffOptions: readonly TimekeepingStaffOption[];
  workShifts: readonly TimekeepingWorkShift[];
  canManage: boolean;
}) {
  const today = getVietnamBusinessDate();
  const weekEnd = addScheduleDays(weekStart, 6);
  const router = useRouter();
  const [editing, setEditing] = useState<TimekeepingScheduleEntry | "new" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isHistory = weekEnd < today;
  const canEdit = (entry: TimekeepingScheduleEntry) => canManage && !isHistory && !entry.isLocked && entry.staffEmploymentStatus === "active" && (entry.workDate ?? addScheduleDays(weekStart, entry.weekday - 1)) >= today;
  const actions = (entry: TimekeepingScheduleEntry) => canEdit(entry)
    ? <Button onClick={(event) => { triggerRef.current = event.currentTarget; setEditing(entry); }} variant="outline">{entry.isActive === false ? "Phân công lại" : "Đổi / bỏ ca"}</Button>
    : <span className="text-caption text-text-muted">{entry.isLocked ? "Đã khóa" : "Chỉ xem"}</span>;
  const shiftInfo = (entry: TimekeepingScheduleEntry) => entry.isActive === false ? "Đã bỏ ca" : `${entry.workShiftCode} · ${entry.workShiftName}`;
  const hours = (entry: TimekeepingScheduleEntry) => entry.isActive === false ? "—" : `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}${entry.crossesMidnight ? " (ngày hôm sau)" : ""}`;

  return <section className="timekeeping-assignment-work-area grid gap-4" aria-labelledby="weekly-schedule-heading" id="weekly-schedule">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-section-title text-text-strong" id="weekly-schedule-heading">Phân công lịch theo tuần</h2>
        <p className="mt-1 text-secondary text-text-muted">Mỗi tuần lưu riêng. Thay đổi ca chỉ áp dụng cho ngày được chọn.</p>
      </div>
      {canManage && !isHistory ? <Button ref={triggerRef} disabled={!staffOptions.length || !workShifts.some((shift) => shift.isActive)} onClick={() => setEditing("new")}>Phân công lịch</Button> : null}
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-surface-base p-3">
      <Link className="inline-flex min-h-11 items-center rounded px-3 text-action-link hover:bg-surface-sunken" href={weekUrl(addScheduleDays(weekStart, -7))} scroll={false}>← Tuần trước</Link>
      <label className="grid gap-1 text-label">Chọn ngày trong tuần
        <input key={weekStart} className={control} type="date" defaultValue={weekStart} min="1900-01-01" max="9998-12-31" onChange={(event) => {
          if (event.target.value) router.push(weekUrl(resolveScheduleWeek(event.target.value)), { scroll: false });
        }} />
      </label>
      <Link className="inline-flex min-h-11 items-center rounded px-3 text-action-link hover:bg-surface-sunken" href={weekUrl(addScheduleDays(weekStart, 7))} scroll={false}>Tuần sau →</Link>
      <Link className="inline-flex min-h-11 items-center rounded px-3 text-action-link hover:bg-surface-sunken" href={weekUrl(getScheduleWeek(today))} scroll={false}>Tuần hiện tại</Link>
    </div>
    <p className="text-body font-semibold text-text-strong">Tuần {formatScheduleDate(weekStart)} – {formatScheduleDate(weekEnd)}{isHistory ? " · Lịch sử, chỉ xem" : ""}</p>
    {entries.some((entry) => entry.weekStart === null) ? <p className="text-caption text-text-muted">Lịch lặp cũ được giữ đến hết tuần chuyển đổi. Các tuần tiếp theo cần phân công riêng.</p> : null}
    <div className="timekeeping-assignment-table">
      <DataTableFrame caption="Bảng phân công theo tuần" tableClassName="min-w-[1040px] text-sm" header={<tr>
        { ["Ngày", "Nhân sự", "Ca làm", "Giờ làm", "Nghỉ giữa ca", ...(canManage ? ["Thao tác"] : [])].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}
      </tr>} body={entries.length ? entries.map((entry) => <tr key={entry.assignmentId} className="align-top">
        <td className="px-5 py-4">{WEEKDAY_OPTIONS.find((day) => day.value === entry.weekday)?.label}<p className="text-caption text-text-muted">{formatScheduleDate(entry.workDate ?? addScheduleDays(weekStart, entry.weekday - 1))}</p></td>
        <td className="px-5 py-4 font-semibold">{staffName(entry)}<p className="text-caption font-normal text-text-muted">{entry.staffEmployeeCode}</p></td>
        <td className="px-5 py-4">{shiftInfo(entry)}</td><td className="px-5 py-4">{hours(entry)}</td><td className="px-5 py-4">{entry.isActive === false ? "—" : `${entry.breakMinutes} phút`}</td>
        {canManage ? <td className="px-5 py-4">{actions(entry)}</td> : null}
      </tr>) : <tr><td colSpan={canManage ? 6 : 5} className="p-6 text-center text-text-muted">Tuần này chưa có phân công.</td></tr>} />
    </div>
    <ResponsiveRecordList className="timekeeping-assignment-record-list" label="Bảng phân công theo tuần">
      {entries.length ? entries.map((entry) => <article key={entry.assignmentId} role="listitem" className="grid gap-2 rounded-lg border border-border-subtle p-4">
        <p className="text-caption text-text-muted">{WEEKDAY_OPTIONS.find((day) => day.value === entry.weekday)?.label} · {formatScheduleDate(entry.workDate ?? addScheduleDays(weekStart, entry.weekday - 1))}</p>
        <h3 className="text-label text-text-strong">{staffName(entry)}</h3><p>{shiftInfo(entry)}</p><p className="text-secondary text-text-muted">{hours(entry)}</p>
        {canManage ? actions(entry) : null}
      </article>) : <p className="p-4 text-text-muted">Tuần này chưa có phân công.</p>}
    </ResponsiveRecordList>
    <p className="text-caption text-text-muted">Ngày đã qua hoặc đã có chấm công được giữ nguyên để bảo toàn lịch sử.</p>
    {editing ? <WeeklyAssignmentDialog key={`${weekStart}:${editing === "new" ? "new" : editing.assignmentId}`} weekStart={weekStart} entries={entries} staffOptions={staffOptions} workShifts={workShifts} editing={editing} onClose={() => setEditing(null)} triggerRef={triggerRef} /> : null}
  </section>;
}

function WeeklyAssignmentDialog({ weekStart, entries, staffOptions, workShifts, editing, onClose, triggerRef }: {
  weekStart: string; entries: readonly TimekeepingScheduleEntry[];
  staffOptions: readonly TimekeepingStaffOption[]; workShifts: readonly TimekeepingWorkShift[];
  editing: TimekeepingScheduleEntry | "new"; onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const current = editing === "new" ? null : editing;
  const activeShifts = workShifts.filter((shift) => shift.isActive);
  const today = getVietnamBusinessDate();
  const [staffId, setStaffId] = useState(current?.staffId ?? staffOptions[0]?.id ?? "");
  const [weekday, setWeekday] = useState(current?.weekday ?? WEEKDAY_OPTIONS.find((day) => addScheduleDays(weekStart, day.value - 1) >= today)?.value ?? 1);
  const [shiftId, setShiftId] = useState(current?.isActive === false ? "" : current?.workShiftId ?? activeShifts[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<TimekeepingManagementActionState>({ status: "idle", message: "" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const titleId = useId(); const descriptionId = useId();
  const staffRef = useRef<HTMLSelectElement>(null);
  const shiftRef = useRef<HTMLSelectElement>(null);
  const selected = entries.find((entry) => entry.staffId === staffId && entry.weekday === weekday);
  const locked = selected?.isLocked || addScheduleDays(weekStart, weekday - 1) < today;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || locked) return;
    startTransition(async () => {
      try {
        const result = await saveWeeklyAssignmentAction({ weekStart, staffId, weekday, workShiftId: shiftId || null,
          expectedAssignmentId: selected?.assignmentId ?? null, expectedUpdatedAt: selected?.updatedAt ?? null, reason });
        setState(result);
        if (result.status === "success") { router.refresh(); onClose(); }
      } catch { setState({ status: "error", message: "Không thể kết nối hệ thống. Vui lòng thử lại." }); }
    });
  };
  return <Dialog isOpen onClose={() => { if (!pending) onClose(); }} ariaLabelledBy={titleId} ariaDescribedBy={descriptionId} initialFocusRef={current ? shiftRef : staffRef} returnFocusRef={triggerRef} className="max-w-xl">
    <form onSubmit={submit} className="grid gap-4 p-5">
      <h2 id={titleId} className="text-section-title text-text-strong">Phân công lịch theo tuần</h2>
      <p id={descriptionId} className="text-secondary text-text-muted">Tuần {formatScheduleDate(weekStart)} – {formatScheduleDate(addScheduleDays(weekStart, 6))}. Chỉ thay đổi ngày {formatScheduleDate(addScheduleDays(weekStart, weekday - 1))}.</p>
      <label className="grid gap-1.5 text-label">Nhân sự<select ref={staffRef} className={control} value={staffId} disabled={pending || Boolean(current)} onChange={(event) => setStaffId(event.target.value)} required>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName || staff.employeeCode || "Nhân sự"}{staff.employeeCode ? ` (${staff.employeeCode})` : ""}</option>)}</select></label>
      <label className="grid gap-1.5 text-label">Ngày phân công<select className={control} value={weekday} disabled={pending || Boolean(current)} onChange={(event) => setWeekday(Number(event.target.value))}>{WEEKDAY_OPTIONS.map((day) => <option key={day.value} value={day.value} disabled={addScheduleDays(weekStart, day.value - 1) < today}>{day.label} · {formatScheduleDate(addScheduleDays(weekStart, day.value - 1))}</option>)}</select></label>
      <label className="grid gap-1.5 text-label">Ca làm<select ref={shiftRef} className={control} value={shiftId} disabled={pending || locked} onChange={(event) => setShiftId(event.target.value)} required={!selected}>
        <option value="">{selected ? "Bỏ ca / không phân công" : "Chọn ca làm"}</option>
        {current && !activeShifts.some((shift) => shift.id === current.workShiftId) ? <option disabled value={current.workShiftId}>{current.workShiftName} (đã ngừng dùng)</option> : null}
        {activeShifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.code} · {shift.name} ({shift.startTime.slice(0,5)}–{shift.endTime.slice(0,5)})</option>)}
      </select></label>
      {selected && !locked ? <p className="text-caption text-text-muted">Ngày này {selected.isActive === false ? "đã bỏ ca" : `đang có ${selected.workShiftName}`}. Lưu sẽ cập nhật phân công của ngày này.</p> : null}
      {locked ? <ResultBanner title="Không thể sửa lịch" description="Ngày này đã qua hoặc đã có chấm công." tone="warning" /> : null}
      <label className="grid gap-1.5 text-label">Lý do thay đổi<textarea className={`${control} min-h-24 py-2`} value={reason} disabled={pending} maxLength={2000} required onChange={(event) => setReason(event.target.value)} /></label>
      {state.status === "error" ? <ResultBanner title="Chưa lưu được lịch" description={state.message} tone="error" /> : null}
      <div className="flex justify-end gap-2"><Button variant="ghost" type="button" disabled={pending} onClick={onClose}>Hủy</Button><Button type="submit" disabled={pending || locked} isLoading={pending}>Lưu phân công</Button></div>
    </form>
  </Dialog>;
}
