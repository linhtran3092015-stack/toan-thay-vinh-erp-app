import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DashboardSectionState,
  RoleAwareDashboardReadModel,
} from "@/features/dashboard/read-models";

const currencyFormatter = new Intl.NumberFormat(
  "vi-VN",
  {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  },
);

const integerFormatter = new Intl.NumberFormat(
  "vi-VN",
  {
    maximumFractionDigits: 2,
  },
);

interface DashboardPageProps {
  dashboard: RoleAwareDashboardReadModel;
}

export function DashboardPage({
  dashboard,
}: DashboardPageProps) {
  const sections = [
    dashboard.finance,
    dashboard.payroll,
    dashboard.advances,
    dashboard.gradingCredits,
    dashboard.commissions,
    dashboard.coaching,
  ];

  const visibleSectionCount = sections.filter(
    (section) => section.status !== "hidden",
  ).length;

  const errorSectionCount = sections.filter(
    (section) => section.status === "error",
  ).length;

  return (
    <div className="grid min-w-0 gap-6">
      <section className="rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Toán Thầy Vinh ERP
              </p>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Tổng quan theo quyền truy cập
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">
              Dashboard chỉ tải và hiển thị những dữ liệu
              nghiệp vụ mà tài khoản hiện tại được phép xem.
              Số liệu được lấy trực tiếp từ hệ thống, không sử
              dụng dữ liệu minh họa.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="info">
              {visibleSectionCount} khối dữ liệu
            </Badge>

            {errorSectionCount > 0 ? (
              <Badge tone="warning">
                {errorSectionCount} khối cần tải lại
              </Badge>
            ) : (
              <Badge tone="success">
                Dữ liệu đã sẵn sàng
              </Badge>
            )}
          </div>
        </div>
      </section>

      {visibleSectionCount === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="rounded-xl border border-hairline bg-surface-2 p-5 text-center">
              <p className="font-display text-base font-bold text-ink">
                Chưa có khối dữ liệu phù hợp
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Tài khoản được vào Dashboard nhưng chưa có
                quyền xem các module nghiệp vụ bên dưới.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardSectionCard
          badge="Tài chính"
          description="Thu, chi, hoàn phí và yêu cầu thanh toán."
          href="/finance"
          section={dashboard.finance}
          title="Tổng quan tài chính"
        >
          {(data) => (
            <DashboardMetricGrid>
              <DashboardMetric
                helper="Tổng tiền thu đã ghi nhận"
                label="Tiền vào"
                value={formatCurrency(data.receiptVnd)}
              />
              <DashboardMetric
                helper="Các khoản chi đã ghi nhận"
                label="Tiền ra"
                value={formatCurrency(
                  data.disbursementVnd,
                )}
              />
              <DashboardMetric
                helper="Khoản hoàn học phí"
                label="Hoàn phí"
                value={formatCurrency(data.refundVnd)}
              />
              <DashboardMetric
                helper="Thu trừ chi và hoàn phí"
                label="Dòng tiền ròng"
                value={formatCurrency(
                  data.netCashflowVnd,
                )}
              />
              <DashboardMetric
                helper="Tổng yêu cầu trong phạm vi truy cập"
                label="Yêu cầu thanh toán"
                value={formatInteger(
                  data.paymentRequestCount,
                )}
              />
            </DashboardMetricGrid>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          badge="Nhân sự"
          description="Tổng hợp bảng lương trong phạm vi tài khoản."
          href="/payroll"
          section={dashboard.payroll}
          title="Bảng lương"
        >
          {(data) => (
            <DashboardMetricGrid>
              <DashboardMetric
                helper="Các bảng lương được phép xem"
                label="Số bảng lương"
                value={formatInteger(
                  data.statementCount,
                )}
              />
              <DashboardMetric
                helper="Tổng số tiền cần thanh toán"
                label="Thực lĩnh"
                value={formatCurrency(
                  data.totalPayableVnd,
                )}
              />
              <DashboardMetric
                helper="Bảng lương chưa gửi đối soát"
                label="Bản nháp"
                value={formatInteger(
                  data.draftStatementCount,
                )}
              />
              <DashboardMetric
                helper="Đang chờ kiểm tra hoặc phê duyệt"
                label="Chờ duyệt"
                value={formatInteger(
                  data.reviewStatementCount,
                )}
              />
              <DashboardMetric
                helper="Bảng lương đã hoàn tất"
                label="Đã duyệt"
                value={formatInteger(
                  data.approvedStatementCount,
                )}
              />
              <DashboardMetric
                helper="Kỳ mới nhất trong phạm vi"
                label="Kỳ gần nhất"
                value={formatPeriodMonth(
                  data.latestPeriodMonth,
                )}
              />
            </DashboardMetricGrid>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          badge="Tạm ứng"
          description="Trạng thái các yêu cầu tạm ứng lương."
          href="/advances"
          section={dashboard.advances}
          title="Tạm ứng lương"
        >
          {(data) => (
            <DashboardMetricGrid>
              <DashboardMetric
                helper="Tổng yêu cầu được phép xem"
                label="Yêu cầu"
                value={formatInteger(data.requestCount)}
              />
              <DashboardMetric
                helper="Tổng số tiền đã yêu cầu"
                label="Giá trị yêu cầu"
                value={formatCurrency(
                  data.totalRequestedVnd,
                )}
              />
              <DashboardMetric
                helper="Đang chờ review hoặc phê duyệt"
                label="Chờ xử lý"
                value={formatInteger(
                  data.pendingReviewCount,
                )}
              />
              <DashboardMetric
                helper="Đã duyệt nhưng chưa khấu trừ"
                label="Chờ khấu trừ"
                value={formatInteger(
                  data.approvedUndeductedCount,
                )}
              />
              <DashboardMetric
                helper="Đã đưa vào bảng lương"
                label="Đã khấu trừ"
                value={formatInteger(
                  data.deductedCount,
                )}
              />
              <DashboardMetric
                helper="Yêu cầu không được duyệt"
                label="Đã từ chối"
                value={formatInteger(
                  data.rejectedCount,
                )}
              />
            </DashboardMetricGrid>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          badge="Chấm bài"
          description="Tín chỉ chấm bài được ghi nhận tự động."
          href="/grading-credits"
          section={dashboard.gradingCredits}
          title="Tín chỉ chấm bài"
        >
          {(data) => (
            <DashboardMetricGrid>
              <DashboardMetric
                helper="Số lượt chấm đã được ghi nhận"
                label="Lượt ghi nhận"
                value={formatInteger(data.entryCount)}
              />
              <DashboardMetric
                helper="Tổng số đơn vị tín chỉ"
                label="Tổng tín chỉ"
                value={formatInteger(
                  data.totalCreditUnits,
                )}
              />
              <DashboardMetric
                helper="Thời điểm ghi nhận gần nhất"
                label="Cập nhật gần nhất"
                value={formatDateTime(
                  data.latestCreditedAt,
                )}
              />
            </DashboardMetricGrid>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          badge="Hoa hồng"
          description="Doanh thu đủ điều kiện ghi nhận hoa hồng."
          href="/commissions"
          section={dashboard.commissions}
          title="Doanh thu hoa hồng"
        >
          {(data) => (
            <DashboardMetricGrid>
              <DashboardMetric
                helper="Số bản ghi doanh thu đủ điều kiện"
                label="Bản ghi"
                value={formatInteger(data.accrualCount)}
              />
              <DashboardMetric
                helper="Chưa áp dụng công thức tính tiền hoa hồng"
                label="Doanh thu ghi nhận"
                value={formatCurrency(
                  data.recognizedRevenueVnd,
                )}
              />
              <DashboardMetric
                helper="Nguồn tuyển sinh MMA"
                label="MMA"
                value={formatInteger(
                  data.mmaAccrualCount,
                )}
              />
              <DashboardMetric
                helper="Nguồn đối tác Sandbox"
                label="Sandbox"
                value={formatInteger(
                  data.sandboxAccrualCount,
                )}
              />
              <DashboardMetric
                helper="Thời điểm ghi nhận gần nhất"
                label="Cập nhật gần nhất"
                value={formatDateTime(
                  data.latestRecognizedAt,
                )}
              />
            </DashboardMetricGrid>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          badge="Coaching"
          description="Phiếu coaching trong phạm vi được phép xem."
          href="/coaching"
          section={dashboard.coaching}
          title="Theo dõi Coaching"
        >
          {(data) => (
            <DashboardMetricGrid>
              <DashboardMetric
                helper="Tổng phiếu trong phạm vi truy cập"
                label="Tổng phiếu"
                value={formatInteger(data.recordCount)}
              />
              <DashboardMetric
                helper="Phiếu chưa bắt đầu xử lý"
                label="Đang mở"
                value={formatInteger(data.openCount)}
              />
              <DashboardMetric
                helper="Phiếu đang được theo dõi"
                label="Đang xử lý"
                value={formatInteger(
                  data.inProgressCount,
                )}
              />
              <DashboardMetric
                helper="Phiếu đã hoàn tất"
                label="Đã đóng"
                value={formatInteger(data.closedCount)}
              />
              <DashboardMetric
                helper="Phiếu ưu tiên cao chưa đóng"
                label="Ưu tiên cao"
                value={formatInteger(
                  data.highPriorityCount,
                )}
              />
            </DashboardMetricGrid>
          )}
        </DashboardSectionCard>
      </div>

      <section className="rounded-xl border border-hairline bg-surface-2 p-4">
        <p className="text-xs leading-relaxed text-ink-muted">
          Phạm vi dữ liệu của từng khối tiếp tục được bảo vệ
          bởi permission, RPC và Row Level Security của module
          tương ứng. Dashboard không cấp thêm quyền truy cập
          nghiệp vụ.
        </p>
      </section>
    </div>
  );
}

interface DashboardSectionCardProps<T> {
  badge: string;
  children: (data: T) => ReactNode;
  description: string;
  href: string;
  section: DashboardSectionState<T>;
  title: string;
}

function DashboardSectionCard<T>({
  badge,
  children,
  description,
  href,
  section,
  title,
}: DashboardSectionCardProps<T>) {
  if (section.status === "hidden") {
    return null;
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {description}
          </p>
        </div>

        <Badge
          tone={
            section.status === "error"
              ? "warning"
              : "info"
          }
        >
          {section.status === "error"
            ? "Không tải được"
            : badge}
        </Badge>
      </CardHeader>

      <CardContent className="grid gap-4">
        {section.status === "error" ? (
          <div className="rounded-xl border border-warning-border bg-warning-bg p-4">
            <p className="text-sm font-bold text-warning">
              Khối dữ liệu này chưa tải được
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Các khối còn lại vẫn hoạt động bình thường.
              Có thể mở module để kiểm tra chi tiết.
            </p>
          </div>
        ) : (
          children(section.data)
        )}

        <div className="border-t border-hairline pt-3">
          <Link
            className="text-sm font-bold text-primary transition-opacity hover:opacity-75"
            href={href}
          >
            Mở module →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardMetricGrid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

function DashboardMetric({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-hairline bg-surface-2 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      <p className="mt-2 break-words font-display text-xl font-bold tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        {helper}
      </p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

function formatPeriodMonth(
  value: string | null,
): string {
  if (!value) {
    return "Chưa có";
  }

  const match = /^(\d{4})-(\d{2})/.exec(value);

  if (!match) {
    return value;
  }

  return `Tháng ${Number(match[2])}/${match[1]}`;
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
