"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
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
import { AttendanceStatusGroup, attendanceStatusLabels, attendanceStatusTones } from "@/features/sessions/components/attendance-status-group";
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

  const triggerRef = useRef<HTMLElement | null>(null);
  const editorTitleId = useId();
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const visibleParticipants = participants.filter((participant, index) =>
    matchesRosterSearch(participant, index, search, canViewStudents) &&
    (!onlyMissing || !participant.attendanceStatus)
  );

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

  const openEditor = (
    participant: SessionParticipantReadModel,
  ) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

  /** One tap saves the chosen status with the registered learning mode; notes and mode changes go through the editor. */
  const quickMark = (participant: SessionParticipantReadModel, attendanceStatus: SessionAttendanceStatus) => {
    if (!canEdit || isPending || participant.attendanceId) return;
    setActionState(null);
    startTransition(async () => {
      try {
        const result = await markSessionAttendanceAction({
          classSessionId: sessionId,
          studentId: participant.studentId,
          attendanceStatus,
          actualLearningMode: getInitialLearningMode(participant, defaultLearningMode),
          notes: null,
        });
        setActionState(result);
        if (result.status === "success") router.refresh();
      } catch {
        setActionState({ status: "error", message: "Chưa lưu được điểm danh. Vui lòng thử lại." });
      }
    });
  };

  const unmarkedParticipants = participants.filter((participant) => !participant.attendanceId);

  /** Marks every unmarked student present, one existing action per student. */
  const markAllPresent = () => {
    if (!canEdit || isPending || unmarkedParticipants.length === 0) return;
    setActionState(null);
    startTransition(async () => {
      let saved = 0;
      let failure: AttendanceActionState | null = null;
      for (const participant of unmarkedParticipants) {
        try {
          const result = await markSessionAttendanceAction({
            classSessionId: sessionId,
            studentId: participant.studentId,
            attendanceStatus: "present",
            actualLearningMode: getInitialLearningMode(participant, defaultLearningMode),
            notes: null,
          });
          if (result.status === "success") {
            saved += 1;
          } else {
            failure = result;
            break;
          }
        } catch {
          failure = { status: "error", message: "Chưa lưu được điểm danh. Vui lòng thử lại." };
          break;
        }
      }
      setActionState(
        failure
          ? { ...failure, message: `Đã ghi có mặt ${saved}/${unmarkedParticipants.length}. ${failure.message}` }
          : { status: "success", message: `Đã ghi có mặt cho ${saved} học sinh chưa chọn.`, attendanceId: "", classSessionId: sessionId },
      );
      router.refresh();
    });
  };

  const submitAttendance = () => {
    if (!editor || !canEdit || isPending) {
      return;
    }

    setActionState(null);

    startTransition(async () => {
      try {
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
      } catch {
        setActionState({ status: "error", message: "Chưa lưu được điểm danh. Dữ liệu đang nhập được giữ lại, vui lòng thử lại." });
      }
    });
  };

  return (
    <Card className="shadow-[var(--panel-shadow)]">
      <CardHeader className="flex-wrap">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <CardTitle>Điểm danh</CardTitle>
          <p className="text-secondary tabular-nums text-text-muted">
            Có mặt {attendanceSummary.present} · Học thêm {attendanceSummary.additional_study} · Vắng có phép {attendanceSummary.excused_absence} · Vắng không phép {attendanceSummary.unexcused_absence} · Chưa điểm danh {attendanceSummary.unmarked}
          </p>
        </div>
        {canEdit && unmarkedParticipants.length > 0 ? (
          <Button className="max-md:hidden" disabled={isPending} onClick={markAllPresent} size="sm" type="button" variant="secondary">
            Có mặt cho tất cả chưa chọn
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="grid gap-4">

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
          <div role="status">
            <ResultBanner title={actionState.message} tone="success" />
          </div>
        ) : null}

        <Dialog ariaLabelledBy={editorTitleId} className="max-w-2xl" isOpen={editor !== null && canEdit} onClose={closeEditor} returnFocusRef={triggerRef}>
        {editor && selectedParticipant ? (
          <AttendanceEditor
            titleId={editorTitleId}
            actionState={actionState}
            editor={editor}
            fieldErrors={fieldErrors}
            isPending={isPending}
            onCancel={closeEditor}
            onChange={updateEditor}
            onSubmit={submitAttendance}
            participant={
              canViewStudents ? selectedParticipant : { ...selectedParticipant, studentName: `Học viên ${participants.indexOf(selectedParticipant) + 1}`, studentCode: null }
            }
          />
        ) : null}
        </Dialog>

        {actionState?.status === "error" && !editor ? <ResultBanner title={actionState.message} tone="error" /> : null}
        <p className="text-secondary text-text-muted">Chọn trạng thái để lưu ngay theo hình thức đăng ký. Mở Điểm danh để đổi hình thức thực tế, thêm ghi chú, hoặc sửa một lượt đã lưu (cần lý do).</p>
        <RosterSearch
          search={search}
          onSearchChange={setSearch}
          onlyMissing={onlyMissing}
          onOnlyMissingChange={setOnlyMissing}
          missingLabel="Chưa điểm danh"
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
              Roster chưa có dữ liệu hoặc tài
              khoản hiện tại không có quyền xem
              học viên.
            </p>
          </div>
        ) : (
          <div className="session-attendance-work-area">
            <DataTableFrame
              body={visibleParticipants.map((participant) => (
                <AttendanceTableRow
                  canEdit={canEdit}
                  canViewStudents={canViewStudents}
                  index={participants.indexOf(participant)}
                  isPending={isPending}
                  key={participant.studentId}
                  onQuickMark={quickMark}
                  onEdit={openEditor}
                  participant={participant}
                />
              ))}
              caption="Danh sách điểm danh buổi học"
              className="session-attendance-table"
              header={<tr><TableHeaderCell className="w-12">#</TableHeaderCell><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell><TableHeaderCell>Hình thức</TableHeaderCell><TableHeaderCell>Ghi chú</TableHeaderCell><TableHeaderCell numeric>Thao tác</TableHeaderCell></tr>}
              tableClassName="min-w-[960px]"
            />
            <ResponsiveRecordList className="session-attendance-record-list" label="Danh sách điểm danh buổi học">
              {visibleParticipants.map((participant) => (
                <AttendanceRecord
                  canEdit={canEdit}
                  canViewStudents={canViewStudents}
                  index={participants.indexOf(participant)}
                  isPending={isPending}
                  key={participant.studentId}
                  onQuickMark={quickMark}
                  onEdit={openEditor}
                  participant={participant}
                />
              ))}
            </ResponsiveRecordList>
          </div>
        )}

        {canEdit && participants.length > 0 ? (
          <div className="sticky bottom-0 z-20 -mx-5 -mb-5 border-t border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--elevation-2)] md:hidden">
            <div className="flex items-center justify-between text-secondary">
              <span className="font-semibold tabular-nums text-text-strong">Đã điểm danh {participants.length - attendanceSummary.unmarked}/{participants.length}</span>
              <span className="tabular-nums text-text-muted">{attendanceSummary.unmarked} chưa chọn</span>
            </div>
            <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-row">
              <div className="progress-grow h-full rounded-full bg-action-primary" style={{ width: `${participants.length === 0 ? 0 : Math.round(((participants.length - attendanceSummary.unmarked) / participants.length) * 100)}%` }} />
            </div>
            {unmarkedParticipants.length > 0 ? (
              <Button className="mt-3 w-full" disabled={isPending} onClick={markAllPresent} size="lg" type="button" variant="secondary">
                Có mặt cho {unmarkedParticipants.length} bạn chưa chọn
              </Button>
            ) : (
              <p className="mt-2 text-secondary text-text-muted">Đã điểm danh đủ. Chuyển sang Kết quả.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface AttendanceRowProps {
  canEdit: boolean;
  canViewStudents: boolean;
  index: number;
  isPending: boolean;
  onQuickMark: (participant: SessionParticipantReadModel, status: SessionAttendanceStatus) => void;
  onEdit: (participant: SessionParticipantReadModel) => void;
  participant: SessionParticipantReadModel;
}

/** Unmarked rows save on tap; marked rows open the editor because a change needs a reason. */
function statusButtonLabel(participant: SessionParticipantReadModel) {
  return (status: SessionAttendanceStatus, label: string) =>
    participant.attendanceId
      ? `Đổi sang ${label} cho học viên`
      : status === "present"
        ? "Ghi có mặt cho học viên"
        : `Ghi ${label} cho học viên`;
}

function AttendanceTableRow({ canEdit, canViewStudents, index, isPending, onQuickMark, onEdit, participant }: AttendanceRowProps) {
  return (
    <TableRow>
      <TableCell className="w-12 text-secondary tabular-nums text-text-muted">{index + 1}</TableCell>
      <TableCell className="w-[220px]">
        <ParticipantIdentity canViewStudents={canViewStudents} index={index} participant={participant} />
      </TableCell>
      <TableCell className="w-[440px]">
        {canEdit ? (
          <AttendanceStatusGroup
            buttonLabel={statusButtonLabel(participant)}
            disabled={isPending}
            label={`Trạng thái điểm danh học viên ${index + 1}`}
            onSelect={(status) => (participant.attendanceId ? onEdit(participant) : onQuickMark(participant, status))}
            value={participant.attendanceStatus}
          />
        ) : (
          <AttendanceBadge status={participant.attendanceStatus} />
        )}
        {participant.isLateUpdate ? <p className="mt-1 text-caption font-semibold text-warning">Cập nhật muộn</p> : null}
      </TableCell>
      <TableCell className="w-[120px] text-secondary text-text-default">{formatActualMode(participant.actualLearningMode)}</TableCell>
      <TableCell className="max-w-[260px] text-secondary text-text-muted">{participant.attendanceNotes ?? <span className="text-text-subtle">—</span>}</TableCell>
      <TableCell className="w-[140px] text-right"><AttendanceAction canEdit={canEdit} isPending={isPending} onEdit={onEdit} participant={participant} /></TableCell>
    </TableRow>
  );
}

function AttendanceRecord({ canEdit, canViewStudents, index, isPending, onQuickMark, onEdit, participant }: AttendanceRowProps) {
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <ParticipantIdentity canViewStudents={canViewStudents} index={index} participant={participant} />
        {!canEdit || participant.attendanceId ? <AttendanceBadge status={participant.attendanceStatus} /> : null}
      </div>
      {canEdit ? (
        <AttendanceStatusGroup
          buttonLabel={statusButtonLabel(participant)}
          className="mt-2.5"
          disabled={isPending}
          label={`Trạng thái điểm danh học viên ${index + 1}`}
          layout="grid"
          onSelect={(status) => (participant.attendanceId ? onEdit(participant) : onQuickMark(participant, status))}
          value={participant.attendanceStatus}
        />
      ) : null}
      <div className="mt-2 grid gap-1 text-secondary text-text-muted">
        <p>Đăng ký: {formatRegisteredMode(participant.registeredMode)} · Thực tế: {formatActualMode(participant.actualLearningMode)}</p>
        {participant.attendanceNotes ? <p>{participant.attendanceNotes}</p> : null}
        {participant.isLateUpdate ? <p className="font-semibold text-warning">Cập nhật muộn</p> : null}
      </div>
      <div className="mt-2"><AttendanceAction canEdit={canEdit} fullWidth isPending={isPending} onEdit={onEdit} participant={participant} /></div>
    </article>
  );
}

function ParticipantIdentity({ canViewStudents, index, participant }: { canViewStudents: boolean; index: number; participant: SessionParticipantReadModel }) {
  return <div className="min-w-0"><p className="text-body font-semibold text-text-strong">{canViewStudents ? participant.studentName ?? "Chưa có tên học viên" : `Học viên ${index + 1}`}</p>{canViewStudents && participant.studentCode ? <p className="mt-0.5 font-mono text-caption text-text-muted">{participant.studentCode}</p> : null}</div>;
}

function AttendanceAction({ canEdit, fullWidth = false, isPending, onEdit, participant }: { canEdit: boolean; fullWidth?: boolean; isPending: boolean; onEdit: (participant: SessionParticipantReadModel) => void; participant: SessionParticipantReadModel }) {
  if (!canEdit) return <span className="text-caption text-text-muted">Chỉ đọc</span>;
  const action = participant.attendanceId ? "Sửa điểm danh" : "Điểm danh";
  return <div className={`flex flex-wrap gap-1 ${fullWidth ? "" : "justify-end"}`}>
    <Button aria-label={`${action} cho học viên`} className={fullWidth ? "w-full" : undefined} disabled={isPending} onClick={() => onEdit(participant)} size={fullWidth ? "lg" : "sm"} type="button" variant={fullWidth ? "secondary" : "ghost"}>{action}</Button>
  </div>;
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
    .replace(/đ/g, "d")
    .trim();
}

function AttendanceEditor({
  titleId,
  actionState,
  editor,
  fieldErrors,
  isPending,
  onCancel,
  onChange,
  onSubmit,
  participant,
}: {
  titleId: string;
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
        <h3 id={titleId} className="text-section-title font-semibold text-text-strong">
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
