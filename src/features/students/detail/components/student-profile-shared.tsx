import type { ReactNode } from "react";

import { formatLearningMode } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StudentProfileTab =
  | "classes"
  | "attendance"
  | "payments"
  | "care"
  | "history";

export const studentProfileTabs: readonly StudentProfileTab[] = [
  "classes",
  "attendance",
  "payments",
  "care",
  "history",
];

export function isStudentProfileTab(value: unknown): value is StudentProfileTab {
  return typeof value === "string" && (studentProfileTabs as readonly string[]).includes(value);
}

export function formatMode(value: string | null | undefined): string {
  return formatLearningMode(value);
}

const weekdayLabels: Record<number, string> = {
  0: "Chủ nhật",
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
};

export function formatWeekday(value: number): string {
  return weekdayLabels[value] ?? `Ngày ${value}`;
}

export function formatTransitionKind(value: string): string {
  const labels: Record<string, string> = {
    initial: "Nhập lớp ban đầu",
    resume: "Quay lại học",
    transfer: "Chuyển lớp",
  };

  return Object.hasOwn(labels, value) ? labels[value] : `Loại chuyển tiếp chưa hỗ trợ: ${value}`;
}

export const enrollmentStatusMeta: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: "Đang học", tone: "success" },
  completed: { label: "Đã kết thúc", tone: "neutral" },
  reserved: { label: "Bảo lưu", tone: "warning" },
  transferred: { label: "Đã chuyển lớp", tone: "neutral" },
};

export function getEnrollmentStatusMeta(value: string): { label: string; tone: "success" | "warning" | "neutral" } {
  return Object.hasOwn(enrollmentStatusMeta, value)
    ? enrollmentStatusMeta[value]
    : { label: `Trạng thái ghi danh chưa hỗ trợ: ${value}`, tone: "neutral" };
}

/** White 12px-radius panel used by the profile columns (design 05). */
export function ProfilePanel({
  action,
  children,
  className,
  title,
  titleId,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
  titleId?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-text-strong" id={titleId}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Two-column definition list: 110px muted label, value on the right. */
export function MetaList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-secondary">
      {items.map((item) => (
        <div className="contents" key={item.label}>
          <dt className="text-text-muted">{item.label}</dt>
          <dd className="min-w-0 break-words text-text-strong">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Dashed in-panel notice for "no permission" and "nothing yet" states. */
export function PanelNotice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" }) {
  return (
    <p
      className={cn(
        "rounded-md border border-dashed px-3 py-2.5 text-secondary",
        tone === "warning"
          ? "border-warning-border bg-warning-bg text-warning-ink"
          : "border-border-strong bg-surface-subtle text-text-muted",
      )}
    >
      {children}
    </p>
  );
}
