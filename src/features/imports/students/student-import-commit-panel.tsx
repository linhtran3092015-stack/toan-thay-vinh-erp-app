"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { formatImportTimestamp } from "@/features/imports/components/import-labels";
import { ImportSummaryStrip } from "@/features/imports/components/import-summary-strip";
import type {
  StudentImportActionFailure,
  StudentImportCommitResult,
  StudentImportValidationResult,
} from "@/features/imports/students/types";
import { formatNumber } from "@/lib/format";
import { permissionLabel } from "@/lib/permissions/labels";

/** Same cap as the server's zod schema ("Lý do import không được vượt quá 1.500 ký tự."). */
export const STUDENT_IMPORT_REASON_MAX_LENGTH = 1500;

const REASON_MAX_TEXT = formatNumber(STUDENT_IMPORT_REASON_MAX_LENGTH);

/**
 * A commit whose answer never arrived. Retrying in place is safe: the commit
 * RPC refuses a second commit of the same file
 * (STUDENT_IMPORT_FILE_ALREADY_COMMITTED) and says so.
 */
const COMMIT_UNKNOWN_RESULT = "Bấm xác nhận lại: máy chủ không ghi hai lần và sẽ báo nếu lần trước đã ghi xong.";

/**
 * The commit action's message for STUDENT_IMPORT_FILE_ALREADY_COMMITTED
 * (actions.ts getRpcFailure, code "conflict"). The action passes no database
 * code through, and "conflict" also means a duplicate student, so the message
 * tells the two apart.
 */
export const STUDENT_IMPORT_ALREADY_COMMITTED_MESSAGE = "File này đã được import thành công trước đó.";

/**
 * The commit action's message for STUDENT_IMPORT_VALIDATION_FAILED (code
 * "invalid_request"): the server re-checked the rows and they no longer pass,
 * so the panel offers a fresh check right there.
 */
export const STUDENT_IMPORT_VALIDATION_FAILED_MESSAGE =
  "Dữ liệu đã thay đổi hoặc còn dòng lỗi. Hãy kiểm tra lại trước khi xác nhận import.";

export interface StudentImportCommitGateInput {
  canCreateStudents: boolean;
  /** Rows mapped from the file currently chosen (0 when no file is held). */
  mappedRowCount: number;
  validation: StudentImportValidationResult;
  reason: string;
  confirmed: boolean;
  isPending: boolean;
  isCommitted: boolean;
  /** The commit refused this file as already committed (an earlier press landed): locked, with its reason. */
  isAlreadyCommitted?: boolean;
  /** The commit was refused because the rows no longer pass: locked until "Kiểm tra lại" answers. */
  needsRecheck?: boolean;
}

export interface StudentImportCommitGate {
  canCommit: boolean;
  conditions: GuardedCondition[];
  /** Why the commit is unavailable, in words (the first unmet condition); null when it can run or while a commit or a re-check runs. */
  reason: string | null;
}

/**
 * The commit gate of today's panel, condition by condition and in the same
 * order as its checks: `students.create`, 0 invalid rows, the dry-run still
 * matches the mapped file (same row count, at least one row, and no commit
 * refused for rows that no longer pass until "Kiểm tra lại" answers), a reason
 * of 1–1,500 characters, the confirmation checkbox; then not pending and not
 * committed (here or by an earlier press the server reports).
 */
export function getStudentImportCommitGate({
  canCreateStudents,
  confirmed,
  isAlreadyCommitted = false,
  isCommitted,
  isPending,
  mappedRowCount,
  needsRecheck = false,
  reason,
  validation,
}: StudentImportCommitGateInput): StudentImportCommitGate {
  const trimmedReason = reason.trim();
  const rowsMatch = validation.row_count > 0 && mappedRowCount === validation.row_count;
  const reasonOk = trimmedReason.length > 0 && trimmedReason.length <= STUDENT_IMPORT_REASON_MAX_LENGTH;

  const checks: Array<{ ok: boolean; met: string; unmet: string; why: string }> = [
    {
      met: `Có quyền ${permissionLabel("students.create")}`,
      ok: canCreateStudents,
      unmet: `Chưa có quyền ${permissionLabel("students.create")}`,
      why: `Tài khoản này chưa có quyền ${permissionLabel("students.create")}.`,
    },
    {
      met: "0 dòng lỗi",
      ok: validation.invalid_count === 0,
      unmet: `Còn ${formatNumber(validation.invalid_count)} dòng lỗi`,
      why: "Bật khi không còn dòng lỗi. Sửa file Excel rồi chọn lại file.",
    },
    {
      met: `Kết quả kiểm tra khớp file đang chọn (${formatNumber(validation.row_count)} dòng)`,
      ok: rowsMatch && !needsRecheck,
      unmet: needsRecheck
        ? "Máy chủ báo dữ liệu đã thay đổi hoặc còn dòng lỗi: cần kiểm tra lại"
        : "Kết quả kiểm tra không khớp file đang chọn",
      why: needsRecheck
        ? "Dữ liệu đã thay đổi hoặc còn dòng lỗi: bấm “Kiểm tra lại” trước khi nhập."
        : "Chọn lại file và kiểm tra các dòng trước khi nhập.",
    },
    {
      met: "Đã nhập lý do",
      ok: reasonOk,
      unmet: trimmedReason.length > STUDENT_IMPORT_REASON_MAX_LENGTH ? `Lý do dài quá ${REASON_MAX_TEXT} ký tự` : "Chưa nhập lý do",
      why: trimmedReason.length > STUDENT_IMPORT_REASON_MAX_LENGTH ? `Rút gọn lý do còn tối đa ${REASON_MAX_TEXT} ký tự.` : "Nhập lý do nhập dữ liệu.",
    },
    {
      met: "Đã đánh dấu xác nhận",
      ok: confirmed,
      unmet: "Chưa đánh dấu xác nhận",
      why: "Đánh dấu ô xác nhận trước khi nhập.",
    },
  ];

  const firstUnmet = checks.find((check) => !check.ok);

  return {
    canCommit: !firstUnmet && !isPending && !isCommitted && !isAlreadyCommitted,
    conditions: checks.map((check) => ({ label: check.ok ? check.met : check.unmet, state: check.ok ? "met" : "unmet" })),
    reason: isAlreadyCommitted ? "File này đã được nhập; không cần nhập lại." : firstUnmet && !isPending ? firstUnmet.why : null,
  };
}

export type StudentImportCommitError =
  | { kind: "error"; message: string }
  | { kind: "unknown" }
  /** The server's refusal of a file it already committed; `message` is its words. */
  | { kind: "already_committed"; message: string }
  /** The server's re-check of the rows failed (data changed or rows invalid); `message` is its words. */
  | { kind: "needs_recheck"; message: string };

/** A refused commit in the panel's terms: the already-committed and failed re-check refusals are told apart from the rest. */
export function toStudentImportCommitError(failure: Pick<StudentImportActionFailure, "code" | "message">): StudentImportCommitError {
  if (failure.code === "conflict" && failure.message === STUDENT_IMPORT_ALREADY_COMMITTED_MESSAGE) {
    return { kind: "already_committed", message: failure.message };
  }
  if (failure.code === "invalid_request" && failure.message === STUDENT_IMPORT_VALIDATION_FAILED_MESSAGE) {
    return { kind: "needs_recheck", message: failure.message };
  }
  return { kind: "error", message: failure.message };
}

interface StudentImportCommitPanelProps {
  gate: StudentImportCommitGate;
  validation: StudentImportValidationResult;
  reusedGuardianCount: number;
  reason: string;
  onReasonChange: (value: string) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  /** Inputs locked (a commit or a re-check running, no permission, rows still invalid, file already committed). */
  inputsDisabled: boolean;
  error: StudentImportCommitError | null;
  /**
   * "Kiểm tra lại" on a failed re-check refusal: runs the dry-run again with the
   * file and mapping held; `error` is that check's own failure, if any.
   */
  recheck: { onRecheck: () => void; isPending: boolean; error: string | null };
  /** Where the already-committed banner sends people to see the students (the /dev preview keeps it under /dev). */
  studentListHref: string;
}

/**
 * Step "Xác nhận nhập" (design 17c step 4): the consequence in words (all or
 * nothing), the gate's conditions, the reason and the confirmation checkbox.
 * The commit button itself is the step's primary in the wizard's action bar.
 */
export function StudentImportCommitPanel({
  confirmed,
  error,
  gate,
  inputsDisabled,
  onConfirmedChange,
  onReasonChange,
  reason,
  recheck,
  reusedGuardianCount,
  studentListHref,
  validation,
}: StudentImportCommitPanelProps) {
  const total = formatNumber(validation.row_count);
  const recheckButtonRef = useRef<HTMLButtonElement>(null);
  const recheckWasPending = useRef(false);

  // The button is disabled while its check runs, which drops focus; a failed check leaves it in place, so focus returns.
  useEffect(() => {
    if (recheckWasPending.current && !recheck.isPending) recheckButtonRef.current?.focus();
    recheckWasPending.current = recheck.isPending;
  }, [recheck.isPending]);

  return (
    <GuardedActionPanel
      conditions={gate.conditions}
      consequence={
        <>
          Ghi toàn bộ <strong>{total} học sinh</strong> trong một lần; nếu máy chủ từ chối thì không ghi dòng nào.
        </>
      }
      result={
        error ? (
          error.kind === "unknown" ? (
            <ResultBanner description={COMMIT_UNKNOWN_RESULT} title="Không rõ kết quả." tone="conflict" />
          ) : error.kind === "already_committed" ? (
            <ResultBanner
              action={
                <Link className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "secondary" })} href={studentListHref}>
                  Mở danh sách học viên
                </Link>
              }
              description={`${error.message} Hồ sơ đã tạo có trong danh sách học viên.`}
              title="File này đã được nhập."
              tone="info"
            />
          ) : error.kind === "needs_recheck" ? (
            <div className="grid gap-3">
              <ResultBanner
                action={
                  <Button
                    className="max-md:h-11"
                    isLoading={recheck.isPending}
                    onClick={recheck.onRecheck}
                    ref={recheckButtonRef}
                    size="sm"
                    variant="secondary"
                  >
                    {recheck.isPending ? "Đang kiểm tra…" : "Kiểm tra lại"}
                  </Button>
                }
                description={error.message}
                title="Chưa nhập."
                tone="error"
              />
              {recheck.error ? <ResultBanner description={recheck.error} title="Chưa kiểm tra được." tone="error" /> : null}
            </div>
          ) : (
            <ResultBanner description={error.message} title="Chưa nhập." tone="error" />
          )
        ) : null
      }
      title="Xác nhận nhập học sinh"
      titleId="student-import-commit-title"
    >
      <p className="mt-2 max-w-[720px] text-secondary text-text-muted">
        Học sinh mới ở trạng thái Đang quan tâm.
        {reusedGuardianCount > 0
          ? ` ${formatNumber(reusedGuardianCount)} phụ huynh đã có trong hệ thống được dùng lại theo số điện thoại; thông tin phụ huynh trong file không ghi đè hồ sơ đó.`
          : null}{" "}
        Máy chủ kiểm tra lại toàn bộ dòng ngay trước khi ghi.
      </p>

      <div className="mt-4 grid max-w-[720px] gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="student-import-reason" required>
            Lý do nhập
          </Label>
          <Textarea
            aria-describedby="student-import-reason-count"
            disabled={inputsDisabled}
            id="student-import-reason"
            maxLength={STUDENT_IMPORT_REASON_MAX_LENGTH}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ví dụ: Nhập danh sách học sinh đang quan tâm từ file vận hành tháng 10."
            value={reason}
          />
          <p className="text-caption text-text-muted tabular-nums" id="student-import-reason-count">
            {formatNumber(reason.length)}/{REASON_MAX_TEXT} ký tự
          </p>
        </div>

        <label className="flex min-h-11 items-start gap-3 rounded-md border border-border-subtle bg-surface-sunken px-4 py-3 text-body text-text-default">
          <input
            checked={confirmed}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
            disabled={inputsDisabled}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            type="checkbox"
          />
          <span>Tôi đã xem kết quả kiểm tra và đồng ý ghi toàn bộ {total} học sinh trong một lần.</span>
        </label>
      </div>
    </GuardedActionPanel>
  );
}

/**
 * Result of a successful commit: what was written (students, new and reused
 * guardians), when, from which file, and the created student codes. Links to
 * the student list and the audit log sit in the wizard's action bar.
 */
export function StudentImportCommitResultView({ result }: { result: StudentImportCommitResult }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <ResultBanner
        description="Toàn bộ dòng được ghi trong một lần; không có dòng nào ghi dở."
        title={`Đã nhập ${formatNumber(result.student_count)} học sinh.`}
        tone="success"
      />

      <ImportSummaryStrip
        cells={[
          { label: "Học sinh đã tạo", tone: "success", value: result.student_count },
          { label: "Phụ huynh tạo mới", value: result.guardian_created_count },
          { label: "Phụ huynh dùng lại", value: result.guardian_reused_count },
        ]}
        label="Kết quả nhập"
      />

      <dl className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4">
        <ResultFact label="Thời điểm ghi">{formatImportTimestamp(result.committed_at)}</ResultFact>
        <ResultFact label="File">
          <span className="break-all">{result.source_filename}</span>
        </ResultFact>
        <ResultFact label="SHA-256">
          <span className="break-all font-mono text-caption font-normal">{result.source_sha256}</span>
        </ResultFact>
        <ResultFact label="Mã lô">
          <span className="break-all font-mono text-caption font-normal">{result.batch_id}</span>
        </ResultFact>
      </dl>

      <DataTableFrame
        body={result.students.map((student) => (
          <TableRow key={student.student_id}>
            <TableCell className="text-text-muted tabular-nums">{student.row_number}</TableCell>
            <TableCell className="font-semibold text-text-strong tabular-nums">{student.student_public_code}</TableCell>
            <TableCell>
              <Badge tone={student.guardian_reused ? "info" : "neutral"}>{student.guardian_reused ? "Dùng lại" : "Tạo mới"}</Badge>
            </TableCell>
          </TableRow>
        ))}
        caption={`Học sinh đã tạo (${formatNumber(result.students.length)})`}
        header={
          <tr>
            <TableHeaderCell style={{ width: "80px" }}>Dòng</TableHeaderCell>
            <TableHeaderCell>Mã học sinh</TableHeaderCell>
            <TableHeaderCell>Phụ huynh</TableHeaderCell>
          </tr>
        }
      />
    </div>
  );
}

function ResultFact({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-semibold text-text-strong">{children}</dd>
    </div>
  );
}
