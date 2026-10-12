"use client";

import { useId, useState, type ReactNode } from "react";

import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";

interface SessionWorkspaceProps {
  attendance: ReactNode;
  /** Students still without attendance; shown as a pending dot on the tab. */
  attendancePending?: number;
  results: ReactNode;
  /** Eligible students still without a result. */
  resultsPending?: number;
}

/**
 * Session workbench tabs (design 04): attendance first, results second. Both
 * panels stay mounted so drafts survive switching.
 */
export function SessionWorkspace({ attendance, attendancePending, results, resultsPending }: SessionWorkspaceProps) {
  const [active, setActive] = useState(attendance ? "attendance" : "results");
  const id = useId();
  const sections = [
    { key: "attendance", label: "Đầu giờ · Điểm danh", content: attendance, pending: attendancePending },
    { key: "results", label: "Cuối giờ · Kết quả", content: results, pending: resultsPending },
  ].filter((section) => section.content);

  if (sections.length === 0) return null;

  const items: TabItem[] = sections.map((section) => ({
    label: section.label,
    pending: section.pending && section.pending > 0 ? section.pending : undefined,
    value: section.key,
  }));

  return (
    <section aria-label="Sổ buổi học" className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Tabs id={id} items={items} label="Công việc buổi học" onValueChange={setActive} value={active} />
      {sections.map((section) => (
        <TabPanel activeValue={active} key={section.key} tabsId={id} value={section.key}>
          {section.content}
        </TabPanel>
      ))}
    </section>
  );
}
