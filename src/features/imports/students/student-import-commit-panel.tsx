"use client";

import type { ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Label, Textarea } from "@/components/ui/field";
import { formatImportTimestamp } from "@/features/imports/components/import-labels";
import { ImportSummaryStrip } from "@/features/imports/components/import-summary-strip";
import type { StudentImportCommitResult, StudentImportValidationResult } from "@/features/imports/students/types";
import { formatNumber } from "@/lib/format";
import { permissionLabel } from "@/lib/permissions/labels";

/** Same cap as the server's zod schema ("Lý do import không được vượt quá 1.500 ký tự."). */
export const STUDENT_IMPORT_REASON_MAX_LENGTH = 1500;

export interface StudentImportCommitGateInput {
  canCreateStudents: boolean;
  /** Rows mapped from the file currently chosen (0 when no file is held). */
  mappedRowCount: number;
  validation: StudentImportValidationResult;
  reason: string;
  confirmed: boolean;
  isPending: boolean;
  isCommitted: boolean;
}

export interface StudentImportCommitGate {
  canCommit: boolean;
  conditions: GuardedCondition[];
  /** Why the commit is unavailable, in words (the first unmet condition); null when it can run or is running. */
  reason: string | null;
}

/**
 * The commit gate of today's panel, condition by condition and in the same
 * order as its checks: `students.create`, 0 invalid rows, the dry-run still
 * matches the mapped file (same row count, at least one row), a reason of
 * 1–1,500 characters, the confirmation checkbox, not pending, not committed.
 */
export function getStudentImportCommitGate({
  canCreateStudents,
  confirmed,
  isCommitted,
  isPending,
  mappedRowCount,
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
      ok: rowsMatch,
      unmet: "Kết quả kiểm tra không khớp file đang chọn",
      why: "Chọn lại file và kiểm tra các dòng trước khi nhập.",
    },
    {
      met: "Đã nhập lý do",
      ok: reasonOk,
      unmet: trimmedReason.length > STUDENT_IMPORT_REASON_MAX_LENGTH ? "Lý do dài quá 1.500 ký tự" : "Chưa nhập lý do",
      why: trimmedReason.length > STUDENT_IMPORT_REASON_MAX_LENGTH ? "Rút gọn lý do còn tối đa 1.500 ký tự." : "Nhập lý do nhập dữ liệu.",
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
    canCommit: !firstUnmet && !isPending && !isCommitted,
    conditions: checks.map((check) => ({ label: check.ok ? check.met : check.unmet, state: check.ok ? "met" : "unmet" })),
    reason: firstUnmet && !isPending ? firstUnmet.why : null,
  };
}

export type StudentImportCommitError = { kind: "error"; message: string } | { kind: "unknown" };

interface StudentImportCommitPanelProps {
  gate: StudentImportCommitGate;
  validation: StudentImportValidationResult;
  reusedGuardianCount: number;
  reason: string;
  onReasonChange: (value: string) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  /** Inputs locked (pending, no permission, rows still invalid), as today. */
  inputsDisabled: boolean;
  error: StudentImportCommitError | null;
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
  reusedGuardianCount,
  validation,
}: StudentImportCommitPanelProps) {
  const total = formatNumber(validation.row_count);

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
            <ResultBanner description="Mở lại trang để kiểm tra trước khi thử lại." title="Không rõ kết quả." tone="conflict" />
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
            {formatNumber(reason.length)}/1.500 ký tự
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
