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
  danger: "bg-danger-bg text-danger",
  primary: "bg-primary-soft text-primary",
  purple: "bg-purple-bg text-accent-purple",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
};

const sparklineToneClasses: Record<KpiMetric["tone"], string> = {
  danger: "bg-danger/70",
  primary: "bg-primary/70",
  purple: "bg-accent-purple/70",
  success: "bg-success/70",
  warning: "bg-warning/70",
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
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">
            Toán Thầy Vinh ERP
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ink md:text-3xl">
            Tổng quan vận hành
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Dữ liệu demo cho Task 1, dùng để kiểm tra AppShell, Sidebar,
            Topbar và các trạng thái giao diện trước khi kết nối hệ thống thật.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline">
            Xuất báo cáo
          </Button>
          <Button size="sm" variant="secondary">
            Thêm nhanh
          </Button>
        </div>
      </section>

      <section className="dashboard-grid kpi-grid">
        {kpiMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-ink">
                    {metric.value}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-9 w-9 flex-none items-center justify-center rounded-pill text-sm font-bold",
                    metricToneClasses[metric.tone],
                  )}
                >
                  {metric.trend === "up"
                    ? "+"
                    : metric.trend === "down"
                      ? "-"
                      : "="}
                </span>
              </div>
              <div className="mt-4 flex h-10 items-end gap-1">
                {metric.points.map((point, index) => (
                  <span
                    className={cn(
                      "w-full rounded-t-sm",
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

      <section className="dashboard-grid main-dashboard-grid">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Doanh thu 6 tháng</CardTitle>
              <p className="mt-1 text-sm text-ink-muted">
                Số liệu giả lập phục vụ kiểm tra giao diện.
              </p>
            </div>
            <Badge tone="info">Demo</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid min-h-[280px] grid-cols-6 items-end gap-3">
              {revenuePoints.map((point) => (
                <div className="flex h-full min-w-0 flex-col justify-end" key={point.month}>
                  <div className="flex flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-secondary"
                      style={{
                        height: `${Math.max((point.revenue / maxRevenue) * 100, 18)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <p className="truncate text-xs font-semibold text-ink">
                      {point.month}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
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
            <Badge tone="success">1.248</Badge>
          </CardHeader>
          <CardContent className="grid gap-5">
            <DistributionList title="Theo khối lớp" items={gradeDistribution} />
            <DistributionList title="Theo nguồn" items={sourceDistribution} />
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-grid lower-dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Lịch học hôm nay</CardTitle>
            <Badge tone="neutral">{todaySchedule.length} lớp</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {todaySchedule.map((item) => (
              <div
                className="grid gap-3 rounded-md border border-hairline bg-canvas p-3 sm:grid-cols-[72px_1fr_auto]"
                key={`${item.time}-${item.className}`}
              >
                <div className="text-sm font-bold text-primary">{item.time}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.className}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.tutor} · {item.room}
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
              <div className="flex gap-3" key={`${item.title}-${item.time}`}>
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 flex-none rounded-pill",
                    notificationToneClasses[item.tone],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {item.description}
                  </p>
                </div>
                <span className="flex-none text-xs text-ink-subtle">
                  {item.time}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-grid lower-dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Học viên cần chú ý</CardTitle>
            <Badge tone="danger">{attentionStudents.length}</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
                <tr>
                  <th className="px-5 py-3 font-semibold">Học viên</th>
                  <th className="px-5 py-3 font-semibold">Lớp</th>
                  <th className="px-5 py-3 font-semibold">Vấn đề</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {attentionStudents.map((student) => (
                  <tr className="border-t border-hairline" key={student.code}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-primary-soft text-xs font-bold text-primary">
                          {student.initials}
                        </span>
                        <div>
                          <p className="font-semibold text-ink">
                            {student.name}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {student.code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {student.className}
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {student.issue}
                    </td>
                    <td className="px-5 py-4">
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
                <Button className="justify-start" key={action} variant="outline">
                  {action}
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
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{item.label}</span>
              <span className="text-ink-muted">
                {item.count} · {item.percent}%
              </span>
            </div>
            <div className="h-2 rounded-pill bg-neutral-bg">
              <div
                className="h-full rounded-pill"
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
