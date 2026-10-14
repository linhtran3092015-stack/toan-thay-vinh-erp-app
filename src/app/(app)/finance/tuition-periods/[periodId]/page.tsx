import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { getButtonClassName } from "@/components/ui/button";
import { buildTuitionPeriodSteps, PeriodStepper } from "@/features/finance/components/period-stepper";
import {
  getTuitionLeadSources,
  getTuitionPeriodReadiness,
  getTuitionStudentDetails,
  getTuitionStudentLabels,
  loadTuitionPeriods,
} from "@/features/tuition/data";
import { canReadTuitionPayments, summarizeTuitionPeriodRows } from "@/features/tuition/period-summary";
import { getTuitionPeriodItemRows } from "@/features/tuition/period-summary-data";
import { getTuitionLockReadiness, summarizeTuitionPreview } from "@/features/tuition/readiness";
import { ClearLockedFlag, TuitionLockedPeriodActions, TuitionPeriodHeader, TuitionPeriodLockedWorkspace } from "@/features/tuition/tuition-period-detail";
import { TuitionPeriodPageLockPanel } from "@/features/tuition/tuition-period-lock-panel";
import { TuitionReadinessTable } from "@/features/tuition/tuition-readiness-table";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function TuitionPeriodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>;
  searchParams?: Promise<{ locked?: string | string[] }>;
}) {
  const { periodId } = await params;
  // Set by the lock panel after a successful lock; any other value is ignored.
  const justLocked = (await searchParams)?.locked === "1";
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản cần quyền xem kỳ thu học phí."
        title="Không có quyền xem kỳ thu"
      />
    );
  }

  const periods = await loadTuitionPeriods();
  if (periods === null) {
    return (
      <ErrorState
        description="Chưa tải được kỳ thu học phí. Tải lại trang để thử lại; kỳ thu không bị thay đổi."
        title="Không tải được kỳ thu"
      />
    );
  }
  const period = periods.find(item => item.id === periodId);

  if (!period) {
    return (
      <div className="grid gap-4 py-8 text-center">
        <h1 className="text-page-title font-semibold text-text-strong">Không tìm thấy kỳ thu học phí</h1>
        <p className="text-body text-text-muted">Kỳ thu này không tồn tại hoặc bạn không có quyền xem.</p>
        <div>
          <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href="/finance/tuition-periods">
            ← Quay lại danh sách kỳ thu
          </Link>
        </div>
      </div>
    );
  }

  const granted = permissions.permissions;

  if (period.status === "draft") {
    const readiness = await getTuitionPeriodReadiness(period);
    const students = summarizeTuitionPreview(readiness.rows);
    const studentIds = students.map(student => student.studentId);
    const lockReadiness = getTuitionLockReadiness(readiness.rows, readiness.systemBlockers);

    const [labels, studentDetails, leadSources] = await Promise.all([
      getTuitionStudentLabels(studentIds),
      getTuitionStudentDetails(studentIds),
      getTuitionLeadSources(),
    ]);

    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <TuitionPeriodHeader period={period} studentCount={lockReadiness.previewUnavailable ? null : lockReadiness.studentCount} />
        <PeriodStepper steps={buildTuitionPeriodSteps({ counts: null, itemCount: 0, requestCount: 0, status: "draft" })} />
        <TuitionPeriodPageLockPanel
          canLock={granted.includes("tuition_periods.lock")}
          period={period}
          preview={readiness.rows}
          systemBlockers={readiness.systemBlockers}
          variant="primary"
        />
        <TuitionReadinessTable
          canManageRates={granted.includes("students.manage_tuition_rates")}
          canManageSources={granted.includes("students.correct_acquisition_source")}
          labels={labels}
          leadSources={leadSources}
          periodId={periodId}
          studentDetails={studentDetails}
          students={students}
        />
      </div>
    );
  }

  const paymentsVisible = canReadTuitionPayments(granted);
  const rows = await getTuitionPeriodItemRows(periodId, { canViewPayments: paymentsVisible });
  const summary = rows ? summarizeTuitionPeriodRows(rows, { dueOn: period.dueOn, paymentsVisible, today: getVietnamToday() }) : null;
  const owed = summary && summary.paymentsVisible ? summary.counts.partial + summary.counts.unpaid + summary.counts.unknown : null;
  const reviewHref = granted.includes("sepay.view") ? "/finance/sepay?queue=review" : null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <TuitionPeriodHeader
        actions={
          <TuitionLockedPeriodActions
            canViewPaymentRequests={granted.includes("payments.view") || granted.includes("payments.manage")}
            owedCount={owed}
            reviewHref={reviewHref}
          />
        }
        period={period}
        studentCount={rows ? rows.length : null}
      />
      {justLocked ? (
        <>
          <ResultBanner description="Phiếu học phí và yêu cầu thanh toán của kỳ đã được tạo." title="Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ." tone="success" />
          <ClearLockedFlag />
        </>
      ) : null}
      <PeriodStepper
        steps={buildTuitionPeriodSteps({
          counts: summary && summary.paymentsVisible ? summary.counts : null,
          collectedVnd: summary?.collectedVnd,
          itemCount: rows ? rows.length : null,
          lockedAt: period.lockedAt,
          requestCount: rows ? rows.filter(row => row.payableAmountVnd > 0).length : null,
          reviewHref,
          status: "locked",
        })}
      />
      <TuitionPeriodLockedWorkspace period={period} rows={rows} summary={summary} />
    </div>
  );
}
