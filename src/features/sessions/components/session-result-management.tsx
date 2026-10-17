"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useEffect,
  useRef,
} from "react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { RosterSearch, matchesRosterSearch } from "@/features/sessions/components/roster-search";

import { Badge } from "@/components/ui/badge";
import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { attendanceStatusLabels, attendanceStatusTones, formatScore, notebookStatusLabels } from "@/features/sessions/components/attendance-status-group";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
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

  const triggerRef = useRef<HTMLElement | null>(null);
  const editorTitleId = useId();
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const visibleParticipants = participants.filter((participant, index) =>
    matchesRosterSearch(participant, index, search, canViewStudents) &&
    (!onlyMissing || (isResultEligible(participant) && (!participant.resultId || participant.testScore === null)))
  );

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
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActionState(null);

    setEditor({
      comment:
        participant.resultComment ?? "",
      notebookScore: scoreToInput(
        participant.notebookScore,
      ),
      notebookStatus:
        participant.notebookStatus ??
        "pending",
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

  const submitResult = (continueToNext = false) => {
    if (!editor || !canEdit || isPending) {
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
      try {
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
        const currentIndex = visibleParticipants.findIndex((item) => item.studentId === editor.studentId);
        const next = continueToNext
          ? visibleParticipants.slice(currentIndex + 1).find(isResultEligible)
          : null;
        if (next) {
          // Keep the original row as the return-focus target while advancing.
          const originalTrigger = triggerRef.current;
          openEditor(next);
          triggerRef.current = originalTrigger;
          setActionState(result);
        } else {
          setEditor(null);
        }
        router.refresh();
      }
      } catch {
        setActionState({ status: "error", message: "Chưa lưu được kết quả. Dữ liệu đang nhập được giữ lại, vui lòng thử lại." });
      }
    });
  };

  return (
    <Card className="shadow-[var(--panel-shadow)]">
      <CardHeader className="flex-wrap">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <CardTitle>Kết quả buổi học</CardTitle>
          <p className="text-secondary text-text-muted">Điểm kiểm tra 0–10 (2 số lẻ) · Vở: đã nộp phải có điểm vở · nhận xét ≤ 1.000 ký tự</p>
        </div>
        <p className="text-secondary tabular-nums text-text-muted">
          Đủ điều kiện {summary.eligible} · Đã có kết quả {summary.resultRecorded} · Chưa có kết quả {summary.missingResult} · Thiếu điểm kiểm tra {summary.missingTestScore}
        </p>
      </CardHeader>

      <CardContent className="grid gap-4">

        <ResultPermissionNotice
          canEdit={canEdit}
          canManageResults={
            canManageResults
          }
          lockedAt={lockedAt}
          sessionStatus={sessionStatus}
        />

        {actionState?.status === "success" ? (
          <div role="status">
            <ResultBanner title={actionState.message} tone="success" />
          </div>
        ) : null}

        <Dialog ariaLabelledBy={editorTitleId} className="max-w-2xl" isOpen={editor !== null && canEdit} onClose={closeEditor} returnFocusRef={triggerRef}>
        {editor && selectedParticipant ? (
          <ResultEditor
            titleId={editorTitleId}
            actionState={actionState}
            editor={editor}
            fieldErrors={fieldErrors}
            isPending={isPending}
            onCancel={closeEditor}
            onChange={updateEditor}
            onNotebookStatusChange={
              updateNotebookStatus
            }
            onSubmit={() => submitResult()}
            onSaveNext={() => submitResult(true)}
            participant={
              canViewStudents ? selectedParticipant : { ...selectedParticipant, studentName: `Học viên ${participants.indexOf(selectedParticipant) + 1}`, studentCode: null }
            }
          />
        ) : null}
        </Dialog>

        <RosterSearch
          search={search}
          onSearchChange={setSearch}
          onlyMissing={onlyMissing}
          onOnlyMissingChange={setOnlyMissing}
          missingLabel="Chưa đủ kết quả"
          visibleCount={visibleParticipants.length}
          totalCount={participants.length}
        />
        {visibleParticipants.length === 0 && participants.length > 0 ? <p className="py-6 text-center text-text-muted">Không có học viên phù hợp. Thử đổi từ khóa hoặc bỏ bộ lọc.</p> : null}

        {participants.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle p-6 text-center">
            <p className="font-semibold text-text-strong">
              Chưa có học viên trong buổi học
            </p>

            <p className="mt-2 text-body text-text-muted">
              Chưa có roster, điểm danh hoặc dữ
              liệu học viên học thêm.
            </p>
          </div>
        ) : (
          <div className="session-result-work-area">
          <DataTableFrame
            body={visibleParticipants.map((participant) => (
              <ResultTableRow
                canEdit={canEdit}
                canViewStudents={canViewStudents}
                index={participants.indexOf(participant)}
                isPending={isPending}
                key={participant.studentId}
                onEdit={openEditor}
                participant={participant}
              />
            ))}
            caption="Danh sách kết quả cuối buổi"
            className="session-result-table"
            footer={<ResultFooter participants={visibleParticipants} total={participants.length} />}
            header={
              <tr>
                <TableHeaderCell className="w-12">#</TableHeaderCell>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                <TableHeaderCell>Điểm danh</TableHeaderCell>
                <TableHeaderCell numeric>Điểm KT (/10)</TableHeaderCell>
                <TableHeaderCell>Vở bài tập</TableHeaderCell>
                <TableHeaderCell numeric>Điểm vở</TableHeaderCell>
                <TableHeaderCell>Nhận xét ngắn</TableHeaderCell>
                <TableHeaderCell numeric>Thao tác</TableHeaderCell>
              </tr>
            }
            tableClassName="min-w-[1120px]"
          />

          <ResponsiveRecordList className="session-result-record-list" label="Danh sách kết quả cuối buổi">
            {visibleParticipants.map((participant) => (
              <ResultRecord
                canEdit={canEdit}
                canViewStudents={canViewStudents}
                index={participants.indexOf(participant)}
                isPending={isPending}
                key={participant.studentId}
                onEdit={openEditor}
                participant={participant}
              />
            ))}
          </ResponsiveRecordList>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultTableRow({
  canEdit,
  canViewStudents,
  index,
  isPending,
  onEdit,
  participant,
}: {
  canEdit: boolean;
  canViewStudents: boolean;
  index: number;
  isPending: boolean;
  onEdit: (participant: SessionParticipantReadModel) => void;
  participant: SessionParticipantReadModel;
}) {
  const eligible = isResultEligible(participant);
  const missing = eligible && participant.resultId === null;

  return (
    <TableRow>
      <TableCell className="w-12 text-secondary tabular-nums text-text-muted">{index + 1}</TableCell>
      <TableCell className={`w-[220px] ${eligible ? "" : "[&_p]:text-text-muted"}`}>
        <ParticipantIdentity
          canViewStudents={canViewStudents}
          index={index}
          participant={participant}
        />
      </TableCell>
      <TableCell className="w-[150px]">
        <AttendanceStatusBadge status={participant.attendanceStatus} />
      </TableCell>
      <TableCell className={`w-[112px] font-semibold ${participant.testScore === null ? "text-text-muted" : "text-text-strong"}`} numeric>
        {formatScore(participant.testScore, "Chưa nhập")}
      </TableCell>
      <TableCell className={`w-[150px] text-secondary ${eligible ? "text-text-default" : "text-text-subtle"}`}>
        {eligible ? formatNotebookStatus(participant.notebookStatus) : "—"}
      </TableCell>
      <TableCell className={`w-[96px] ${participant.notebookScore === null ? "text-text-muted" : "text-text-strong"}`} numeric>
        {eligible ? formatScore(participant.notebookScore, "Chưa nhập") : "—"}
      </TableCell>
      <TableCell className="max-w-[300px] text-secondary text-text-muted">
        {!eligible ? (
          <span className="text-text-muted">Không nhập cho học sinh vắng</span>
        ) : missing ? (
          <span className="font-medium text-warning">Chưa nhập kết quả</span>
        ) : (
          participant.resultComment ?? <span className="text-text-subtle">—</span>
        )}
        {!eligible ? <span className="sr-only">Không được nhập kết quả</span> : null}
      </TableCell>
      <TableCell className="w-[132px]" numeric>
        <ResultAction
          canEdit={canEdit}
          eligible={eligible}
          isPending={isPending}
          onEdit={onEdit}
          participant={participant}
        />
      </TableCell>
    </TableRow>
  );
}

function ResultFooter({ participants, total }: { participants: SessionParticipantReadModel[]; total: number }) {
  const scores = participants.map((participant) => participant.testScore).filter((score): score is number => score !== null);
  const average = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

  return (
    <p className="tabular-nums">
      Hiển thị {participants.length} trong {total}
      {average !== null ? (
        <>
          {" "}· Điểm trung bình đã nhập: <strong className="font-semibold text-text-strong">{formatScore(Math.round(average * 10) / 10)}</strong>
        </>
      ) : null}
    </p>
  );
}

function ResultRecord({
  canEdit,
  canViewStudents,
  index,
  isPending,
  onEdit,
  participant,
}: {
  canEdit: boolean;
  canViewStudents: boolean;
  index: number;
  isPending: boolean;
  onEdit: (participant: SessionParticipantReadModel) => void;
  participant: SessionParticipantReadModel;
}) {
  const eligible = isResultEligible(participant);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <ParticipantIdentity canViewStudents={canViewStudents} index={index} participant={participant} />
        <AttendanceStatusBadge status={participant.attendanceStatus} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border-row pt-2 text-secondary text-text-default">
        <span>Điểm KT <strong className="font-semibold tabular-nums">{formatScore(participant.testScore, "Chưa nhập")}</strong></span>
        <span>Vở <strong className="font-semibold">{eligible ? formatNotebookStatus(participant.notebookStatus) : "—"}</strong></span>
        <span>Điểm vở <strong className="font-semibold tabular-nums">{eligible ? formatScore(participant.notebookScore, "Chưa nhập") : "—"}</strong></span>
      </div>
      <div className="mt-1.5 text-secondary text-text-muted">
        {!eligible ? <p>Không được nhập kết quả</p> : eligible && participant.resultId === null ? <p className="font-medium text-warning">Chưa nhập kết quả</p> : <p>{participant.resultComment ?? "Chưa có nhận xét"}</p>}
      </div>
      <div className="mt-2"><ResultAction canEdit={canEdit} eligible={eligible} fullWidth isPending={isPending} onEdit={onEdit} participant={participant} /></div>
    </article>
  );
}

function ParticipantIdentity({ canViewStudents, index, participant }: { canViewStudents: boolean; index: number; participant: SessionParticipantReadModel }) {
  return <div className="min-w-0"><p className="text-body font-semibold text-text-strong">{canViewStudents ? participant.studentName ?? "Chưa có tên học viên" : `Học viên ${index + 1}`}</p>{canViewStudents && participant.studentCode ? <p className="mt-0.5 text-caption tabular-nums text-text-muted">{participant.studentCode}</p> : null}</div>;
}

function ResultAction({ canEdit, eligible, fullWidth = false, isPending, onEdit, participant }: { canEdit: boolean; eligible: boolean; fullWidth?: boolean; isPending: boolean; onEdit: (participant: SessionParticipantReadModel) => void; participant: SessionParticipantReadModel }) {
  if (!canEdit || !eligible) return <span className="text-caption text-text-muted">Chỉ đọc</span>;
  const action = participant.resultId ? "Sửa kết quả" : "Nhập kết quả";
  return <Button aria-label={`${action} cho học viên`} className={fullWidth ? "w-full" : undefined} disabled={isPending} onClick={() => onEdit(participant)} size={fullWidth ? "lg" : "sm"} type="button" variant={fullWidth ? "secondary" : "ghost"}>{action}</Button>;
}

function ResultEditor({
  titleId,
  actionState,
  editor,
  fieldErrors,
  isPending,
  onCancel,
  onChange,
  onNotebookStatusChange,
  onSubmit,
  onSaveNext,
  participant,
}: {
  titleId: string;
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
  onSaveNext: () => void;
  participant: SessionParticipantReadModel;
}) {
  const isUpdate =
    editor.resultId !== null;
  const scoreRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    scoreRef.current?.focus({ preventScroll: true });
  }, [editor.studentId]);

  return (
    <div className="grid gap-4 rounded-md border border-border-subtle bg-surface-raised p-4" onKeyDown={(event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !isPending && (!isUpdate || editor.reason.trim().length >= 3)) {
        event.preventDefault();
        onSaveNext();
      }
    }}>
      <div>
        <h3 id={titleId} className="text-section-title font-semibold text-text-strong">
          {isUpdate
            ? "Cập nhật kết quả"
            : "Nhập kết quả"}
        </h3>

        <p className="mt-1 text-body text-text-muted">
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
            ref={scoreRef}
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
            <option value="pending">
              Chờ chấm vở
            </option>

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

            <span className="text-caption font-normal text-text-muted">
              {editor.reason.trim().length}
              /500 ký tự
            </span>
          </FormField>
        ) : null}
      </div>

      {actionState?.status === "error" ? <ResultBanner title={actionState.message} tone="error" /> : null}

      {actionState?.status === "success" ? <p role="status" className="text-success">Đã lưu học viên trước. Tiếp tục nhập cho học viên bên trên.</p> : null}
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-surface-raised py-2">
        <Button
          disabled={isPending}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>

        <Button
          disabled={isPending || (isUpdate && editor.reason.trim().length < 3)}
          onClick={onSaveNext}
          type="button"
          variant="secondary"
        >
          Lưu và học viên tiếp theo
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

  return (
    <Badge tone={attendanceStatusTones[status]}>
      {attendanceStatusLabels[status]}
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
  const controlId = useId();
  const errorId = useId();
  const [firstChild, ...supportingContent] = Children.toArray(children);
  const controlElement = firstChild as ReactElement<{
    "aria-describedby"?: string;
    id?: string;
  }>;
  const control = isValidElement(firstChild)
    ? cloneElement(
        controlElement,
        {
          id: controlId,
          "aria-describedby": error
            ? [
                controlElement.props["aria-describedby"],
                errorId,
              ]
                .filter(Boolean)
                .join(" ")
            : controlElement.props["aria-describedby"],
        },
      )
    : firstChild;

  return (
    <div
      className={`grid gap-1.5 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <label
        className="text-label font-semibold text-text-strong"
        htmlFor={controlId}
      >
        {label}

        {required ? (
          <span className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </label>

      {control}

      {supportingContent}

      {error ? (
        <span className="text-caption font-medium text-danger" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
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
    neutral: "border-border-subtle bg-surface-raised text-text-muted",
    success: "border-success-border bg-success-bg text-success",
    warning: "border-warning-border bg-warning-bg text-warning",
  };

  return (
    <div
      className={`rounded-md border p-3 text-body ${classNames[tone]}`}
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

function formatNotebookStatus(
  value:
    | SessionNotebookStatus
    | null,
): string {
  return value ? notebookStatusLabels[value] : "Chưa có kết quả";
}

function firstError(
  errors: string[] | undefined,
): string | undefined {
  return errors?.[0];
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-border-subtle bg-field-bg px-3 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

const textareaClassName =
  "min-h-24 rounded-md border border-border-subtle bg-field-bg px-3 py-2 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";
