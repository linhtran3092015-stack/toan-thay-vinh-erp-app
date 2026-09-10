"use client";

import type {
  FormEvent,
  ReactNode,
} from "react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSessionAction, startSessionAction } from "@/features/sessions/actions/session-lifecycle-actions";
import type {
  CancelledSessionOption,
  SessionCreationClassOption,
  SessionScheduleOption,
} from "@/features/sessions/create-data";
import type { SessionLifecycleActionState } from "@/features/sessions/forms/session-action-types";
import type {
  SessionKind,
  SessionLearningMode,
} from "@/features/sessions/read-models";

interface SessionCreateFormProps {
  cancelledSessions: CancelledSessionOption[];
  classes: SessionCreationClassOption[];
  schedules: SessionScheduleOption[];
  directoryQuery?: string;
}

interface FormState {
  classId: string;
  componentCode: string;
  endTime: string;
  learningMode: SessionLearningMode;
  makeupForSessionId: string;
  meetingUrl: string;
  notes: string;
  roomName: string;
  scheduleTemplateId: string;
  sessionDate: string;
  sessionKind: SessionKind;
  startTime: string;
}

const initialFormState: FormState = {
  classId: "",
  componentCode: "",
  endTime: "",
  learningMode: "offline",
  makeupForSessionId: "",
  meetingUrl: "",
  notes: "",
  roomName: "",
  scheduleTemplateId: "",
  sessionDate: "",
  sessionKind: "regular",
  startTime: "",
};

export function SessionCreateForm({
  cancelledSessions,
  classes,
  schedules,
  directoryQuery = "",
}: SessionCreateFormProps) {
  const router = useRouter();
  const [startImmediately, setStartImmediately] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  const goToSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}${directoryQuery ? `?${directoryQuery}` : ""}`);
    router.refresh();
  };

  const startCreatedSession = async (sessionId: string) => {
    try {
      const started = await startSessionAction({ sessionId });
      if (started.status === "success") {
        goToSession(sessionId);
      } else {
        setActionState({ ...started, message: `Buổi học đã được tạo nhưng chưa bắt đầu: ${started.message}` });
      }
    } catch {
      setActionState({ status: "error", message: "Buổi học đã được tạo. Chưa xác nhận được trạng thái bắt đầu; hãy mở buổi học để kiểm tra." });
    }
  };

  const [form, setForm] =
    useState<FormState>(
      initialFormState,
    );

  const [
    actionState,
    setActionState,
  ] = useState<
    SessionLifecycleActionState | null
  >(null);

  const [isPending, startTransition] =
    useTransition();

  const selectedClass = useMemo(
    () =>
      classes.find(
        (item) => item.id === form.classId,
      ) ?? null,
    [classes, form.classId],
  );

  const availableSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        if (
          schedule.classId !== form.classId
        ) {
          return false;
        }

        if (!form.sessionDate) {
          return true;
        }

        if (
          schedule.effectiveFrom >
          form.sessionDate
        ) {
          return false;
        }

        if (
          schedule.effectiveTo &&
          schedule.effectiveTo <
            form.sessionDate
        ) {
          return false;
        }

        return (
          schedule.weekday ===
          getIsoWeekday(form.sessionDate)
        );
      }),
    [
      form.classId,
      form.sessionDate,
      schedules,
    ],
  );

  const availableCancelledSessions =
    useMemo(
      () =>
        cancelledSessions.filter(
          (session) =>
            session.classId ===
              form.classId &&
            (!form.sessionDate ||
              session.sessionDate <
                form.sessionDate),
        ),
      [
        cancelledSessions,
        form.classId,
        form.sessionDate,
      ],
    );

  const fieldErrors =
    actionState?.status === "error"
      ? actionState.fieldErrors ?? {}
      : {};

  const updateField = <
    Key extends keyof FormState,
  >(
    key: Key,
    value: FormState[Key],
  ) => {
    setActionState(null);

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleClassChange = (
    classId: string,
  ) => {
    const nextClass =
      classes.find(
        (item) => item.id === classId,
      ) ?? null;

    setActionState(null);

    setForm((current) => ({
      ...current,
      classId,
      learningMode:
        nextClass?.defaultLearningMode ??
        current.learningMode,
      makeupForSessionId: "",
      scheduleTemplateId: "",
    }));
  };

  const handleKindChange = (
    sessionKind: SessionKind,
  ) => {
    setActionState(null);

    setForm((current) => ({
      ...current,
      makeupForSessionId:
        sessionKind === "makeup"
          ? current.makeupForSessionId
          : "",
      scheduleTemplateId:
        sessionKind === "regular"
          ? current.scheduleTemplateId
          : "",
      sessionKind,
    }));
  };

  const handleMakeupSourceChange = (
    sourceId: string,
  ) => {
    const source =
      cancelledSessions.find(
        (item) => item.id === sourceId,
      ) ?? null;

    setActionState(null);

    setForm((current) => ({
      ...current,
      componentCode:
        source?.componentCode ?? "",
      endTime:
        source?.endTime.slice(0, 5) ??
        current.endTime,
      learningMode:
        source?.learningMode ??
        current.learningMode,
      makeupForSessionId: sourceId,
      meetingUrl:
        source?.meetingUrl ?? "",
      roomName: source?.roomName ?? "",
      startTime:
        source?.startTime.slice(0, 5) ??
        current.startTime,
    }));
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (isPending || createdSessionId) return;
    setActionState(null);

    startTransition(async () => {
      const result =
        await createSessionAction({
          classId: form.classId,
          componentCode:
            form.sessionKind === "regular"
              ? null
              : optionalValue(
                  form.componentCode,
                ),
          endTime:
            form.sessionKind === "regular"
              ? null
              : optionalValue(
                  form.endTime,
                ),
          learningMode:
            form.sessionKind === "regular"
              ? null
              : form.learningMode,
          makeupForSessionId:
            form.sessionKind === "makeup"
              ? optionalValue(
                  form.makeupForSessionId,
                )
              : null,
          meetingUrl:
            form.sessionKind === "regular"
              ? null
              : optionalValue(
                  form.meetingUrl,
                ),
          notes: optionalValue(form.notes),
          roomName:
            form.sessionKind === "regular"
              ? null
              : optionalValue(
                  form.roomName,
                ),
          scheduleTemplateId:
            form.sessionKind === "regular"
              ? optionalValue(
                  form.scheduleTemplateId,
                )
              : null,
          sessionDate: form.sessionDate,
          sessionKind: form.sessionKind,
          startTime:
            form.sessionKind === "regular"
              ? null
              : optionalValue(
                  form.startTime,
                ),
        });

      setActionState(result);

      if (result.status === "success") {
        setCreatedSessionId(result.sessionId);
        if (startImmediately) {
          await startCreatedSession(result.sessionId);
        } else {
          goToSession(result.sessionId);
        }
      }
    });
  };

  return (
    <div className="grid min-w-0 gap-6">
      <section className="grid gap-4">
        <nav aria-label="Điều hướng tạo buổi học" className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
          <Link
            className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
          >
            Buổi học
          </Link>

          <span>/</span>

          <span className="font-semibold text-ink">
            Tạo buổi học
          </span>
        </nav>

        <PageHeader title="Tạo buổi học">
        <p className="mt-1 text-secondary text-text-muted">
          Chọn buổi chính, buổi bù hoặc buổi bổ
          sung. Dữ liệu chỉ được lưu qua workflow
          đã phân quyền.
        </p>
        </PageHeader>
      </section>

      {createdSessionId ? (
        <Card><CardContent className="grid gap-3 p-5">
          <p role={actionState?.status === "error" ? "alert" : "status"}>{actionState?.message ?? "Đã tạo buổi học."}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending || !createdSessionId} onClick={() => startTransition(async () => { if (createdSessionId) await startCreatedSession(createdSessionId); })}>Thử bắt đầu lại</Button>
            <Button variant="secondary" disabled={isPending} onClick={() => goToSession(createdSessionId)}>Mở buổi học đã tạo</Button>
          </div>
        </CardContent></Card>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <h2 className="font-semibold text-ink">
              Chưa có lớp đang hoạt động
            </h2>

            <p className="mt-2 text-sm text-ink-muted">
              Cần kích hoạt lớp và năm học trước
              khi tạo buổi học.
            </p>
          </CardContent>
        </Card>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={handleSubmit}
        >
          <fieldset
            className="contents"
            disabled={isPending}
          >
            <Card>
              <CardHeader>
                <CardTitle>
                  Thông tin chính
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={firstError(
                    fieldErrors.classId,
                  )}
                  label="Lớp học"
                  required
                >
                  <select
                    className={inputClassName}
                    onChange={(event) =>
                      handleClassChange(
                        event.target.value,
                      )
                    }
                    value={form.classId}
                  >
                    <option value="">
                      Chọn lớp học
                    </option>

                    {classes.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.code} –{" "}
                        {item.name} · Khối{" "}
                        {item.grade} · Mức{" "}
                        {item.level}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  error={firstError(
                    fieldErrors.sessionKind,
                  )}
                  label="Loại buổi"
                  required
                >
                  <select
                    className={inputClassName}
                    onChange={(event) =>
                      handleKindChange(
                        event.target
                          .value as SessionKind,
                      )
                    }
                    value={form.sessionKind}
                  >
                    <option value="regular">
                      Buổi chính
                    </option>
                    <option value="makeup">
                      Buổi bù
                    </option>
                    <option value="additional">
                      Buổi bổ sung
                    </option>
                  </select>
                </FormField>

                <FormField
                  error={firstError(
                    fieldErrors.sessionDate,
                  )}
                  label="Ngày học"
                  required
                >
                  <input
                    className={inputClassName}
                    onChange={(event) => {
                      updateField(
                        "sessionDate",
                        event.target.value,
                      );

                      updateField(
                        "scheduleTemplateId",
                        "",
                      );

                      updateField(
                        "makeupForSessionId",
                        "",
                      );
                    }}
                    type="date"
                    value={form.sessionDate}
                  />
                </FormField>

                <FormField
                  error={firstError(
                    fieldErrors.notes,
                  )}
                  label="Ghi chú"
                >
                  <input
                    className={inputClassName}
                    maxLength={1000}
                    onChange={(event) =>
                      updateField(
                        "notes",
                        event.target.value,
                      )
                    }
                    placeholder="Ghi chú nội bộ"
                    value={form.notes}
                  />
                </FormField>
              </CardContent>
            </Card>

            {form.sessionKind ===
            "regular" ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Lịch học cố định
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <FormField
                    error={firstError(
                      fieldErrors.scheduleTemplateId,
                    )}
                    label="Lịch áp dụng"
                    required
                  >
                    <select
                      className={inputClassName}
                      disabled={
                        !form.classId ||
                        !form.sessionDate
                      }
                      onChange={(event) =>
                        updateField(
                          "scheduleTemplateId",
                          event.target.value,
                        )
                      }
                      value={
                        form.scheduleTemplateId
                      }
                    >
                      <option value="">
                        Chọn lịch học
                      </option>

                      {availableSchedules.map(
                        (schedule) => (
                          <option
                            key={schedule.id}
                            value={schedule.id}
                          >
                            {formatWeekday(
                              schedule.weekday,
                            )}
                            {" · "}
                            {formatTime(
                              schedule.startTime,
                            )}
                            {"–"}
                            {formatTime(
                              schedule.endTime,
                            )}
                            {" · "}
                            {
                              schedule.componentCode
                            }
                            {" · "}
                            {formatMode(
                              schedule.learningMode,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>

                  {form.classId &&
                  form.sessionDate &&
                  availableSchedules.length ===
                    0 ? (
                    <Notice>
                      Không có lịch cố định đang hiệu
                      lực và đúng thứ trong ngày đã
                      chọn.
                    </Notice>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {form.sessionKind ===
            "makeup" ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Buổi cần học bù
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <FormField
                    error={firstError(
                      fieldErrors.makeupForSessionId,
                    )}
                    label="Buổi đã hủy"
                    required
                  >
                    <select
                      className={inputClassName}
                      disabled={!form.classId}
                      onChange={(event) =>
                        handleMakeupSourceChange(
                          event.target.value,
                        )
                      }
                      value={
                        form.makeupForSessionId
                      }
                    >
                      <option value="">
                        Chọn buổi đã hủy
                      </option>

                      {availableCancelledSessions.map(
                        (session) => (
                          <option
                            key={session.id}
                            value={session.id}
                          >
                            {formatDate(
                              session.sessionDate,
                            )}
                            {" · "}
                            {formatTime(
                              session.startTime,
                            )}
                            {"–"}
                            {formatTime(
                              session.endTime,
                            )}
                            {" · "}
                            {formatKind(
                              session.sessionKind,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>

                  {form.classId &&
                  availableCancelledSessions.length ===
                    0 ? (
                    <Notice>
                      Lớp chưa có buổi đã hủy đủ điều
                      kiện để tạo buổi bù.
                    </Notice>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {form.sessionKind !==
            "regular" ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Thời gian và hình thức
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField
                    error={firstError(
                      fieldErrors.startTime,
                    )}
                    label="Giờ bắt đầu"
                    required
                  >
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        updateField(
                          "startTime",
                          event.target.value,
                        )
                      }
                      type="time"
                      value={form.startTime}
                    />
                  </FormField>

                  <FormField
                    error={firstError(
                      fieldErrors.endTime,
                    )}
                    label="Giờ kết thúc"
                    required
                  >
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        updateField(
                          "endTime",
                          event.target.value,
                        )
                      }
                      type="time"
                      value={form.endTime}
                    />
                  </FormField>

                  <FormField
                    error={firstError(
                      fieldErrors.learningMode,
                    )}
                    label="Hình thức"
                    required
                  >
                    <select
                      className={inputClassName}
                      onChange={(event) =>
                        updateField(
                          "learningMode",
                          event.target
                            .value as SessionLearningMode,
                        )
                      }
                      value={form.learningMode}
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
                    error={firstError(
                      fieldErrors.componentCode,
                    )}
                    label="Thành phần"
                  >
                    <input
                      className={inputClassName}
                      maxLength={120}
                      onChange={(event) =>
                        updateField(
                          "componentCode",
                          event.target.value,
                        )
                      }
                      placeholder="Ví dụ: A, CLC1"
                      value={form.componentCode}
                    />
                  </FormField>

                  <FormField
                    error={firstError(
                      fieldErrors.roomName,
                    )}
                    label="Phòng học"
                  >
                    <input
                      className={inputClassName}
                      maxLength={120}
                      onChange={(event) =>
                        updateField(
                          "roomName",
                          event.target.value,
                        )
                      }
                      placeholder="Tên hoặc mã phòng"
                      value={form.roomName}
                    />
                  </FormField>

                  <FormField
                    error={firstError(
                      fieldErrors.meetingUrl,
                    )}
                    label="Đường dẫn học trực tuyến"
                  >
                    <input
                      className={inputClassName}
                      maxLength={1000}
                      onChange={(event) =>
                        updateField(
                          "meetingUrl",
                          event.target.value,
                        )
                      }
                      placeholder="https://..."
                      type="url"
                      value={form.meetingUrl}
                    />
                  </FormField>
                </CardContent>
              </Card>
            ) : null}

            {selectedClass ? (
              <Notice>
                Đang tạo buổi cho lớp{" "}
                <strong>
                  {selectedClass.code} –{" "}
                  {selectedClass.name}
                </strong>
                .
              </Notice>
            ) : null}

            {actionState?.status ===
            "error" ? (
              <div
                className="rounded-md border border-danger-border bg-danger-bg p-3 text-body font-medium text-danger"
                role="alert"
              >
                {actionState.message}
              </div>
            ) : null}

            <label className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 text-body">
              <input type="checkbox" checked={startImmediately} onChange={(event) => setStartImmediately(event.target.checked)} className="mt-1" />
              <span><strong>Bắt đầu ngay và vào điểm danh</strong><span className="mt-1 block text-text-muted">Dùng khi buổi học đã đến giờ. Bỏ chọn nếu chỉ lên lịch cho buổi sau.</span></span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 rounded-lg border border-border-subtle bg-surface-base p-4">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-border-strong bg-surface-base px-4 text-control font-semibold text-text-strong transition hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
                href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
              >
                Hủy
              </Link>

              <Button
                disabled={isPending}
                type="submit"
              >
                {isPending
                  ? "Đang tạo..."
                  : startImmediately ? "Tạo và vào điểm danh" : "Tạo buổi học"}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}

function FormField({
  children,
  error,
  label,
  required = false,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-label font-semibold text-text-strong">
      <span>
        {label}
        {required ? (
          <span className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </span>

      {children}

      {error ? (
        <span className="text-caption font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Notice({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-body text-warning">
      {children}
    </div>
  );
}

function optionalValue(
  value: string,
): string | null {
  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function firstError(
  errors: string[] | undefined,
): string | undefined {
  return errors?.[0];
}

function getIsoWeekday(
  dateValue: string,
): number {
  const date = new Date(
    `${dateValue}T00:00:00Z`,
  );

  const weekday = date.getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

function formatWeekday(
  weekday: number,
): string {
  const labels = [
    "",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
    "Chủ Nhật",
  ];

  return labels[weekday] ?? `Thứ ${weekday}`;
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function formatTime(
  value: string,
): string {
  return value.slice(0, 5);
}

function formatMode(
  value: SessionLearningMode,
): string {
  const labels: Record<
    SessionLearningMode,
    string
  > = {
    hybrid: "Kết hợp",
    offline: "Offline",
    online: "Online",
  };

  return labels[value];
}

function formatKind(
  value: Exclude<
    SessionKind,
    "additional"
  >,
): string {
  return value === "regular"
    ? "Buổi chính"
    : "Buổi bù";
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-border-subtle bg-field-bg px-3 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:bg-disabled-bg";
