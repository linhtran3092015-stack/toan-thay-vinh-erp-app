"use client";

import { useRouter } from "next/navigation";
import type {
  FormEvent,
  ReactNode,
} from "react";
import {
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { createClassScheduleAction } from "@/features/classes/actions/class-schedule-actions";
import type {
  ClassManagementActionState,
  ClassScheduleWriteFields,
} from "@/features/classes/forms/class-action-types";
import { initialClassManagementActionState } from "@/features/classes/forms/class-action-types";

interface ClassScheduleCreateFormProps {
  classId: string;
  defaultLearningMode:
    ClassScheduleWriteFields["learningMode"];
  remainingScheduleSlots: number;
}

const WEEKDAY_OPTIONS = [
  {
    label: "Thứ Hai",
    value: 1,
  },
  {
    label: "Thứ Ba",
    value: 2,
  },
  {
    label: "Thứ Tư",
    value: 3,
  },
  {
    label: "Thứ Năm",
    value: 4,
  },
  {
    label: "Thứ Sáu",
    value: 5,
  },
  {
    label: "Thứ Bảy",
    value: 6,
  },
  {
    label: "Chủ nhật",
    value: 7,
  },
] as const;

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

function createInitialValues(
  defaultLearningMode:
    ClassScheduleWriteFields["learningMode"],
): ClassScheduleWriteFields {
  return {
    componentCode: "",
    effectiveFrom: "",
    endTime: "",
    learningMode: defaultLearningMode,
    meetingUrl: "",
    roomName: "",
    startTime: "",
    weekday: 1,
  };
}

export function ClassScheduleCreateForm({
  classId,
  defaultLearningMode,
  remainingScheduleSlots,
}: ClassScheduleCreateFormProps) {
  const router = useRouter();

  const [isPending, startTransition] =
    useTransition();

  const [isExpanded, setIsExpanded] =
    useState(false);

  const [values, setValues] =
    useState<ClassScheduleWriteFields>(() =>
      createInitialValues(
        defaultLearningMode,
      ),
    );

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const getFieldError = (
    fieldName: keyof ClassScheduleWriteFields,
  ): string | undefined =>
    actionState.fieldErrors?.[fieldName]?.[0];

  const updateValue = <
    Key extends keyof ClassScheduleWriteFields,
  >(
    key: Key,
    value: ClassScheduleWriteFields[Key],
  ): void => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetForm = (): void => {
    setValues(
      createInitialValues(
        defaultLearningMode,
      ),
    );

    setActionState(
      initialClassManagementActionState,
    );
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    startTransition(async () => {
      const result =
        await createClassScheduleAction({
          ...values,
          classId,
        });

      setActionState(result);

      if (result.status === "success") {
        setValues(
          createInitialValues(
            defaultLearningMode,
          ),
        );

        setIsExpanded(false);
        router.refresh();
      }
    });
  };

  if (!isExpanded) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-dashed border-hairline bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink">
            Thêm lịch học cố định
          </p>

          <p className="mt-1 text-sm text-ink-muted">
            Lớp còn {remainingScheduleSlots} lịch
            có thể thiết lập trong tuần.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsExpanded(true);
          }}
          type="button"
        >
          Thêm lịch học
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-md border border-hairline bg-surface-2 p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold text-ink">
          Thêm lịch học cố định
        </h3>

        <p className="mt-1 text-sm text-ink-muted">
          Lịch sẽ có hiệu lực từ ngày được chọn và
          được lưu vào lịch sử vận hành của lớp.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          error={getFieldError(
            "componentCode",
          )}
          label="Mã thành phần"
          optional
        >
          <input
            className={inputClassName}
            disabled={isPending}
            maxLength={100}
            onChange={(event) =>
              updateValue(
                "componentCode",
                event.target.value.toUpperCase(),
              )
            }
            placeholder="Ví dụ: A, CLC1"
            value={values.componentCode}
          />
        </FormField>

        <FormField
          error={getFieldError("weekday")}
          label="Ngày học"
        >
          <select
            className={inputClassName}
            disabled={isPending}
            onChange={(event) =>
              updateValue(
                "weekday",
                Number(event.target.value),
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
          error={getFieldError("endTime")}
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
                  ClassScheduleWriteFields["learningMode"],
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
            "effectiveFrom",
          )}
          label="Hiệu lực từ ngày"
        >
          <input
            className={inputClassName}
            disabled={isPending}
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
          error={getFieldError("roomName")}
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
            placeholder="Ví dụ: Phòng 2"
            value={values.roomName}
          />
        </FormField>

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
          onClick={() => {
            resetForm();
            setIsExpanded(false);
          }}
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>

        <Button
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? "Đang tạo lịch..."
            : "Tạo lịch học"}
        </Button>
      </div>
    </form>
  );
}

interface FormFieldProps {
  children: ReactNode;
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
