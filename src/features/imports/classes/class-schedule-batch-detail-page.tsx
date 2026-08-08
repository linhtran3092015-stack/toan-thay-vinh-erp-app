"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { commitClassScheduleImportBatchAction } from "./actions";
import type {
  ClassScheduleImportBatchDetail,
  ClassScheduleImportClassRowRecord,
  ClassScheduleImportRowClassification,
  ClassScheduleImportScheduleRowRecord,
} from "./types";

interface ClassScheduleBatchDetailPageProps {
  detail: ClassScheduleImportBatchDetail;
}

export function ClassScheduleBatchDetailPage({
  detail,
}: ClassScheduleBatchDetailPageProps) {
  const [currentDetail, setCurrentDetail] = useState<ClassScheduleImportBatchDetail>(detail);
  const [activeTab, setActiveTab] = useState<"classes" | "schedules">("classes");

  const [isPendingCommit, startTransitionCommit] = useTransition();
  const [commitReason, setCommitReason] = useState(detail.batch.reason || "Pilot Data Import Readiness - commit lớp 2A1 và lịch học 2026-2027");
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);

  const { batch, classRows, scheduleRows } = currentDetail;

  // Filter preview rows
  const newClassRows = useMemo(
    () => classRows.filter((r) => r.classification === "new"),
    [classRows]
  );
  const existingMatchingClassRows = useMemo(
    () => classRows.filter((r) => r.classification === "existing_matching"),
    [classRows]
  );

  const newScheduleRows = useMemo(
    () => scheduleRows.filter((r) => r.classification === "new"),
    [scheduleRows]
  );
  const existingMatchingScheduleRows = useMemo(
    () => scheduleRows.filter((r) => r.classification === "existing_matching"),
    [scheduleRows]
  );

  const isCommitEligible =
    batch.status === "ready_to_commit" &&
    batch.class_conflict_count === 0 &&
    batch.class_invalid_count === 0 &&
    batch.schedule_conflict_count === 0 &&
    batch.schedule_invalid_count === 0 &&
    confirmationChecked &&
    confirmationText.trim() === "IMPORT LOP LICH" &&
    commitReason.trim().length > 0;

  const handleCommit = () => {
    if (!isCommitEligible) return;

    setCommitError(null);

    startTransitionCommit(async () => {
      const res = await commitClassScheduleImportBatchAction({
        batch_id: batch.id,
        confirmation_checked: true,
        confirmation_text: confirmationText.trim(),
        reason: commitReason.trim(),
      });

      if (!res.ok) {
        setCommitError(res.message);
      } else {
        // Update local state cleanly to reflect committed state
        setCurrentDetail((prev) => ({
          ...prev,
          batch: res.data,
          classRows: prev.classRows.map((r) => ({
            ...r,
            classification: "committed",
          })),
          scheduleRows: prev.scheduleRows.map((r) => ({
            ...r,
            classification: "committed",
          })),
        }));
      }
    });
  };

  const renderClassificationBadge = (classification: ClassScheduleImportRowClassification) => {
    switch (classification) {
      case "new":
        return <Badge tone="success">Mới</Badge>;
      case "existing_matching":
        return <Badge tone="info">Đã tồn tại & khớp</Badge>;
      case "existing_conflict":
        return <Badge tone="warning">Xung đột</Badge>;
      case "invalid":
        return <Badge tone="danger">Không hợp lệ</Badge>;
      case "committed":
        return <Badge tone="success">Đã import</Badge>;
      default:
        return <Badge tone="neutral">{classification}</Badge>;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "ready_to_commit":
        return <Badge tone="warning">Sẵn sàng import</Badge>;
      case "previewed":
        return <Badge tone="info">Đã xem trước</Badge>;
      case "committed":
        return <Badge tone="success">Đã import thành công</Badge>;
      case "rejected":
        return <Badge tone="danger">Đã từ chối</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Back Link */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/imports/classes"
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              ← Quay lại danh sách import
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Chi tiết Batch Import Lớp học & Lịch học
          </h1>
          <p className="text-sm text-slate-500 font-mono">ID: {batch.id}</p>
        </div>
        <div>{renderStatusBadge(batch.status)}</div>
      </div>

      {/* Batch Header Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Thông tin Batch Import</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-slate-500">Tên file gốc:</span>
            <p className="font-semibold text-slate-900">{batch.source_filename}</p>
          </div>
          <div>
            <span className="text-slate-500">Năm học:</span>
            <p className="font-semibold text-slate-900">{batch.academic_year_code}</p>
          </div>
          <div>
            <span className="text-slate-500">SHA-256:</span>
            <p className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[11px] truncate">
              {batch.source_sha256}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Thời gian tạo:</span>
            <p className="font-semibold text-slate-900">
              {new Date(batch.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
          {batch.committed_at && (
            <>
              <div>
                <span className="text-slate-500">Thời gian import:</span>
                <p className="font-semibold text-emerald-800">
                  {new Date(batch.committed_at).toLocaleString("vi-VN")}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Người thực hiện:</span>
                <p className="font-semibold text-emerald-800 font-mono">
                  {batch.committed_by || "System"}
                </p>
              </div>
            </>
          )}
          <div className="sm:col-span-2 lg:col-span-4 border-t pt-2 mt-1">
            <span className="text-slate-500">Lý do tạo batch:</span>
            <p className="font-medium text-slate-800 italic mt-0.5">
              &quot;{batch.reason}&quot;
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Committed Success Banner */}
      {batch.status === "committed" && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            Đã import lớp và lịch học thành công.
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            Các lớp học và lịch học mới đã được khởi tạo trong hệ thống dữ liệu vận hành.
            {batch.committed_at && (
              <span> Thời gian ghi: {new Date(batch.committed_at).toLocaleString("vi-VN")}.</span>
            )}
          </p>
        </div>
      )}

      {/* Classes Summary Cards */}
      <div>
        <h3 className="mb-3 text-sm font-bold tracking-tight text-slate-800">1. Tổng quan Lớp học ({batch.class_row_count} lớp)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="p-3">
            <p className="text-xs text-slate-500">Tổng số lớp</p>
            <p className="text-xl font-bold text-slate-900">{batch.class_row_count}</p>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs text-emerald-700">Tạo mới</p>
            <p className="text-xl font-bold text-emerald-800">{batch.class_new_count}</p>
          </Card>
          <Card className="border-blue-200 bg-blue-50/40 p-3">
            <p className="text-xs text-blue-700">Đã tồn tại & Khớp</p>
            <p className="text-xl font-bold text-blue-800">{batch.class_matching_count}</p>
          </Card>
          <Card className="border-amber-200 bg-amber-50/40 p-3">
            <p className="text-xs text-amber-700">Xung đột</p>
            <p className="text-xl font-bold text-amber-800">{batch.class_conflict_count}</p>
          </Card>
          <Card className="border-red-200 bg-red-50/40 p-3">
            <p className="text-xs text-red-700">Không hợp lệ</p>
            <p className="text-xl font-bold text-red-800">{batch.class_invalid_count}</p>
          </Card>
        </div>
      </div>

      {/* Schedules Summary Cards */}
      <div>
        <h3 className="mb-3 text-sm font-bold tracking-tight text-slate-800">2. Tổng quan Lịch học ({batch.schedule_row_count} lịch học)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="p-3">
            <p className="text-xs text-slate-500">Tổng số lịch</p>
            <p className="text-xl font-bold text-slate-900">{batch.schedule_row_count}</p>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs text-emerald-700">Tạo mới</p>
            <p className="text-xl font-bold text-emerald-800">{batch.schedule_new_count}</p>
          </Card>
          <Card className="border-blue-200 bg-blue-50/40 p-3">
            <p className="text-xs text-blue-700">Đã tồn tại & Khớp</p>
            <p className="text-xl font-bold text-blue-800">{batch.schedule_matching_count}</p>
          </Card>
          <Card className="border-amber-200 bg-amber-50/40 p-3">
            <p className="text-xs text-amber-700">Xung đột</p>
            <p className="text-xl font-bold text-amber-800">{batch.schedule_conflict_count}</p>
          </Card>
          <Card className="border-red-200 bg-red-50/40 p-3">
            <p className="text-xs text-red-700">Không hợp lệ</p>
            <p className="text-xl font-bold text-red-800">{batch.schedule_invalid_count}</p>
          </Card>
        </div>
      </div>

      {/* PREVIEWS BEFORE COMMIT */}
      {batch.status === "ready_to_commit" && (
        <div className="space-y-4">
          {/* New Classes to be Created */}
          {newClassRows.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-bold text-emerald-900">
                  Lớp sẽ được tạo ({newClassRows.length} lớp)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-emerald-100/50 font-semibold text-emerald-900">
                    <tr>
                      <th className="px-3 py-2">Mã lớp</th>
                      <th className="px-3 py-2">Tên lớp</th>
                      <th className="px-3 py-2">Khối/Trình độ</th>
                      <th className="px-3 py-2">Số buổi</th>
                      <th className="px-3 py-2">Hình thức</th>
                      <th className="px-3 py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {newClassRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-950">{r.class_code}</td>
                        <td className="px-3 py-2">{r.class_name}</td>
                        <td className="px-3 py-2">Khối {r.grade} ({r.level})</td>
                        <td className="px-3 py-2">{r.weekly_session_count} buổi/tuần</td>
                        <td className="px-3 py-2">{r.default_learning_mode}</td>
                        <td className="px-3 py-2">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* New Schedules to be Created */}
          {newScheduleRows.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-bold text-emerald-900">
                  Lịch học sẽ được tạo ({newScheduleRows.length} lịch học)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-emerald-100/50 font-semibold text-emerald-900">
                    <tr>
                      <th className="px-3 py-2">Mã lớp</th>
                      <th className="px-3 py-2">Thành phần</th>
                      <th className="px-3 py-2">Thứ</th>
                      <th className="px-3 py-2">Giờ học</th>
                      <th className="px-3 py-2">Hình thức</th>
                      <th className="px-3 py-2">Hiệu lực từ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {newScheduleRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-950">{r.class_code}</td>
                        <td className="px-3 py-2 font-semibold">{r.component_code}</td>
                        <td className="px-3 py-2">Thứ {r.weekday}</td>
                        <td className="px-3 py-2">{r.start_time} – {r.end_time}</td>
                        <td className="px-3 py-2">{r.learning_mode}</td>
                        <td className="px-3 py-2">{r.effective_from}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Existing Matching Reused Section */}
          {(existingMatchingClassRows.length > 0 || existingMatchingScheduleRows.length > 0) && (
            <Card className="border-blue-200 bg-blue-50/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-bold text-blue-900">
                  Đã tồn tại và sẽ được tái sử dụng ({existingMatchingClassRows.length} lớp, {existingMatchingScheduleRows.length} lịch)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-2 text-xs text-blue-800">
                Các đối tượng này đã tồn tại khớp dữ liệu trong hệ thống và sẽ không bị tạo trùng lại.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Detail Sub Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("classes")}
          className={`border-b-2 px-4 py-2 text-xs font-bold ${
            activeTab === "classes"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Chi tiết Lớp học ({classRows.length})
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`border-b-2 px-4 py-2 text-xs font-bold ${
            activeTab === "schedules"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Chi tiết Lịch học ({scheduleRows.length})
        </button>
      </div>

      {/* CLASSES DETAIL TABLE */}
      {activeTab === "classes" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Mã lớp</th>
                    <th className="px-3 py-2">Tên lớp</th>
                    <th className="px-3 py-2">Khối/Trình độ</th>
                    <th className="px-3 py-2">Số buổi</th>
                    <th className="px-3 py-2">Hình thức</th>
                    <th className="px-3 py-2">Phân loại</th>
                    <th className="px-3 py-2">ID Lớp hệ thống</th>
                    <th className="px-3 py-2">Thông báo kiểm tra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classRows.map((row: ClassScheduleImportClassRowRecord) => (
                    <tr
                      key={row.id}
                      className={
                        row.classification === "existing_conflict"
                          ? "bg-amber-50/50"
                          : row.classification === "invalid"
                          ? "bg-red-50/50"
                          : "hover:bg-slate-50"
                      }
                    >
                      <td className="px-3 py-2 font-mono text-slate-500">{row.source_row_number}</td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">{row.class_code}</td>
                      <td className="px-3 py-2">{row.class_name}</td>
                      <td className="px-3 py-2">
                        Khối {row.grade} ({row.level})
                      </td>
                      <td className="px-3 py-2">{row.weekly_session_count} buổi/tuần</td>
                      <td className="px-3 py-2">{row.default_learning_mode}</td>
                      <td className="px-3 py-2">{renderClassificationBadge(row.classification)}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">
                        {row.resolved_class_id ? (
                          <Link
                            href={`/classes/${row.resolved_class_id}`}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            {row.resolved_class_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.validation_message || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SCHEDULES DETAIL TABLE */}
      {activeTab === "schedules" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Mã lớp</th>
                    <th className="px-3 py-2">Thành phần</th>
                    <th className="px-3 py-2">Thứ</th>
                    <th className="px-3 py-2">Giờ học</th>
                    <th className="px-3 py-2">Hình thức</th>
                    <th className="px-3 py-2">Hiệu lực từ</th>
                    <th className="px-3 py-2">Phân loại</th>
                    <th className="px-3 py-2">Thông báo kiểm tra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduleRows.map((row: ClassScheduleImportScheduleRowRecord) => (
                    <tr
                      key={row.id}
                      className={
                        row.classification === "existing_conflict"
                          ? "bg-amber-50/50"
                          : row.classification === "invalid"
                          ? "bg-red-50/50"
                          : "hover:bg-slate-50"
                      }
                    >
                      <td className="px-3 py-2 font-mono text-slate-500">{row.source_row_number}</td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">{row.class_code}</td>
                      <td className="px-3 py-2 font-semibold">{row.component_code}</td>
                      <td className="px-3 py-2">Thứ {row.weekday}</td>
                      <td className="px-3 py-2">
                        {row.start_time} – {row.end_time}
                      </td>
                      <td className="px-3 py-2">{row.learning_mode}</td>
                      <td className="px-3 py-2">{row.effective_from}</td>
                      <td className="px-3 py-2">{renderClassificationBadge(row.classification)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.validation_message || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* COMMIT FORM PANEL (Only visible when status === 'ready_to_commit') */}
      {batch.status === "ready_to_commit" && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-emerald-950">
              Import Lớp & Lịch học chính thức
            </CardTitle>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 mt-2">
              <span className="font-bold">Cảnh báo quan trọng:</span> Thao tác này sẽ tạo lớp và lịch học chính thức trong hệ thống. Dữ liệu đã import không được tự động ghi đè hoặc xóa bằng workflow này.
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {/* Reason input */}
            <div className="space-y-1.5">
              <label htmlFor="commit-reason-input" className="text-xs font-medium text-slate-700">
                Lý do ghi nhận import <span className="text-red-500">*</span>
              </label>
              <input
                id="commit-reason-input"
                type="text"
                value={commitReason}
                onChange={(e) => setCommitReason(e.target.value)}
                placeholder="Nhập lý do thực hiện import..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            {/* Checkbox confirmation */}
            <div className="flex items-start gap-2 pt-1">
              <input
                id="commit-confirmation-checkbox"
                type="checkbox"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <label
                htmlFor="commit-confirmation-checkbox"
                className="cursor-pointer text-xs font-semibold text-slate-800 select-none"
              >
                Tôi xác nhận đã kiểm tra batch và đồng ý tạo các lớp và lịch học mới.
              </label>
            </div>

            {/* Confirmation text input */}
            <div className="space-y-1.5">
              <label htmlFor="commit-confirmation-text-input" className="text-xs font-medium text-slate-700">
                Nhập chính xác cụm từ <strong className="font-mono text-red-600">IMPORT LOP LICH</strong> để xác nhận:
              </label>
              <input
                id="commit-confirmation-text-input"
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="IMPORT LOP LICH"
                className="w-full sm:w-80 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono focus:border-slate-900 focus:outline-none uppercase"
              />
            </div>

            {/* Commit Error Alert */}
            {commitError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
                <div className="font-bold flex items-center gap-2">Lỗi thực thi Import</div>
                <p>{commitError}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleCommit}
                disabled={!isCommitEligible || isPendingCommit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
              >
                {isPendingCommit ? "Đang ghi dữ liệu..." : "Import lớp & lịch học"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
