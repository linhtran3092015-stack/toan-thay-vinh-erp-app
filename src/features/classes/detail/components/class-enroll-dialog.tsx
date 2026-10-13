"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { searchEnrollmentCandidatesAction } from "@/features/classes/actions/class-enrollment-search-actions";
import type { ClassEnrollmentCandidate } from "@/features/classes/detail/class-detail-data";
import {
  ENROLLMENT_SEARCH_FAILED_MESSAGE,
  ENROLLMENT_SEARCH_MAX_LENGTH,
  ENROLLMENT_SEARCH_MIN_LENGTH,
} from "@/features/classes/detail/class-detail-models";
import { normalizeRosterSearch } from "@/features/sessions/components/roster-search";
import { enrollStudentInClassAction } from "@/features/students/enrollment/student-enrollment-actions";
import type {
  StudentEnrollmentActionState,
  StudentEnrollmentRegisteredMode,
} from "@/features/students/enrollment/student-enrollment-action-types";
import { describedBy, FieldShell, fieldControlClass, textAreaControlClass } from "@/features/students/form/components/form-controls";
import { getVietnamToday } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Matches shown at once; typing narrows the rest. */
const VISIBLE_MATCHES = 40;

const ENROLL_SEARCH_DEBOUNCE_MS = 300;

/** Shown when the search call itself fails; a returned error carries its own message. */

type RemoteSearch =
  | { status: "idle" }
  | { status: "loading" }
  | { message: string; status: "error" }
  | { candidates: ClassEnrollmentCandidate[]; status: "ready"; truncated: boolean };

interface ClassEnrollDialogProps {
  candidates: readonly ClassEnrollmentCandidate[];
  candidatesTruncated?: boolean;
  classCode: string;
  classDefaultMode: string;
  classGrade: number;
  classId: string;
  className: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function getDefaultMode(candidate: ClassEnrollmentCandidate | undefined, classDefaultMode: string): StudentEnrollmentRegisteredMode {
  const mode = candidate?.registeredMode ?? classDefaultMode;
  return mode === "online" ? "online" : "offline";
}

/**
 * Enroll a student into this class (design 03 primary action). Only students
 * without any enrollment history are offered: enroll_student_in_class rejects
 * the others, who transfer or resume from their profile instead.
 */
export function ClassEnrollDialog({
  candidates,
  candidatesTruncated = false,
  classCode,
  classDefaultMode,
  classGrade,
  classId,
  className,
  onClose,
  onSuccess,
  returnFocusRef,
}: ClassEnrollDialogProps) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<RemoteSearch>({ status: "idle" });
  const [selected, setSelected] = useState<ClassEnrollmentCandidate | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(() => getVietnamToday());
  const [registeredMode, setRegisteredMode] = useState<StudentEnrollmentRegisteredMode>(() => getDefaultMode(undefined, classDefaultMode));
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<StudentEnrollmentActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  // Every keystroke bumps the sequence; a response only lands if it is still the latest.
  const searchSequenceRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchSequenceRef.current += 1;
    },
    [],
  );

  const matches = useMemo(() => {
    const needle = normalizeRosterSearch(query);
    // The preloaded list always narrows accent-insensitively ("hoang" finds "Hoàng"); the
    // server's ILIKE is accent-sensitive, so its results only add students not preloaded.
    const local = needle
      ? candidates.filter((candidate) => normalizeRosterSearch(`${candidate.fullName} ${candidate.publicCode}`).includes(needle))
      : candidates;
    const localIds = new Set(local.map((candidate) => candidate.id));
    const merged =
      remote.status === "ready" ? [...local, ...remote.candidates.filter((candidate) => !localIds.has(candidate.id))] : local;

    // Same-grade students first: they are the likely ones for this class. The sort is
    // stable, so preloaded matches stay ahead of server-only ones within each group.
    return [...merged].sort((a, b) => Number(b.grade === classGrade) - Number(a.grade === classGrade));
  }, [candidates, classGrade, query, remote]);

  const studentId = selected?.id ?? "";
  const fieldError = (name: string) => actionState?.status === "error" ? actionState.fieldErrors?.[name]?.[0] : undefined;

  function selectStudent(candidate: ClassEnrollmentCandidate) {
    setSelected(candidate);
    setRegisteredMode(getDefaultMode(candidate, classDefaultMode));
  }

  function changeQuery(value: string) {
    setQuery(value);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const sequence = ++searchSequenceRef.current;
    const needle = value.trim();

    if (needle.length < ENROLLMENT_SEARCH_MIN_LENGTH) {
      setRemote({ status: "idle" });
      return;
    }

    setRemote({ status: "loading" });
    searchTimerRef.current = setTimeout(async () => {
      let next: RemoteSearch;

      try {
        const result = await searchEnrollmentCandidatesAction(needle);
        next = result.status === "success"
          ? { candidates: result.candidates, status: "ready", truncated: result.truncated }
          : { message: result.message, status: "error" };
      } catch {
        next = { message: ENROLLMENT_SEARCH_FAILED_MESSAGE, status: "error" };
      }

      if (sequence === searchSequenceRef.current) {
        setRemote(next);
      }
    }, ENROLL_SEARCH_DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studentId) {
      return;
    }

    startTransition(async () => {
      const result = await enrollStudentInClassAction({ classId, effectiveFrom, reason, registeredMode, studentId });

      setActionState(result);

      if (result.status === "success") {
        onSuccess(`Đã ghi danh ${selected?.fullName ?? "học sinh"} vào lớp ${classCode}.`);
      }
    });
  }

  return (
    <Dialog
      ariaDescribedBy="class-enroll-description"
      ariaLabelledBy="class-enroll-title"
      className="sm:max-w-[560px]"
      initialFocusRef={searchRef}
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      returnFocusRef={returnFocusRef}
    >
      <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id="class-enroll-title">
              Ghi danh học sinh
            </h2>
            <p className="mt-1 text-secondary text-text-muted" id="class-enroll-description">
              Vào lớp {classCode} · {className}. Chỉ hiện học sinh chưa từng ghi danh; em đã học lớp khác thì chuyển lớp
              hoặc cho quay lại học từ hồ sơ.
            </p>
          </div>
          <button
            aria-label="Đóng hộp thoại ghi danh"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        </div>

        {actionState?.status === "error" ? (
          <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-secondary font-semibold text-danger-ink" role="alert">
            {actionState.message}
          </div>
        ) : null}

        <fieldset
          aria-describedby={fieldError("studentId") ? "class-enroll-student-error" : undefined}
          aria-invalid={fieldError("studentId") ? true : undefined}
          className="grid min-w-0 gap-2"
        >
          <legend className="mb-1.5 text-sm font-semibold text-ink-muted">
            Học sinh<span className="ml-1 text-danger">*</span>
          </legend>
          <input
            aria-label="Tìm học sinh theo tên hoặc mã"
            className={fieldControlClass()}
            disabled={isPending}
            maxLength={ENROLLMENT_SEARCH_MAX_LENGTH}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Tìm theo tên hoặc mã học sinh"
            ref={searchRef}
            type="search"
            value={query}
          />
          {remote.status === "loading" ? (
            <p aria-live="polite" className="px-1 text-caption text-text-muted" role="status">
              Đang tìm trong toàn bộ học sinh…
            </p>
          ) : null}
          {remote.status === "error" ? (
            <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-secondary text-warning-ink" role="alert">
              {remote.message}
            </p>
          ) : null}
          {remote.status === "idle" && candidates.length === 0 && !candidatesTruncated ? (
            <p className="rounded-md border border-dashed border-border-strong bg-surface-subtle px-3 py-2.5 text-secondary text-text-muted">
              Không có học sinh nào chưa ghi danh. Tạo học sinh mới trước, hoặc chuyển lớp từ hồ sơ của em.
            </p>
          ) : matches.length === 0 ? (
            remote.status === "loading" ? null : (
              <p className="px-1 text-secondary text-text-muted">Không có học sinh khớp “{query.trim()}”.</p>
            )
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border-subtle">
              {matches.slice(0, VISIBLE_MATCHES).map((candidate) => (
                <label
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 border-b border-border-row px-3 py-2 last:border-b-0 hover:bg-surface-hover",
                    candidate.id === studentId && "bg-action-primary-soft",
                  )}
                  key={candidate.id}
                >
                  <input
                    checked={candidate.id === studentId}
                    className="h-4 w-4 accent-[var(--action-primary)]"
                    disabled={isPending}
                    name="class-enroll-student"
                    onChange={() => selectStudent(candidate)}
                    type="radio"
                    value={candidate.id}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-text-strong">{candidate.fullName}</span>
                    <span className="block text-caption tabular-nums text-text-muted">
                      {candidate.publicCode} · Khối {candidate.grade}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <SearchHint
            candidatesTruncated={candidatesTruncated}
            matchCount={matches.length}
            remote={remote}
          />
          {fieldError("studentId") ? (
            <p className="text-xs font-semibold text-danger" id="class-enroll-student-error">
              {fieldError("studentId")}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldShell error={fieldError("effectiveFrom")} id="class-enroll-date" label="Ngày bắt đầu học" required>
            <input
              aria-describedby={describedBy("class-enroll-date", fieldError("effectiveFrom"))}
              aria-invalid={fieldError("effectiveFrom") ? true : undefined}
              className={fieldControlClass(fieldError("effectiveFrom"))}
              disabled={isPending}
              id="class-enroll-date"
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
              type="date"
              value={effectiveFrom}
            />
          </FieldShell>
          <FieldShell error={fieldError("registeredMode")} id="class-enroll-mode" label="Hình thức đăng ký" required>
            <select
              aria-describedby={describedBy("class-enroll-mode", fieldError("registeredMode"))}
              aria-invalid={fieldError("registeredMode") ? true : undefined}
              className={fieldControlClass(fieldError("registeredMode"))}
              disabled={isPending}
              id="class-enroll-mode"
              onChange={(event) => setRegisteredMode(event.target.value as StudentEnrollmentRegisteredMode)}
              value={registeredMode}
            >
              <option value="offline">Tại lớp</option>
              <option value="online">Trực tuyến</option>
            </select>
          </FieldShell>
        </div>

        <FieldShell error={fieldError("reason")} hint="Lý do được lưu vào lịch sử nghiệp vụ." id="class-enroll-reason" label="Lý do thao tác" required>
          <textarea
            aria-describedby={describedBy("class-enroll-reason", fieldError("reason"), "Lý do được lưu vào lịch sử nghiệp vụ.")}
            aria-invalid={fieldError("reason") ? true : undefined}
            className={textAreaControlClass(fieldError("reason"))}
            disabled={isPending}
            id="class-enroll-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Phụ huynh đăng ký sau buổi học thử"
            required
            value={reason}
          />
        </FieldShell>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isPending} onClick={onClose} type="button" variant="ghost">
            Hủy
          </Button>
          <Button
            disabled={isPending || !studentId || reason.trim().length === 0}
            disabledReason={
              isPending ? undefined : !studentId ? "Chọn một học sinh" : reason.trim().length === 0 ? "Nhập lý do thao tác" : undefined
            }
            type="submit"
            variant="primary"
          >
            {isPending ? "Đang ghi danh..." : selected ? `Ghi danh ${selected.fullName}` : "Ghi danh"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** How much of the candidate list is on screen and how to reach the rest. */
function SearchHint({
  candidatesTruncated,
  matchCount,
  remote,
}: {
  candidatesTruncated: boolean;
  matchCount: number;
  remote: RemoteSearch;
}) {
  const shown = matchCount > VISIBLE_MATCHES ? `Đang hiện ${VISIBLE_MATCHES}/${matchCount} học sinh khớp. ` : "";
  let text: string | null = null;

  if (remote.status === "ready") {
    text = matchCount > VISIBLE_MATCHES || remote.truncated ? `${shown}Còn nhiều học sinh khớp hơn; gõ thêm tên hoặc mã để thu hẹp.` : null;
  } else if (remote.status === "idle") {
    text =
      candidatesTruncated
        ? `${shown}Danh sách ban đầu chỉ có một phần học sinh; gõ từ ${ENROLLMENT_SEARCH_MIN_LENGTH} ký tự để tìm trong toàn bộ.`
        : matchCount > VISIBLE_MATCHES
          ? `${shown}Gõ thêm tên hoặc mã để thu hẹp.`
          : null;
  }

  return text ? <p className="px-1 text-caption text-text-muted">{text}</p> : null;
}
