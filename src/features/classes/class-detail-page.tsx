"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { ActionMenu } from "@/components/patterns/action-menu";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import type { ClassDetailWorkspace, ClassEnrollmentCandidate } from "@/features/classes/detail/class-detail-data";
import { summarizeClassSessions } from "@/features/classes/detail/class-detail-models";
import { ClassEnrollDialog } from "@/features/classes/detail/components/class-enroll-dialog";
import { ClassOverviewTab } from "@/features/classes/detail/components/class-overview-tab";
import { ClassScheduleSection, sortSchedules } from "@/features/classes/detail/components/class-schedule-section";
import { ClassSessionsTab } from "@/features/classes/detail/components/class-sessions-tab";
import type { ClassTargetStatus } from "@/features/classes/forms/class-action-types";
import { useClassStatusOperations } from "@/features/classes/management/class-status-actions";
import type { ClassDetailReadModel, ClassScheduleReadModel } from "@/features/classes/read-models";
import { getVietnamTime, getVietnamToday } from "@/lib/datetime";
import { formatLearningMode } from "@/lib/format";

export type ClassDetailTab = "overview" | "sessions";

const classDetailTabs: readonly ClassDetailTab[] = ["overview", "sessions"];

function isClassDetailTab(value: unknown): value is ClassDetailTab {
  return typeof value === "string" && (classDetailTabs as readonly string[]).includes(value);
}

const unavailableWorkspace: ClassDetailWorkspace = {
  absenceStreaks: { reason: "forbidden", status: "unavailable" },
  attendance: { reason: "forbidden", status: "unavailable" },
  debt: { reason: "forbidden", status: "unavailable" },
  results: { reason: "forbidden", status: "unavailable" },
  sessions: { reason: "forbidden", status: "unavailable" },
  students: { reason: "forbidden", status: "unavailable" },
};

interface ClassDetailPageProps {
  /**
   * Bulk cancel in the sessions tab is owner-only: sessions.manage AND
   * classes.manage_schedule (teaching assistants hold only sessions.manage).
   */
  canBulkCancelSessions?: boolean;
  canEditClass: boolean;
  /** students.manage_status: the enroll RPC's permission. */
  canEnrollStudents?: boolean;
  canLockSessions?: boolean;
  canManageSchedule: boolean;
  /** sessions.manage: the batch-creation link. */
  canManageSessions?: boolean;
  canViewCare?: boolean;
  canViewStudentCount: boolean;
  detail: ClassDetailReadModel;
  directoryQuery?: string;
  /** `null` = failed to load; `undefined` = not loaded (no permission). */
  enrollmentCandidates?: { candidates: ClassEnrollmentCandidate[]; truncated: boolean } | null;
  initialTab?: string;
  /** HH:MM in Vietnam time, computed on the server so both renders agree. */
  nowTime?: string;
  /** YYYY-MM-DD in Vietnam time, computed on the server so both renders agree. */
  today?: string;
  workspace?: ClassDetailWorkspace;
}

/**
 * Class detail (design 03): header with one primary action ("Ghi danh học
 * sinh"), status changes in the "…" menu, and tabs for the overview and the
 * class's sessions. Students, results and tuition tabs follow in a later step.
 */
export function ClassDetailPage({
  canBulkCancelSessions = false,
  canEditClass,
  canEnrollStudents = false,
  canLockSessions = false,
  canManageSchedule,
  canManageSessions = false,
  canViewCare = false,
  canViewStudentCount,
  detail,
  directoryQuery = "",
  enrollmentCandidates,
  initialTab,
  nowTime,
  today,
  workspace = unavailableWorkspace,
}: ClassDetailPageProps) {
  const router = useRouter();
  const tabsId = useId();
  const resolvedToday = today ?? getVietnamToday();
  const resolvedNow = nowTime ?? getVietnamTime();
  const sessionRows = workspace.sessions.status === "ready" ? workspace.sessions.value.rows : null;
  const summary = sessionRows ? summarizeClassSessions(sessionRows, resolvedToday, resolvedNow) : null;
  // The feed also holds a composite's component sessions; change_class_status only
  // cancels (and is only blocked by) the class's own sessions.
  const ownSessionRows = sessionRows ? sessionRows.filter((row) => row.classId === detail.id) : null;
  const classStatus = getClassStatusMeta(detail.status);
  const statusOperations = useClassStatusOperations({
    classCode: detail.code,
    classId: detail.id,
    className: detail.name,
    scheduledSessionCount: ownSessionRows ? ownSessionRows.filter((row) => row.status === "scheduled").length : null,
    status: detail.status,
  });
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);
  const enrollTriggerRef = useRef<HTMLButtonElement>(null);
  const enrollReasonId = useId();

  const tabItems: TabItem[] = [{ label: "Tổng quan", value: "overview" }];

  if (workspace.sessions.status !== "unavailable" || workspace.sessions.reason === "failed") {
    const pending = summary ? summary.pendingLock + summary.overdue : 0;
    tabItems.push({ count: summary?.total, label: "Buổi học", pending: pending > 0 ? pending : undefined, value: "sessions" });
  }

  const [activeTab, setActiveTab] = useState<ClassDetailTab>(() =>
    isClassDetailTab(initialTab) && tabItems.some((item) => item.value === initialTab) ? initialTab : "overview",
  );

  function changeTab(value: string) {
    if (!isClassDetailTab(value)) {
      return;
    }

    setActiveTab(value);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      // Next 16 tracks its own history entries: pass null, never window.history.state.
      window.history.replaceState(null, "", url);
    }
  }

  const isOpenForEnrollment = detail.status === "active";
  const showEnroll = canEnrollStudents && (detail.status === "active" || detail.status === "draft");
  const enrollDisabledReason = !isOpenForEnrollment
    ? canEditClass
      ? "Kích hoạt lớp (menu …) trước khi ghi danh học sinh"
      : "Lớp chưa kích hoạt nên chưa ghi danh được"
    : enrollmentCandidates === null
      ? "Chưa tải được danh sách học sinh, tải lại trang"
      : null;
  // The database rejects sessions on a linked composite parent: its components hold them.
  const isCompositeParent = detail.componentClasses.length > 0;
  const batchHref =
    canManageSessions && detail.status === "active" && !isCompositeParent
      ? `/sessions/batch?classId=${detail.id}${directoryQuery ? `&${directoryQuery}` : ""}`
      : null;
  const activeStudentCount =
    workspace.students.status === "ready"
      ? workspace.students.value.length
      : canViewStudentCount
        ? detail.activeStudentCount ?? null
        : null;

  // change_class_status rejects closing or archiving while any of these remain.
  const closeBlockers = [
    detail.activeScheduleCount > 0 ? `${detail.activeScheduleCount} lịch cố định đang hiệu lực` : null,
    activeStudentCount ? `${activeStudentCount} học sinh đang học` : null,
    ownSessionRows?.some((row) => row.status === "in_progress") ? "buổi đang diễn ra" : null,
  ].filter((blocker): blocker is string => blocker !== null);

  const metaParts = [
    detail.code,
    detail.academicYear ? `Năm học ${detail.academicYear.name}` : null,
    `Khối ${detail.grade} · Mức ${detail.level}`,
    formatScheduleSummary(detail.schedules.filter((schedule) => schedule.isActive)),
    formatLearningMode(detail.defaultLearningMode),
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <header className="grid gap-4">
        <nav aria-label="Điều hướng lớp học" className="text-secondary">
          <Link
            className="inline-flex items-center gap-1 font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={directoryQuery ? `/classes?${directoryQuery}` : "/classes"}
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            Danh sách lớp
          </Link>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title font-semibold tracking-[-0.01em] text-text-strong">{detail.name}</h1>
              <Badge tone={classStatus.tone}>{classStatus.label}</Badge>
            </div>
            <p className="mt-1 text-secondary text-text-muted">{metaParts.join(" · ")}</p>
          </div>

          <div className="grid shrink-0 gap-1 md:justify-items-end">
            <div className="flex flex-wrap items-start gap-2 md:justify-end">
              {canEditClass ? (
                <ActionMenu<ClassTargetStatus>
                  items={statusOperations.operations.map((operation) => {
                    const blockers = operation.targetStatus === "active" ? [] : closeBlockers;

                    return {
                      danger: operation.danger,
                      enabled: blockers.length === 0,
                      label: operation.label,
                      reason: blockers.length > 0 ? `Chưa thực hiện được: còn ${blockers.join(", ")}.` : null,
                      value: operation.targetStatus,
                    };
                  })}
                  label="Thêm hành động cho lớp"
                  onSelect={(value, trigger) => statusOperations.open(value, trigger)}
                />
              ) : null}
              {canEditClass && ["draft", "active"].includes(detail.status) ? (
                <Link
                  className={getButtonClassName({ variant: "secondary" })}
                  href={`/classes/${detail.id}/edit${directoryQuery ? `?${directoryQuery}` : ""}`}
                >
                  Sửa lớp
                </Link>
              ) : null}
              {showEnroll ? (
                // The reason is rendered under the whole action row (below), not by
                // Button's disabledReason wrapper, so the buttons stay on one line.
                <Button
                  aria-describedby={enrollDisabledReason ? enrollReasonId : undefined}
                  disabled={enrollDisabledReason !== null}
                  onClick={() => {
                    setEnrollMessage(null);
                    setIsEnrollOpen(true);
                  }}
                  ref={enrollTriggerRef}
                  type="button"
                  variant="primary"
                >
                  Ghi danh học sinh
                </Button>
              ) : null}
            </div>
            {showEnroll && enrollDisabledReason ? (
              <p className="max-w-80 text-caption text-text-muted md:text-right" id={enrollReasonId}>
                {enrollDisabledReason}
              </p>
            ) : null}
          </div>
        </div>

        {statusOperations.successMessage ? <ResultBanner title={statusOperations.successMessage} tone="success" /> : null}
        {enrollMessage ? <ResultBanner title={enrollMessage} tone="success" /> : null}
      </header>

      <div className="grid min-w-0 content-start gap-4">
        <Tabs id={tabsId} items={tabItems} label="Mục trong lớp học" onValueChange={changeTab} value={activeTab} />

        <TabPanel activeValue={activeTab} className="grid gap-4" tabsId={tabsId} value="overview">
          <ClassOverviewTab
            activeStudentCount={activeStudentCount}
            batchHref={batchHref}
            canLockSessions={canLockSessions}
            canManageSchedule={canManageSchedule}
            canViewCare={canViewCare}
            detail={detail}
            nowTime={resolvedNow}
            onShowSessions={tabItems.some((item) => item.value === "sessions") ? () => changeTab("sessions") : undefined}
            today={resolvedToday}
            workspace={workspace}
          />
          <ClassScheduleSection canManageSchedule={canManageSchedule} detail={detail} />
        </TabPanel>

        {tabItems.some((item) => item.value === "sessions") ? (
          <TabPanel activeValue={activeTab} tabsId={tabsId} value="sessions">
            {sessionRows && workspace.sessions.status === "ready" ? (
              <ClassSessionsTab
                attendanceAvailable={workspace.attendance.status === "ready"}
                batchHref={batchHref}
                canBulkCancelSessions={canBulkCancelSessions}
                classId={detail.id}
                resultsAvailable={workspace.results.status === "ready"}
                nowTime={resolvedNow}
                rows={sessionRows}
                today={resolvedToday}
                truncated={workspace.sessions.value.truncated}
              />
            ) : (
              <ResultBanner description="Tải lại trang để thử lại." title="Chưa tải được buổi học của lớp" tone="warning" />
            )}
          </TabPanel>
        ) : null}
      </div>

      {statusOperations.dialog}

      {isEnrollOpen && enrollmentCandidates ? (
        <ClassEnrollDialog
          candidates={enrollmentCandidates.candidates}
          candidatesTruncated={enrollmentCandidates.truncated}
          classCode={detail.code}
          classDefaultMode={detail.defaultLearningMode}
          classGrade={detail.grade}
          classId={detail.id}
          className={detail.name}
          onClose={() => setIsEnrollOpen(false)}
          onSuccess={(message) => {
            setIsEnrollOpen(false);
            setEnrollMessage(message);
            router.refresh();
          }}
          returnFocusRef={enrollTriggerRef}
        />
      ) : null}
    </div>
  );
}

const shortWeekdays: Record<number, string> = { 0: "CN", 1: "2", 2: "3", 3: "4", 4: "5", 5: "6", 6: "7", 7: "CN" };

/**
 * "Thứ 2-4-6, 19:30–21:30" when all slots share a time, otherwise one entry per slot.
 * Sunday is never a "Thứ": "Thứ 2, Chủ nhật" or "Chủ nhật".
 */
export function formatScheduleSummary(schedules: readonly ClassScheduleReadModel[]): string | null {
  if (schedules.length === 0) {
    return null;
  }

  const sorted = sortSchedules(schedules);
  const times = new Set(sorted.map((schedule) => `${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)}`));
  const days = sorted.map((schedule) => shortWeekdays[schedule.weekday] ?? String(schedule.weekday));
  const rooms = [...new Set(sorted.map((schedule) => schedule.roomName).filter((room): room is string => Boolean(room)))];
  const dayLabel = (values: string[]) => {
    const weekdays = values.filter((value) => value !== "CN");
    return [weekdays.length > 0 ? `Thứ ${weekdays.join("-")}` : null, values.includes("CN") ? "Chủ nhật" : null]
      .filter(Boolean)
      .join(", ");
  };

  const slots =
    times.size === 1
      ? `${dayLabel(days)}, ${[...times][0]}`
      : sorted.map((schedule, index) => `${dayLabel([days[index]])} ${schedule.startTime.slice(0, 5)}`).join(", ");

  return rooms.length > 0 ? `${slots} · ${rooms.join(", ")}` : slots;
}

function getClassStatusMeta(status: string): {
  label: string;
  tone: "info" | "neutral" | "success" | "warning";
} {
  const metadata: Record<string, { label: string; tone: "info" | "neutral" | "success" | "warning" }> = {
    active: { label: "Đang hoạt động", tone: "success" },
    archived: { label: "Lưu trữ", tone: "neutral" },
    closed: { label: "Đã đóng", tone: "neutral" },
    draft: { label: "Nháp", tone: "warning" },
  };

  if (!Object.hasOwn(metadata, status)) {
    return { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" };
  }

  return metadata[status];
}
