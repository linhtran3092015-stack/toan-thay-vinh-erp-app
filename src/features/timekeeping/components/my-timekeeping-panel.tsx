"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Info,
  MapPin,
  ShieldCheck,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import { useAttendanceHeartbeat } from "@/features/timekeeping/hooks/use-attendance-heartbeat";
import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import {
  getClockOutReasonLabel,
  getEvidencePresenceLabel,
  getTimekeepingEntryStatusPresentation,
  getTimekeepingModeLabel,
} from "@/features/timekeeping/timekeeping-entry-presentation";
import { readRememberedTimekeepingMode } from "@/features/timekeeping/timekeeping-last-mode";
import {
  formatVietnamClockLine,
  formatVietnamClockTime,
  getOpenShiftEvidenceText,
  getOpenShiftRuleNotes,
  getShiftConditionItems,
  type ShiftConditionIcon,
} from "@/features/timekeeping/timekeeping-staff-presentation";
import type {
  AttendanceVerificationPolicy,
  TimeEntryMode,
  TimekeepingMyEntry,
} from "@/features/timekeeping/types";

export {
  getClockOutReasonLabel,
  getEvidencePresenceLabel,
  getTimekeepingEntryStatusPresentation,
  getTimekeepingModeLabel,
} from "@/features/timekeeping/timekeeping-entry-presentation";

interface MyTimekeepingPanelProps {
  /** Inert replacements for the /dev/timekeeping preview; real pages pass nothing. */
  actions?: TimekeepingActionOverrides;
  attendancePolicy?: AttendanceVerificationPolicy;
  canCheck: boolean;
  entries: readonly TimekeepingMyEntry[];
  onSessionClosed?: () => void;
}

const modeOptions: readonly TimeEntryMode[] = ["offline", "online"];

function formatScheduleTime(value: string | null): string {
  if (!value) return "Không áp dụng";
  return value.slice(0, 5);
}

function formatElapsedTime(checkInAt: string, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - new Date(checkInAt).getTime());
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function subscribeStoredMode(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function subscribeMinute(onChange: () => void): () => void {
  const intervalId = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(intervalId);
}

function readMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/** Wall clock that ticks per minute; null during server render and hydration. */
function useCurrentMinute(): number | null {
  return useSyncExternalStore(subscribeMinute, readMinute, () => null);
}

function subscribeSecond(onChange: () => void): () => void {
  const intervalId = window.setInterval(onChange, 1000);
  return () => window.clearInterval(intervalId);
}

function readSecond(): number {
  return Math.floor(Date.now() / 1000);
}

/** Per-second clock for the elapsed timer; null during server render and hydration. */
function useCurrentSecond(): number | null {
  return useSyncExternalStore(subscribeSecond, readSecond, () => null);
}

const conditionIcons: Record<ShiftConditionIcon, LucideIcon> = {
  location: MapPin,
  schedule: CalendarClock,
  verification: Info,
  warning: AlertTriangle,
  wifi: Wifi,
};

const bigActionClassName = "h-14! w-full rounded-lg! text-base! font-bold!";

export function MyTimekeepingPanel({
  actions,
  attendancePolicy = {
    attendanceRadiusM: 100,
    centerName: "Trung tâm",
    configured: false,
    continuousGpsTrackingRequired: false,
    gpsMaxAccuracyM: 100,
    gpsRequiredForOffline: true,
    wifiRequiredForOffline: false,
  },
  canCheck,
  entries,
  onSessionClosed,
}: MyTimekeepingPanelProps) {
  const openEntry = entries.find((entry) => entry.status === "open");
  const entry = openEntry ?? entries[0];
  const statusPresentation = entry && !openEntry
    ? getTimekeepingEntryStatusPresentation(entry.status)
    : null;
  const currentMinute = useCurrentMinute();
  const openEntryId = openEntry?.id ?? null;
  const actionRegionRef = useRef<HTMLDivElement>(null);
  const [trackedOpenEntryId, setTrackedOpenEntryId] = useState(openEntryId);
  const [transitionMessage, setTransitionMessage] = useState("");
  const [exceptionMessage, setExceptionMessage] = useState("");

  // A successful check-in/out (or the server's cutoff) swaps the idle card
  // for the open-shift card or back after router.refresh(). Announce the
  // change; the effect below moves focus off the unmounted trigger.
  if (openEntryId !== trackedOpenEntryId) {
    setTrackedOpenEntryId(openEntryId);
    setTransitionMessage(openEntryId ? "Đã vào ca." : "Ca đã kết thúc.");
  }

  // Compared by id, not a first-run flag, so StrictMode's double effect run
  // on mount is a no-op too.
  const focusHandledForIdRef = useRef(trackedOpenEntryId);
  useEffect(() => {
    if (focusHandledForIdRef.current === trackedOpenEntryId) {
      return;
    }
    focusHandledForIdRef.current = trackedOpenEntryId;

    // Only when focus was lost with the old card; never steal it from
    // something the person is using.
    const active = document.activeElement;
    if (!active || active === document.body) {
      actionRegionRef.current?.focus();
    }
  }, [trackedOpenEntryId]);

  return (
    <section
      aria-labelledby="my-timekeeping-heading"
      className="grid min-w-0 max-w-xl gap-3"
    >
      <div className="min-w-0">
        <p className="min-h-[18px] text-label font-normal text-text-muted tabular-nums">
          {currentMinute === null ? null : (
            <time dateTime={new Date(currentMinute * 60_000).toISOString()}>
              {formatVietnamClockLine(currentMinute * 60_000)}
            </time>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h2 className="text-[22px]/[30px] font-semibold tracking-[-0.01em] text-text-strong md:text-section-title" id="my-timekeeping-heading">
            Chấm công của tôi
          </h2>
          {statusPresentation ? (
            <Badge tone={statusPresentation.tone}>{statusPresentation.label}</Badge>
          ) : null}
        </div>
        <p className="text-label font-normal text-text-muted">{attendancePolicy.centerName} · giờ Việt Nam</p>
      </div>

      <p aria-live="polite" className="sr-only">{transitionMessage}</p>
      {/* The status region stays mounted (and in the accessibility tree) so
          the confirmation is announced when it arrives; only the box comes and goes. */}
      <div className="empty:sr-only" role="status">
        {exceptionMessage ? (
          <p className="rounded-lg border border-info-border bg-info-bg px-4 py-3 text-label font-normal text-text-strong">
            {exceptionMessage}
          </p>
        ) : null}
      </div>

      {canCheck ? (
        <div
          aria-label="Thao tác chấm công"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          ref={actionRegionRef}
          role="group"
          tabIndex={-1}
        >
          {openEntry ? (
            <OpenShiftCard
              actions={actions}
              attendancePolicy={attendancePolicy}
              entry={openEntry}
              onExceptionSubmitted={setExceptionMessage}
              onSessionClosed={onSessionClosed}
            />
          ) : (
            <ShiftActionCard
              actions={actions}
              attendancePolicy={attendancePolicy}
              hasEntryToday={Boolean(entry)}
              onExceptionSubmitted={setExceptionMessage}
            />
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-border-subtle bg-surface-base p-4 text-body text-text-muted">
          Bạn chưa có quyền chấm công.
        </p>
      )}

      {entry ? (
        <details className="group rounded-lg border border-border-subtle bg-surface-base">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 text-body font-medium text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus [&::-webkit-details-marker]:hidden">
            Chi tiết lượt chấm công gần nhất
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
          </summary>
          <dl className="grid gap-x-6 gap-y-4 border-t border-border-row px-4 py-4 sm:grid-cols-2">
            <EntryField
              label="Ca làm"
              value={
                entry.workShiftCode && entry.workShiftName
                  ? `${entry.workShiftCode} · ${entry.workShiftName}`
                  : "Không ca (Tự do)"
              }
            />
            <EntryField
              label="Thời gian ca"
              value={
                entry.scheduledStartTime && entry.scheduledEndTime
                  ? `${formatScheduleTime(entry.scheduledStartTime)} – ${formatScheduleTime(entry.scheduledEndTime)}`
                  : "Không có ca ấn định"
              }
            />
            <EntryField
              label="Check-in"
              value={`${formatVietnamClockTime(entry.checkInAt)} · ${getTimekeepingModeLabel(entry.checkInMode)}`}
            />
            <EntryField
              label="Check-out"
              value={
                entry.checkOutAt && entry.checkOutMode
                  ? `${formatVietnamClockTime(entry.checkOutAt)} · ${entry.checkOutMode === "auto_end" ? `Tự động (${getClockOutReasonLabel(entry.clockOutReason)})` : getTimekeepingModeLabel(entry.checkOutMode)}`
                  : "Chưa check-out"
              }
            />
            <EntryField
              label="Dữ liệu GPS khi vào"
              value={getEvidencePresenceLabel(entry.hasCheckInGpsEvidence)}
            />
            <EntryField
              label="Thông tin Wi-Fi khi vào"
              value={getEvidencePresenceLabel(entry.hasCheckInWifiEvidence)}
            />
            {entry.checkOutAt ? (
              <>
                <EntryField
                  label="Dữ liệu GPS khi ra"
                  value={getEvidencePresenceLabel(entry.hasCheckOutGpsEvidence)}
                />
                <EntryField
                  label="Thông tin Wi-Fi khi ra"
                  value={getEvidencePresenceLabel(entry.hasCheckOutWifiEvidence)}
                />
              </>
            ) : null}
          </dl>
        </details>
      ) : (
        <p className="px-1 text-body text-text-muted">
          Hôm nay chưa có lượt chấm công nào.
        </p>
      )}
    </section>
  );
}

/** Design 14a/14e: mode choice, the real rules as text, one big "Vào ca". */
function ShiftActionCard({
  actions,
  attendancePolicy,
  hasEntryToday,
  onExceptionSubmitted,
}: {
  actions?: TimekeepingActionOverrides;
  attendancePolicy: AttendanceVerificationPolicy;
  hasEntryToday: boolean;
  onExceptionSubmitted: (message: string) => void;
}) {
  // Read-only here: the sheet remembers a mode only after the server accepted
  // it, so a tap that only reads the online rules does not change the default
  // of the topbar pill or the dashboard strip.
  const storedMode = useSyncExternalStore(subscribeStoredMode, readRememberedTimekeepingMode, () => null);
  const [chosenMode, setChosenMode] = useState<TimeEntryMode | null>(null);
  const mode = chosenMode ?? storedMode ?? "offline";
  const conditions = getShiftConditionItems(attendancePolicy, mode);

  return (
    <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]">
      <ModeRadioGroup mode={mode} onChange={setChosenMode} />

      <ul aria-label="Điều kiện chấm công" className="grid gap-2">
        {conditions.map((item) => {
          const Icon = conditionIcons[item.icon];
          return (
            <li className="flex items-start gap-2 text-body text-text-strong" key={item.id}>
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 h-[18px] w-[18px] shrink-0",
                  item.tone === "warning" ? "text-warning" : "text-text-muted",
                )}
                strokeWidth={1.8}
              />
              <span>{item.text}</span>
            </li>
          );
        })}
      </ul>

      {hasEntryToday ? (
        <p className="text-label font-normal text-text-muted">
          Hôm nay đã có lượt chấm công. Nếu bạn có ca khác, vào ca mới.
        </p>
      ) : null}

      <TimekeepingEntryDialog
        actions={actions}
        attendancePolicy={attendancePolicy}
        initialMode={mode}
        onExceptionSubmitted={onExceptionSubmitted}
        operation="check-in"
        triggerChildren="Vào ca"
        triggerClassName={getButtonClassName({
          className: cn(bigActionClassName, "shift-action-pulse"),
          size: "lg",
          variant: "primary",
        })}
      />
    </div>
  );
}

function ModeRadioGroup({
  mode,
  onChange,
}: {
  mode: TimeEntryMode;
  onChange: (mode: TimeEntryMode) => void;
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();
    const nextIndex = (index + step + modeOptions.length) % modeOptions.length;
    onChange(modeOptions[nextIndex]);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      aria-label="Hình thức chấm công"
      className="grid grid-cols-2 overflow-hidden rounded-md border border-border-strong"
      role="radiogroup"
    >
      {modeOptions.map((option, index) => {
        const isChecked = option === mode;
        return (
          <button
            aria-checked={isChecked}
            className={cn(
              "h-11 px-2 text-control focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
              index > 0 && "border-l border-border-strong",
              isChecked
                ? "bg-action-primary-soft font-semibold text-action-link"
                : "bg-surface-base font-normal text-text-default hover:bg-interactive-hover",
            )}
            key={option}
            onClick={() => onChange(option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            role="radio"
            tabIndex={isChecked ? 0 : -1}
            type="button"
          >
            {getTimekeepingModeLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

/** Design 14b: the open shift with elapsed time, evidence and "Ra ca". */
function OpenShiftCard({
  actions,
  attendancePolicy,
  entry,
  onExceptionSubmitted,
  onSessionClosed,
}: {
  actions?: TimekeepingActionOverrides;
  attendancePolicy: AttendanceVerificationPolicy;
  entry: TimekeepingMyEntry;
  onExceptionSubmitted: (message: string) => void;
  onSessionClosed?: () => void;
}) {
  const isTracked = entry.checkInMode === "offline" && attendancePolicy.continuousGpsTrackingRequired;

  const { distanceM, serverMessage, statusLabel } = useAttendanceHeartbeat({
    actions,
    activeSessionId: entry.id,
    enabled: isTracked,
    onSessionClosed,
  });

  const shiftText = entry.workShiftName
    ? `${entry.workShiftCode ? `${entry.workShiftCode} · ` : ""}${entry.workShiftName}${entry.scheduledStartTime && entry.scheduledEndTime ? ` ${formatScheduleTime(entry.scheduledStartTime)}–${formatScheduleTime(entry.scheduledEndTime)}` : ""}`
    : null;

  return (
    <div className="overflow-hidden rounded-lg border border-action-primary-soft-border bg-surface-base shadow-[var(--panel-shadow)]">
      <div className="flex items-center gap-2 bg-action-primary-soft px-4 py-3">
        <span aria-hidden="true" className="shift-live-dot h-2 w-2 shrink-0 rounded-full bg-action-primary" />
        <span className="text-body font-semibold text-action-link">
          Đang trong ca · {getTimekeepingModeLabel(entry.checkInMode)}
        </span>
        <ElapsedClock checkInAt={entry.checkInAt} />
      </div>

      <div className="grid gap-3 p-4">
        <p className="text-body text-text-strong">
          Vào ca <strong className="font-semibold tabular-nums">{formatVietnamClockTime(entry.checkInAt)}</strong>
          {shiftText ? ` · ${shiftText}` : null}
        </p>
        {entry.isUnscheduled ? (
          <div>
            <Badge tone="warning">Không có ca được phân công hôm nay</Badge>
          </div>
        ) : null}

        <ul className="grid gap-1.5 text-label font-normal text-text-strong">
          <li className="flex items-start gap-2">
            <ShieldCheck aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.8} />
            <span>{getOpenShiftEvidenceText(entry)}</span>
          </li>
          {isTracked ? (
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.8} />
              <span>
                Trạng thái định vị GPS: {statusLabel}
                {distanceM !== null ? ` (khoảng ${distanceM}m từ Trung tâm)` : ""}
              </span>
            </li>
          ) : null}
          {getOpenShiftRuleNotes(entry, attendancePolicy).map((note) => (
            <li className="flex items-start gap-2" key={note}>
              <Info aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.8} />
              <span>{note}</span>
            </li>
          ))}
        </ul>
        {serverMessage ? (
          <p className="text-label font-normal text-danger">{serverMessage}</p>
        ) : null}

        <TimekeepingEntryDialog
          actions={actions}
          attendancePolicy={attendancePolicy}
          onExceptionSubmitted={onExceptionSubmitted}
          operation="check-out"
          timeEntryId={entry.id}
          triggerChildren="Ra ca"
          triggerClassName={getButtonClassName({
            className: bigActionClassName,
            size: "lg",
            variant: "secondary",
          })}
        />
      </div>
    </div>
  );
}

/**
 * The only part of the open-shift card that changes every second, kept as a
 * leaf so the rest of the card (and its closed sheet) renders once.
 */
function ElapsedClock({ checkInAt }: { checkInAt: string }) {
  const currentSecond = useCurrentSecond();
  // Rendered only on the client so the server HTML never disagrees with it.
  const elapsedText = currentSecond === null
    ? "--:--:--"
    : formatElapsedTime(checkInAt, currentSecond * 1000);

  return (
    <span className="ml-auto text-label font-semibold text-action-link tabular-nums">
      <span className="sr-only">Thời gian đã làm việc </span>
      {elapsedText}
    </span>
  );
}

function EntryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-text-muted">{label}</dt>
      <dd className="mt-1 text-body font-medium text-text-default">{value}</dd>
    </div>
  );
}
