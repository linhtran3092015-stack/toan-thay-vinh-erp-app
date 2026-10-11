"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { rescheduleSessionAction } from "@/features/sessions/actions/session-lifecycle-actions";
import type { SessionLifecycleActionState } from "@/features/sessions/forms/session-action-types";
import type { SessionLearningMode } from "@/features/sessions/read-models";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export interface SessionRescheduleDialogProps {
  classCode: string;
  endTime: string;
  learningMode: SessionLearningMode;
  meetingUrl: string | null;
  notes: string | null;
  roomName: string | null;
  sessionDate: string;
  sessionId: string;
  startTime: string;
}

interface FormValues {
  endTime: string;
  learningMode: SessionLearningMode;
  meetingUrl: string;
  notes: string;
  reason: string;
  roomName: string;
  sessionDate: string;
  startTime: string;
}

/** Edits date, time, mode, room, link and notes of a scheduled session. */
export function SessionRescheduleDialog(props: SessionRescheduleDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() => initialValues(props));
  const [state, setState] = useState<SessionLifecycleActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = (): void => {
    setValues(initialValues(props));
    setState(null);
    setIsOpen(true);
  };

  const close = (): void => {
    if (isPending) return;
    setIsOpen(false);
  };

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isPending) return;
    setState(null);
    startTransition(async () => {
      const result = await rescheduleSessionAction({
        endTime: values.endTime,
        learningMode: values.learningMode,
        meetingUrl: values.meetingUrl || null,
        notes: values.notes || null,
        reason: values.reason,
        roomName: values.roomName || null,
        sessionDate: values.sessionDate,
        sessionId: props.sessionId,
        startTime: values.startTime,
      });
      setState(result);
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  const fieldError = (name: keyof FormValues): string | undefined =>
    state?.status === "error" ? state.fieldErrors?.[name]?.[0] : undefined;

  return (
    <>
      <Button onClick={open} ref={triggerRef} type="button" variant="outline">
        Đổi lịch / sửa buổi
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={dateRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <form className="grid gap-4 p-4 sm:p-5" onSubmit={submit}>
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>
              Đổi lịch buổi học {props.classCode}
            </h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Chỉ áp dụng cho buổi còn ở trạng thái đã lên lịch. Lịch cũ được lưu lại và ghi nhật ký. Buổi chính có thể
              dời sang ngày khác thứ của lịch mẫu, nhưng không được trùng ngày với buổi khác cùng lịch mẫu hay chồng giờ
              buổi khác của lớp.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field error={fieldError("sessionDate")} label="Ngày học">
              <input
                className={inputClassName}
                disabled={isPending}
                onChange={(event) => update("sessionDate", event.target.value)}
                ref={dateRef}
                required
                type="date"
                value={values.sessionDate}
              />
            </Field>
            <Field error={fieldError("startTime")} label="Bắt đầu">
              <input
                className={inputClassName}
                disabled={isPending}
                onChange={(event) => update("startTime", event.target.value)}
                required
                type="time"
                value={values.startTime}
              />
            </Field>
            <Field error={fieldError("endTime")} label="Kết thúc">
              <input
                className={inputClassName}
                disabled={isPending}
                onChange={(event) => update("endTime", event.target.value)}
                required
                type="time"
                value={values.endTime}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field error={fieldError("learningMode")} label="Hình thức">
              <select
                className={inputClassName}
                disabled={isPending}
                onChange={(event) => update("learningMode", event.target.value as SessionLearningMode)}
                value={values.learningMode}
              >
                <option value="offline">Tại trung tâm</option>
                <option value="online">Trực tuyến</option>
                <option value="hybrid">Kết hợp</option>
              </select>
            </Field>
            <Field error={fieldError("roomName")} label="Phòng">
              <input
                className={inputClassName}
                disabled={isPending}
                maxLength={120}
                onChange={(event) => update("roomName", event.target.value)}
                placeholder="Ví dụ: Phòng 2"
                value={values.roomName}
              />
            </Field>
          </div>

          <Field error={fieldError("meetingUrl")} label="Link học trực tuyến">
            <input
              className={inputClassName}
              disabled={isPending}
              inputMode="url"
              onChange={(event) => update("meetingUrl", event.target.value)}
              placeholder="https://…"
              value={values.meetingUrl}
            />
          </Field>

          <Field error={fieldError("notes")} label="Ghi chú">
            <textarea
              className={`${inputClassName} min-h-16 py-2`}
              disabled={isPending}
              maxLength={1000}
              onChange={(event) => update("notes", event.target.value)}
              value={values.notes}
            />
          </Field>

          <Field error={fieldError("reason")} label="Lý do đổi lịch">
            <textarea
              className={`${inputClassName} min-h-16 py-2`}
              disabled={isPending}
              maxLength={1000}
              minLength={3}
              onChange={(event) => update("reason", event.target.value)}
              placeholder="Ví dụ: Giáo viên bận, phụ huynh đã được báo dời sang thứ 5."
              required
              value={values.reason}
            />
          </Field>

          {state?.status === "error" ? <ResultBanner title={state.message} tone="error" /> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" disabled={isPending} onClick={close} type="button" variant="outline">
              Hủy
            </Button>
            <Button className="min-h-11" isLoading={isPending} type="submit">
              Lưu lịch mới
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return (
    <label className="grid gap-1 text-label font-medium text-text-strong">
      {label}
      {children}
      {error ? <span className="text-caption font-normal text-danger" role="alert">{error}</span> : null}
    </label>
  );
}

function initialValues(props: SessionRescheduleDialogProps): FormValues {
  return {
    endTime: props.endTime.slice(0, 5),
    learningMode: props.learningMode,
    meetingUrl: props.meetingUrl ?? "",
    notes: props.notes ?? "",
    reason: "",
    roomName: props.roomName ?? "",
    sessionDate: props.sessionDate,
    startTime: props.startTime.slice(0, 5),
  };
}
