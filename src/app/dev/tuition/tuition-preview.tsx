"use client";

import { AppShell } from "@/components/layout/app-shell";
import { buildTuitionPeriodSteps, PeriodStepper } from "@/features/finance/components/period-stepper";
import type { TuitionActionResult } from "@/features/tuition/actions";
import type { TuitionPeriodListItem, TuitionPreviewRow, TuitionSystemBlocker } from "@/features/tuition/data";
import {
  canReadTuitionPayments,
  summarizeTuitionPeriodRows,
  toCurrentTuitionItemRows,
  type TuitionPeriodItemQueryRow,
  type TuitionPeriodPaymentSummary,
} from "@/features/tuition/period-summary";
import { getTuitionLockReadiness, summarizeTuitionPreview } from "@/features/tuition/readiness";
import { TuitionLockedPeriodActions, TuitionPeriodHeader, TuitionPeriodLockedWorkspace } from "@/features/tuition/tuition-period-detail";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";
import { TuitionPeriodPageLockPanel } from "@/features/tuition/tuition-period-lock-panel";
import { TuitionReadinessTable } from "@/features/tuition/tuition-readiness-table";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type TuitionPreviewView = "list" | "draft" | "locked";
export type TuitionPreviewRole = "owner" | "accountant";
/** `ready`: like normal, but the draft has no blockers so its (stubbed) lock can be tried. */
export type TuitionPreviewState = "normal" | "ready" | "empty" | "errors";

/**
 * Inert stand-ins for every write the previewed components can make. The
 * preview runs on localhost where .env.local may point at production: it must
 * never reach createTuitionPeriodAction, lockTuitionPeriodAction or the
 * rate/source actions, so each control gets one of these instead.
 */
const previewResult: TuitionActionResult = { message: "Bản xem trước không ghi dữ liệu.", status: "error" };
export const previewActions = {
  create: async (): Promise<TuitionActionResult> => previewResult,
  lock: async (): Promise<TuitionActionResult> => previewResult,
  setRates: async (): Promise<TuitionActionResult> => previewResult,
  setSources: async (): Promise<TuitionActionResult> => previewResult,
};

/** Accountant: prepares and follows collection; locking stays with the owner. */
const accountantPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "finance.view",
  "payments.view",
  "payments.create_request",
  "sepay.view",
  "sepay.allocate",
  "tuition_periods.view",
  "tuition_periods.manage",
  "tuition_periods.export",
  "students.view",
  "students.manage_tuition_rates",
  "students.correct_acquisition_source",
];

const TODAY = "2026-10-14";

const draftPeriod: TuitionPeriodListItem = { dueOn: "2026-11-15", endsOn: "2026-11-30", id: "period-2611", name: "Học phí tháng 11/2026", startsOn: "2026-11-01", status: "draft" };
const lockedPeriod: TuitionPeriodListItem = {
  dueOn: "2026-10-15",
  endsOn: "2026-10-31",
  id: "period-2610",
  lockedAt: "2026-09-28T02:40:00Z",
  name: "Học phí tháng 10/2026",
  startsOn: "2026-10-01",
  status: "locked",
};
const overduePeriod: TuitionPeriodListItem = { dueOn: "2026-09-15", endsOn: "2026-09-30", id: "period-2609", lockedAt: "2026-08-28T03:00:00Z", name: "Học phí tháng 09/2026", startsOn: "2026-09-01", status: "locked" };
const completePeriod: TuitionPeriodListItem = { dueOn: "2026-08-15", endsOn: "2026-08-31", id: "period-2608", lockedAt: "2026-07-28T03:00:00Z", name: "Học phí tháng 08/2026", startsOn: "2026-08-01", status: "locked" };

const students = [
  { code: "TTV-00123", grade: 9, id: "s-01", klass: "Toán 9A tối 2-4-6", name: "Nguyễn Minh Anh" },
  { code: "TTV-00144", grade: 9, id: "s-02", klass: "Toán 9A tối 2-4-6", name: "Phạm Thu Hà" },
  { code: "TTV-00088", grade: 9, id: "s-03", klass: "Toán 9A tối 2-4-6", name: "Lý Nhật Quang" },
  { code: "TTV-00117", grade: 9, id: "s-04", klass: "Toán 9A tối 2-4-6", name: "Bùi Quang Minh" },
  { code: "TTV-00205", grade: 8, id: "s-05", klass: "Toán 8B chiều 3-5", name: "Trịnh Bảo Châu" },
  { code: "TTV-00188", grade: 8, id: "s-06", klass: "Toán 8B chiều 3-5", name: "Đặng Hải Đăng" },
  { code: "TTV-00212", grade: 7, id: "s-07", klass: "Toán 7A tối 3-5", name: "Mai Phương Linh" },
  { code: "TTV-00176", grade: 10, id: "s-08", klass: "Toán 10 NC", name: "Hồ Anh Khoa" },
  { code: "TTV-00190", grade: 7, id: "s-09", klass: "Toán 7A tối 3-5", name: "Vũ Gia Bảo" },
  { code: "TTV-00201", grade: 8, id: "s-10", klass: "Toán 8B chiều 3-5", name: "Ngô Khánh Vy" },
];

type Payment = [status: string, expected: number, paid: number] | null;

/** One item per student; s-04 was reissued (original cancelled, replacement partially paid). */
function lockedItems(periodId: string, payments: Payment[]): TuitionPeriodItemQueryRow[] {
  const items: TuitionPeriodItemQueryRow[] = students.map((student, index) => {
    const payment = payments[index] ?? null;
    return {
      id: `${periodId}-item-${student.id}`,
      payable_amount_vnd: payment ? payment[1] : 0,
      payable_sessions: payment ? Math.round(payment[1] / 200_000) : 0,
      payment_request: payment ? { expected_amount_vnd: payment[1], paid_amount_vnd: payment[2], status: payment[0] } : null,
      period_id: periodId,
      reissued_from_item_id: null,
      student_id: student.id,
      student_snapshot: { class_name: student.klass, current_grade: student.grade, full_name: student.name, public_code: student.code },
    };
  });
  const original = items[3];
  items[3] = { ...original, payment_request: { expected_amount_vnd: 2_520_000, paid_amount_vnd: 0, status: "cancelled" } };
  items.push({ ...original, id: `${original.id}-r1`, payable_amount_vnd: 2_400_000, payment_request: { expected_amount_vnd: 2_400_000, paid_amount_vnd: 1_920_000, status: "partially_paid" }, reissued_from_item_id: original.id });
  return items;
}

const octoberPayments: Payment[] = [
  ["partially_paid", 4_400_000, 2_000_000],
  ["pending", 2_400_000, 0],
  ["paid", 2_400_000, 2_400_000],
  ["pending", 2_520_000, 0],
  ["paid", 2_340_000, 2_340_000],
  ["pending", 2_340_000, 0],
  ["paid", 1_440_000, 1_440_000],
  ["paid", 2_000_000, 2_000_000],
  null,
  ["expired", 2_340_000, 0],
];

function summaryFor(period: TuitionPeriodListItem, payments: Payment[], paymentsVisible: boolean): TuitionPeriodPaymentSummary {
  const items = lockedItems(period.id, payments).map((item) => (paymentsVisible ? item : { ...item, payment_request: null }));
  return summarizeTuitionPeriodRows(toCurrentTuitionItemRows(items), { dueOn: period.dueOn, paymentsVisible, today: TODAY });
}

function previewRows(state: TuitionPreviewState): TuitionPreviewRow[] {
  if (state === "empty" || state === "errors") return [];
  const blocked = state === "normal";
  return students.flatMap((student, index) =>
    Array.from({ length: 8 }, (_, session) => ({
      acquisitionSourceId: blocked && index === 5 ? null : "source-direct",
      blockerCode: blocked && index === 2 ? "MISSING_PRIMARY_GUARDIAN" : null,
      classId: `class-${student.grade}`,
      classSessionId: `session-${student.id}-${session}`,
      enrollmentId: `enrollment-${student.id}`,
      openingBalanceSessions: index === 7 ? 2 : 0,
      sessionDate: `2026-11-${String(2 + session * 3).padStart(2, "0")}`,
      sessionKind: "regular",
      studentId: student.id,
      unitPriceVnd: blocked && index === 4 ? null : 200_000,
    })),
  );
}

function systemBlockersFor(state: TuitionPreviewState): TuitionSystemBlocker[] {
  return state === "errors" ? [{ code: "PREVIEW_UNAVAILABLE", message: "Không tải được đầy đủ dữ liệu kỳ thu. Vui lòng tải lại trước khi khóa kỳ." }] : [];
}

export function TuitionPreview({ role, state, view }: { role: TuitionPreviewRole; state: TuitionPreviewState; view: TuitionPreviewView }) {
  const permissions = role === "accountant" ? accountantPermissions : DATABASE_PERMISSION_CODES;
  const can = (code: PermissionCode) => permissions.includes(code);
  const paymentsVisible = canReadTuitionPayments(permissions);
  const pathname = view === "list" ? "/finance/tuition-periods" : `/finance/tuition-periods/${view === "draft" ? draftPeriod.id : lockedPeriod.id}`;

  return (
    <AppShell
      authUser={{ displayName: role === "accountant" ? "Phạm Thu Hạnh" : "Nguyễn Văn Vinh", email: "preview@example.com", id: "dev-user", initials: role === "accountant" ? "PH" : "NV" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={pathname}
      unreadNotificationCount={3}
    >
      {view === "list" ? <ListView can={can} paymentsVisible={paymentsVisible} state={state} /> : null}
      {view === "draft" ? <DraftView can={can} state={state} /> : null}
      {view === "locked" ? <LockedView can={can} paymentsVisible={paymentsVisible} state={state} /> : null}
    </AppShell>
  );
}

function ListView({ can, paymentsVisible, state }: { can: (code: PermissionCode) => boolean; paymentsVisible: boolean; state: TuitionPreviewState }) {
  const periods = state === "empty" ? [] : [draftPeriod, lockedPeriod, overduePeriod, completePeriod];
  const allPaid: Payment[] = octoberPayments.map((payment) => (payment && payment[0] !== "expired" ? ["paid", payment[1], payment[1]] : payment));

  return (
    <TuitionPeriodDirectory
      createAction={previewActions.create}
      lockAction={previewActions.lock}
      canLock={can("tuition_periods.lock")}
      canManage={can("tuition_periods.manage")}
      canManageTemplates={can("settings.receipts.manage")}
      loadError={state === "errors"}
      periods={state === "errors" ? [] : periods}
      previewByPeriod={{ [draftPeriod.id]: previewRows(state) }}
      summaries={{
        [completePeriod.id]: summaryFor(completePeriod, allPaid, paymentsVisible),
        [lockedPeriod.id]: summaryFor(lockedPeriod, octoberPayments, paymentsVisible),
        [overduePeriod.id]: summaryFor(overduePeriod, octoberPayments, paymentsVisible),
      }}
      systemBlockersByPeriod={{ [draftPeriod.id]: systemBlockersFor(state) }}
    />
  );
}

function DraftView({ can, state }: { can: (code: PermissionCode) => boolean; state: TuitionPreviewState }) {
  const rows = previewRows(state);
  const systemBlockers = systemBlockersFor(state);
  const readiness = getTuitionLockReadiness(rows, systemBlockers);
  const summary = summarizeTuitionPreview(rows);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <TuitionPeriodHeader period={draftPeriod} studentCount={readiness.previewUnavailable ? null : readiness.studentCount} />
      <PeriodStepper steps={buildTuitionPeriodSteps({ counts: null, itemCount: 0, requestCount: 0, status: "draft" })} />
      <TuitionPeriodPageLockPanel canLock={can("tuition_periods.lock")} lockAction={previewActions.lock} period={draftPeriod} preview={rows} systemBlockers={systemBlockers} variant="primary" />
      <TuitionReadinessTable
        setRatesAction={previewActions.setRates}
        setSourcesAction={previewActions.setSources}
        canManageRates={can("students.manage_tuition_rates")}
        canManageSources={can("students.correct_acquisition_source")}
        labels={Object.fromEntries(students.map((student) => [student.id, `${student.name} (${student.code})`]))}
        leadSources={[{ code: "DIRECT", id: "source-direct", name: "Đến trực tiếp trung tâm" }]}
        periodId={draftPeriod.id}
        studentDetails={Object.fromEntries(students.map((student) => [student.id, { fullName: student.name, id: student.id, publicCode: student.code }]))}
        students={summary}
      />
    </div>
  );
}

function LockedView({ can, paymentsVisible, state }: { can: (code: PermissionCode) => boolean; paymentsVisible: boolean; state: TuitionPreviewState }) {
  const items = state === "normal" || state === "ready" ? lockedItems(lockedPeriod.id, octoberPayments).map((item) => (paymentsVisible ? item : { ...item, payment_request: null })) : [];
  const rows = state === "errors" ? null : toCurrentTuitionItemRows(items);
  const summary = rows ? summarizeTuitionPeriodRows(rows, { dueOn: lockedPeriod.dueOn, paymentsVisible, today: TODAY }) : null;
  const reviewHref = can("sepay.view") ? "/finance/sepay?queue=review" : null;
  const owed = summary?.paymentsVisible ? summary.counts.partial + summary.counts.unpaid + summary.counts.unknown : null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <TuitionPeriodHeader
        actions={<TuitionLockedPeriodActions canViewPaymentRequests={can("payments.view") || can("payments.manage")} owedCount={owed} reviewHref={reviewHref} />}
        period={lockedPeriod}
        studentCount={rows ? rows.length : null}
      />
      <PeriodStepper
        steps={buildTuitionPeriodSteps({
          counts: summary?.paymentsVisible ? summary.counts : null,
          collectedVnd: summary?.collectedVnd,
          itemCount: rows ? rows.length : null,
          lockedAt: lockedPeriod.lockedAt,
          requestCount: rows ? rows.filter((row) => row.payableAmountVnd > 0).length : null,
          reviewHref,
          status: "locked",
        })}
      />
      <TuitionPeriodLockedWorkspace period={lockedPeriod} rows={rows} summary={summary} />
    </div>
  );
}
