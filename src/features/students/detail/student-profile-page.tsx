"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { StudentActionMenu } from "@/features/students/detail/components/student-action-menu";
import { StudentAttendanceTab } from "@/features/students/detail/components/student-attendance-tab";
import { StudentClassesTab } from "@/features/students/detail/components/student-classes-tab";
import { StudentHistoryTab } from "@/features/students/detail/components/student-history-tab";
import { StudentPaymentsTab } from "@/features/students/detail/components/student-payments-tab";
import {
  formatMode,
  isStudentProfileTab,
  MetaList,
  PanelNotice,
  ProfilePanel,
  type StudentProfileTab,
} from "@/features/students/detail/components/student-profile-shared";
import { StudentSessionLedgerCard } from "@/features/students/detail/components/student-session-ledger-card";
import { StudentTuitionProfileCard } from "@/features/students/detail/components/student-tuition-profile-card";
import { getInitials } from "@/features/students/detail/helpers";
import {
  getAttendanceRate,
  getMainSessionCount,
  type StudentAttendanceHistory,
  type StudentPaymentSummary,
  type StudentUpcomingSession,
} from "@/features/students/detail/student-activity-models";
import {
  operationLabels,
  useStudentEnrollmentOperations,
} from "@/features/students/enrollment/student-enrollment-management";
import type {
  StudentEnrollmentOperation,
  StudentEnrollmentUiModel,
} from "@/features/students/enrollment/student-enrollment-ui-types";
import type { StudentLedgerReadModel } from "@/features/students/ledger-data";
import type { StudentDetailReadModel } from "@/features/students/read-models";
import type { StudentTuitionProfile } from "@/features/students/tuition-profile-data";
import { formatIsoDate, formatTime, formatWeekdayDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface StudentProfilePageProps {
  /** `null` = feed failed; `undefined` = not loaded (no permission). */
  attendance?: StudentAttendanceHistory | null;
  canCorrectAcquisitionSource?: boolean;
  canCreatePaymentRequest?: boolean;
  canManageTuitionRates?: boolean;
  canUpdateStudent: boolean;
  canViewAttendance?: boolean;
  canViewCare?: boolean;
  canViewClasses: boolean;
  canViewGuardians: boolean;
  canViewLedger?: boolean;
  canViewPayments?: boolean;
  canViewSessions?: boolean;
  /** Server-rendered care card for the "Chăm sóc" tab. */
  careCard?: ReactNode;
  careTaskCount?: number | null;
  detail: StudentDetailReadModel;
  directoryHref: string;
  editHref: string;
  enrollmentUiModel: StudentEnrollmentUiModel;
  initialTab?: string;
  ledgerSummary?: StudentLedgerReadModel | null;
  payments?: StudentPaymentSummary | null;
  tuitionProfile?: StudentTuitionProfile;
  /** `null` = nothing scheduled (or no class); see `upcomingSessionFailed`. */
  upcomingSession?: StudentUpcomingSession | null;
  /** The upcoming-session feed failed; the tile shows "—" instead of "Chưa xếp lịch". */
  upcomingSessionFailed?: boolean;
  zaloGroupCard?: ReactNode;
}

const menuOperations: ReadonlyArray<{ danger?: boolean; operation: StudentEnrollmentOperation }> = [
  { operation: "transfer" },
  { operation: "reserve" },
  { operation: "resume" },
  { danger: true, operation: "end" },
];

/**
 * Student profile (design 05): avatar header with one primary action, four
 * KPI tiles, fixed context column on the left, tabbed work area on the right.
 * Permissions arrive as props; the page only shows what the feature allows.
 */
export function StudentProfilePage({
  attendance,
  canCorrectAcquisitionSource = false,
  canCreatePaymentRequest = false,
  canManageTuitionRates = false,
  canUpdateStudent,
  canViewAttendance = false,
  canViewCare = false,
  canViewClasses,
  canViewGuardians,
  canViewLedger = false,
  canViewPayments = false,
  canViewSessions = false,
  careCard,
  careTaskCount = null,
  detail,
  directoryHref,
  editHref,
  enrollmentUiModel,
  initialTab,
  ledgerSummary = null,
  payments,
  tuitionProfile,
  upcomingSession = null,
  upcomingSessionFailed = false,
  zaloGroupCard,
}: StudentProfilePageProps) {
  const tabsId = useId();
  const operations = useStudentEnrollmentOperations({
    model: enrollmentUiModel,
    studentId: detail.id,
    studentName: detail.fullName,
  });

  const tabItems: TabItem[] = [];
  // The tuition card (rates, acquisition source) lives in the payments tab; a
  // role that can edit it keeps the tab even without payments/ledger view.
  const canEditTuition = Boolean(tuitionProfile) && (canManageTuitionRates || canCorrectAcquisitionSource);
  const showPaymentsTab = canViewPayments || canViewLedger || canEditTuition;
  // Rate and source details follow the payments tab: a role that cannot open it
  // (a TA) does not read the tuition rate elsewhere on the page either.
  const visibleTuitionProfile = showPaymentsTab ? tuitionProfile : undefined;

  if (canViewClasses) {
    tabItems.push({ count: detail.activeEnrollment ? 1 : 0, label: "Lớp", value: "classes" });
  }
  if (canViewAttendance) {
    tabItems.push({ count: attendance?.total, label: "Điểm danh", value: "attendance" });
  }
  if (showPaymentsTab) {
    const pending = (payments?.openCount ?? 0) + ((ledgerSummary?.balanceSessions ?? 1) <= 0 ? 1 : 0);
    tabItems.push({ label: "Thanh toán & số dư buổi", pending: pending > 0 ? pending : undefined, value: "payments" });
  }
  if (canViewCare) {
    tabItems.push({ count: careTaskCount ?? undefined, label: "Chăm sóc", value: "care" });
  }
  tabItems.push({ label: "Lịch sử", value: "history" });

  const fallbackTab = tabItems[0]?.value as StudentProfileTab;
  const [activeTab, setActiveTab] = useState<StudentProfileTab>(() =>
    isStudentProfileTab(initialTab) && tabItems.some((item) => item.value === initialTab) ? initialTab : fallbackTab,
  );

  function changeTab(value: string) {
    if (!isStudentProfileTab(value)) {
      return;
    }

    setActiveTab(value);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState(null, "", url);
    }
  }

  const activeClass = detail.activeEnrollment?.classInfo ?? null;
  const learningLevel = activeClass?.level ?? detail.learningLevel;
  const registeredMode = detail.activeEnrollment?.registeredMode ?? detail.registeredMode;
  const primaryGuardian = canViewGuardians
    ? detail.guardians.find((guardian) => guardian.isPrimary) ?? detail.guardians[0] ?? null
    : null;

  const primaryOperation: StudentEnrollmentOperation | null = enrollmentUiModel.actions.enroll.visible
    ? "enroll"
    : enrollmentUiModel.actions.resume.visible
      ? "resume"
      : null;
  const primaryAvailability = primaryOperation ? enrollmentUiModel.actions[primaryOperation] : null;
  const menuItems = menuOperations
    .filter(({ operation }) => operation !== primaryOperation && enrollmentUiModel.actions[operation].visible)
    .map(({ danger, operation }) => ({
      danger,
      enabled: enrollmentUiModel.actions[operation].enabled,
      label: operation === "end" ? "Nghỉ học (kết thúc ghi danh)" : operationLabels[operation],
      reason: enrollmentUiModel.actions[operation].reason,
      value: operation,
    }));

  const balance = ledgerSummary?.balanceSessions ?? null;
  const attendanceRate = attendance ? getAttendanceRate(attendance) : null;

  const metaParts = [
    detail.publicCode,
    `Khối ${detail.currentGrade}`,
    learningLevel ? `Mức ${learningLevel}` : null,
    registeredMode ? formatMode(registeredMode) : null,
    detail.officialStartDate ? `Vào trung tâm ${formatIsoDate(detail.officialStartDate)}` : null,
    primaryGuardian
      ? `Phụ huynh: ${primaryGuardian.fullName} (${primaryGuardian.relationship}) · ${primaryGuardian.phone}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <header className="grid gap-4">
        <nav aria-label="Điều hướng hồ sơ học sinh" className="text-secondary">
          <Link
            className="inline-flex items-center gap-1 font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={directoryHref}
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            Danh sách học sinh
          </Link>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-action-primary-soft text-[16px] font-bold text-action-primary"
            >
              {getInitials(detail.fullName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title font-semibold tracking-[-0.01em] text-text-strong">{detail.fullName}</h1>
                <StudentStatusBadge status={detail.lifecycleStatus} />
                {balance !== null && balance <= 0 ? (
                  <Badge tone={balance < 0 ? "danger" : "warning"}>
                    {balance < 0 ? `Nợ ${Math.abs(balance)} buổi` : "Hết buổi"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-secondary text-text-muted">{metaParts.join(" · ")}</p>
              {detail.nickname ? (
                <p className="mt-0.5 text-secondary text-text-muted">Tên thường gọi: {detail.nickname}</p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-start gap-2 md:justify-end">
            <StudentActionMenu items={menuItems} onSelect={(operation, trigger) => operations.open(operation, trigger)} />
            {canUpdateStudent ? (
              <Link className={getButtonClassName({ variant: "secondary" })} href={editHref}>
                Sửa hồ sơ
              </Link>
            ) : null}
            {primaryOperation && primaryAvailability ? (
              <Button
                disabled={!primaryAvailability.enabled}
                disabledReason={primaryAvailability.enabled ? undefined : primaryAvailability.reason ?? undefined}
                onClick={(event) => operations.open(primaryOperation, event.currentTarget)}
                type="button"
                variant="primary"
              >
                {primaryOperation === "enroll" ? "Ghi danh vào lớp" : "Quay lại học"}
              </Button>
            ) : null}
          </div>
        </div>

        {operations.successMessage ? <ResultBanner title={operations.successMessage} tone="success" /> : null}
      </header>

      <section
        aria-label="Chỉ số nhanh"
        className="grid grid-cols-2 divide-border-row rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] md:grid-cols-4 md:divide-x"
      >
        {/* Below md the 2×2 grid draws its own dividers: column after tiles 1/3, row above tiles 3/4. */}
        <KpiTile
          className="max-md:border-r"
          hint={
            !canViewAttendance
              ? "không có quyền xem điểm danh"
              : attendance === null
                ? "chưa tải được"
                : attendance && attendance.total > 0
                  ? attendance.truncated
                    ? `tính trên ${attendance.total} buổi gần nhất`
                    : `${attendance.counts.present}/${getMainSessionCount(attendance)} buổi chính${attendance.counts.additional_study > 0 ? ` · ${attendance.counts.additional_study} học thêm` : ""} · ${attendance.classes.length} lớp`
                  : "chưa có buổi được điểm danh"
          }
          label="Chuyên cần"
          value={!canViewAttendance ? "Không có quyền" : attendanceRate === null ? "—" : `${attendanceRate}%`}
        />
        <KpiTile
          hint={
            !canViewLedger
              ? "không có quyền xem số dư buổi"
              : ledgerSummary
                ? `+${ledgerSummary.totalCreditSessions} · −${ledgerSummary.totalDebitSessions} buổi`
                : "chưa tải được sổ buổi"
          }
          label="Số dư buổi"
          tone={balance !== null && balance < 0 ? "danger" : "default"}
          value={
            !canViewLedger
              ? "Không có quyền"
              : balance === null
                ? "—"
                : balance < 0
                  ? `Nợ ${Math.abs(balance)} buổi`
                  : `${balance} buổi`
          }
        />
        <KpiTile
          className="max-md:border-r max-md:border-t"
          hint={
            !canViewPayments
              ? "không có quyền xem thanh toán"
              : payments === null
                ? "chưa tải được"
                : payments?.truncated
                  ? `${payments.openCount} yêu cầu chờ · tính trên ${payments.requests.length} yêu cầu gần nhất`
                  : payments && payments.openCount > 0
                    ? `${payments.openCount} yêu cầu chờ thanh toán${payments.overdue ? " · có yêu cầu quá hạn" : ""}`
                    : "không có yêu cầu chờ"
          }
          label="Công nợ"
          // Same two levels as the directory: overdue debt is danger, other open debt warning.
          tone={payments && payments.outstandingVnd > 0 ? (payments.overdue ? "danger" : "warning") : "default"}
          value={!canViewPayments ? "Không có quyền" : payments ? formatVnd(payments.outstandingVnd) : "—"}
        />
        <KpiTile
          className="max-md:border-t"
          hint={
            !canViewSessions
              ? "không có quyền xem lịch buổi"
              : upcomingSessionFailed
                ? "chưa tải được"
                : upcomingSession
                  ? `${upcomingSession.className}${upcomingSession.roomName ? ` · ${upcomingSession.roomName}` : ""}`
                  : activeClass
                    ? "lớp chưa có buổi sắp tới"
                    : "học sinh chưa có lớp"
          }
          label="Buổi tới"
          value={
            !canViewSessions
              ? "Không có quyền"
              : upcomingSessionFailed
                ? "—"
                : upcomingSession
                  ? `${formatWeekdayDate(upcomingSession.sessionDate, { year: false })} · ${formatTime(upcomingSession.startTime)}`
                  : activeClass
                    ? "Chưa xếp lịch"
                    : "Chưa có lớp"
          }
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <ProfilePanel title="Phụ huynh" titleId="student-guardians-title">
            {!canViewGuardians ? (
              <PanelNotice tone="warning">Không có quyền xem phụ huynh.</PanelNotice>
            ) : detail.guardians.length === 0 ? (
              <PanelNotice>Học sinh chưa được liên kết phụ huynh.</PanelNotice>
            ) : (
              <ul className="grid gap-3">
                {detail.guardians.map((guardian) => (
                  <li className="grid gap-0.5" key={guardian.id}>
                    <p className="text-body font-semibold text-text-strong">
                      {guardian.fullName}
                      <span className="font-normal text-text-muted">
                        {" "}
                        · {guardian.relationship}
                        {guardian.isPrimary ? " · liên hệ chính" : ""}
                      </span>
                    </p>
                    <p className="text-body tabular-nums text-text-default">{guardian.phone}</p>
                    <p className="text-secondary text-text-muted">
                      {guardian.zalo ? `Zalo ${guardian.zalo}` : "Chưa có Zalo"}
                      {guardian.email ? ` · ${guardian.email}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </ProfilePanel>

          <ProfilePanel title="Thông tin học sinh" titleId="student-info-title">
            <MetaList
              items={[
                { label: "Năm sinh", value: String(detail.birthYear) },
                { label: "Khối", value: `Khối ${detail.currentGrade}` },
                { label: "Mức", value: learningLevel ?? "Chưa xác định" },
                { label: "Hình thức", value: registeredMode ? formatMode(registeredMode) : "Chưa xác định" },
                { label: "Tỉnh/TP", value: detail.provinceCity ?? "Chưa cập nhật" },
                { label: "Học chính thức", value: formatIsoDate(detail.officialStartDate) },
                ...(visibleTuitionProfile
                  ? [
                      { label: "Nguồn", value: visibleTuitionProfile.sourceName ?? "Chưa gán nguồn" },
                      {
                        label: "Học phí/buổi",
                        value:
                          visibleTuitionProfile.currentRateVnd === null
                            ? "Chưa thiết lập"
                            : formatVnd(visibleTuitionProfile.currentRateVnd),
                      },
                    ]
                  : []),
                { label: "Mục tiêu", value: detail.learningGoal ?? "Chưa cập nhật" },
              ]}
            />
          </ProfilePanel>

          <ProfilePanel
            action={
              canUpdateStudent ? (
                <Link
                  className="text-secondary font-medium text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                  href={editHref}
                >
                  Sửa
                </Link>
              ) : null
            }
            title="Ghi chú nội bộ"
            titleId="student-notes-title"
          >
            {detail.internalNotes ? (
              <p className="whitespace-pre-wrap text-secondary text-text-default">{detail.internalNotes}</p>
            ) : (
              <PanelNotice>Chưa có ghi chú.</PanelNotice>
            )}
          </ProfilePanel>

          {zaloGroupCard}
        </aside>

        <div className="grid min-w-0 content-start gap-4">
          <Tabs id={tabsId} items={tabItems} label="Mục trong hồ sơ học sinh" onValueChange={changeTab} value={activeTab} />

          {canViewClasses ? (
            <TabPanel activeValue={activeTab} tabsId={tabsId} value="classes">
              <StudentClassesTab
                canViewClasses={canViewClasses}
                detail={detail}
                model={enrollmentUiModel}
                onOperation={(operation, trigger) => operations.open(operation, trigger)}
              />
            </TabPanel>
          ) : null}

          {canViewAttendance ? (
            <TabPanel activeValue={activeTab} tabsId={tabsId} value="attendance">
              <StudentAttendanceTab canViewAttendance={canViewAttendance} history={attendance ?? null} />
            </TabPanel>
          ) : null}

          {showPaymentsTab ? (
            <TabPanel activeValue={activeTab} tabsId={tabsId} value="payments">
              <StudentPaymentsTab
                canCreatePaymentRequest={canCreatePaymentRequest}
                canViewPayments={canViewPayments}
                ledgerCard={canViewLedger ? <StudentSessionLedgerCard summary={ledgerSummary} /> : null}
                payments={payments ?? null}
                tuitionCard={
                  tuitionProfile ? (
                    <StudentTuitionProfileCard
                      canCorrectSource={canCorrectAcquisitionSource}
                      canManageRates={canManageTuitionRates}
                      profile={tuitionProfile}
                      studentId={detail.id}
                    />
                  ) : null
                }
              />
            </TabPanel>
          ) : null}

          {canViewCare ? (
            <TabPanel activeValue={activeTab} tabsId={tabsId} value="care">
              {careCard ?? <PanelNotice>Chưa tải được dữ liệu chăm sóc.</PanelNotice>}
            </TabPanel>
          ) : null}

          <TabPanel activeValue={activeTab} tabsId={tabsId} value="history">
            <StudentHistoryTab
              canViewClasses={canViewClasses}
              enrollmentHistory={detail.enrollmentHistory}
              tuitionProfile={visibleTuitionProfile}
            />
          </TabPanel>
        </div>
      </div>

      {operations.dialog}
    </div>
  );
}

function KpiTile({
  className,
  hint,
  label,
  tone = "default",
  value,
}: {
  className?: string;
  hint?: string;
  label: string;
  tone?: "default" | "danger" | "warning";
  value: string;
}) {
  return (
    <div className={cn("min-w-0 border-border-row px-4 py-3", className)}>
      <p className="text-secondary text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-[20px] font-semibold leading-7 tabular-nums md:truncate",
          tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text-strong",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 break-words text-caption text-text-muted md:truncate" title={hint}>{hint}</p> : null}
    </div>
  );
}
