"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";

interface PrintableNotice {
  grade: number;
  href: string;
  id: string;
  name: string;
}

/** Pick notices by grade or one by one, then open the print view in a new tab. */
export function TuitionBulkPrintControls({ notices }: { notices: PrintableNotice[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [grade, setGrade] = useState("");
  const grades = useMemo(() => [...new Set(notices.map((notice) => notice.grade))].sort((a, b) => a - b), [notices]);
  const chosen = useMemo(
    () => notices.filter((notice) => selected.includes(notice.id) || (grade !== "" && notice.grade === Number(grade))),
    [grade, notices, selected],
  );

  const print = () => {
    const items = (chosen.length ? chosen : notices).map((notice) => notice.id).join(",");
    window.open(`/finance/tuition-periods/print?itemIds=${encodeURIComponent(items)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[200px] gap-1.5">
          <Label htmlFor="tuition-print-grade">In theo khối</Label>
          <Select id="tuition-print-grade" onChange={(event) => setGrade(event.target.value)} value={grade}>
            <option value="">Chọn khối để in</option>
            {grades.map((value) => (
              <option key={value} value={value}>
                Khối {value}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={print} type="button" variant="secondary">
          In đã chọn / cả khối
        </Button>
        <p className="text-caption text-text-muted">
          {chosen.length > 0 ? `${chosen.length} phiếu sẽ được in.` : `Chưa chọn: in toàn bộ ${notices.length} phiếu.`}
        </p>
      </div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {notices.map((notice) => (
          <label className="flex min-h-10 items-center gap-2 rounded-md px-2 text-body text-text-default hover:bg-interactive-hover" key={notice.id}>
            <input
              checked={selected.includes(notice.id)}
              className="h-4 w-4 accent-action-primary"
              onChange={(event) =>
                setSelected(event.target.checked ? [...selected, notice.id] : selected.filter((id) => id !== notice.id))
              }
              type="checkbox"
            />
            {notice.name} · Khối {notice.grade}
          </label>
        ))}
      </div>
    </div>
  );
}
