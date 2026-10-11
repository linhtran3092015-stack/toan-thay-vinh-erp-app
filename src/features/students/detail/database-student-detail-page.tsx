import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { StudentEnrollmentManagement } from "@/features/students/enrollment/student-enrollment-management";
import type { StudentEnrollmentUiModel } from "@/features/students/enrollment/student-enrollment-ui-types";
import { StudentSessionLedgerCard } from "@/features/students/detail/components/student-session-ledger-card";
import { StudentTuitionProfileCard } from "@/features/students/detail/components/student-tuition-profile-card";
import type { StudentLedgerReadModel } from "@/features/students/ledger-data";
import type { StudentTuitionProfile } from "@/features/students/tuition-profile-data";
import type {
  StudentDetailReadModel,
  StudentEnrollmentReadModel,
  StudentScheduleReadModel,
} from "@/features/students/read-models";

interface DatabaseStudentDetailPageProps {
  canUpdateStudent: boolean;
  canViewClasses: boolean;
  canViewGuardians: boolean;
  canViewLedger?: boolean;
  canCorrectAcquisitionSource?: boolean;
  canManageTuitionRates?: boolean;
  directoryHref: string;
  detail: StudentDetailReadModel;
  editHref: string;
  enrollmentUiModel: StudentEnrollmentUiModel;
  ledgerSummary?: StudentLedgerReadModel | null;
  tuitionProfile?: StudentTuitionProfile;
  zaloGroupCard?: React.ReactNode;
}

export function DatabaseStudentDetailPage({
  canUpdateStudent,
  canViewClasses,
  canViewGuardians,
  canViewLedger = false,
  canCorrectAcquisitionSource = false,
  canManageTuitionRates = false,
  directoryHref,
  detail,
  editHref,
  enrollmentUiModel,
  ledgerSummary = null,
  tuitionProfile,
  zaloGroupCard,
}: DatabaseStudentDetailPageProps) {
  const activeClass = detail.activeEnrollment?.classInfo;
  const learningLevel =
    activeClass?.level ?? detail.learningLevel;
  const registeredMode =
    detail.activeEnrollment?.registeredMode ??
    detail.registeredMode;

  return (
    <div className="grid min-w-0 gap-6">
      <section className="rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5">
        <nav aria-label="Điều hướng hồ sơ học viên" className="mb-4 flex flex-wrap items-center gap-2 text-secondary text-text-muted">
          <Link
            className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            href={directoryHref}
          >
            Học viên
          </Link>
          <span>/</span>
          <span className="font-semibold text-text-strong">
            {detail.publicCode}
          </span>
        </nav>

        <PageHeader
          actions={canUpdateStudent ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-4 text-control font-semibold text-text-strong transition-colors hover:border-border-strong hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
              href={editHref}
            >
              Chỉnh sửa hồ sơ
            </Link>
          ) : null}
          context={<StudentStatusBadge status={detail.lifecycleStatus} />}
          title={detail.fullName}
        >
          <p className="mt-1 text-secondary text-text-muted">
            Mã {detail.publicCode} · Khối {detail.currentGrade}
            {activeClass ? ` · ${activeClass.name}` : " · Chưa xếp lớp"}
            {learningLevel ? ` · Mức ${learningLevel}` : ""}
            {registeredMode ? ` · ${formatMode(registeredMode)}` : ""}
          </p>
          {detail.nickname ? <p className="mt-1 text-secondary text-text-muted">Tên thường gọi: {detail.nickname}</p> : null}
        </PageHeader>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="grid content-start gap-4">
          <StudentEnrollmentManagement
            model={enrollmentUiModel}
            studentId={detail.id}
            studentName={detail.fullName}
          />

          {zaloGroupCard}

          {canViewLedger ? (
            <StudentSessionLedgerCard summary={ledgerSummary} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Thông tin học viên</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoTile
                label="Họ và tên"
                value={detail.fullName}
              />
              <InfoTile
                label="Tên thường gọi"
                value={detail.nickname ?? "Chưa cập nhật"}
              />
              <InfoTile
                label="Năm sinh"
                value={String(detail.birthYear)}
              />
              <InfoTile
                label="Khối hiện tại"
                value={`Khối ${detail.currentGrade}`}
              />
              <InfoTile
                label="Tỉnh/thành phố"
                value={detail.provinceCity ?? "Chưa cập nhật"}
              />
              <InfoTile
                label="Ngày học chính thức"
                value={formatDate(detail.officialStartDate)}
              />
              <InfoTile
                label="Mục tiêu học tập"
                value={detail.learningGoal ?? "Chưa cập nhật"}
                wide
              />
              <InfoTile
                label="Ghi chú nội bộ"
                value={detail.internalNotes ?? "Chưa có ghi chú"}
                wide
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lớp chính và lịch học</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              {!canViewClasses ? (
                <NoticeText>
                  Tài khoản không có quyền classes.view.
                </NoticeText>
              ) : !detail.activeEnrollment ||
                !activeClass ? (
                <NoticeText>
                  Học viên chưa có lớp đang hoạt động.
                </NoticeText>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoTile
                      label="Mã lớp"
                      value={activeClass.code}
                    />
                    <InfoTile
                      label="Tên lớp"
                      value={activeClass.name}
                    />
                    <InfoTile
                      label="Khối"
                      value={`Khối ${activeClass.grade}`}
                    />
                    <InfoTile
                      label="Mức"
                      value={activeClass.level}
                    />
                    <InfoTile
                      label="Hình thức đăng ký"
                      value={formatMode(
                        detail.activeEnrollment.registeredMode,
                      )}
                    />
                    <InfoTile
                      label="Ngày bắt đầu"
                      value={formatDate(
                        detail.activeEnrollment.effectiveFrom,
                      )}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-ink">
                      Lịch học đang hiệu lực
                    </h3>

                    {detail.activeSchedules.length === 0 ? (
                      <NoticeText>
                        Lớp chưa có lịch học đang hiệu lực.
                      </NoticeText>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {detail.activeSchedules.map(
                          (schedule) => (
                            <ScheduleCard
                              key={schedule.id}
                              schedule={schedule}
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử xếp lớp</CardTitle>
            </CardHeader>

            <CardContent>
              {!canViewClasses ? (
                <NoticeText>
                  Tài khoản không có quyền classes.view.
                </NoticeText>
              ) : detail.enrollmentHistory.length === 0 ? (
                <NoticeText>
                  Chưa có lịch sử xếp lớp.
                </NoticeText>
              ) : (
                <div className="grid gap-3">
                  {detail.enrollmentHistory.map(
                    (enrollment) => (
                      <EnrollmentHistoryCard
                        enrollment={enrollment}
                        key={enrollment.id}
                      />
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          {tuitionProfile ? <StudentTuitionProfileCard canCorrectSource={canCorrectAcquisitionSource} canManageRates={canManageTuitionRates} profile={tuitionProfile} studentId={detail.id} /> : null}
          <Card>
            <CardHeader>
              <CardTitle>Phụ huynh</CardTitle>
            </CardHeader>

            <CardContent>
              {!canViewGuardians ? (
                <NoticeText>
                  Tài khoản không có quyền guardians.view.
                </NoticeText>
              ) : detail.guardians.length === 0 ? (
                <NoticeText>
                  Học viên chưa được liên kết phụ huynh.
                </NoticeText>
              ) : (
                <div className="grid gap-4">
                  {detail.guardians.map((guardian) => (
                    <div
                      className="rounded-md border border-hairline bg-canvas p-4"
                      key={guardian.id}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">
                          {guardian.fullName}
                        </p>

                        {guardian.isPrimary ? (
                          <Badge tone="success">
                            Phụ huynh chính
                          </Badge>
                        ) : null}
                      </div>

                      <div className="grid gap-2 text-sm">
                        <InfoLine
                          label="Quan hệ"
                          value={guardian.relationship}
                        />
                        <InfoLine
                          label="Số điện thoại"
                          value={guardian.phone}
                        />
                        <InfoLine
                          label="Zalo"
                          value={guardian.zalo ?? "Chưa cập nhật"}
                        />
                        <InfoLine
                          label="Email"
                          value={guardian.email ?? "Chưa cập nhật"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thông tin hệ thống</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3">
              <InfoLine
                label="Mã học viên"
                value={detail.publicCode}
              />
              <InfoLine
                label="Trạng thái"
                value={formatLifecycleStatus(
                  detail.lifecycleStatus,
                )}
              />
              <InfoLine
                label="Hình thức hiện tại"
                value={
                  registeredMode
                    ? formatMode(registeredMode)
                    : "Chưa xác định"
                }
              />
              <InfoLine
                label="Mức hiện tại"
                value={learningLevel ?? "Chưa xác định"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScheduleCard({
  schedule,
}: {
  schedule: StudentScheduleReadModel;
}) {
  return (
    <div className="rounded-md border border-hairline bg-canvas p-4">
      <p className="font-semibold text-ink">
        {formatWeekday(schedule.weekday)}
      </p>

      <p className="mt-1 text-sm text-ink-muted">
        {formatTime(schedule.startTime)}–
        {formatTime(schedule.endTime)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="neutral">
          {formatMode(schedule.learningMode)}
        </Badge>

        {schedule.componentCode ? (
          <Badge tone="neutral">
            {schedule.componentCode}
          </Badge>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-ink-muted">
        {schedule.roomName ??
          (schedule.learningMode === "online"
            ? "Học trực tuyến"
            : "Chưa cập nhật phòng")}
      </p>
    </div>
  );
}

function EnrollmentHistoryCard({
  enrollment,
}: {
  enrollment: StudentEnrollmentReadModel;
}) {
  const className =
    enrollment.classInfo?.name ?? "Không xác định";

  return (
    <div className="rounded-md border border-hairline bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">
            {className}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDate(enrollment.effectiveFrom)}
            {" – "}
            {enrollment.effectiveTo
              ? formatDate(enrollment.effectiveTo)
              : "Hiện tại"}
          </p>
        </div>

        <Badge
          tone={
            enrollment.status === "active"
              ? "success"
              : enrollment.status === "reserved"
                ? "warning"
                : "neutral"
          }
        >
          {formatEnrollmentStatus(enrollment.status)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="neutral">
          {formatTransitionKind(
            enrollment.transitionKind,
          )}
        </Badge>
        <Badge tone="neutral">
          {formatMode(enrollment.registeredMode)}
        </Badge>
      </div>

      {enrollment.startReason ? (
        <p className="mt-3 text-sm text-ink-muted">
          Lý do bắt đầu: {enrollment.startReason}
        </p>
      ) : null}

      {enrollment.endReason ? (
        <p className="mt-1 text-sm text-ink-muted">
          Lý do kết thúc: {enrollment.endReason}
        </p>
      ) : null}
    </div>
  );
}

function InfoTile({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-hairline bg-canvas p-3 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink">
        {value}
      </p>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

function NoticeText({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-hairline bg-canvas p-4 text-sm text-ink-muted">
      {children}
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatMode(value: string): string {
  if (value === "online") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  if (value === "hybrid") {
    return "Kết hợp";
  }

  return value;
}

function formatWeekday(value: number): string {
  const labels: Record<number, string> = {
    0: "Chủ nhật",
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    7: "Chủ nhật",
  };

  return labels[value] ?? `Ngày ${value}`;
}

function formatTransitionKind(value: string): string {
  const labels: Record<string, string> = {
    initial: "Nhập lớp ban đầu",
    resume: "Quay lại học",
    transfer: "Chuyển lớp",
  };

  return Object.hasOwn(labels, value)
    ? labels[value]
    : `Loại chuyển tiếp chưa hỗ trợ: ${value}`;
}

function formatEnrollmentStatus(value: string): string {
  const labels: Record<string, string> = {
    active: "Đang học",
    completed: "Hoàn thành",
    reserved: "Bảo lưu",
    transferred: "Đã chuyển lớp",
  };

  return Object.hasOwn(labels, value)
    ? labels[value]
    : `Trạng thái ghi danh chưa hỗ trợ: ${value}`;
}

function formatLifecycleStatus(value: string): string {
  const labels: Record<string, string> = {
    active: "Đang học",
    completed: "Hoàn thành",
    interested: "Đang quan tâm",
    pending_enrollment_confirmation:
      "Chờ xác nhận nhập học",
    reserved: "Bảo lưu",
    resumed: "Quay lại học",
    trial_booked: "Đã đặt lịch học thử",
    trial_completed: "Đã học thử",
    waiting_class: "Chờ chọn lớp",
  };

  return Object.hasOwn(labels, value)
    ? labels[value]
    : `Trạng thái chưa hỗ trợ: ${value}`;
}
