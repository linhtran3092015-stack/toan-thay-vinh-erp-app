"use client";

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
import { formatIsoDate, formatTime } from "@/lib/datetime";
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
  upcomingSession?: StudentUpcomingSession | null;
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
  zaloGroupCard,
}: StudentProfilePageProps) {
  const tabsId = useId();
  const operations = useStudentEnrollmentOperations({
    model: enrollmentUiModel,
    studentId: detail.id,
    studentName: detail.fullName,
  });

  const tabItems: TabItem[] = [];

  if (canViewClasses) {
    tabItems.push({ count: detail.activeEnrollment ? 1 : 0, label: "Lớp", value: "classes" });
  }
  if (canViewAttendance) {
    tabItems.push({ count: attendance?.total, label: "Điểm danh", value: "attendance" });
  }
  if (canViewPayments || canViewLedger) {
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
      window.history.replaceState(window.history.state, "", url);
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
            className="font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={directoryHref}
          >
            ← Danh sách học sinh
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
        className="grid grid-cols-2 divide-border-row rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] max-md:divide-y md:grid-cols-4 md:divide-x"
      >
        <KpiTile
          hint={
            !canViewAttendance
              ? "attendance.view"
              : attendance === null
                ? "chưa tải được"
                : attendance && attendance.total > 0
                  ? `${attendance.counts.present + attendance.counts.additional_study}/${attendance.total} buổi · ${attendance.classes.length} lớp`
                  : "chưa có buổi được điểm danh"
          }
          label="Chuyên cần"
          value={!canViewAttendance ? "Không có quyền" : attendanceRate === null ? "—" : `${attendanceRate}%`}
        />
        <KpiTile
          hint={
            !canViewLedger
              ? "session_ledger.view"
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
          hint={
            !canViewPayments
              ? "payments.view"
              : payments === null
                ? "chưa tải được"
                : payments && payments.openCount > 0
                  ? `${payments.openCount} yêu cầu chờ thanh toán`
                  : "không có yêu cầu chờ"
          }
          label="Công nợ"
          tone={payments && payments.outstandingVnd > 0 ? "danger" : "default"}
          value={!canViewPayments ? "Không có quyền" : payments ? formatVnd(payments.outstandingVnd) : "—"}
        />
        <KpiTile
          hint={
            upcomingSession
              ? `${upcomingSession.className}${upcomingSession.roomName ? ` · ${upcomingSession.roomName}` : ""}`
              : activeClass
                ? "lớp chưa có buổi sắp tới"
                : "học sinh chưa có lớp"
          }
          label="Buổi tới"
          value={
            upcomingSession
              ? `${formatShortWeekdayDate(upcomingSession.sessionDate)} · ${formatTime(upcomingSession.startTime)}`
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
              <PanelNotice tone="warning">Không có quyền xem phụ huynh (guardians.view).</PanelNotice>
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
                ...(tuitionProfile
                  ? [
                      { label: "Nguồn", value: tuitionProfile.sourceName ?? "Chưa gán nguồn" },
                      {
                        label: "Học phí/buổi",
                        value: tuitionProfile.currentRateVnd === null ? "Chưa thiết lập" : formatVnd(tuitionProfile.currentRateVnd),
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

          {canViewPayments || canViewLedger ? (
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
              tuitionProfile={tuitionProfile}
            />
          </TabPanel>
        </div>
      </div>

      {operations.dialog}
    </div>
  );
}

function KpiTile({
  hint,
  label,
  tone = "default",
  value,
}: {
  hint?: string;
  label: string;
  tone?: "default" | "danger";
  value: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-secondary text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-[20px] font-semibold leading-7 tabular-nums md:truncate",
          tone === "danger" ? "text-danger" : "text-text-strong",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 break-words text-caption text-text-muted md:truncate">{hint}</p> : null}
    </div>
  );
}

const shortWeekdays = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"] as const;

/** `2026-10-14` → `Thứ 4 14/10` (design 05 KPI tile; the year would overflow the tile). */
function formatShortWeekdayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const weekday = shortWeekdays[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).getUTCDay()];
  return `${weekday} ${match[3]}/${match[2]}`;
}
