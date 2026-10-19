"use client";

import { useState } from "react";

import { TabPanel, Tabs } from "@/components/ui/tabs";
import { ImportReviewTable } from "@/features/imports/components/import-review-table";

import {
  buildClassReviewColumns,
  buildScheduleReviewColumns,
  classRowCardTitle,
  getClassRowSeverity,
  getRowIssue,
  scheduleRowCardTitle,
  type ClassReviewRow,
  type ScheduleReviewRow,
} from "./class-schedule-import-presentation";

type SheetTab = "classes" | "schedules";

interface ClassScheduleRowsTabsProps {
  /** Shared id prefix of the tabs and their panels (one per page). */
  id: string;
  classRows: readonly ClassReviewRow[];
  scheduleRows: readonly ScheduleReviewRow[];
  /** Adds the "Lớp trong hệ thống" link column (batch page). */
  classHref?: (classId: string) => string;
  /** Table captions, e.g. "Kết quả kiểm tra 12 dòng lớp học". */
  captions: { classes: string; schedules: string };
}

/**
 * The two sheets' rows in `Tabs` ("Lớp học n" · "Lịch học m"), each as an
 * `ImportReviewTable` ("Cần xem" / "Tất cả", state words, server message).
 * Only the active sheet's table is in the DOM, so a class code shared by
 * both sheets is found once.
 */
export function ClassScheduleRowsTabs({ captions, classHref, classRows, id, scheduleRows }: ClassScheduleRowsTabsProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>("classes");

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <Tabs
        id={id}
        items={[
          { count: classRows.length, label: "Lớp học", value: "classes" },
          { count: scheduleRows.length, label: "Lịch học", value: "schedules" },
        ]}
        label="Dòng theo sheet"
        onValueChange={(value) => setActiveTab(value === "schedules" ? "schedules" : "classes")}
        value={activeTab}
      />
      <TabPanel activeValue={activeTab} className="min-w-0" tabsId={id} value="classes">
        {activeTab === "classes" ? (
          <ImportReviewTable<ClassReviewRow>
            caption={captions.classes}
            cardTitle={classRowCardTitle}
            columns={buildClassReviewColumns({ classHref })}
            emptyText="Sheet Classes không có dòng nào."
            getRowIssue={getRowIssue}
            getRowKey={(row) => `class-${row.source_row_number}`}
            getRowSeverity={getClassRowSeverity}
            rows={classRows}
          />
        ) : null}
      </TabPanel>
      <TabPanel activeValue={activeTab} className="min-w-0" tabsId={id} value="schedules">
        {activeTab === "schedules" ? (
          <ImportReviewTable<ScheduleReviewRow>
            caption={captions.schedules}
            cardTitle={scheduleRowCardTitle}
            columns={buildScheduleReviewColumns()}
            emptyText="Sheet Schedules không có dòng nào."
            getRowIssue={getRowIssue}
            getRowKey={(row) => `schedule-${row.source_row_number}`}
            getRowSeverity={getClassRowSeverity}
            rows={scheduleRows}
          />
        ) : null}
      </TabPanel>
    </div>
  );
}
