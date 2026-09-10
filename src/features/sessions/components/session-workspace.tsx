"use client";

import { useId, useState, type ReactNode } from "react";

export function SessionWorkspace({ attendance, results }: { attendance: ReactNode; results: ReactNode }) {
  const [active, setActive] = useState(attendance ? "attendance" : "results");
  const id = useId();
  const sections = [
    { key: "attendance", label: "Đầu giờ · Điểm danh", content: attendance },
    { key: "results", label: "Cuối giờ · Kết quả", content: results },
  ].filter((section) => section.content);

  if (sections.length === 0) return null;
  return <section className="grid min-w-0 gap-3" aria-label="Sổ buổi học">
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Công việc buổi học">
      {sections.map((section, index) => <button
        key={section.key}
        id={`${id}-${section.key}-tab`}
        aria-controls={`${id}-${section.key}-panel`}
        aria-selected={active === section.key}
        tabIndex={active === section.key ? 0 : -1}
        role="tab"
        type="button"
        onClick={() => setActive(section.key)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
          setActive(sections[next].key);
          document.getElementById(`${id}-${sections[next].key}-tab`)?.focus();
        }}
        className={`min-h-11 rounded-md border px-4 text-control font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring ${active === section.key ? "border-action-primary bg-action-primary text-text-on-primary" : "border-border-subtle bg-surface-base text-text-muted"}`}
      >{section.label}</button>)}
    </div>
    {sections.map((section) => <div key={section.key} id={`${id}-${section.key}-panel`} role="tabpanel" aria-labelledby={`${id}-${section.key}-tab`} hidden={active !== section.key}>{section.content}</div>)}
  </section>;
}
