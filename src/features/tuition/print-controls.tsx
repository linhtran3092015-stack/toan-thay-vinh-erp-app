"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";

interface PrintableNotice {
  grade: number;
  href: string;
  id: string;
  name: string;
  /**
   * The current item's payable amount; when every notice has one the controls
   * count notices with an amount due vs no-payment ones. A count of amounts,
   * not of unpaid requests: payment status is not read here.
   */
  payableAmountVnd?: number;
}

function gradeLabel(grade: number): string {
  return grade > 0 ? `Khối ${grade}` : "Chưa rõ khối";
}

/**
 * Pick notices by grade or one by one, then open the print view in a new tab
 * (design 15b print card). One button prints the union of the ticked notices
 * and the chosen grade, or every notice when nothing is chosen; the design's
 * separate "In N phiếu khối 9" / "In 3 phiếu đã chọn" buttons are not used.
 */
export function TuitionBulkPrintControls({ notices }: { notices: PrintableNotice[] }) {
  const gradeSelectId = useId();
  const hintId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [grade, setGrade] = useState("");
  const grades = useMemo(() => {
    const counts = new Map<number, number>();
    for (const notice of notices) counts.set(notice.grade, (counts.get(notice.grade) ?? 0) + 1);
    // Unknown grade (0) last.
    return [...counts].sort(([a], [b]) => (a > 0 ? a : Number.POSITIVE_INFINITY) - (b > 0 ? b : Number.POSITIVE_INFINITY));
  }, [notices]);
  const chosen = useMemo(
    () => notices.filter((notice) => selected.includes(notice.id) || (grade !== "" && notice.grade === Number(grade))),
    [grade, notices, selected],
  );
  const amounts = notices.every((notice) => typeof notice.payableAmountVnd === "number");
  const payableCount = notices.filter((notice) => (notice.payableAmountVnd ?? 0) > 0).length;

  const print = () => {
    const items = (chosen.length ? chosen : notices).map((notice) => notice.id).join(",");
    window.open(`/finance/tuition-periods/print?itemIds=${encodeURIComponent(items)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid gap-3">
      <p className="text-secondary tabular-nums text-text-muted">
        {notices.length} phiếu
        {amounts ? ` · ${payableCount} có số tiền phải nộp · ${notices.length - payableCount} không cần thanh toán` : null}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[220px] gap-1.5">
          <Label htmlFor={gradeSelectId}>In theo khối</Label>
          <Select className="max-md:h-11" id={gradeSelectId} onChange={(event) => setGrade(event.target.value)} value={grade}>
            <option value="">Chọn khối để in</option>
            {grades.map(([value, count]) => (
              <option key={value} value={value}>
                {gradeLabel(value)} · {count} phiếu
              </option>
            ))}
          </Select>
        </div>
        <Button aria-describedby={hintId} className="max-md:h-11" onClick={print} type="button" variant="secondary">
          In đã chọn / cả khối
        </Button>
      </div>
      <p aria-live="polite" className="text-caption text-text-muted" id={hintId}>
        {chosen.length > 0 ? `${chosen.length} phiếu sẽ được in.` : `Chưa chọn: in toàn bộ ${notices.length} phiếu.`} Mở tab in, mỗi
        phiếu một trang A5.
      </p>
      <fieldset className="min-w-0">
        <legend className="sr-only">Chọn từng phiếu để in</legend>
        <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border border-border-subtle p-1 sm:grid-cols-2 lg:grid-cols-3">
          {notices.map((notice) => (
            <label
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-body text-text-default hover:bg-interactive-hover md:min-h-10"
              key={notice.id}
            >
              <input
                checked={selected.includes(notice.id)}
                className="h-4 w-4 shrink-0 accent-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                onChange={(event) =>
                  setSelected(event.target.checked ? [...selected, notice.id] : selected.filter((id) => id !== notice.id))
                }
                type="checkbox"
              />
              <span className="min-w-0 truncate">
                {notice.name} · {gradeLabel(notice.grade)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
