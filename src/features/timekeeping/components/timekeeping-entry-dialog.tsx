"use client";

import {
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { requestAttendanceExceptionAction } from "@/features/timekeeping/attendance-exception-actions";

import { Button } from "@/components/ui/button";
import { ResultBanner } from "@/components/shared/result-banner";
import { Dialog } from "@/components/ui/dialog";
import type {
  TimeEntryActionInput,
  TimekeepingEntryActionState,
} from "@/features/timekeeping/time-entry-action-types";
import { initialTimekeepingEntryActionState } from "@/features/timekeeping/time-entry-action-types";
import type { AttendanceVerificationPolicy } from "@/features/timekeeping/types";
import {
  checkInTimeEntryAction,
  checkOutTimeEntryAction,
} from "@/features/timekeeping/time-entry-actions";

type TimekeepingEntryOperation = "check-in" | "check-out";

interface TimekeepingEntryDialogProps {
  attendancePolicy?: AttendanceVerificationPolicy;
  /** Capture GPS as soon as the dialog opens in on-site mode (one-tap flow). */
  autoLocate?: boolean;
  operation: TimekeepingEntryOperation;
  /** Custom trigger content (e.g. the topbar pill); the dialog still owns the button. */
  triggerChildren?: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  timeEntryId?: string;
}

const LAST_MODE_STORAGE_KEY = "timekeeping.lastMode";

function readLastMode(): TimeEntryActionInput["mode"] {
  try {
    return window.localStorage.getItem(LAST_MODE_STORAGE_KEY) === "online" ? "online" : "offline";
  } catch {
    return "offline";
  }
}

function rememberMode(mode: TimeEntryActionInput["mode"]): void {
  try {
    window.localStorage.setItem(LAST_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode); remembering is a convenience only.
  }
}

const defaultAttendancePolicy: AttendanceVerificationPolicy = {
  attendanceRadiusM: 100,
  centerName: "Trung tâm",
  configured: false,
  continuousGpsTrackingRequired: false,
  gpsMaxAccuracyM: 100,
  gpsRequiredForOffline: true,
  wifiRequiredForOffline: false,
};

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function createInitialValues(mode: TimeEntryActionInput["mode"] = "offline"): TimeEntryActionInput {
  return {
    gpsAccuracyMeters: null,
    gpsLatitude: null,
    gpsLongitude: null,
    mode,
    wifiBssid: "",
    wifiSsid: "",
  };
}

/** Presentation for the existing check-in/out mutation; eligibility remains server-owned. */
export function TimekeepingEntryDialog({
  attendancePolicy = defaultAttendancePolicy,
  autoLocate = true,
  operation,
  timeEntryId,
  triggerChildren,
  triggerClassName,
  triggerTitle,
}: TimekeepingEntryDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modeRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const modeId = useId();
  const gpsHelpId = useId();
  const wifiHelpId = useId();
  const wifiSsidId = useId();
  const wifiBssidId = useId();
  const gpsErrorId = useId();
  const [reviewReason, setReviewReason] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const requestIdRef = useRef<string | null>(null);
  const sampledAtRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [values, setValues] = useState<TimeEntryActionInput>(createInitialValues);
  const [actionState, setActionState] = useState<TimekeepingEntryActionState>(
    initialTimekeepingEntryActionState,
  );
  const isCheckIn = operation === "check-in";
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};
  const gpsErrors = [
    fieldErrors.gpsLatitude?.[0],
    fieldErrors.gpsLongitude?.[0],
    fieldErrors.gpsAccuracyMeters?.[0],
  ].filter((error): error is string => Boolean(error));
  const isMutationInteractionLocked =
    isPending && actionState.status !== "error";
  const isInteractionLocked = isLocating || isMutationInteractionLocked;

  const openDialog = (): void => {
    const lastMode = readLastMode();
    requestIdRef.current = crypto.randomUUID();
    sampledAtRef.current = null;
    setReviewReason("");
    setSubmittedMessage("");
    setValues(createInitialValues(lastMode));
    setLocationMessage("");
    setActionState(initialTimekeepingEntryActionState);
    setIsOpen(true);
    // One-tap: on-site check-in starts locating as soon as the dialog opens.
    if (autoLocate && lastMode === "offline" && attendancePolicy.configured) {
      captureLocation();
    }
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setActionState(initialTimekeepingEntryActionState);
  };

  const updateValue = <Key extends keyof TimeEntryActionInput>(
    key: Key,
    value: TimeEntryActionInput[Key],
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateMode = (mode: TimeEntryActionInput["mode"]): void => {
    setValues((current) => mode === "online"
      ? {
          ...current,
          gpsAccuracyMeters: null,
          gpsLatitude: null,
          gpsLongitude: null,
          mode,
          wifiBssid: "",
          wifiSsid: "",
        }
      : { ...current, mode });
    setLocationMessage("");
  };

  const captureLocation = (): void => {
    sampledAtRef.current = null;
    setValues((current) => ({ ...current, gpsAccuracyMeters: null, gpsLatitude: null, gpsLongitude: null }));
    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt hiện tại không hỗ trợ định vị.");
      return;
    }

    setIsLocating(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        sampledAtRef.current = Date.now();
        setValues((current) => ({
          ...current,
          gpsAccuracyMeters: Math.max(0, Math.round(position.coords.accuracy)),
          gpsLatitude: position.coords.latitude,
          gpsLongitude: position.coords.longitude,
        }));
        setLocationMessage("Đã lấy dữ liệu vị trí từ thiết bị.");
        setIsLocating(false);
      },
      (error) => {
        setLocationMessage(error.code === 1
          ? "Trình duyệt chưa được cấp quyền vị trí. Hãy cấp quyền hoặc gửi chấm công chờ duyệt."
          : error.code === 3
            ? "Lấy vị trí quá thời gian chờ. Hãy thử lại hoặc gửi chấm công chờ duyệt."
            : "Thiết bị chưa xác định được vị trí. Hãy thử lại hoặc gửi chấm công chờ duyệt.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  };

  const clearLocation = (): void => {
    setValues((current) => ({
      ...current,
      gpsAccuracyMeters: null,
      gpsLatitude: null,
      gpsLongitude: null,
    }));
    setLocationMessage("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    if (values.mode === "offline" && sampledAtRef.current !== null && Date.now() - sampledAtRef.current > 60_000) {
      clearLocation();
      sampledAtRef.current = null;
      setLocationMessage("Vị trí đã quá 60 giây. Vui lòng lấy lại vị trí trước khi xác nhận.");
      return;
    }

    setActionState(initialTimekeepingEntryActionState);

    startTransition(async () => {
      try {
        const result = isCheckIn
          ? await checkInTimeEntryAction(values)
          : await checkOutTimeEntryAction(values);

        setActionState(result);

        if (result.status === "success") {
          rememberMode(values.mode);
          setIsOpen(false);
          router.refresh();
        }
      } catch {
        setActionState({ status: "error", message: "Không thể kết nối tới hệ thống chấm công. Vui lòng thử lại." });
      }
    });
  };

  const hasLocation = values.gpsLatitude !== null && values.gpsLongitude !== null;
  const submitForReview = () => {
    if (isInteractionLocked || !requestIdRef.current) return;
    const requestId = requestIdRef.current;
    startTransition(async () => {
      try {
        const result = await requestAttendanceExceptionAction({ operation, reason: reviewReason, requestId, timeEntryId: timeEntryId ?? null });
        setActionState(result);
        if (result.status === "success") {
          setSubmittedMessage(result.message);
          setIsOpen(false);
          router.refresh();
        }
      } catch {
        setActionState({ status: "error", message: "Chưa có xác nhận từ hệ thống. Vui lòng thử gửi lại khi có mạng." });
      }
    });
  };
  const isOffline = values.mode === "offline";
  const title = isCheckIn ? "Xác nhận vào ca" : "Xác nhận ra ca";
  const triggerLabel = isCheckIn ? "Vào ca" : "Ra ca";
  const pendingLabel = isLocating
    ? "Đang lấy vị trí…"
    : isCheckIn
      ? "Đang vào ca…"
      : "Đang ra ca…";

  return (
    <>
      {submittedMessage ? <p role="status" className="text-secondary">{submittedMessage}</p> : null}
      {triggerChildren ? (
        <button
          aria-label={triggerTitle}
          className={triggerClassName}
          onClick={openDialog}
          ref={triggerRef}
          title={triggerTitle}
          type="button"
        >
          {triggerChildren}
        </button>
      ) : (
        <Button
          className="min-h-11"
          onClick={openDialog}
          ref={triggerRef}
          size="lg"
          type="button"
          variant={isCheckIn ? "primary" : "secondary"}
        >
          {triggerLabel}
        </Button>
      )}

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-xl"
        initialFocusRef={modeRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>{title}</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Thời điểm chấm công ghi theo giờ hệ thống. Tại trung tâm: vị trí được lấy tự động khi mở; hình thức lần trước được ghi nhớ.
            </p>
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <FormField error={fieldErrors.mode?.[0]} id={modeId} label="Hình thức">
              <select
                aria-describedby={fieldErrors.mode?.[0] ? `${modeId}-error` : undefined}
                aria-invalid={Boolean(fieldErrors.mode?.[0])}
                className={inputClassName}
                disabled={isInteractionLocked}
                id={modeId}
                onChange={(event) => updateMode(event.target.value as TimeEntryActionInput["mode"])}
                ref={modeRef}
                value={values.mode}
              >
                <option value="offline">Tại trung tâm</option>
                <option value="online">Trực tuyến</option>
              </select>
            </FormField>

            {isOffline && !attendancePolicy.configured ? (
              <ResultBanner
                description="Chủ trung tâm cần lưu tọa độ và bán kính trước khi nhân sự có thể chấm công tại Trung tâm."
                title="Chưa cấu hình vị trí Trung tâm"
                tone="warning"
              />
            ) : null}

            {isOffline ? <fieldset
              aria-describedby={[gpsHelpId, gpsErrors.length > 0 ? gpsErrorId : undefined].filter(Boolean).join(" ") || undefined}
              className="grid gap-3 rounded-md border border-border-subtle p-4"
            >
              <legend className="px-1 text-label text-text-default">Dữ liệu vị trí GPS</legend>
              <p className="text-secondary text-text-muted" id={gpsHelpId}>
                Bắt buộc khi chấm công tại Trung tâm. Vị trí phải nằm trong bán kính {attendancePolicy.attendanceRadiusM} m và sai số không quá {attendancePolicy.gpsMaxAccuracyM} m.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  disabled={isInteractionLocked}
                  onClick={captureLocation}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {isLocating ? "Đang lấy vị trí…" : "Lấy vị trí hiện tại"}
                </Button>
                {hasLocation ? (
                  <Button disabled={isInteractionLocked} onClick={clearLocation} size="lg" type="button" variant="ghost">
                    Bỏ dữ liệu vị trí
                  </Button>
                ) : null}
              </div>
              {hasLocation ? (
                <p className="text-secondary text-text-muted">
                  Đã có dữ liệu vị trí
                  {values.gpsAccuracyMeters !== null ? `, sai số khoảng ${values.gpsAccuracyMeters} m` : ""}.
                </p>
              ) : null}
              {locationMessage ? <p aria-live="polite" className="text-secondary text-text-muted">{locationMessage}</p> : null}
              {gpsErrors.length > 0 ? <p className="text-caption text-danger" id={gpsErrorId}>{gpsErrors.join(" ")}</p> : null}
            </fieldset> : null}

            {/* Phones cannot read SSID/BSSID, so typed Wi-Fi proves nothing; only
                show the fields when the owner explicitly requires them. */}
            {isOffline && attendancePolicy.wifiRequiredForOffline ? <fieldset aria-describedby={wifiHelpId} className="grid gap-4 rounded-md border border-border-subtle p-4">
              <legend className="px-1 text-label text-text-default">Thông tin Wi-Fi</legend>
              <p className="text-secondary text-text-muted" id={wifiHelpId}>
                Bắt buộc nhập đúng tên Wi-Fi và BSSID đã được Chủ trung tâm đăng ký.
              </p>
              <FormField error={fieldErrors.wifiSsid?.[0]} id={wifiSsidId} label="Tên mạng Wi-Fi">
                <input
                  aria-describedby={[wifiHelpId, fieldErrors.wifiSsid?.[0] ? `${wifiSsidId}-error` : undefined].filter(Boolean).join(" ") || undefined}
                  aria-invalid={Boolean(fieldErrors.wifiSsid?.[0])}
                  autoComplete="off"
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id={wifiSsidId}
                  maxLength={128}
                  onChange={(event) => updateValue("wifiSsid", event.target.value)}
                  placeholder="Không bắt buộc"
                  required={attendancePolicy.wifiRequiredForOffline}
                  value={values.wifiSsid}
                />
              </FormField>
              <FormField error={fieldErrors.wifiBssid?.[0]} id={wifiBssidId} label="BSSID">
                <input
                  aria-describedby={[wifiHelpId, fieldErrors.wifiBssid?.[0] ? `${wifiBssidId}-error` : undefined].filter(Boolean).join(" ") || undefined}
                  aria-invalid={Boolean(fieldErrors.wifiBssid?.[0])}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id={wifiBssidId}
                  maxLength={17}
                  onChange={(event) => updateValue("wifiBssid", event.target.value)}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  required={attendancePolicy.wifiRequiredForOffline}
                  value={values.wifiBssid}
                />
              </FormField>
            </fieldset> : null}

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title={isCheckIn ? "Không thể ghi nhận vào ca" : "Không thể ghi nhận ra ca"}
                tone="error"
              />
            ) : null}

            {isOffline && attendancePolicy.exceptionReviewEnabled ? <fieldset className="grid gap-2 rounded-md border border-border-subtle p-4">
              <legend className="px-1 font-medium">Không xác minh được vị trí?</legend>
              <p className="text-secondary text-text-muted">Bạn có thể ghi nhận giờ vào/ra để quản lý duyệt. Công này chưa được cộng vào tổng đã xác minh.</p>
              <label className="grid gap-1">Lý do cần duyệt
                <textarea className={`${inputClassName} min-h-20 py-2`} disabled={isInteractionLocked} maxLength={2000} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} />
              </label>
              <Button type="button" variant="outline" disabled={isInteractionLocked || !reviewReason.trim() || (!isCheckIn && !timeEntryId)} onClick={submitForReview}>Gửi chấm công chờ duyệt</Button>
            </fieldset> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isMutationInteractionLocked} type="submit">
                {isInteractionLocked ? pendingLabel : title}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function FormField({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-label text-text-default" htmlFor={id}>{label}</label>
      {children}
      <FieldError error={error} id={`${id}-error`} />
    </div>
  );
}

function FieldError({ error, id }: { error?: string; id: string }) {
  return error ? <p className="text-caption text-danger" id={id}>{error}</p> : null;
}
