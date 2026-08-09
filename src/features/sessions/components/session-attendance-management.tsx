"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import type { AdditionalStudyCandidate } from "@/features/sessions/attendance-data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  markSessionAttendanceAction,
  updateSessionAttendanceAction,
} from "@/features/sessions/actions/session-attendance-actions";
import type {
  SessionAttendanceStatus,
  SessionParticipantReadModel,
} from "@/features/sessions/detail-read-models";
import type {
  AttendanceActionState,
  AttendanceLearningMode,
} from "@/features/sessions/forms/attendance-action-types";
import type {
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";

interface SessionAttendanceManagementProps {
  additionalStudyCandidates:
    AdditionalStudyCandidate[];
  canMarkAttendance: boolean;
  canViewStudents: boolean;
  defaultLearningMode: SessionLearningMode;
  lockedAt: string | null;
  participants: SessionParticipantReadModel[];
  sessionId: string;
  sessionStatus: SessionStatus;
}

interface AttendanceEditorState {
  actualLearningMode: AttendanceLearningMode;
  attendanceId: string | null;
  attendanceStatus: SessionAttendanceStatus;
  notes: string;
  reason: string;
  studentId: string;
}

export function SessionAttendanceManagement({
  additionalStudyCandidates,
  canMarkAttendance,
  canViewStudents,
  defaultLearningMode,
  lockedAt,
  participants,
  sessionId,
  sessionStatus,
}: SessionAttendanceManagementProps) {
  const router = useRouter();

  const [editor, setEditor] =
    useState<AttendanceEditorState | null>(
      null,
    );

  const [actionState, setActionState] =
    useState<AttendanceActionState | null>(
      null,
    );

  const [isPending, startTransition] =
    useTransition();

  const feedbackRef = useRef<HTMLDivElement>(null);

  const canEdit =
    canMarkAttendance &&
    lockedAt === null &&
    (
      sessionStatus === "in_progress" ||
      sessionStatus === "completed"
    );

  const attendanceSummary = useMemo(() => {
    const summary: Record<
      SessionAttendanceStatus,
      number
    > = {
      additional_study: 0,
      excused_absence: 0,
      present: 0,
      unexcused_absence: 0,
    };

    let unmarked = 0;

    for (const participant of participants) {
      if (!participant.attendanceStatus) {
        unmarked += 1;
        continue;
      }

      summary[
        participant.attendanceStatus
      ] += 1;
    }

    return {
      ...summary,
      unmarked,
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

  useEffect(() => {
    if (actionState?.status === "success") {
      feedbackRef.current?.focus();
    }
  }, [actionState]);

  const openEditor = (
    participant: SessionParticipantReadModel,
  ) => {
    setActionState(null);

    setEditor({
      actualLearningMode:
        getInitialLearningMode(
          participant,
          defaultLearningMode,
        ),
      attendanceId:
        participant.attendanceId,
      attendanceStatus:
        participant.attendanceStatus ??
        "present",
      notes:
        participant.attendanceNotes ?? "",
      reason: "",
      studentId: participant.studentId,
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
    Key extends keyof AttendanceEditorState,
  >(
    key: Key,
    value: AttendanceEditorState[Key],
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

  const submitAttendance = () => {
    if (!editor) {
      return;
    }

    setActionState(null);

    startTransition(async () => {
      const result = editor.attendanceId
        ? await updateSessionAttendanceAction({
            actualLearningMode:
              editor.actualLearningMode,
            attendanceId:
              editor.attendanceId,
            attendanceStatus:
              editor.attendanceStatus,
            notes:
              optionalValue(editor.notes),
            reason: editor.reason,
          })
        : await markSessionAttendanceAction({
            actualLearningMode:
              editor.actualLearningMode,
            attendanceStatus:
              editor.attendanceStatus,
            classSessionId: sessionId,
            notes:
              optionalValue(editor.notes),
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
          Quản lý điểm danh
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">
            Có mặt:{" "}
            {attendanceSummary.present}
          </Badge>

          <Badge tone="neutral">
            Vắng có phép:{" "}
            {
              attendanceSummary
                .excused_absence
            }
          </Badge>

          <Badge tone="neutral">
            Vắng không phép:{" "}
            {
              attendanceSummary
                .unexcused_absence
            }
          </Badge>

          <Badge tone="info">
            Học thêm:{" "}
            {
              attendanceSummary
                .additional_study
            }
          </Badge>

          <Badge tone="purple">
            Chưa điểm danh:{" "}
            {attendanceSummary.unmarked}
          </Badge>
        </div>

        <AttendancePermissionNotice
          canEdit={canEdit}
          canMarkAttendance={
            canMarkAttendance
          }
          lockedAt={lockedAt}
          sessionStatus={sessionStatus}
        />

        {canEdit &&
        canViewStudents ? (
          <AdditionalStudyPanel
            candidates={
              additionalStudyCandidates
            }
            defaultLearningMode={
              defaultLearningMode
            }
            existingStudentIds={
              participants.map(
                (participant) =>
                  participant.studentId,
              )
            }
            sessionId={sessionId}
          />
        ) : null}

        {actionState?.status === "success" ? (
          <div ref={feedbackRef} tabIndex={-1}>
            <ResultBanner title={actionState.message} tone="success" />
          </div>
        ) : null}

        {editor && selectedParticipant ? (
          <AttendanceEditor
            actionState={actionState}
            editor={editor}
            fieldErrors={fieldErrors}
            isPending={isPending}
            onCancel={closeEditor}
            onChange={updateEditor}
            onSubmit={submitAttendance}
            participant={
              selectedParticipant
            }
          />
        ) : null}

        {participants.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle p-6 text-center">
            <p className="font-semibold text-text-strong">
              Chưa có học viên trong buổi học
            </p>

            <p className="mt-2 text-body text-text-muted">
              Roster chưa có dữ liệu hoặc tài
              khoản hiện tại không có quyền xem
              học viên.
            </p>
          </div>
        ) : (
          <div className="session-attendance-work-area">
            <DataTableFrame
              body={participants.map((participant, index) => (
                <AttendanceTableRow
                  canEdit={canEdit}
                  canViewStudents={canViewStudents}
                  index={index}
                  isPending={isPending}
                  key={participant.studentId}
                  onEdit={openEditor}
                  participant={participant}
                />
              ))}
              caption="Danh sách điểm danh buổi học"
              className="session-attendance-table"
              header={<tr><TableHeader>Học viên</TableHeader><TableHeader>Hình thức đăng ký</TableHeader><TableHeader>Trạng thái</TableHeader><TableHeader>Hình thức thực tế</TableHeader><TableHeader>Ghi chú</TableHeader><TableHeader className="text-right">Thao tác</TableHeader></tr>}
              tableClassName="min-w-[960px] table-fixed text-table-body text-text-default"
            />
            <ResponsiveRecordList className="session-attendance-record-list" label="Danh sách điểm danh buổi học">
              {participants.map((participant, index) => (
                <AttendanceRecord
                  canEdit={canEdit}
                  canViewStudents={canViewStudents}
                  index={index}
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

function AttendanceTableRow({
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
  return (
    <tr className="transition-colors hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[190px]">
        <ParticipantIdentity canViewStudents={canViewStudents} index={index} participant={participant} />
      </TableCell>
      <TableCell className="w-[140px] text-secondary text-text-muted">{formatRegisteredMode(participant.registeredMode)}</TableCell>
      <TableCell className="w-[170px]"><AttendanceBadge status={participant.attendanceStatus} />{participant.isLateUpdate ? <p className="mt-1 text-caption font-semibold text-warning">Cập nhật muộn</p> : null}</TableCell>
      <TableCell className="w-[145px] text-secondary text-text-muted">{formatActualMode(participant.actualLearningMode)}</TableCell>
      <TableCell className="max-w-[260px] text-secondary text-text-muted">{participant.attendanceNotes ?? "Chưa có ghi chú"}</TableCell>
      <TableCell className="w-[132px] text-right"><AttendanceAction canEdit={canEdit} isPending={isPending} onEdit={onEdit} participant={participant} /></TableCell>
    </tr>
  );
}

function AttendanceRecord({
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
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3"><ParticipantIdentity canViewStudents={canViewStudents} index={index} participant={participant} /><AttendanceBadge status={participant.attendanceStatus} /></div>
      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted"><p>Đăng ký: {formatRegisteredMode(participant.registeredMode)} · Thực tế: {formatActualMode(participant.actualLearningMode)}</p><p>{participant.attendanceNotes ?? "Chưa có ghi chú"}</p>{participant.isLateUpdate ? <p className="font-semibold text-warning">Cập nhật muộn</p> : null}</div>
      <div className="mt-3"><AttendanceAction canEdit={canEdit} fullWidth isPending={isPending} onEdit={onEdit} participant={participant} /></div>
    </article>
  );
}

function ParticipantIdentity({ canViewStudents, index, participant }: { canViewStudents: boolean; index: number; participant: SessionParticipantReadModel }) {
  return <div className="min-w-0"><p className="text-body font-semibold text-text-strong">{canViewStudents ? participant.studentName ?? "Chưa có tên học viên" : `Học viên ${index + 1}`}</p>{canViewStudents && participant.studentCode ? <p className="mt-0.5 font-mono text-caption text-text-muted">{participant.studentCode}</p> : null}</div>;
}

function AttendanceAction({ canEdit, fullWidth = false, isPending, onEdit, participant }: { canEdit: boolean; fullWidth?: boolean; isPending: boolean; onEdit: (participant: SessionParticipantReadModel) => void; participant: SessionParticipantReadModel }) {
  if (!canEdit) return <span className="text-caption text-text-muted">Chỉ đọc</span>;
  const action = participant.attendanceId ? "Sửa điểm danh" : "Điểm danh";
  return <Button aria-label={`${action} cho học viên`} className={fullWidth ? "min-h-11 w-full" : undefined} disabled={isPending} onClick={() => onEdit(participant)} size={fullWidth ? "md" : "sm"} type="button" variant="ghost">{action}</Button>;
}

function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className ?? ""}`} scope="col">{children}</th>;
}

function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`h-14 px-3 align-middle text-table-body ${className ?? ""}`}>{children}</td>;
}

function AdditionalStudyPanel({
  candidates,
  defaultLearningMode,
  existingStudentIds,
  sessionId,
}: {
  candidates: AdditionalStudyCandidate[];
  defaultLearningMode: SessionLearningMode;
  existingStudentIds: string[];
  sessionId: string;
}) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [studentId, setStudentId] =
    useState("");

  const [
    actualLearningMode,
    setActualLearningMode,
  ] = useState<AttendanceLearningMode>(
    defaultLearningMode === "online"
      ? "online"
      : "offline",
  );

  const [notes, setNotes] =
    useState("");

  const [actionState, setActionState] =
    useState<AttendanceActionState | null>(
      null,
    );

  const [isPending, startTransition] =
    useTransition();

  const existingIdSet = useMemo(
    () => new Set(existingStudentIds),
    [existingStudentIds],
  );

  const availableCandidates = useMemo(() => {
    const normalizedSearch =
      normalizeSearch(search);

    return candidates.filter((candidate) => {
      if (existingIdSet.has(candidate.id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        normalizeSearch(
          candidate.fullName,
        ).includes(normalizedSearch) ||
        normalizeSearch(
          candidate.publicCode,
        ).includes(normalizedSearch)
      );
    });
  }, [
    candidates,
    existingIdSet,
    search,
  ]);

  const selectedCandidate =
    candidates.find(
      (candidate) =>
        candidate.id === studentId,
    ) ?? null;

  const handleStudentChange = (
    nextStudentId: string,
  ) => {
    const candidate =
      candidates.find(
        (item) =>
          item.id === nextStudentId,
      ) ?? null;

    setStudentId(nextStudentId);
    setActionState(null);

    if (
      candidate?.registeredMode ===
        "online" ||
      candidate?.registeredMode ===
        "offline"
    ) {
      setActualLearningMode(
        candidate.registeredMode,
      );
    }
  };

  const reset = () => {
    setIsOpen(false);
    setSearch("");
    setStudentId("");
    setNotes("");
    setActionState(null);

    setActualLearningMode(
      defaultLearningMode === "online"
        ? "online"
        : "offline",
    );
  };

  const submit = () => {
    if (!studentId) {
      setActionState({
        fieldErrors: {
          studentId: [
            "Bắt buộc chọn học viên.",
          ],
        },
        message:
          "Vui lòng chọn học viên học thêm.",
        status: "error",
      });

      return;
    }

    setActionState(null);

    startTransition(async () => {
      const result =
        await markSessionAttendanceAction({
          actualLearningMode,
          attendanceStatus:
            "additional_study",
          classSessionId: sessionId,
          notes: optionalValue(notes),
          studentId,
        });

      setActionState(result);

      if (result.status === "success") {
        reset();
        router.refresh();
      }
    });
  };

  if (!isOpen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border-subtle bg-surface-raised p-3">
        <div>
          <p className="font-semibold text-text-strong">
            Học viên học thêm
          </p>

          <p className="mt-1 text-body text-text-muted">
            Thêm học viên chính thức không thuộc
            roster của lớp vào buổi học này.
          </p>
        </div>

        <Button
          onClick={() => setIsOpen(true)}
          type="button"
          variant="ghost"
        >
          Thêm học viên học thêm
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-md border border-border-subtle bg-surface-raised p-4">
      <div>
        <h3 className="text-section-title font-semibold text-text-strong">
          Thêm học viên học thêm
        </h3>

        <p className="mt-1 text-body text-text-muted">
          Trạng thái sẽ được ghi cố định là
          “Học thêm”.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Tìm học viên"
          wide
        >
          <input
            className={inputClassName}
            disabled={isPending}
            onChange={(event) => {
              setSearch(event.target.value);
              setStudentId("");
              setActionState(null);
            }}
            placeholder="Nhập tên hoặc mã học viên"
            type="search"
            value={search}
          />
        </FormField>

        <FormField
          error={firstError(
            actionState?.status === "error"
              ? actionState.fieldErrors
                  ?.studentId
              : undefined,
          )}
          label="Học viên"
          required
          wide
        >
          <select
            className={inputClassName}
            disabled={
              isPending ||
              availableCandidates.length === 0
            }
            onChange={(event) =>
              handleStudentChange(
                event.target.value,
              )
            }
            value={studentId}
          >
            <option value="">
              Chọn học viên
            </option>

            {availableCandidates
              .slice(0, 100)
              .map((candidate) => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                >
                  {candidate.publicCode}
                  {" – "}
                  {candidate.fullName}
                  {candidate.currentGrade
                    ? ` · Khối ${candidate.currentGrade}`
                    : ""}
                </option>
              ))}
          </select>
        </FormField>

        <FormField
          label="Trạng thái"
        >
          <input
            className={inputClassName}
            disabled
            value="Học thêm"
          />
        </FormField>

        <FormField
          label="Hình thức thực tế"
          required
        >
          <select
            className={inputClassName}
            disabled={isPending}
            onChange={(event) =>
              setActualLearningMode(
                event.target
                  .value as AttendanceLearningMode,
              )
            }
            value={actualLearningMode}
          >
            <option value="offline">
              Offline
            </option>

            <option value="online">
              Online
            </option>
          </select>
        </FormField>

        <FormField
          label="Ghi chú"
          wide
        >
          <textarea
            className={textareaClassName}
            disabled={isPending}
            maxLength={1000}
            onChange={(event) => {
              setNotes(event.target.value);
              setActionState(null);
            }}
            placeholder="Ghi chú về việc tham gia học thêm..."
            value={notes}
          />
        </FormField>
      </div>

      {selectedCandidate ? (
        <Notice tone="neutral">
          Đã chọn{" "}
          <strong>
            {selectedCandidate.publicCode} –{" "}
            {selectedCandidate.fullName}
          </strong>
          .
        </Notice>
      ) : null}

      {availableCandidates.length === 0 ? (
        <Notice tone="warning">
          Không còn học viên phù hợp hoặc không
          tìm thấy học viên theo từ khóa.
        </Notice>
      ) : null}

      {actionState?.status === "error" ? <ResultBanner title={actionState.message} tone="error" /> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={isPending}
          onClick={reset}
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>

        <Button
          disabled={
            isPending ||
            studentId.length === 0
          }
          onClick={submit}
          type="button"
        >
          {isPending
            ? "Đang thêm..."
            : "Thêm học viên"}
        </Button>
      </div>
    </div>
  );
}

function normalizeSearch(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .trim();
}

function AttendanceEditor({
  actionState,
  editor,
  fieldErrors,
  isPending,
  onCancel,
  onChange,
  onSubmit,
  participant,
}: {
  actionState: AttendanceActionState | null;
  editor: AttendanceEditorState;
  fieldErrors: Record<
    string,
    string[] | undefined
  >;
  isPending: boolean;
  onCancel: () => void;
  onChange: <
    Key extends keyof AttendanceEditorState,
  >(
    key: Key,
    value: AttendanceEditorState[Key],
  ) => void;
  onSubmit: () => void;
  participant: SessionParticipantReadModel;
}) {
  const isUpdate =
    editor.attendanceId !== null;

  return (
    <div className="grid gap-4 rounded-md border border-border-subtle bg-surface-raised p-4">
      <div>
        <h3 className="text-section-title font-semibold text-text-strong">
          {isUpdate
            ? "Cập nhật điểm danh"
            : "Ghi điểm danh"}
        </h3>

        <p className="mt-1 text-body text-text-muted">
          {participant.studentName ??
            participant.studentCode ??
            "Học viên được chọn"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          error={firstError(
            fieldErrors.attendanceStatus,
          )}
          label="Trạng thái điểm danh"
          required
        >
          <select
            className={inputClassName}
            disabled={isPending}
            onChange={(event) =>
              onChange(
                "attendanceStatus",
                event.target
                  .value as SessionAttendanceStatus,
              )
            }
            value={editor.attendanceStatus}
          >
            <option value="present">
              Có mặt
            </option>

            <option value="excused_absence">
              Vắng có phép
            </option>

            <option value="unexcused_absence">
              Vắng không phép
            </option>

            <option value="additional_study">
              Học thêm
            </option>
          </select>
        </FormField>

        <FormField
          error={firstError(
            fieldErrors.actualLearningMode,
          )}
          label="Hình thức thực tế"
          required
        >
          <select
            className={inputClassName}
            disabled={isPending}
            onChange={(event) =>
              onChange(
                "actualLearningMode",
                event.target
                  .value as AttendanceLearningMode,
              )
            }
            value={
              editor.actualLearningMode
            }
          >
            <option value="offline">
              Offline
            </option>

            <option value="online">
              Online
            </option>
          </select>
        </FormField>

        <FormField
          error={firstError(
            fieldErrors.notes,
          )}
          label="Ghi chú điểm danh"
          wide
        >
          <textarea
            className={textareaClassName}
            disabled={isPending}
            maxLength={1000}
            onChange={(event) =>
              onChange(
                "notes",
                event.target.value,
              )
            }
            placeholder="Ghi chú về tình trạng tham gia buổi học..."
            value={editor.notes}
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
              placeholder="Ví dụ: Điều chỉnh sau khi đối soát với trợ giảng..."
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
              : "Ghi điểm danh"}
        </Button>
      </div>
    </div>
  );
}

function AttendancePermissionNotice({
  canEdit,
  canMarkAttendance,
  lockedAt,
  sessionStatus,
}: {
  canEdit: boolean;
  canMarkAttendance: boolean;
  lockedAt: string | null;
  sessionStatus: SessionStatus;
}) {
  if (lockedAt) {
    return (
      <Notice tone="warning">
        Buổi học đã khóa nên không thể thay đổi
        điểm danh.
      </Notice>
    );
  }

  if (sessionStatus === "cancelled") {
    return (
      <Notice tone="warning">
        Buổi học đã hủy nên không thể nhập điểm
        danh.
      </Notice>
    );
  }

  if (sessionStatus === "scheduled") {
    return (
      <Notice tone="neutral">
        Cần bắt đầu buổi học trước khi nhập điểm
        danh.
      </Notice>
    );
  }

  if (!canMarkAttendance) {
    return (
      <Notice tone="neutral">
        Tài khoản hiện tại chỉ được xem điểm
        danh.
      </Notice>
    );
  }

  if (
    sessionStatus === "completed" &&
    canEdit
  ) {
    return (
      <Notice tone="warning">
        Buổi học đã hoàn thành. Mọi điểm danh
        được bổ sung hoặc sửa lúc này có thể được
        ghi nhận là cập nhật muộn.
      </Notice>
    );
  }

  return (
    <Notice tone="success">
      Có thể nhập và cập nhật điểm danh cho buổi
      học đang diễn ra.
    </Notice>
  );
}

function AttendanceBadge({
  status,
}: {
  status: SessionAttendanceStatus | null;
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

function getInitialLearningMode(
  participant: SessionParticipantReadModel,
  defaultLearningMode: SessionLearningMode,
): AttendanceLearningMode {
  if (
    participant.actualLearningMode ===
      "online" ||
    participant.actualLearningMode ===
      "offline"
  ) {
    return participant.actualLearningMode;
  }

  if (
    participant.registeredMode ===
      "online" ||
    participant.registeredMode ===
      "offline"
  ) {
    return participant.registeredMode;
  }

  return defaultLearningMode === "online"
    ? "online"
    : "offline";
}

function formatRegisteredMode(
  value: string | null,
): string {
  if (value === "online") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  return "Học thêm/Chưa xác định";
}

function formatActualMode(
  value: "online" | "offline" | null,
): string {
  if (value === "online") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  return "Chưa xác định";
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
  value: string[] | undefined,
): string | undefined {
  return value?.[0];
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-border-subtle bg-field-bg px-3 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

const textareaClassName =
  "min-h-24 rounded-md border border-border-subtle bg-field-bg px-3 py-2 text-body font-normal text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";
