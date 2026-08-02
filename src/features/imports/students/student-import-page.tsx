"use client";

import type { ChangeEvent } from "react";
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
  validateStudentImportRowsAction,
} from "@/features/imports/students/actions";
import {
  StudentImportCommitPanel,
} from "@/features/imports/students/student-import-commit-panel";
import {
  STUDENT_IMPORT_FIELD_DEFINITIONS,
} from "@/features/imports/students/fields";
import {
  buildStudentImportAutomaticMapping,
  mapStudentImportWorkbookRows,
  validateStudentImportColumnMapping,
} from "@/features/imports/students/mapping";
import type {
  StudentImportCellValue,
  StudentImportColumnMapping,
  StudentImportFieldKey,
  StudentImportParsedWorkbook,
  StudentImportRowStatus,
  StudentImportValidationResult,
  StudentImportValidationRow,
} from "@/features/imports/students/types";
import {
  parseStudentImportWorkbook,
  STUDENT_IMPORT_TEMPLATE_FILENAME,
  StudentImportWorkbookError,
} from "@/features/imports/students/workbook";

interface StudentImportPageProps {
  canCreateStudents: boolean;
}

const controlClassName =
  "h-10 w-full rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle";

function displayCellValue(
  value: StudentImportCellValue | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function getStatusTone(
  status: StudentImportRowStatus,
): "danger" | "success" | "warning" {
  if (status === "invalid") {
    return "danger";
  }

  if (status === "warning") {
    return "warning";
  }

  return "success";
}

function getStatusLabel(
  status: StudentImportRowStatus,
): string {
  if (status === "invalid") {
    return "Không hợp lệ";
  }

  if (status === "warning") {
    return "Cảnh báo";
  }

  return "Hợp lệ";
}

function getRowMessages(
  row: StudentImportValidationRow,
): string {
  const messages = [
    ...row.errors,
    ...row.warnings,
  ].map((issue) => issue.message);

  return messages.length > 0
    ? messages.join(" • ")
    : "Không có lỗi hoặc cảnh báo.";
}

export function StudentImportPage({
  canCreateStudents,
}: StudentImportPageProps) {
  const [
    workbook,
    setWorkbook,
  ] = useState<StudentImportParsedWorkbook | null>(
    null,
  );

  const [
    mapping,
    setMapping,
  ] = useState<StudentImportColumnMapping>({});

  const [
    validationResult,
    setValidationResult,
  ] = useState<StudentImportValidationResult | null>(
    null,
  );

  const [
    fileError,
    setFileError,
  ] = useState<string | null>(null);

  const [
    templateDownloadError,
    setTemplateDownloadError,
  ] = useState<string | null>(null);

  const [
    isTemplateDownloading,
    setIsTemplateDownloading,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState<string | null>(null);

  const [
    automaticMappingNotice,
    setAutomaticMappingNotice,
  ] = useState<string | null>(null);

  const [
    inputKey,
    setInputKey,
  ] = useState(0);

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const mappingValidation = useMemo(
    () =>
      workbook
        ? validateStudentImportColumnMapping(
            workbook.columns,
            mapping,
          )
        : null,
    [
      mapping,
      workbook,
    ],
  );

  const mappedRows = useMemo(() => {
    if (
      !workbook ||
      !mappingValidation?.isValid
    ) {
      return [];
    }

    return mapStudentImportWorkbookRows(
      workbook,
      mapping,
    );
  }, [
    mapping,
    mappingValidation?.isValid,
    workbook,
  ]);

  const previewRows = mappedRows.slice(0, 5);

  const validationRows =
    validationResult?.rows.slice(0, 100) ?? [];

  async function handleTemplateDownload(): Promise<void> {
    setTemplateDownloadError(null);
    setIsTemplateDownloading(true);

    try {
      const response = await fetch(
        "/imports/students/template",
        {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
        },
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => null) as {
            message?: unknown;
          } | null;

        const serverMessage =
          typeof payload?.message === "string"
            ? payload.message
            : null;

        throw new Error(
          serverMessage ??
            `Không thể tải file mẫu (HTTP ${response.status}).`,
        );
      }

      const contentType =
        response.headers.get("content-type") ?? "";

      if (
        !contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
      ) {
        throw new Error(
          "Máy chủ không trả về đúng định dạng Excel .xlsx.",
        );
      }

      const workbookBlob = await response.blob();

      if (workbookBlob.size === 0) {
        throw new Error(
          "File mẫu được tạo nhưng không có dữ liệu.",
        );
      }

      const objectUrl =
        URL.createObjectURL(workbookBlob);

      const downloadAnchor =
        document.createElement("a");

      downloadAnchor.href = objectUrl;
      downloadAnchor.download =
        STUDENT_IMPORT_TEMPLATE_FILENAME;
      downloadAnchor.style.display = "none";

      document.body.append(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(objectUrl),
        1_000,
      );
    } catch (error) {
      setTemplateDownloadError(
        error instanceof Error
          ? error.message
          : "Không thể tải file mẫu import học viên.",
      );
    } finally {
      setIsTemplateDownloading(false);
    }
  }

  function resetImport(): void {
    setWorkbook(null);
    setMapping({});
    setValidationResult(null);
    setFileError(null);
    setActionError(null);
    setAutomaticMappingNotice(null);
    setInputKey((current) => current + 1);
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file =
      event.target.files?.[0];

    setWorkbook(null);
    setMapping({});
    setValidationResult(null);
    setFileError(null);
    setActionError(null);
    setAutomaticMappingNotice(null);

    if (!file) {
      return;
    }

    try {
      const parsedWorkbook =
        await parseStudentImportWorkbook(
          file,
        );

      const automaticMapping =
        buildStudentImportAutomaticMapping(
          parsedWorkbook.columns,
        );

      const noticeParts: string[] = [];

      if (
        automaticMapping.ambiguousFields.length >
        0
      ) {
        noticeParts.push(
          `${automaticMapping.ambiguousFields.length} trường có tiêu đề mơ hồ cần chọn thủ công`,
        );
      }

      if (
        automaticMapping.unmatchedColumns.length >
        0
      ) {
        noticeParts.push(
          `${automaticMapping.unmatchedColumns.length} cột chưa được sử dụng`,
        );
      }

      setWorkbook(parsedWorkbook);
      setMapping(automaticMapping.mapping);

      setAutomaticMappingNotice(
        noticeParts.length > 0
          ? noticeParts.join(". ") + "."
          : "Đã tự động nhận diện toàn bộ cột của file.",
      );
    } catch (error) {
      if (
        error instanceof
        StudentImportWorkbookError
      ) {
        setFileError(error.message);
        return;
      }

      setFileError(
        "Không thể đọc file Excel. Hãy kiểm tra lại file và thử lại.",
      );
    }
  }

  function updateMapping(
    fieldKey: StudentImportFieldKey,
    columnKey: string,
  ): void {
    setMapping((current) => ({
      ...current,
      [fieldKey]:
        columnKey.length > 0
          ? columnKey
          : null,
    }));

    setValidationResult(null);
    setActionError(null);
  }

  function handleDryRun(): void {
    setActionError(null);
    setValidationResult(null);

    if (!workbook) {
      setActionError(
        "Hãy chọn file Excel trước khi kiểm tra dữ liệu.",
      );
      return;
    }

    if (!mappingValidation?.isValid) {
      setActionError(
        "Ánh xạ cột chưa hợp lệ. Hãy xử lý các lỗi mapping trước khi kiểm tra dữ liệu.",
      );
      return;
    }

    const rows =
      mapStudentImportWorkbookRows(
        workbook,
        mapping,
      );

    startTransition(async () => {
      const result =
        await validateStudentImportRowsAction({
          rows,
        });

      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      setValidationResult(result.data);
    });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span>Học viên</span>
              <span>/</span>
              <span className="font-semibold text-ink">
                Import Excel
              </span>
            </div>

            <h1 className="text-2xl font-bold text-ink md:text-3xl">
              Import học viên từ Excel
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-ink-muted">
              Tạo học viên ở trạng thái đang quan tâm,
              tạo hoặc dùng lại phụ huynh chính theo số
              điện thoại. Bước kiểm tra không ghi dữ liệu.
            </p>
          </div>

          <div className="grid flex-none gap-2">
            <Button
              disabled={isTemplateDownloading}
              onClick={handleTemplateDownload}
              type="button"
            >
              {isTemplateDownloading
                ? "Đang tạo file mẫu..."
                : "Tải file mẫu .xlsx"}
            </Button>

            {templateDownloadError ? (
              <p
                aria-live="polite"
                className="max-w-sm text-xs font-medium text-danger"
              >
                {templateDownloadError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {!canCreateStudents ? (
        <div className="rounded-md border border-warning-border bg-warning-bg p-4 text-sm text-warning">
          Tài khoản hiện tại có thể tải file và chạy
          dry-run nhưng chưa có quyền students.create.
          Bước xác nhận ghi dữ liệu sẽ không khả dụng.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            1. Chọn file học viên
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <label
              className="text-sm font-semibold text-ink"
              htmlFor="student-import-file"
            >
              File Excel
            </label>

            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={`${controlClassName} file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-primary`}
              id="student-import-file"
              key={inputKey}
              onChange={handleFileChange}
              type="file"
            />

            <p className="text-xs text-ink-muted">
              Chỉ nhận .xlsx, tối đa 5 MB, đúng một
              worksheet và tối đa 500 dòng dữ liệu.
            </p>
          </div>

          {fileError ? (
            <div
              aria-live="polite"
              className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger"
            >
              {fileError}
            </div>
          ) : null}

          {workbook ? (
            <div className="grid gap-3 rounded-lg border border-hairline bg-canvas p-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Tên file
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-ink">
                  {workbook.sourceFilename}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Worksheet
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {workbook.sheetName}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Số dòng
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {workbook.rowCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  SHA-256
                </p>
                <p
                  className="mt-1 truncate font-mono text-xs text-ink"
                  title={workbook.sourceSha256}
                >
                  {workbook.sourceSha256}
                </p>
              </div>
            </div>
          ) : null}

          {automaticMappingNotice ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-ink">
              {automaticMappingNotice}
            </div>
          ) : null}

          {workbook ? (
            <div>
              <Button
                onClick={resetImport}
                type="button"
                variant="outline"
              >
                Chọn file khác
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {workbook ? (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Ánh xạ cột
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4">
            <p className="text-sm text-ink-muted">
              Chọn cột Excel tương ứng với từng trường.
              Các trường có dấu * là bắt buộc.
            </p>

            <div className="grid gap-3 lg:grid-cols-2">
              {STUDENT_IMPORT_FIELD_DEFINITIONS.map(
                (definition) => (
                  <label
                    className="grid gap-2 rounded-md border border-hairline bg-canvas p-3"
                    key={definition.key}
                  >
                    <span className="text-sm font-semibold text-ink">
                      {definition.label}
                      {definition.required ? (
                        <span className="ml-1 text-danger">
                          *
                        </span>
                      ) : null}
                    </span>

                    <select
                      className={controlClassName}
                      onChange={(event) =>
                        updateMapping(
                          definition.key,
                          event.target.value,
                        )
                      }
                      value={
                        mapping[definition.key] ??
                        ""
                      }
                    >
                      <option value="">
                        — Không ánh xạ —
                      </option>

                      {workbook.columns.map(
                        (column) => (
                          <option
                            key={column.columnKey}
                            value={column.columnKey}
                          >
                            {column.columnKey}
                            {" — "}
                            {column.sourceHeader ??
                              "Không có tiêu đề"}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ),
              )}
            </div>

            {mappingValidation &&
            !mappingValidation.isValid ? (
              <div
                aria-live="polite"
                className="rounded-md border border-danger-border bg-danger-bg p-4"
              >
                <p className="text-sm font-bold text-danger">
                  Mapping chưa hợp lệ
                </p>

                <ul className="mt-2 grid gap-1 text-sm text-danger">
                  {mappingValidation.issues.map(
                    (issue, index) => (
                      <li
                        key={`${issue.code}-${issue.fieldKey ?? issue.columnKey ?? index}`}
                      >
                        • {issue.message}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {mappingValidation?.isValid ? (
              <div className="rounded-md border border-success-border bg-success-bg p-3 text-sm font-medium text-success">
                Mapping hợp lệ. Có thể xem trước và
                chạy kiểm tra dữ liệu.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {workbook &&
      mappingValidation?.isValid ? (
        <Card>
          <CardHeader>
            <CardTitle>
              3. Xem trước và kiểm tra
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-canvas">
                  <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                    <th className="px-4 py-3">
                      Dòng
                    </th>
                    <th className="px-4 py-3">
                      Học viên
                    </th>
                    <th className="px-4 py-3">
                      Năm sinh
                    </th>
                    <th className="px-4 py-3">
                      Khối
                    </th>
                    <th className="px-4 py-3">
                      Phụ huynh
                    </th>
                    <th className="px-4 py-3">
                      SĐT
                    </th>
                    <th className="px-4 py-3">
                      Quan hệ
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-hairline">
                  {previewRows.map((row) => (
                    <tr key={String(row.row_number)}>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {displayCellValue(
                          row.row_number,
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold text-ink">
                        {displayCellValue(
                          row.student_full_name,
                        )}
                      </td>

                      <td className="px-4 py-3 text-ink">
                        {displayCellValue(
                          row.birth_year,
                        )}
                      </td>

                      <td className="px-4 py-3 text-ink">
                        {displayCellValue(
                          row.current_grade,
                        )}
                      </td>

                      <td className="px-4 py-3 text-ink">
                        {displayCellValue(
                          row.guardian_full_name,
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-ink">
                        {displayCellValue(
                          row.guardian_phone,
                        )}
                      </td>

                      <td className="px-4 py-3 text-ink">
                        {displayCellValue(
                          row.guardian_relationship,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {mappedRows.length > previewRows.length ? (
              <p className="text-xs text-ink-muted">
                Đang hiển thị 5/{mappedRows.length} dòng
                đầu tiên.
              </p>
            ) : null}

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
                disabled={
                  isPending ||
                  !mappingValidation.isValid
                }
                onClick={handleDryRun}
                type="button"
              >
                {isPending
                  ? "Đang kiểm tra..."
                  : `Kiểm tra ${mappedRows.length} dòng`}
              </Button>

              <span className="text-xs text-ink-muted">
                Dry-run chỉ kiểm tra, không tạo học viên
                hoặc phụ huynh.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {validationResult && workbook ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Tổng số dòng
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-ink">
                  {validationResult.row_count}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Hợp lệ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">
                  {validationResult.valid_count}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Cảnh báo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">
                  {validationResult.warning_count}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Không hợp lệ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-danger">
                  {validationResult.invalid_count}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Kết quả kiểm tra từng dòng
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3">
              <div className="overflow-x-auto rounded-lg border border-hairline">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-canvas">
                    <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-3">
                        Dòng
                      </th>
                      <th className="px-4 py-3">
                        Trạng thái
                      </th>
                      <th className="px-4 py-3">
                        Học viên
                      </th>
                      <th className="px-4 py-3">
                        Phụ huynh
                      </th>
                      <th className="px-4 py-3">
                        Xử lý phụ huynh
                      </th>
                      <th className="px-4 py-3">
                        Trùng học viên
                      </th>
                      <th className="px-4 py-3">
                        Chi tiết
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-hairline">
                    {validationRows.map((row) => (
                      <tr key={row.row_number}>
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                          {row.row_number}
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            tone={getStatusTone(
                              row.status,
                            )}
                          >
                            {getStatusLabel(
                              row.status,
                            )}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 font-semibold text-ink">
                          {row.normalized_data
                            .student_full_name ??
                            "—"}
                        </td>

                        <td className="px-4 py-3 text-ink">
                          {row.normalized_data
                            .guardian_full_name ??
                            "—"}
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              row.guardian_reused
                                ? "info"
                                : "neutral"
                            }
                          >
                            {row.guardian_reused
                              ? "Dùng lại"
                              : "Tạo mới"}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              row.exact_student_duplicate
                                ? "danger"
                                : "neutral"
                            }
                          >
                            {row.exact_student_duplicate
                              ? "Có"
                              : "Không"}
                          </Badge>
                        </td>

                        <td
                          className="max-w-xl px-4 py-3 text-xs text-ink"
                          title={getRowMessages(row)}
                        >
                          {getRowMessages(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validationResult.rows.length >
              validationRows.length ? (
                <p className="text-xs text-ink-muted">
                  Đang hiển thị 100/
                  {validationResult.rows.length} dòng kết
                  quả đầu tiên.
                </p>
              ) : null}

              {validationResult.invalid_count > 0 ? (
                <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-sm text-danger">
                  Chưa thể xác nhận import vì còn dòng
                  không hợp lệ. Hãy sửa file hoặc mapping
                  rồi chạy kiểm tra lại.
                </div>
              ) : (
                <div className="rounded-md border border-success-border bg-success-bg p-4 text-sm text-success">
                  Dry-run đã đạt. Bước tiếp theo sẽ bổ sung
                  xác nhận lý do và commit toàn bộ dữ liệu
                  trong một transaction.
                </div>
              )}
            </CardContent>
          </Card>

          <StudentImportCommitPanel
            canCreateStudents={canCreateStudents}
            rows={mappedRows}
            sourceFilename={workbook.sourceFilename}
            sourceSha256={workbook.sourceSha256}
            validationResult={validationResult}
          />
        </>
      ) : null}
    </div>
  );
}
