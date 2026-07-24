"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import {
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { replaceClassScheduleAction } from "@/features/classes/actions/class-schedule-actions";
import type { ClassManagementActionState } from "@/features/classes/forms/class-action-types";
import { initialClassManagementActionState } from "@/features/classes/forms/class-action-types";
import type {
  ClassLearningMode,
  ClassScheduleReadModel,
} from "@/features/classes/read-models";

interface ClassScheduleReplaceActionProps {
  schedule: ClassScheduleReadModel;
}

interface ReplaceScheduleFormValues {
  effectiveFrom: string;
  endTime: string;
  learningMode: ClassLearningMode;
  meetingUrl: string;
  reason: string;
  roomName: string;
  startTime: string;
  weekday: number;
}

const WEEKDAY_OPTIONS = [
  { label: "Thứ Hai", value: 1 },
  { label: "Thứ Ba", value: 2 },
  { label: "Thứ Tư", value: 3 },
  { label: "Thứ Năm", value: 4 },
  { label: "Thứ Sáu", value: 5 },
  { label: "Thứ Bảy", value: 6 },
  { label: "Chủ nhật", value: 7 },
] as const;

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

function getVietnamBusinessDate(): string {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    },
  ).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Không xác định được ngày hiện tại theo giờ Việt Nam.",
    );
  }

  return `${year}-${month}-${day}`;
}

function createInitialValues(
  schedule: ClassScheduleReadModel,
): ReplaceScheduleFormValues {
  return {
    effectiveFrom:
      getVietnamBusinessDate(),
    endTime: schedule.endTime.slice(0, 5),
    learningMode: schedule.learningMode,
    meetingUrl: schedule.meetingUrl ?? "",
    reason: "",
    roomName: schedule.roomName ?? "",
    startTime: schedule.startTime.slice(0, 5),
    weekday: schedule.weekday,
  };
}

export function ClassScheduleReplaceAction({
  schedule,
}: ClassScheduleReplaceActionProps) {
  const router = useRouter();

  const businessDate =
    getVietnamBusinessDate();

  const canReplaceToday =
    schedule.effectiveFrom < businessDate;

  const [isOpen, setIsOpen] = useState(false);

  const [isPending, startTransition] =
    useTransition();

  const [values, setValues] =
    useState<ReplaceScheduleFormValues>(() =>
      createInitialValues(schedule),
    );

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const openDialog = (): void => {
    if (!canReplaceToday) {
      return;
    }

    setValues(createInitialValues(schedule));
    setActionState(
      initialClassManagementActionState,
    );
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    setActionState(
      initialClassManagementActionState,
    );
  };

  const getFieldError = (
    fieldName: keyof ReplaceScheduleFormValues,
  ): string | undefined =>
    actionState.fieldErrors?.[fieldName]?.[0];

  const updateValue = <
    Key extends keyof ReplaceScheduleFormValues,
  >(
    key: Key,
    value: ReplaceScheduleFormValues[Key],
  ): void => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    startTransition(async () => {
      const result =
        await replaceClassScheduleAction({
          effectiveFrom:
            values.effectiveFrom,
          endTime: values.endTime,
          learningMode:
            values.learningMode,
          meetingUrl: values.meetingUrl,
          reason: values.reason,
          roomName: values.roomName,
          scheduleTemplateId:
            schedule.id,
          startTime: values.startTime,
          weekday: values.weekday,
        });

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        className="w-full"
        disabled={!canReplaceToday}
        onClick={openDialog}
        type="button"
        variant="outline"
      >
        {canReplaceToday
          ? "Thay đổi lịch"
          : "Chưa thể thay đổi hôm nay"}
      </Button>

      {!canReplaceToday ? (
        <p className="mt-2 text-xs text-amber-700">
          Lịch bắt đầu hôm nay nên chưa thể thay thế.
          Có thể thực hiện từ ngày mai theo giờ Việt Nam.
        </p>
      ) : null}

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-2xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Thay đổi lịch học
              </h2>

              <p className="mt-1 text-sm text-ink-muted">
                Lịch cũ sẽ được kết thúc và giữ
                nguyên trong lịch sử. Hệ thống sẽ
                tạo một lịch mới thay thế.
              </p>

              {schedule.componentCode ? (
                <p className="mt-2 text-sm font-semibold text-ink">
                  Mã thành phần:{" "}
                  {schedule.componentCode}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                error={getFieldError(
                  "weekday",
                )}
                label="Ngày học mới"
              >
                <select
                  className={inputClassName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateValue(
                      "weekday",
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                  value={values.weekday}
                >
                  {WEEKDAY_OPTIONS.map(
                    (weekday) => (
                      <option
                        key={weekday.value}
                        value={weekday.value}
                      >
                        {weekday.label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField
                error={getFieldError(
                  "effectiveFrom",
                )}
                label="Lịch mới hiệu lực từ"
              >
                <input
                  className={inputClassName}
                  disabled={isPending}
                  max={businessDate}
                  min={businessDate}
                  onChange={(event) =>
                    updateValue(
                      "effectiveFrom",
                      event.target.value,
                    )
                  }
                  required
                  type="date"
                  value={values.effectiveFrom}
                />
              </FormField>

              <FormField
                error={getFieldError(
                  "startTime",
                )}
                label="Giờ bắt đầu"
              >
                <input
                  className={inputClassName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateValue(
                      "startTime",
                      event.target.value,
                    )
                  }
                  required
                  step={60}
                  type="time"
                  value={values.startTime}
                />
              </FormField>

              <FormField
                error={getFieldError(
                  "endTime",
                )}
                label="Giờ kết thúc"
              >
                <input
                  className={inputClassName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateValue(
                      "endTime",
                      event.target.value,
                    )
                  }
                  required
                  step={60}
                  type="time"
                  value={values.endTime}
                />
              </FormField>

              <FormField
                error={getFieldError(
                  "learningMode",
                )}
                label="Hình thức học"
              >
                <select
                  className={inputClassName}
                  disabled={isPending}
                  onChange={(event) =>
                    updateValue(
                      "learningMode",
                      event.target.value as
                        ClassLearningMode,
                    )
                  }
                  value={values.learningMode}
                >
                  <option value="offline">
                    Offline
                  </option>

                  <option value="online">
                    Online
                  </option>

                  <option value="hybrid">
                    Kết hợp
                  </option>
                </select>
              </FormField>

              <FormField
                error={getFieldError(
                  "roomName",
                )}
                label="Phòng học"
                optional
              >
                <input
                  className={inputClassName}
                  disabled={isPending}
                  maxLength={200}
                  onChange={(event) =>
                    updateValue(
                      "roomName",
                      event.target.value,
                    )
                  }
                  placeholder="Ví dụ: Phòng 3"
                  value={values.roomName}
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField
                  error={getFieldError(
                    "meetingUrl",
                  )}
                  label="Đường dẫn học trực tuyến"
                  optional
                >
                  <input
                    className={inputClassName}
                    disabled={isPending}
                    onChange={(event) =>
                      updateValue(
                        "meetingUrl",
                        event.target.value,
                      )
                    }
                    placeholder="ClassIn, Google Meet..."
                    type="url"
                    value={values.meetingUrl}
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField
                  error={getFieldError("reason")}
                  label="Lý do thay đổi"
                >
                  <textarea
                    autoFocus
                    className={`${inputClassName} min-h-28 resize-y py-3`}
                    disabled={isPending}
                    maxLength={2000}
                    onChange={(event) =>
                      updateValue(
                        "reason",
                        event.target.value,
                      )
                    }
                    placeholder="Nhập lý do thay đổi lịch học"
                    required
                    value={values.reason}
                  />
                </FormField>
              </div>
            </div>

            {actionState.message ? (
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
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                disabled={isPending}
                onClick={closeDialog}
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>

              <Button
                disabled={
                  isPending ||
                  values.reason.trim().length === 0
                }
                type="submit"
              >
                {isPending
                  ? "Đang thay đổi..."
                  : "Xác nhận thay đổi"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  label: string;
  optional?: boolean;
}

function FormField({
  children,
  error,
  label,
  optional = false,
}: FormFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>
        {label}

        {optional ? (
          <span className="ml-1 font-normal text-ink-muted">
            (không bắt buộc)
          </span>
        ) : null}
      </span>

      {children}

      {error ? (
        <span className="text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}
