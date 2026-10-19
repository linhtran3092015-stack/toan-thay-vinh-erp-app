"use client";

import { useEffect, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { GradingReviewActions } from "@/features/grading-submissions/components/review-actions";
import type { IgnoredGradingSubmission, UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import type { SessionCandidate } from "@/features/grading-submissions/matching";
import {
  filterMatchCandidates,
  isWithinSubmissionWindow,
  sortMatchCandidates,
  suggestSessionId,
  type MatchCandidateStudent,
} from "@/features/grading-submissions/review";
import { attendanceStatusLabels } from "@/features/sessions/components/attendance-status-group";
import { getStudentLifecycleStatusLabel } from "@/features/students/form/student-profile-form-helpers";
import { formatIsoDate, formatTime, toVietnamDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** How many students the picker shows before asking to type. */
const VISIBLE_STUDENTS = 40;

const optionClassName =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-focus-ring";

/** Per-row actions on "Bài nộp chưa ghép": match by hand, or mark as junk. */
export function SubmissionReviewActions({
  actions,
  item,
  onDone,
}: {
  actions: GradingReviewActions;
  item: UnmatchedGradingSubmission;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "ignore" | "match">("idle");
  // Shown in place until the list refreshes and the row leaves it, so the result is visible where the
  // tap happened (the page banner may be scrolled out of view on a phone).
  const [done, setDone] = useState<string | null>(null);
  const finish = (message: string) => {
    setDone(message);
    onDone(message);
  };

  if (done) return <ResultBanner title={done} tone="success" />;
  if (mode === "match") {
    return <MatchSubmissionPanel actions={actions} item={item} onCancel={() => setMode("idle")} onDone={finish} />;
  }
  if (mode === "ignore") {
    return <IgnoreSubmissionForm actions={actions} item={item} onCancel={() => setMode("idle")} onDone={finish} />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button className="flex-1 sm:flex-none" onClick={() => setMode("match")} size="sm" type="button" variant="outline">
        Ghép tay
      </Button>
      <Button className="flex-1 sm:flex-none" onClick={() => setMode("ignore")} size="sm" type="button" variant="ghost">
        Bỏ qua (bài rác)
      </Button>
    </div>
  );
}

function MatchSubmissionPanel({
  actions,
  item,
  onCancel,
  onDone,
}: {
  actions: GradingReviewActions;
  item: UnmatchedGradingSubmission;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const submittedOn = toVietnamDate(item.submittedAt);
  const [students, setStudents] = useState<MatchCandidateStudent[] | null>(null);
  const [search, setSearch] = useState<{ query: string; students: MatchCandidateStudent[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Kept as the object: a student picked from a search stays picked after the search is cleared.
  const [selected, setSelected] = useState<MatchCandidateStudent | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    let active = true;
    actions.loadCandidates({ submissionId: item.id }).then(
      (result) => {
        if (!active) return;
        if (!result.ok) {
          setLoadError(result.message);
          return;
        }
        setStudents(sortMatchCandidates(result.students, item.claimedBirthYear));
        // The student the webhook already recognised (session still unknown) starts selected.
        const recognised = result.students.find((student) => student.id === item.student?.id);
        if (recognised) {
          setSelected(recognised);
          setSessionId(suggestSessionId(recognised.sessions, item.submittedAt, item.claimedClassSessionId));
        }
      },
      () => {
        if (active) setLoadError("Không tải được danh sách học sinh. Vui lòng thử lại.");
      },
    );
    return () => {
      active = false;
    };
  }, [actions, item.claimedBirthYear, item.claimedClassSessionId, item.id, item.student?.id, item.submittedAt]);

  const listed = search ? search.students : filterMatchCandidates(students ?? [], filter);
  const visible = listed.slice(0, VISIBLE_STUDENTS);
  const canSearchAll = filter.trim().length >= 2 && !search;
  const canSave = Boolean(selected && sessionId && selected.sessions.some((session) => session.classSessionId === sessionId));

  const pickStudent = (student: MatchCandidateStudent) => {
    setError(null);
    setSelected(student);
    setSessionId(suggestSessionId(student.sessions, item.submittedAt, item.claimedClassSessionId));
  };

  const searchAll = () => {
    const query = filter.trim();
    setError(null);
    startSearch(async () => {
      const result = await actions.loadCandidates({ query, submissionId: item.id });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSearch({ query, students: sortMatchCandidates(result.students, item.claimedBirthYear) });
    });
  };

  const save = () => {
    if (!selected || !sessionId || isSaving) return;
    setError(null);
    startSave(async () => {
      const result = await actions.match({
        classSessionId: sessionId,
        reason: note.trim() || null,
        studentId: selected.id,
        submissionId: item.id,
      });
      if (result.ok) onDone(result.message);
      else setError(result.message);
    });
  };

  return (
    <section aria-label="Ghép tay" className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3">
      <p className="text-secondary text-text-default">
        Chọn học sinh, rồi chọn buổi của em ngày <span className="font-semibold">{formatIsoDate(submittedOn)}</span> (ngày nộp).
      </p>

      {loadError ? <ResultBanner title={loadError} tone="error" /> : null}
      {!students && !loadError ? <p className="text-secondary text-text-muted">Đang tải danh sách học sinh…</p> : null}

      {students ? (
        <fieldset className="grid min-w-0 gap-2">
          <legend className="mb-1 text-label font-medium text-text-strong">Học sinh</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Lọc học sinh theo tên hoặc mã"
              disabled={isSaving}
              maxLength={100}
              onChange={(event) => {
                setFilter(event.target.value);
                setSearch(null);
              }}
              placeholder="Gõ tên hoặc mã để lọc"
              value={filter}
            />
            {canSearchAll ? (
              <Button className="shrink-0" disabled={isSearching || isSaving} isLoading={isSearching} onClick={searchAll} size="sm" type="button" variant="outline">
                Tìm cả năm sinh khác
              </Button>
            ) : null}
          </div>
          {search ? null : (
            <p className="text-caption text-text-muted">Đang hiện các em sinh {item.claimedBirthYear} có lớp hoặc buổi học ngày nộp.</p>
          )}
          {search ? (
            <p className="flex flex-wrap items-center gap-2 text-caption text-text-muted">
              Kết quả tìm “{search.query}” (mọi năm sinh, chỉ các em có lớp hoặc buổi học ngày nộp).
              <button className="font-semibold text-action-link hover:underline" onClick={() => setSearch(null)} type="button">
                Quay lại các em sinh {item.claimedBirthYear}
              </button>
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="text-secondary text-text-muted">
              {search || filter.trim() ? "Không có học sinh phù hợp." : `Không có học sinh sinh ${item.claimedBirthYear} đang học vào ngày nộp.`}
            </p>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {visible.map((student) => (
                <StudentOption
                  checked={student.id === selected?.id}
                  disabled={isSaving}
                  groupName={`grading-student-${item.id}`}
                  key={student.id}
                  onPick={() => pickStudent(student)}
                  student={student}
                />
              ))}
            </div>
          )}
          {listed.length > visible.length ? (
            <p className="text-caption text-text-muted">Còn {listed.length - visible.length} em nữa, gõ tên để lọc.</p>
          ) : null}
        </fieldset>
      ) : null}

      {selected ? (
        <fieldset className="grid min-w-0 gap-2">
          <legend className="mb-1 text-label font-medium text-text-strong">
            Buổi của {selected.fullName} ngày {formatIsoDate(submittedOn)}
          </legend>
          {selected.sessions.length === 0 ? (
            <ResultBanner
              description="Em không có trong danh sách lớp hay điểm danh của buổi nào ngày này. Nếu em học bù hoặc học thêm, điểm danh em vào buổi đó trước rồi ghép lại."
              title="Không có buổi để ghép"
              tone="warning"
            />
          ) : (
            selected.sessions.map((session) => (
              <SessionOption
                checked={session.classSessionId === sessionId}
                claimed={session.classSessionId === item.claimedClassSessionId}
                disabled={isSaving}
                groupName={`grading-session-${item.id}`}
                key={session.classSessionId}
                onPick={() => setSessionId(session.classSessionId)}
                session={session}
                submittedAt={item.submittedAt}
              />
            ))
          )}
        </fieldset>
      ) : null}

      {selected && selected.sessions.length > 0 ? (
        <Field hint="Lưu vào lịch sử thao tác, ví dụ: đã hỏi trợ giảng lớp." label="Ghi chú (không bắt buộc)">
          {(controlProps) => (
            <Input {...controlProps} disabled={isSaving} maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} />
          )}
        </Field>
      ) : null}

      {error ? <ResultBanner title={error} tone="error" /> : null}

      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 sm:flex-none" disabled={!canSave || isSaving} isLoading={isSaving} onClick={save} size="sm" type="button">
          Ghép vào buổi này
        </Button>
        <Button className="flex-1 sm:flex-none" disabled={isSaving} onClick={onCancel} size="sm" type="button" variant="ghost">
          Hủy
        </Button>
      </div>
    </section>
  );
}

function StudentOption({
  checked,
  disabled,
  groupName,
  onPick,
  student,
}: {
  checked: boolean;
  disabled: boolean;
  groupName: string;
  onPick: () => void;
  student: MatchCandidateStudent;
}) {
  const sessionSummary =
    student.sessions.length > 0
      ? student.sessions.map((session) => `${session.classCode} ${formatTime(session.startTime)}`).join(", ")
      : "Không có buổi ngày nộp";
  return (
    <label
      className={cn(
        optionClassName,
        checked ? "border-action-primary bg-surface-base" : "border-border-subtle bg-surface-base hover:bg-interactive-hover",
      )}
    >
      <input checked={checked} className="mt-1 size-4 shrink-0" disabled={disabled} name={groupName} onChange={onPick} type="radio" value={student.id} />
      <span className="grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-text-strong">{student.fullName}</span>
          {student.nickname ? <span className="text-caption text-text-muted">({student.nickname})</span> : null}
          {student.lifecycleStatus !== "active" ? <Badge tone="neutral">{getStudentLifecycleStatusLabel(student.lifecycleStatus)}</Badge> : null}
        </span>
        <span className={cn("text-caption", student.sessions.length > 0 ? "text-text-muted" : "text-text-subtle")}>
          {student.publicCode} · sinh {student.birthYear} · {sessionSummary}
        </span>
      </span>
    </label>
  );
}

function SessionOption({
  checked,
  claimed,
  disabled,
  groupName,
  onPick,
  session,
  submittedAt,
}: {
  checked: boolean;
  claimed: boolean;
  disabled: boolean;
  groupName: string;
  onPick: () => void;
  session: SessionCandidate;
  submittedAt: string;
}) {
  const inWindow = isWithinSubmissionWindow(session, submittedAt);
  const attendance = session.attendanceStatus
    ? ((attendanceStatusLabels as Record<string, string>)[session.attendanceStatus] ?? session.attendanceStatus)
    : null;
  return (
    <label
      className={cn(
        optionClassName,
        checked ? "border-action-primary bg-surface-base" : "border-border-subtle bg-surface-base hover:bg-interactive-hover",
      )}
    >
      <input checked={checked} className="mt-1 size-4 shrink-0" disabled={disabled} name={groupName} onChange={onPick} type="radio" value={session.classSessionId} />
      <span className="grid min-w-0 gap-1">
        <span className="font-medium text-text-strong">
          {session.classCode} · {formatTime(session.startTime)}–{formatTime(session.endTime)}
        </span>
        <span className="flex flex-wrap gap-1">
          <Badge tone={inWindow ? "success" : "neutral"}>{inWindow ? "Nộp trong giờ buổi này" : "Nộp ngoài giờ buổi này"}</Badge>
          {claimed ? <Badge tone="info">Em chọn trên form</Badge> : null}
          {!session.onRoster ? <Badge tone="info">Ngoài danh sách lớp</Badge> : null}
          {attendance ? <Badge tone="neutral">Điểm danh: {attendance}</Badge> : <Badge tone="warning">Chưa điểm danh</Badge>}
        </span>
      </span>
    </label>
  );
}

function IgnoreSubmissionForm({
  actions,
  item,
  onCancel,
  onDone,
}: {
  actions: GradingReviewActions;
  item: UnmatchedGradingSubmission;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ready = reason.trim().length >= 2;

  const confirm = () => {
    if (!ready || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await actions.ignore({ reason, submissionId: item.id });
      if (result.ok) onDone(result.message);
      else setError(result.message);
    });
  };

  return (
    <section aria-label="Bỏ qua bài rác" className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3">
      <Field hint="Bài bỏ qua chuyển sang mục Đã bỏ qua và không được tính điểm; bỏ qua nhầm thì khôi phục được." label="Lý do bỏ qua" required>
        {(controlProps) => (
          <Input
            {...controlProps}
            disabled={isPending}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: gõ linh tinh, nộp thử"
            value={reason}
          />
        )}
      </Field>
      {error ? <ResultBanner title={error} tone="error" /> : null}
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 sm:flex-none" disabled={!ready || isPending} isLoading={isPending} onClick={confirm} size="sm" type="button" variant="danger">
          Xác nhận bỏ qua
        </Button>
        <Button className="flex-1 sm:flex-none" disabled={isPending} onClick={onCancel} size="sm" type="button" variant="ghost">
          Hủy
        </Button>
      </div>
    </section>
  );
}

/** "Khôi phục" on a submission marked junk: back to "Chờ ghép" as it was, with an optional note. */
export function SubmissionRestoreAction({
  actions,
  item,
  onDone,
}: {
  actions: GradingReviewActions;
  item: IgnoredGradingSubmission;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) return <ResultBanner title={done} tone="success" />;
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 sm:flex-none" onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
          Khôi phục
        </Button>
      </div>
    );
  }

  const confirm = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await actions.restore({ reason: note.trim() || null, submissionId: item.id });
      if (result.ok) {
        setDone(result.message);
        onDone(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <section aria-label="Khôi phục bài" className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3">
      <Field hint="Bài quay lại mục Chờ ghép để ghép tay hoặc ghép lại tự động. Lưu vào lịch sử thao tác." label="Ghi chú (không bắt buộc)">
        {(controlProps) => (
          <Input
            {...controlProps}
            disabled={isPending}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ví dụ: bỏ qua nhầm, đây là bài thật"
            value={note}
          />
        )}
      </Field>
      {error ? <ResultBanner title={error} tone="error" /> : null}
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 sm:flex-none" disabled={isPending} isLoading={isPending} onClick={confirm} size="sm" type="button">
          Xác nhận khôi phục
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>
      </div>
    </section>
  );
}
