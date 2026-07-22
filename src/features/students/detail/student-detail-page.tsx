"use client";

import { useMemo, useState } from "react";
import type { PermissionCode } from "@/types/domain";
import { StudentAlertPanel } from "./components/student-alert-panel";
import { StudentAttendanceTab } from "./components/student-attendance-tab";
import { StudentAuditTab } from "./components/student-audit-tab";
import { StudentCoachingTab } from "./components/student-coaching-tab";
import { StudentFinanceTab } from "./components/student-finance-tab";
import { StudentOverviewTab } from "./components/student-overview-tab";
import { StudentProfileHeader } from "./components/student-profile-header";
import { StudentResultsTab } from "./components/student-results-tab";
import { StudentSummaryCards } from "./components/student-summary-cards";
import type { StudentDetail, StudentDetailAction } from "./types";

type DetailTabId =
  | "attendance"
  | "audit"
  | "coaching"
  | "finance"
  | "overview"
  | "results";

interface StudentDetailPageProps {
  detail: StudentDetail;
  permissions: PermissionCode[];
}

export function StudentDetailPage({
  detail,
  permissions,
}: StudentDetailPageProps) {
  const tabs = useMemo(
    () =>
      [
        { id: "overview", label: "Tổng quan", visible: true },
        { id: "attendance", label: "Điểm danh", visible: true },
        { id: "results", label: "Kết quả", visible: true },
        {
          id: "finance",
          label: "Học phí & số buổi",
          visible: permissions.includes("session_ledger.view"),
        },
        {
          id: "coaching",
          label: "Coaching",
          visible: permissions.includes("coaching.view"),
        },
        {
          id: "audit",
          label: "Lịch sử thay đổi",
          visible: permissions.includes("audit.view"),
        },
      ].filter((tab) => tab.visible) as Array<{
        id: DetailTabId;
        label: string;
        visible: boolean;
      }>,
    [permissions],
  );
  const [activeTab, setActiveTab] = useState<DetailTabId>("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isActionAllowed = (action: StudentDetailAction) =>
    !action.permission || permissions.includes(action.permission);

  const showMockToast = (label: string) => {
    setToastMessage(`${label}: Chức năng sẽ được triển khai ở bước sau`);
    window.setTimeout(() => setToastMessage(null), 2200);
  };

  const safeActiveTab = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "overview";

  return (
    <div className="grid min-w-0 gap-4">
      <StudentProfileHeader
        detail={detail}
        isActionAllowed={isActionAllowed}
        onMockAction={showMockToast}
      />
      <StudentSummaryCards detail={detail} />
      <StudentAlertPanel alerts={detail.alerts} onMockAction={showMockToast} />

      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
        <div className="overflow-x-auto border-b border-hairline">
          <div className="flex min-w-max gap-1 px-3 py-2">
            {tabs.map((tab) => (
              <button
                className={`min-h-11 rounded-md px-4 text-sm font-semibold transition ${
                  safeActiveTab === tab.id
                    ? "bg-primary text-white"
                    : "text-ink-muted hover:bg-canvas hover:text-ink"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 p-4">
          {safeActiveTab === "overview" ? (
            <StudentOverviewTab detail={detail} />
          ) : null}
          {safeActiveTab === "attendance" ? (
            <StudentAttendanceTab records={detail.attendance} />
          ) : null}
          {safeActiveTab === "results" ? (
            <StudentResultsTab
              automaticLevel={detail.student.learningLevel}
              averageScore={detail.summary.averageScoreLastFourSessions}
              records={detail.results}
            />
          ) : null}
          {safeActiveTab === "finance" ? (
            <StudentFinanceTab detail={detail} />
          ) : null}
          {safeActiveTab === "coaching" ? (
            <StudentCoachingTab records={detail.coaching} />
          ) : null}
          {safeActiveTab === "audit" ? (
            <StudentAuditTab records={detail.auditTrail} />
          ) : null}
        </div>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-4 left-4 right-4 z-[70] rounded-lg border border-hairline bg-ink px-4 py-3 text-sm font-semibold text-white shadow-modal md:left-auto md:w-[360px]">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
