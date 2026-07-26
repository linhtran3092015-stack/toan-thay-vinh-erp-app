"use client";

import type { ReactNode } from "react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  recordSessionResultAction,
  updateSessionResultAction,
} from "@/features/sessions/actions/session-result-actions";
import type {
  SessionAttendanceStatus,
  SessionNotebookStatus,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import type { SessionResultActionState } from "@/features/sessions/forms/result-action-types";
import type { SessionStatus } from "@/features/sessions/read-models";

interface SessionResultManagementProps {
  canManageResults: boolean;
  canViewStudents: boolean;
  lockedAt: string | null;
  participants: SessionParticipantReadModel[];
  sessionId: string;
  sessionStatus: SessionStatus;
}

interface ResultEditorState {
  comment: string;
  notebookScore: string;
  notebookStatus: SessionNotebookStatus;
  reason: string;
  resultId: string | null;
  studentId: string;
  testScore: string;
}

export function SessionResultManagement({
  canManageResults,
  canViewStudents,
  lockedAt,
  participants,
  sessionId,
  sessionStatus,
}: SessionResultManagementProps) {
  const router = useRouter();

  const [editor, setEditor] =
    useState<ResultEditorState | null>(
      null,
    );

  const [actionState, setActionState] =
    useState<
      SessionResultActionState | null
    >(null);

  const [isPending, startTransition] =
    useTransition();

  const canEdit =
    canManageResults &&
    lockedAt === null &&
    (
      sessionStatus === "in_progress" ||
      sessionStatus === "completed"
    );

  const summary = useMemo(() => {
    let eligible = 0;
    let resultRecorded = 0;
    let missingResult = 0;
    let missingTestScore = 0;

    for (const participant of participants) {
      if (!isResultEligible(participant)) {
        continue;
      }

      eligible += 1;

      if (!participant.resultId) {
        missingResult += 1;
        continue;
      }

      resultRecorded += 1;

      if (participant.testScore === null) {
        missingTestScore += 1;
      }
    }

    return {
      eligible,
      missingResult,
      missingTestScore,
      resultRecorded,
    };
  }, [participants]);

  const selectedParticipant =
    editor === null
      ? null
      : participants.find(
          (participant) =>
            participant.studentId ===
            editor.studentId,
        ) ?? null;

  const fieldErrors =
    actionState?.status === "error"
      ? actionState.fieldErrors ?? {}
      : {};

  const openEditor = (
    participant: SessionParticipantReadModel,
  ) => {
    setActionState(null);

    setEditor({
      comment:
        participant.resultComment ?? "",
      notebookScore: scoreToInput(
        participant.notebookScore,
      ),
      notebookStatus:
        participant.notebookStatus ??
        "not_submitted",
      reason: "",
      resultId: participant.resultId,
      studentId: participant.studentId,
      testScore: scoreToInput(
        participant.testScore,
      ),
    });
  };

  const closeEditor = () => {
    if (isPending) {
      return;
    }

    setEditor(null);
    setActionState(null);
  };

  const updateEditor = <
    Key extends keyof ResultEditorState,
  >(
    key: Key,
    value: ResultEditorState[Key],
  ) => {
    setActionState(null);

    setEditor((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  };

  const updateNotebookStatus = (
    notebookStatus: SessionNotebookStatus,
  ) => {
    setActionState(null);

    setEditor((current) =>
      current
        ? {
            ...current,
            notebookScore:
              notebookStatus === "submitted"
                ? current.notebookScore
                : "",
            notebookStatus,
          }
        : current,
    );
  };

  const submitResult = () => {
    if (!editor) {
      return;
    }

    setActionState(null);

    const commonInput = {
      comment:
        optionalText(editor.comment),
      notebookScore:
        editor.notebookStatus ===
        "submitted"
          ? parseOptionalScore(
              editor.notebookScore,
            )
          : null,
      notebookStatus:
        editor.notebookStatus,
      testScore: parseOptionalScore(
        editor.testScore,
      ),
    };

    startTransition(async () => {
      const result = editor.resultId
        ? await updateSessionResultAction({
            ...commonInput,
            reason: editor.reason,
            resultId: editor.resultId,
          })
        : await recordSessionResultAction({
            ...commonInput,
            classSessionId: sessionId,
            studentId: editor.studentId,
          });

      setActionState(result);

      if (result.status === "success") {
        setEditor(null);
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Kết quả cuối buổi
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">
            Đủ điều kiện: {summary.eligible}
          </Badge>

          <Badge tone="success">
            Đã có kết quả:{" "}
            {summary.resultRecorded}
          </Badge>

          <Badge tone="neutral">
            Chưa có kết quả:{" "}
            {summary.missingResult}
          </Badge>

          <Badge tone="neutral">
            Thiếu điểm kiểm tra:{" "}
            {summary.missingTestScore}
          </Badge>
        </div>

        <ResultPermissionNotice
          canEdit={canEdit}
          canManageResults={
            canManageResults
          }
          lockedAt={lockedAt}
          sessionStatus={sessionStatus}
        />

        {actionState?.status ===
        "success" ? (
          <div
            className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700"
            role="status"
          >
            {actionState.message}
          </div>
        ) : null}

        {editor && selectedParticipant ? (
          <ResultEditor
            actionState={actionState}
            editor={editor}
            fieldErrors={fieldErrors}
            isPending={isPending}
            onCancel={closeEditor}
            onChange={updateEditor}
            onNotebookStatusChange={
              updateNotebookStatus
            }
            onSubmit={submitResult}
            participant={
              selectedParticipant
            }
          />
        ) : null}

        {participants.length === 0 ? (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center">
            <p className="font-semibold text-ink">
              Chưa có học viên trong buổi học
            </p>

            <p className="mt-2 text-sm text-ink-muted">
              Chưa có roster, điểm danh hoặc dữ
              liệu học viên học thêm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-hairline">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-3 py-3">
                    Học viên
                  </th>

                  <th className="px-3 py-3">
                    Điểm danh
                  </th>

                  <th className="px-3 py-3">
                    Điểm kiểm tra
                  </th>

                  <th className="px-3 py-3">
                    Vở
                  </th>

                  <th className="px-3 py-3">
                    Nhận xét
                  </th>

                  <th className="px-3 py-3 text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {participants.map(
                  (participant, index) => {
                    const eligible =
                      isResultEligible(
                        participant,
                      );

                    return (
                      <tr
                        className="border-t border-hairline align-top"
                        key={
                          participant.studentId
                        }
                      >
                        <td className="px-3 py-4">
                          <p className="font-semibold text-ink">
                            {canViewStudents
                              ? participant
                                  .studentName ??
                                "Chưa có tên học viên"
                              : `Học viên ${
                                  index + 1
                                }`}
                          </p>

                          {canViewStudents &&
                          participant.studentCode ? (
                            <p className="mt-1 font-mono text-xs text-ink-muted">
                              {
                                participant
                                  .studentCode
                              }
                            </p>
                          ) : null}
                        </td>

                        <td className="px-3 py-4">
                          <AttendanceStatusBadge
                            status={
                              participant
                                .attendanceStatus
                            }
                          />

                          {!eligible ? (
                            <p className="mt-2 text-xs text-ink-muted">
                              Không được nhập kết
                              quả
                            </p>
                          ) : null}
                        </td>

                        <td className="px-3 py-4">
                          {formatScore(
                            participant.testScore,
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <p className="font-medium text-ink">
                            {formatNotebookStatus(
                              participant
                                .notebookStatus,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-ink-muted">
                            Điểm:{" "}
                            {formatScore(
                              participant
                                .notebookScore,
                            )}
                          </p>
                        </td>

                        <td className="max-w-[300px] px-3 py-4 text-ink-muted">
                          {participant
                            .resultComment ??
                            "Chưa có nhận xét"}
                        </td>

                        <td className="px-3 py-4 text-right">
                          {canEdit && eligible ? (
                            <Button
                              disabled={
                                isPending
                              }
                              onClick={() =>
                                openEditor(
                                  participant,
                                )
                              }
                              type="button"
                              variant="ghost"
                            >
                              {participant.resultId
                                ? "Sửa kết quả"
                                : "Nhập kết quả"}
                            </Button>
                          ) : (
                            <span className="text-xs text-ink-muted">
                              Chỉ đọc
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultEditor({
  actionState,
  editor,
  fieldErrors,
  isPending,
  onCancel,
  onChange,
  onNotebookStatusChange,
  onSubmit,
  participant,
}: {
  actionState:
    | SessionResultActionState
    | null;
  editor: ResultEditorState;
  fieldErrors: Record<
    string,
    string[] | undefined
  >;
  isPending: boolean;
  onCancel: () => void;
  onChange: <
    Key extends keyof ResultEditorState,
  >(
    key: Key,
    value: ResultEditorState[Key],
  ) => void;
  onNotebookStatusChange: (
    status: SessionNotebookStatus,
  ) => void;
  onSubmit: () => void;
  participant: SessionParticipantReadModel;
}) {
  const isUpdate =
    editor.resultId !== null;

  return (
    <div className="grid gap-4 rounded-md border border-secondary/30 bg-secondary/5 p-4">
      <div>
        <h3 className="font-semibold text-ink">
          {isUpdate
            ? "Cập nhật kết quả"
            : "Nhập kết quả"}
        </h3>

        <p className="mt-1 text-sm text-ink-muted">
          {participant.studentName ??
            participant.studentCode ??
            "Học viên được chọn"}
        </p>
      </div>

      <Notice tone="neutral">
        Có thể lưu kết quả chưa có điểm kiểm tra,
        nhưng buổi học chỉ được khóa khi mọi học
        viên có mặt hoặc học thêm đã có điểm kiểm
        tra.
      </Notice>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          error={firstError(
            fieldErrors.testScore,
          )}
          label="Điểm kiểm tra cuối buổi"
        >
          <input
            className={inputClassName}
            disabled={isPending}
            inputMode="decimal"
            max="10"
            min="0"
            onChange={(event) =>
              onChange(
                "testScore",
                event.target.value,
              )
            }
            placeholder="0–10"
            step="0.01"
            type="number"
            value={editor.testScore}
          />
        </FormField>

        <FormField
          error={firstError(
            fieldErrors.notebookStatus,
          )}
          label="Trạng thái vở"
          required
        >
          <select
            className={inputClassName}
            disabled={isPending}
            onChange={(event) =>
              onNotebookStatusChange(
                event.target
                  .value as SessionNotebookStatus,
              )
            }
            value={editor.notebookStatus}
          >
            <option value="submitted">
              Đã nộp
            </option>

            <option value="not_submitted">
              Chưa nộp
            </option>

            <option value="not_required">
              Không yêu cầu
            </option>
          </select>
        </FormField>

        <FormField
          error={firstError(
            fieldErrors.notebookScore,
          )}
          label="Điểm vở"
          required={
            editor.notebookStatus ===
            "submitted"
          }
        >
          <input
            className={inputClassName}
            disabled={
              isPending ||
              editor.notebookStatus !==
                "submitted"
            }
            inputMode="decimal"
            max="10"
            min="0"
            onChange={(event) =>
              onChange(
                "notebookScore",
                event.target.value,
              )
            }
            placeholder={
              editor.notebookStatus ===
              "submitted"
                ? "0–10"
                : "Không áp dụng"
            }
            step="0.01"
            type="number"
            value={editor.notebookScore}
          />
        </FormField>

        <FormField
          error={firstError(
            fieldErrors.comment,
          )}
          label="Nhận xét"
          wide
        >
          <textarea
            className={textareaClassName}
            disabled={isPending}
            maxLength={1000}
            onChange={(event) =>
              onChange(
                "comment",
                event.target.value,
              )
            }
            placeholder="Nhận xét về kết quả và tình hình học tập trong buổi..."
            value={editor.comment}
          />
        </FormField>

        {isUpdate ? (
          <FormField
            error={firstError(
              fieldErrors.reason,
            )}
            label="Lý do cập nhật"
            required
            wide
          >
            <textarea
              className={textareaClassName}
              disabled={isPending}
              maxLength={500}
              onChange={(event) =>
                onChange(
                  "reason",
                  event.target.value,
                )
              }
              placeholder="Ví dụ: Điều chỉnh sau khi đối soát bài kiểm tra..."
              value={editor.reason}
            />

            <span className="text-xs font-normal text-ink-muted">
              {editor.reason.trim().length}
              /500 ký tự
            </span>
          </FormField>
        ) : null}
      </div>

      {actionState?.status === "error" ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {actionState.message}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={isPending}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>

        <Button
          disabled={
            isPending ||
            (
              isUpdate &&
              editor.reason.trim().length < 3
            )
          }
          onClick={onSubmit}
          type="button"
        >
          {isPending
            ? "Đang lưu..."
            : isUpdate
              ? "Lưu cập nhật"
              : "Ghi kết quả"}
        </Button>
      </div>
    </div>
  );
}

function ResultPermissionNotice({
  canEdit,
  canManageResults,
  lockedAt,
  sessionStatus,
}: {
  canEdit: boolean;
  canManageResults: boolean;
  lockedAt: string | null;
  sessionStatus: SessionStatus;
}) {
  if (lockedAt) {
    return (
      <Notice tone="warning">
        Buổi học đã khóa nên không thể thay đổi
        kết quả.
      </Notice>
    );
  }

  if (sessionStatus === "cancelled") {
    return (
      <Notice tone="warning">
        Buổi học đã hủy nên không thể nhập kết
        quả.
      </Notice>
    );
  }

  if (sessionStatus === "scheduled") {
    return (
      <Notice tone="neutral">
        Cần bắt đầu buổi học trước khi nhập kết
        quả.
      </Notice>
    );
  }

  if (!canManageResults) {
    return (
      <Notice tone="neutral">
        Tài khoản hiện tại chỉ được xem kết quả.
      </Notice>
    );
  }

  if (
    sessionStatus === "completed" &&
    canEdit
  ) {
    return (
      <Notice tone="warning">
        Buổi học đã hoàn thành nhưng chưa khóa.
        Kết quả vẫn có thể bổ sung hoặc điều
        chỉnh.
      </Notice>
    );
  }

  return (
    <Notice tone="success">
      Có thể nhập và cập nhật kết quả cho học
      viên có mặt hoặc học thêm.
    </Notice>
  );
}

function AttendanceStatusBadge({
  status,
}: {
  status:
    | SessionAttendanceStatus
    | null;
}) {
  if (!status) {
    return (
      <Badge tone="neutral">
        Chưa điểm danh
      </Badge>
    );
  }

  const labels: Record<
    SessionAttendanceStatus,
    string
  > = {
    additional_study: "Học thêm",
    excused_absence: "Vắng có phép",
    present: "Có mặt",
    unexcused_absence: "Vắng không phép",
  };

  const tones: Record<
    SessionAttendanceStatus,
    "info" | "neutral" | "success"
  > = {
    additional_study: "info",
    excused_absence: "neutral",
    present: "success",
    unexcused_absence: "neutral",
  };

  return (
    <Badge tone={tones[status]}>
      {labels[status]}
    </Badge>
  );
}

function FormField({
  children,
  error,
  label,
  required = false,
  wide = false,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label
      className={`grid gap-1.5 text-sm font-semibold text-ink ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <span>
        {label}

        {required ? (
          <span className="text-red-600">
            {" "}
            *
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

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "success" | "warning";
}) {
  const classNames = {
    neutral:
      "border-hairline bg-surface-2 text-ink-muted",
    success:
      "border-green-200 bg-green-50 text-green-800",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div
      className={`rounded-md border p-3 text-sm ${classNames[tone]}`}
    >
      {children}
    </div>
  );
}

function isResultEligible(
  participant: SessionParticipantReadModel,
): boolean {
  return (
    participant.attendanceStatus ===
      "present" ||
    participant.attendanceStatus ===
      "additional_study"
  );
}

function scoreToInput(
  value: number | null,
): string {
  return value === null
    ? ""
    : String(value);
}

function parseOptionalScore(
  value: string,
): number | null {
  const normalized = value
    .trim()
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  return Number(normalized);
}

function optionalText(
  value: string,
): string | null {
  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function formatScore(
  value: number | null,
): string {
  if (value === null) {
    return "Chưa nhập";
  }

  return new Intl.NumberFormat(
    "vi-VN",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatNotebookStatus(
  value:
    | SessionNotebookStatus
    | null,
): string {
  if (value === "submitted") {
    return "Đã nộp";
  }

  if (value === "not_required") {
    return "Không yêu cầu";
  }

  if (value === "not_submitted") {
    return "Chưa nộp";
  }

  return "Chưa có kết quả";
}

function firstError(
  errors: string[] | undefined,
): string | undefined {
  return errors?.[0];
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-surface-2";

const textareaClassName =
  "min-h-24 rounded-md border border-hairline bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-surface-2";
