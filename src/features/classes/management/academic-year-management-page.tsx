import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { AcademicYearStatusActions, CreateAcademicYearForm } from "@/features/classes/management/academic-year-management-actions";
import type { AcademicYearManagementItem } from "@/features/classes/read-models";

interface AcademicYearManagementPageProps { academicYears: AcademicYearManagementItem[]; canManageAcademicYears: boolean; }
const statusMeta: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = { active: { label: "Đang hoạt động", tone: "success" }, archived: { label: "Đã lưu trữ", tone: "neutral" }, closed: { label: "Đã đóng", tone: "neutral" }, draft: { label: "Bản nháp", tone: "warning" } };
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}/${month}/${year}` : value; }

export function AcademicYearManagementPage({ academicYears, canManageAcademicYears }: AcademicYearManagementPageProps) {
  return <main className="grid gap-6">
    <div className="grid gap-3"><Link className="flex w-fit items-center gap-2 text-secondary font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href="/classes"><ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />Quay lại danh sách lớp</Link><PageHeader context={<span className="text-secondary text-text-muted">{canManageAcademicYears ? "Có quyền quản lý" : "Chỉ có quyền xem"}</span>} title="Quản lý năm học"><p className="mt-1 text-secondary text-text-muted">Năm học là ngữ cảnh thuộc Lớp học; trạng thái và số lớp được hiển thị theo dữ liệu hiện có.</p></PageHeader></div>
    {canManageAcademicYears ? <CreateAcademicYearForm /> : <section className="rounded-lg border border-border-subtle bg-surface-raised p-4 text-secondary text-text-muted">Tài khoản hiện tại chỉ có quyền xem năm học. Các thao tác tạo và thay đổi trạng thái đã được ẩn.</section>}
    <section className="grid gap-3"><div><h2 className="text-section-title font-semibold text-text-strong">Danh sách năm học</h2><p className="mt-1 text-secondary text-text-muted">Năm học hiện tại luôn được ưu tiên hiển thị đầu tiên.</p></div>
      {academicYears.length === 0 ? <EmptyState description="Hệ thống chưa ghi nhận dữ liệu năm học." title="Chưa có năm học" /> : <div className="grid gap-3">{academicYears.map((academicYear) => <AcademicYearRow academicYear={academicYear} canManage={canManageAcademicYears} key={academicYear.id} />)}</div>}
    </section>
  </main>;
}

function AcademicYearRow({ academicYear, canManage }: { academicYear: AcademicYearManagementItem; canManage: boolean }) {
  const status = statusMeta[academicYear.status] ?? { label: academicYear.status, tone: "neutral" as const };
  const counts = academicYear.classCounts;
  return <article className="rounded-lg border border-border-subtle bg-surface-base p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-body font-semibold text-text-strong">{academicYear.code}</h3><Badge tone={status.tone}>{status.label}</Badge>{academicYear.isCurrent ? <span className="text-caption font-semibold text-text-muted">Năm học hiện tại</span> : null}</div><p className="mt-1 text-secondary text-text-muted">{academicYear.name}</p><p className="mt-2 text-secondary text-text-muted">{formatDate(academicYear.startsOn)} – {formatDate(academicYear.endsOn)}</p></div><dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-secondary sm:grid-cols-5"><Count label="Tổng lớp" value={counts.total} /><Count label="Nháp" value={counts.draft} /><Count label="Hoạt động" value={counts.active} /><Count label="Đã đóng" value={counts.closed} /><Count label="Lưu trữ" value={counts.archived} /></dl></div>{canManage ? <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-caption text-text-muted">Mọi thay đổi trạng thái đều yêu cầu nhập lý do.</p><AcademicYearStatusActions academicYear={academicYear} /></div> : null}</article>;
}
function Count({ label, value }: { label: string; value: number }) { return <div><dt className="text-caption text-text-muted">{label}</dt><dd className="mt-0.5 tabular-nums font-semibold text-text-strong">{value}</dd></div>; }
