import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  attentionStudents,
  gradeDistribution,
  kpiMetrics,
  notifications,
  quickActions,
  revenuePoints,
  sourceDistribution,
  todaySchedule,
  type KpiMetric,
} from "./mock-data";

const metricToneClasses: Record<KpiMetric["tone"], string> = {
  danger: "bg-danger-bg text-danger border-danger-border",
  primary: "bg-primary-soft text-primary border-primary/20",
  purple: "bg-purple-bg text-accent-purple border-accent-purple/30",
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
};

const sparklineToneClasses: Record<KpiMetric["tone"], string> = {
  danger: "bg-danger/80",
  primary: "bg-primary/80",
  purple: "bg-accent-purple/80",
  success: "bg-success/80",
  warning: "bg-warning/80",
};

const notificationToneClasses = {
  danger: "bg-danger",
  info: "bg-info",
  purple: "bg-accent-purple",
  success: "bg-success",
  warning: "bg-warning",
};

const maxRevenue = Math.max(...revenuePoints.map((point) => point.revenue));

export function DashboardPage() {
  return (
    <div className="grid gap-6">
      {/* Header Section */}
      <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-1 p-6 shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
            <p className="font-display text-xs font-bold uppercase tracking-wider text-primary">
              Toán Thầy Vinh ERP
            </p>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Tổng quan vận hành
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-muted">
            Hệ thống quản lý thông tin học viên, lớp học, điểm danh và doanh thu học phí trung tâm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button size="sm" variant="outline">
            <span>📥</span> Xuất báo cáo
          </Button>
          <Button size="sm" variant="primary">
            <span>✨</span> Thêm nhanh
          </Button>
        </div>
      </section>

      {/* KPI Metrics */}
      <section className="dashboard-grid kpi-grid">
        {kpiMetrics.map((metric) => (
          <Card className="hover:border-hairline-strong hover:shadow-md" key={metric.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wider text-ink-subtle">
                    {metric.label}
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                    {metric.value}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-9 w-9 flex-none items-center justify-center rounded-xl border text-xs font-bold shadow-xs",
                    metricToneClasses[metric.tone],
                  )}
                >
                  {metric.trend === "up"
                    ? "↑"
                    : metric.trend === "down"
                      ? "↓"
                      : "•"}
                </span>
              </div>
              <div className="mt-4 flex h-10 items-end gap-1">
                {metric.points.map((point, index) => (
                  <span
                    className={cn(
                      "w-full rounded-t-xs transition-all hover:opacity-100 opacity-85",
                      sparklineToneClasses[metric.tone],
                    )}
                    key={`${metric.label}-${index}`}
                    style={{ height: `${Math.max(point, 6)}px` }}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-ink-muted">
                {metric.helper}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Main Dashboard Grid */}
      <section className="dashboard-grid main-dashboard-grid">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Doanh thu 6 tháng</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                Biểu đồ tổng hợp doanh thu học phí theo từng tháng (triệu VNĐ)
              </p>
            </div>
            <Badge tone="info">Cập nhật mới</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid min-h-[280px] grid-cols-6 items-end gap-4 pt-4">
              {revenuePoints.map((point) => (
                <div className="flex h-full min-w-0 flex-col justify-end" key={point.month}>
                  <div className="flex flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-primary to-secondary transition-all hover:brightness-110 shadow-xs"
                      style={{
                        height: `${Math.max((point.revenue / maxRevenue) * 100, 18)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <p className="truncate text-xs font-bold text-ink">
                      {point.month}
                    </p>
                    <p className="mt-0.5 font-display text-xs font-bold text-primary">
                      {point.revenue}tr
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân bổ học viên</CardTitle>
            <Badge tone="success">1.248 HS</Badge>
          </CardHeader>
          <CardContent className="grid gap-6">
            <DistributionList title="Theo khối lớp" items={gradeDistribution} />
            <DistributionList title="Theo nguồn tuyển sinh" items={sourceDistribution} />
          </CardContent>
        </Card>
      </section>

      {/* Lower Dashboard Grid 1 */}
      <section className="dashboard-grid lower-dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Lịch học hôm nay</CardTitle>
            <Badge tone="neutral">{todaySchedule.length} lớp</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {todaySchedule.map((item) => (
              <div
                className="grid gap-3 rounded-xl border border-hairline bg-surface-2 p-3.5 transition-colors hover:border-hairline-strong sm:grid-cols-[80px_1fr_auto]"
                key={`${item.time}-${item.className}`}
              >
                <div className="font-display text-xs font-bold text-primary">{item.time}</div>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold text-ink">
                    {item.className}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    🧑‍🏫 {item.tutor} · 🚪 {item.room}
                  </p>
                </div>
                <Badge tone={item.tone === "success" ? "success" : "neutral"}>
                  {item.attendance}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông báo ưu tiên</CardTitle>
            <Badge tone="warning">{notifications.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notifications.map((item) => (
              <div className="flex items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-hairline hover:bg-surface-2" key={`${item.title}-${item.time}`}>
                <span
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 flex-none rounded-pill shadow-xs",
                    notificationToneClasses[item.tone],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                    {item.description}
                  </p>
                </div>
                <span className="flex-none text-xs font-semibold text-ink-subtle">
                  {item.time}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Lower Dashboard Grid 2 */}
      <section className="dashboard-grid lower-dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Học viên cần chú ý</CardTitle>
            <Badge tone="danger">{attentionStudents.length}</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Học viên</th>
                  <th className="px-5 py-3.5 font-bold">Lớp</th>
                  <th className="px-5 py-3.5 font-bold">Vấn đề</th>
                  <th className="px-5 py-3.5 font-bold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {attentionStudents.map((student) => (
                  <tr className="transition-colors hover:bg-surface-2/60" key={student.code}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary-soft text-xs font-bold text-primary shadow-xs">
                          {student.initials}
                        </span>
                        <div>
                          <p className="font-display text-sm font-bold text-ink">
                            {student.name}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-subtle">
                            {student.code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink-muted">
                      {student.className}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-muted">
                      {student.issue}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={student.statusTone}>{student.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thao tác nhanh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickActions.map((action) => (
                <Button className="justify-start text-xs font-bold" key={action} variant="outline">
                  ⚡ {action}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DistributionList({
  items,
  title,
}: {
  items: typeof gradeDistribution;
  title: string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-ink">{item.label}</span>
              <span className="text-xs font-bold text-ink-muted">
                {item.count} · {item.percent}%
              </span>
            </div>
            <div className="h-2 rounded-pill bg-surface-2 overflow-hidden border border-hairline">
              <div
                className="h-full rounded-pill transition-all duration-300"
                style={{
                  backgroundColor: item.color,
                  width: `${item.percent}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
