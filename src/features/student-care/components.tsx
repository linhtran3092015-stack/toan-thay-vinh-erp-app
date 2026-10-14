import type { CareDashboard } from "./models";

export { CareActionForm } from "./components/care-action-form";
export { CareDetailView } from "./components/care-detail-view";
export { CareQueueView } from "./components/care-queue-view";
/** The generator health strip keeps its pre-redesign name for the home and student cards. */
export { GeneratorStatusBar as CareHealth, GeneratorStatusBar } from "./components/generator-status-bar";

/** Month figures for the home dashboard card (the queue page shows them in its header line). */
export function CareSummary({ data }: { data: CareDashboard }) {
  const summary = data.summary;
  const tiles: [string, string | number][] = [
    ["Cảnh báo đang mở", summary.open_alerts],
    ["Việc quá hạn", summary.overdue],
    ["Coaching tháng hoàn thành", `${summary.monthly_completed}/${summary.monthly_total}`],
    ["Chưa phân công", summary.unassigned],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([title, value]) => (
        <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-base p-4" key={title}>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}
