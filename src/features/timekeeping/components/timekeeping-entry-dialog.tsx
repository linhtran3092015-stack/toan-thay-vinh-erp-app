"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  TimeEntryActionInput,
  TimekeepingEntryActionState,
} from "@/features/timekeeping/time-entry-action-types";
import { initialTimekeepingEntryActionState } from "@/features/timekeeping/time-entry-action-types";
import {
  checkInTimeEntryAction,
  checkOutTimeEntryAction,
} from "@/features/timekeeping/time-entry-actions";
import { formInputClassName } from "@/features/timekeeping/timekeeping-client-utils";

type TimekeepingEntryOperation = "check-in" | "check-out";

interface TimekeepingEntryDialogProps {
  operation: TimekeepingEntryOperation;
}

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

export function TimekeepingEntryDialog({
  operation,
}: TimekeepingEntryDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [values, setValues] = useState<TimeEntryActionInput>(createInitialValues);
  const [actionState, setActionState] = useState<TimekeepingEntryActionState>(
    initialTimekeepingEntryActionState,
  );
  const isCheckIn = operation === "check-in";

  const openDialog = (): void => {
    setValues(createInitialValues());
    setLocationMessage("");
    setActionState(initialTimekeepingEntryActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (!isPending && !isLocating) {
      setIsOpen(false);
    }
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
        setLocationMessage("Đã cập nhật vị trí hiện tại.");
        setIsLocating(false);
      },
      () => {
        setLocationMessage("Không lấy được vị trí. Bạn có thể tiếp tục không kèm GPS.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
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

  const hasLocation =
    values.gpsLatitude !== null && values.gpsLongitude !== null;
  const title = isCheckIn ? "Xác nhận check-in" : "Xác nhận check-out";
  const triggerLabel = isCheckIn ? "Check-in" : "Check-out";
  const submitLabel = isPending
    ? "Đang ghi nhận..."
    : isCheckIn
      ? "Xác nhận check-in"
      : "Xác nhận check-out";

  return (
    <>
      <Button onClick={openDialog} size="lg" type="button" variant={isCheckIn ? "primary" : "secondary"}>
        {triggerLabel}
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Thời điểm chấm công được ghi nhận theo giờ hệ thống.
              </p>
            </div>

            <div className="grid gap-4">
              <FormField error={actionState.fieldErrors?.mode?.[0]} label="Hình thức">
                <select
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateValue("mode", event.target.value as TimeEntryActionInput["mode"])
                  }
                  value={values.mode}
                >
                  <option value="offline">Tại trung tâm</option>
                  <option value="online">Trực tuyến</option>
                </select>
              </FormField>

              <fieldset className="grid gap-3 rounded-md border border-hairline p-4">
                <legend className="px-1 text-sm font-semibold text-ink">Vị trí GPS</legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    disabled={isPending || isLocating}
                    onClick={captureLocation}
                    size="lg"
                    type="button"
                    variant="outline"
                  >
                    {isLocating ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
                  </Button>
                  {hasLocation ? (
                    <Button
                      disabled={isPending || isLocating}
                      onClick={clearLocation}
                      size="lg"
                      type="button"
                      variant="ghost"
                    >
                      Bỏ vị trí
                    </Button>
                  ) : null}
                </div>
                {hasLocation ? (
                  <p className="text-sm text-ink-muted">
                    Vị trí đã sẵn sàng
                    {values.gpsAccuracyMeters !== null
                      ? `, sai số khoảng ${values.gpsAccuracyMeters} m`
                      : ""}.
                  </p>
                ) : null}
                {locationMessage ? (
                  <p aria-live="polite" className="text-sm text-ink-muted">
                    {locationMessage}
                  </p>
                ) : null}
                <FieldError error={actionState.fieldErrors?.gpsLatitude?.[0]} />
                <FieldError error={actionState.fieldErrors?.gpsLongitude?.[0]} />
                <FieldError error={actionState.fieldErrors?.gpsAccuracyMeters?.[0]} />
              </fieldset>

              <fieldset className="grid gap-4 rounded-md border border-hairline p-4">
                <legend className="px-1 text-sm font-semibold text-ink">Thông tin Wi-Fi</legend>
                <FormField error={actionState.fieldErrors?.wifiSsid?.[0]} label="Tên mạng Wi-Fi">
                  <input
                    autoComplete="off"
                    className={formInputClassName}
                    disabled={isPending}
                    maxLength={128}
                    onChange={(event) => updateValue("wifiSsid", event.target.value)}
                    placeholder="Không bắt buộc"
                    value={values.wifiSsid}
                  />
                </FormField>
                <FormField error={actionState.fieldErrors?.wifiBssid?.[0]} label="BSSID">
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    className={formInputClassName}
                    disabled={isPending}
                    maxLength={17}
                    onChange={(event) => updateValue("wifiBssid", event.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    value={values.wifiBssid}
                  />
                </FormField>
              </fieldset>
            </div>

            <ActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                disabled={isPending || isLocating}
                onClick={closeDialog}
                size="lg"
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>
              <Button disabled={isPending || isLocating} size="lg" type="submit">
                {submitLabel}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function FormField({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      <FieldError error={error} />
    </label>
  );
}

function FieldError({ error }: { error?: string }) {
  return error ? <span className="text-xs font-medium text-red-600">{error}</span> : null;
}

function ActionMessage({
  actionState,
}: {
  actionState: TimekeepingEntryActionState;
}) {
  if (!actionState.message) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={
        actionState.status === "error"
          ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
      }
    >
      {actionState.message}
    </div>
  );
}
