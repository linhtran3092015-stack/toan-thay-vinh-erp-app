import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import {
  getTuitionLeadSources,
  getTuitionLockedItems,
  getTuitionPeriodReadiness,
  getTuitionPeriods,
  getTuitionStudentDetails,
  getTuitionStudentLabels,
} from "@/features/tuition/data";
import { TuitionBulkPrintControls } from "@/features/tuition/print-controls";
import { summarizeTuitionPreview } from "@/features/tuition/readiness";
import { TuitionReadinessTable } from "@/features/tuition/tuition-readiness-table";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function TuitionPeriodDetailPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản cần quyền xem kỳ thu học phí."
        title="Không có quyền xem kỳ thu"
      />
    );
  }

  const periods = await getTuitionPeriods();
  const period = periods.find(item => item.id === periodId);

  if (!period) {
    return (
      <div className="grid gap-4 py-8 text-center">
        <h1 className="text-xl font-bold text-text-strong">Không tìm thấy kỳ thu học phí</h1>
        <p className="text-sm text-text-muted">Kỳ thu này không tồn tại hoặc bạn không có quyền xem.</p>
        <div>
          <Link
            className="inline-block rounded-md bg-action-primary px-4 py-2 text-sm font-semibold text-text-on-primary"
            href="/finance/tuition-periods"
          >
            ← Quay lại danh sách kỳ thu
          </Link>
        </div>
      </div>
    );
  }

  if (period.status === "draft") {
    const readiness = await getTuitionPeriodReadiness(period);
    const students = summarizeTuitionPreview(readiness.rows);
    const studentIds = students.map(student => student.studentId);

    const [labels, studentDetails, leadSources] = await Promise.all([
      getTuitionStudentLabels(studentIds),
      getTuitionStudentDetails(studentIds),
      getTuitionLeadSources(),
    ]);

    return (
      <div className="grid gap-5">
        <PageHeader title="Chuẩn bị thu học phí">
          <p>Hoàn thiện đơn giá và thông tin học viên trước khi khóa kỳ và tạo yêu cầu thanh toán.</p>
        </PageHeader>
        <TuitionPeriodDirectory
          canLock={permissions.permissions.includes("tuition_periods.lock")}
          canManage={false}
          periods={[period]}
          previewByPeriod={{ [periodId]: readiness.rows }}
          systemBlockersByPeriod={{ [periodId]: readiness.systemBlockers }}
        />
        <TuitionReadinessTable
          canManageRates={permissions.permissions.includes("students.manage_tuition_rates")}
          canManageSources={permissions.permissions.includes("students.correct_acquisition_source")}
          labels={labels}
          leadSources={leadSources}
          periodId={periodId}
          studentDetails={studentDetails}
          students={students}
        />
      </div>
    );
  }

  const items = await getTuitionLockedItems(periodId);
  return (
    <div className="grid gap-5">
      <PageHeader title={period.name}>
        <p>
          {period.startsOn} → {period.endsOn}
          {period.dueOn ? ` · Hạn ${period.dueOn}` : ""}
        </p>
      </PageHeader>
      <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-base font-semibold text-text-strong">Trạng thái: Đã khóa kỳ thu</h2>
        <p className="mt-1 text-sm text-text-muted">
          {items.length} phiếu · {items.filter(item => item.amountVnd === 0).length} không cần thu ·{" "}
          {items.filter(item => item.amountVnd > 0).length} yêu cầu thanh toán
        </p>
        <div className="mt-2">
          <Link
            className="font-semibold text-action-link underline text-sm"
            href="/finance/payment-requests"
          >
            Mở danh sách yêu cầu thanh toán →
          </Link>
        </div>
      </section>
      <TuitionBulkPrintControls
        notices={items.map(item => ({
          id: item.id,
          name: item.studentName,
          grade: item.studentGrade,
          href: `/finance/tuition-periods/${periodId}/items/${item.id}/notice`,
        }))}
      />
      <section className="grid gap-3">
        <h3 className="font-semibold text-sm text-text-muted">Danh sách phiếu học phí ({items.length})</h3>
        <div className="grid gap-2">
          {items.map(item => (
            <article
              className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-base p-3 shadow-sm hover:border-border-strong transition-colors"
              key={item.id}
            >
              <div>
                <strong className="text-text-strong">{item.studentName}</strong>
                <p className="text-xs text-text-muted">
                  {item.payableSessions} buổi · {item.amountVnd.toLocaleString("vi-VN")}đ · Trạng thái: {item.status}
                </p>
              </div>
              <Link
                className="text-xs font-semibold text-action-link hover:underline"
                href={`/finance/tuition-periods/${periodId}/items/${item.id}/notice`}
              >
                Mở Phiếu học phí →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
