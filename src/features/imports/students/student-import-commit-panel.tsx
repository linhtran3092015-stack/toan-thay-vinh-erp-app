"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  commitStudentImportRowsAction,
} from "@/features/imports/students/actions";
import type {
  StudentImportCommitResult,
  StudentImportRowInput,
  StudentImportValidationResult,
} from "@/features/imports/students/types";
import { VIETNAM_TIME_ZONE } from "@/lib/datetime";

interface StudentImportCommitPanelProps {
  canCreateStudents: boolean;
  rows: StudentImportRowInput[];
  sourceFilename: string;
  sourceSha256: string;
  validationResult: StudentImportValidationResult;
}

function formatCommittedAt(
  value: string,
): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: VIETNAM_TIME_ZONE,
    },
  ).format(parsedDate);
}

export function StudentImportCommitPanel({
  canCreateStudents,
  rows,
  sourceFilename,
  sourceSha256,
  validationResult,
}: StudentImportCommitPanelProps) {
  const [
    reason,
    setReason,
  ] = useState("");

  const [
    confirmed,
    setConfirmed,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState<string | null>(null);

  const [
    commitResult,
    setCommitResult,
  ] = useState<StudentImportCommitResult | null>(
    null,
  );

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const normalizedReason = reason.trim();

  const canCommit = useMemo(
    () =>
      canCreateStudents &&
      validationResult.invalid_count === 0 &&
      validationResult.row_count > 0 &&
      rows.length === validationResult.row_count &&
      normalizedReason.length > 0 &&
      normalizedReason.length <= 1500 &&
      confirmed &&
      !isPending &&
      commitResult === null,
    [
      canCreateStudents,
      commitResult,
      confirmed,
      isPending,
      normalizedReason.length,
      rows.length,
      validationResult.invalid_count,
      validationResult.row_count,
    ],
  );

  function handleCommit(): void {
    setActionError(null);

    if (!canCreateStudents) {
      setActionError(
        "Tài khoản hiện tại không có quyền tạo học viên.",
      );
      return;
    }

    if (validationResult.invalid_count > 0) {
      setActionError(
        "Không thể import khi kết quả dry-run vẫn còn dòng không hợp lệ.",
      );
      return;
    }

    if (
      rows.length !==
      validationResult.row_count
    ) {
      setActionError(
        "Dữ liệu hiện tại không còn khớp với kết quả dry-run. Hãy kiểm tra lại.",
      );
      return;
    }

    if (normalizedReason.length === 0) {
      setActionError(
        "Bắt buộc nhập lý do import.",
      );
      return;
    }

    if (normalizedReason.length > 1500) {
      setActionError(
        "Lý do import không được vượt quá 1.500 ký tự.",
      );
      return;
    }

    if (!confirmed) {
      setActionError(
        "Hãy xác nhận dữ liệu trước khi import.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const result =
          await commitStudentImportRowsAction({
            reason: normalizedReason,
            rows,
            sourceFilename,
            sourceSha256,
          });

        if (!result.ok) {
          setActionError(result.message);
          return;
        }

        setCommitResult(result.data);
        setConfirmed(false);
      } catch {
        setActionError(
          "Không thể hoàn tất import. Dữ liệu chưa được xác nhận là đã tạo.",
        );
      }
    });
  }

  if (commitResult) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              Import học viên thành công
            </CardTitle>

            <Badge tone="success">
              Đã commit
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5">
          <div
            aria-live="polite"
            className="rounded-md border border-success-border bg-success-bg p-4 text-sm text-success"
          >
            Toàn bộ batch đã được ghi trong một
            transaction. Không có dòng nào được commit
            một phần.
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-hairline bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Học viên đã tạo
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {commitResult.student_count}
              </p>
            </div>

            <div className="rounded-md border border-hairline bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Phụ huynh tạo mới
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {commitResult.guardian_created_count}
              </p>
            </div>

            <div className="rounded-md border border-hairline bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Phụ huynh dùng lại
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {commitResult.guardian_reused_count}
              </p>
            </div>

            <div className="rounded-md border border-hairline bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Thời điểm commit
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {formatCommittedAt(
                  commitResult.committed_at,
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-2 rounded-md border border-hairline bg-canvas p-4 text-sm">
            <p>
              <span className="font-semibold text-ink">
                Batch ID:
              </span>{" "}
              <span className="break-all font-mono text-xs text-ink-muted">
                {commitResult.batch_id}
              </span>
            </p>

            <p>
              <span className="font-semibold text-ink">
                File:
              </span>{" "}
              <span className="text-ink-muted">
                {commitResult.source_filename}
              </span>
            </p>

            <p>
              <span className="font-semibold text-ink">
                SHA-256:
              </span>{" "}
              <span className="break-all font-mono text-xs text-ink-muted">
                {commitResult.source_sha256}
              </span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-hairline">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-canvas">
                <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                  <th className="px-4 py-3">
                    Dòng
                  </th>
                  <th className="px-4 py-3">
                    Mã học viên
                  </th>
                  <th className="px-4 py-3">
                    Student ID
                  </th>
                  <th className="px-4 py-3">
                    Phụ huynh
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-hairline">
                {commitResult.students.map(
                  (student) => (
                    <tr key={student.student_id}>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {student.row_number}
                      </td>

                      <td className="px-4 py-3 font-semibold text-ink">
                        {student.student_public_code}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {student.student_id}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            student.guardian_reused
                              ? "info"
                              : "neutral"
                          }
                        >
                          {student.guardian_reused
                            ? "Dùng lại"
                            : "Tạo mới"}
                        </Badge>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-primary bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              href="/students"
            >
              Mở danh sách học viên
            </Link>

            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
              href="/audit"
            >
              Xem nhật ký thao tác
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          4. Xác nhận import
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        {!canCreateStudents ? (
          <div className="rounded-md border border-warning-border bg-warning-bg p-4 text-sm text-warning">
            Tài khoản hiện tại thiếu quyền
            students.create nên không thể commit batch.
          </div>
        ) : null}

        {validationResult.invalid_count > 0 ? (
          <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-sm text-danger">
            Còn {validationResult.invalid_count} dòng
            không hợp lệ. Hãy sửa file hoặc mapping và
            chạy dry-run lại.
          </div>
        ) : (
          <div className="rounded-md border border-success-border bg-success-bg p-4 text-sm text-success">
            Dry-run không có dòng lỗi. Có thể xác nhận
            tạo {validationResult.row_count} học viên.
          </div>
        )}

        {validationResult.warning_count > 0 ? (
          <div className="rounded-md border border-warning-border bg-warning-bg p-4 text-sm text-warning">
            Có {validationResult.warning_count} dòng cảnh
            báo. Hãy đọc kỹ bảng kết quả trước khi commit.
          </div>
        ) : null}

        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-ink"
            htmlFor="student-import-reason"
          >
            Lý do import
            <span className="ml-1 text-danger">
              *
            </span>
          </label>

          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-canvas"
            disabled={
              isPending ||
              validationResult.invalid_count > 0 ||
              !canCreateStudents
            }
            id="student-import-reason"
            maxLength={1500}
            onChange={(event) => {
              setReason(event.target.value);
              setActionError(null);
            }}
            placeholder="Ví dụ: Import danh sách học viên đang quan tâm từ file vận hành tháng 8/2026."
            value={reason}
          />

          <p className="text-right text-xs text-ink-muted">
            {reason.length}/1.500 ký tự
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-hairline bg-canvas p-4">
          <input
            checked={confirmed}
            className="mt-1 size-4 rounded border-hairline"
            disabled={
              isPending ||
              validationResult.invalid_count > 0 ||
              !canCreateStudents
            }
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setActionError(null);
            }}
            type="checkbox"
          />

          <span className="text-sm text-ink">
            Tôi đã kiểm tra kết quả dry-run và xác nhận
            tạo toàn bộ {validationResult.row_count} học
            viên trong một transaction. Tôi hiểu rằng
            thao tác này sẽ ghi dữ liệu thật.
          </span>
        </label>

        {actionError ? (
          <div
            aria-live="polite"
            className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger"
          >
            {actionError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!canCommit}
            onClick={handleCommit}
            type="button"
          >
            {isPending
              ? "Đang import..."
              : `Xác nhận import ${validationResult.row_count} học viên`}
          </Button>

          <span className="text-xs text-ink-muted">
            Database sẽ kiểm tra lại toàn bộ dữ liệu ngay
            trước khi commit.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
