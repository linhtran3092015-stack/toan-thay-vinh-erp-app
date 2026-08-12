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

import { Button } from "@/components/ui/button";
import { ResultBanner } from "@/components/shared/result-banner";
import { Dialog } from "@/components/ui/dialog";
import type {
  TimeEntryActionInput,
  TimekeepingEntryActionState,
} from "@/features/timekeeping/time-entry-action-types";
import { initialTimekeepingEntryActionState } from "@/features/timekeeping/time-entry-action-types";
import {
  checkInTimeEntryAction,
  checkOutTimeEntryAction,
} from "@/features/timekeeping/time-entry-actions";

type TimekeepingEntryOperation = "check-in" | "check-out";

interface TimekeepingEntryDialogProps {
  operation: TimekeepingEntryOperation;
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function createInitialValues(): TimeEntryActionInput {
  return {
    gpsAccuracyMeters: null,
    gpsLatitude: null,
    gpsLongitude: null,
    mode: "offline",
    wifiBssid: "",
    wifiSsid: "",
  };
}

/** Presentation for the existing check-in/out mutation; eligibility remains server-owned. */
export function TimekeepingEntryDialog({
  operation,
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
    setValues(createInitialValues());
    setLocationMessage("");
    setActionState(initialTimekeepingEntryActionState);
    setIsOpen(true);
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

  const captureLocation = (): void => {
    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt hiện tại không hỗ trợ định vị.");
      return;
    }

    setIsLocating(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValues((current) => ({
          ...current,
          gpsAccuracyMeters: Math.max(0, Math.round(position.coords.accuracy)),
          gpsLatitude: position.coords.latitude,
          gpsLongitude: position.coords.longitude,
        }));
        setLocationMessage("Đã lấy dữ liệu vị trí từ thiết bị.");
        setIsLocating(false);
      },
      () => {
        setLocationMessage("Không lấy được vị trí. Bạn vẫn có thể ghi nhận không kèm GPS.");
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

    setActionState(initialTimekeepingEntryActionState);

    startTransition(async () => {
      const result = isCheckIn
        ? await checkInTimeEntryAction(values)
        : await checkOutTimeEntryAction(values);

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  const hasLocation = values.gpsLatitude !== null && values.gpsLongitude !== null;
  const title = isCheckIn ? "Xác nhận check-in" : "Xác nhận check-out";
  const triggerLabel = isCheckIn ? "Check-in" : "Check-out";
  const pendingLabel = isLocating
    ? "Đang lấy vị trí…"
    : isCheckIn
      ? "Đang check-in…"
      : "Đang check-out…";

  return (
    <>
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
              Thời điểm chấm công được ghi nhận theo giờ hệ thống.
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
                onChange={(event) => updateValue("mode", event.target.value as TimeEntryActionInput["mode"])}
                ref={modeRef}
                value={values.mode}
              >
                <option value="offline">Tại trung tâm</option>
                <option value="online">Trực tuyến</option>
              </select>
            </FormField>

            <fieldset
              aria-describedby={[gpsHelpId, gpsErrors.length > 0 ? gpsErrorId : undefined].filter(Boolean).join(" ") || undefined}
              className="grid gap-3 rounded-md border border-border-subtle p-4"
            >
              <legend className="px-1 text-label text-text-default">Dữ liệu vị trí GPS</legend>
              <p className="text-secondary text-text-muted" id={gpsHelpId}>
                Dữ liệu vị trí chỉ được gửi kèm khi bạn chọn lấy vị trí từ thiết bị.
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
            </fieldset>

            <fieldset aria-describedby={wifiHelpId} className="grid gap-4 rounded-md border border-border-subtle p-4">
              <legend className="px-1 text-label text-text-default">Thông tin Wi-Fi</legend>
              <p className="text-secondary text-text-muted" id={wifiHelpId}>
                Thông tin Wi-Fi là dữ liệu bổ sung, không bắt buộc.
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
                  value={values.wifiBssid}
                />
              </FormField>
            </fieldset>

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title={isCheckIn ? "Không thể ghi nhận check-in" : "Không thể ghi nhận check-out"}
                tone="error"
              />
            ) : null}

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
