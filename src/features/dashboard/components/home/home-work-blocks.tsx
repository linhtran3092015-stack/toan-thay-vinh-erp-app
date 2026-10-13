import {
  ArrowLeftRight,
  CalendarX2,
  ClipboardList,
  Clock,
  FileWarning,
  HandCoins,
  HeartHandshake,
  PhoneCall,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { BlockEmpty, BlockError, HomeBlock, IconTile, homeLinkClassName } from "@/features/dashboard/components/home/home-block";
import {
  buildNeedsAction,
  buildSummaryStrip,
  formatBacklogCount,
  getTuitionShares,
  hasNoBacklog,
  type DashboardHomeReadModel,
  type NeedsActionKind,
  type StatRow,
} from "@/features/dashboard/home-models";
import { formatIsoDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

const kindIcons: Record<NeedsActionKind, ReactNode> = {
  advances: <HandCoins />,
  care: <HeartHandshake />,
  coaching: <HeartHandshake />,
  crm: <PhoneCall />,
  debt: <Receipt />,
  import: <FileWarning />,
  payroll: <Wallet />,
  results: <ClipboardList />,
  sepay: <ArrowLeftRight />,
  sessions: <CalendarX2 />,
  timekeeping: <Clock />,
};

/** 32px on desktop rows, 44px touch target below md. */
const rowActionClassName = cn(getButtonClassName({ size: "sm", variant: "secondary" }), "shrink-0 max-md:h-11");

/**
 * "Cần bạn xử lý" (2a) / "Việc của bạn" (2b): one direct link per item, a
 * text badge beside every title, failures listed in the block with a reload,
 * and "Không có việc tồn" only when every permitted source loaded. Hidden
 * entirely when the viewer may read none of its sources.
 */
export function NeedsActionBlock({ model, retryHref }: { model: DashboardHomeReadModel; retryHref: string }) {
  const list = buildNeedsAction(model);
  if (list.sourceCount === 0) return null;

  const personal = model.layout === "personal";

  return (
    <HomeBlock
      count={{ label: `${formatBacklogCount(list)} việc tồn`, value: formatBacklogCount(list) }}
      title={personal ? "Việc của bạn" : "Cần bạn xử lý"}
      titleId="home-needs-action-title"
    >
      {list.failed.length > 0 ? (
        <BlockError message={`Chưa tải được ${list.failed.join(", ")}; danh sách có thể chưa đủ.`} retryHref={retryHref} />
      ) : null}
      {hasNoBacklog(list) ? (
        <BlockEmpty>Không có việc tồn.</BlockEmpty>
      ) : list.items.length > 0 ? (
        <ul className="divide-y divide-border-row">
          {list.items.map((item) => (
            <li className="flex flex-col gap-2 px-4 py-3" key={item.key}>
              <div className="flex min-w-0 gap-3">
                <IconTile tone={item.tone}>{kindIcons[item.kind]}</IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-body font-semibold text-text-strong">{item.title}</p>
                    <Badge tone={item.tone}>{item.badge}</Badge>
                  </div>
                  <p className="mt-0.5 text-secondary text-text-muted">{item.detail}</p>
                </div>
              </div>
              <div className="pl-9">
                <Link className={rowActionClassName} href={item.href}>
                  {item.actionLabel}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {list.notes.length > 0 ? <p className="border-t border-border-row px-4 py-2.5 text-caption text-text-muted">{list.notes.join(" ")}</p> : null}
    </HomeBlock>
  );
}

/** Thin strip of the centre's four headline numbers (2a): not KPI cards. */
export function SummaryStrip({ model, retryHref }: { model: DashboardHomeReadModel; retryHref: string }) {
  const cells = buildSummaryStrip(model);
  if (cells.length === 0) return null;

  return (
    <section aria-label="Tóm tắt hôm nay" className="panel-rise rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <dl className="grid grid-cols-1 divide-y divide-border-row sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
        {cells.map((cell, index) => (
          <div
            className={cn(
              "min-w-0 px-4 py-3",
              index > 0 && "xl:border-l xl:border-border-row",
              index % 2 === 1 && "sm:border-l sm:border-border-row",
              index >= 2 && "sm:border-t sm:border-border-row xl:border-t-0",
            )}
            key={cell.key}
          >
            <dt className="text-label font-medium text-text-muted">{cell.label}</dt>
            <dd
              className={cn(
                "mt-1 break-words text-numeric font-bold tabular-nums",
                cell.tone === "danger" ? "text-danger" : cell.tone === "warning" ? "text-warning" : "text-text-strong",
              )}
            >
              {cell.value}
            </dd>
            <dd className="text-caption text-text-muted">{cell.caption}</dd>
          </div>
        ))}
      </dl>
      {cells.some((cell) => cell.state === "failed") ? (
        <BlockError className="rounded-b-lg border-t" message="Một số số liệu chưa tải được." retryHref={retryHref} />
      ) : null}
    </section>
  );
}

function StatList({ rows }: { rows: StatRow[] }) {
  return (
    <dl className="divide-y divide-border-row">
      {rows.map((row) => (
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5" key={row.key}>
          <dt className="min-w-0 text-secondary text-text-default">
            {row.label}
            {row.hint ? <span className="block text-caption text-text-muted">{row.hint}</span> : null}
          </dt>
          <dd className="shrink-0 text-body font-semibold tabular-nums text-text-strong">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small stat block ("Tuần này", "Tháng 10 của bạn"); hidden when every row is forbidden. */
export function StatBlock({
  footnote,
  retryHref,
  rows,
  subtitle,
  title,
  titleId,
}: {
  footnote?: string;
  retryHref: string;
  rows: StatRow[];
  subtitle?: string;
  title: string;
  titleId: string;
}) {
  if (rows.length === 0) return null;

  return (
    <HomeBlock subtitle={subtitle} title={title} titleId={titleId}>
      <StatList rows={rows} />
      {rows.some((row) => row.state === "failed") ? <BlockError className="border-t" message="Một số số liệu chưa tải được." retryHref={retryHref} /> : null}
      {footnote ? <p className="border-t border-border-row px-4 py-2.5 text-caption text-text-muted">{footnote}</p> : null}
    </HomeBlock>
  );
}

/**
 * Current tuition period (2a): payable, collected, overdue, due date and a
 * three-part bar with its shares written out. Needs tuition_periods.view and
 * payments.view; otherwise hidden.
 */
export function TuitionProgressBlock({ model, retryHref }: { model: DashboardHomeReadModel; retryHref: string }) {
  const feed = model.tuition;
  if (feed.status === "unavailable" && feed.reason === "forbidden") return null;

  const progress = feed.status === "ready" ? feed.value : null;
  const shares = progress ? getTuitionShares(progress) : null;
  const isPastDue = Boolean(progress?.dueOn && progress.dueOn < model.today);
  const badge = !progress ? null : progress.status === "draft" ? (
    <Badge tone="neutral">Bản nháp</Badge>
  ) : isPastDue && progress.overdueVnd > 0 ? (
    <Badge tone="warning">Đã qua hạn thu</Badge>
  ) : (
    <Badge tone="info">Đang thu</Badge>
  );

  return (
    <HomeBlock
      action={
        <Link className={homeLinkClassName} href={progress ? `/finance/tuition-periods/${progress.periodId}` : "/finance/tuition-periods"}>
          {progress ? "Mở kỳ thu" : "Danh sách kỳ thu"}
        </Link>
      }
      subtitle={badge}
      title={progress ? `Kỳ thu học phí ${progress.name}` : "Kỳ thu học phí"}
      titleId="home-tuition-title"
    >
      {feed.status === "unavailable" ? (
        <BlockError message="Chưa tải được tiến độ kỳ thu học phí." retryHref={retryHref} />
      ) : !progress ? (
        <BlockEmpty>Chưa có kỳ thu học phí nào.</BlockEmpty>
      ) : progress.status === "draft" ? (
        <BlockEmpty>Kỳ thu đang ở bản nháp: chưa khóa nên chưa có phiếu và số phải thu.</BlockEmpty>
      ) : (
        <div className="grid gap-4 px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 2xl:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-label text-text-muted">Phải thu</dt>
              <dd className="mt-0.5 whitespace-nowrap text-section-title font-semibold tabular-nums text-text-strong">{formatVnd(progress.payableVnd)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-text-muted">Đã thu</dt>
              <dd className="mt-0.5 whitespace-nowrap text-section-title font-semibold tabular-nums text-success">{formatVnd(progress.collectedVnd)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-text-muted">Quá hạn</dt>
              <dd className={cn("mt-0.5 whitespace-nowrap text-section-title font-semibold tabular-nums", progress.overdueVnd > 0 ? "text-danger" : "text-text-strong")}>
                {formatVnd(progress.overdueVnd)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-text-muted">Hạn thu</dt>
              <dd className="mt-0.5 whitespace-nowrap text-section-title font-semibold tabular-nums text-text-strong">{formatIsoDate(progress.dueOn)}</dd>
            </div>
          </dl>
          {shares && progress.payableVnd > 0 ? (
            <div className="grid gap-2">
              <div
                aria-label={`${shares.collected}% đã thu, ${shares.overdue}% quá hạn, ${shares.notDue}% chưa đến hạn`}
                className="flex h-2 overflow-hidden rounded-full bg-surface-sunken"
                role="img"
              >
                <span className="progress-grow block h-full bg-success" style={{ width: `${shares.collected}%` }} />
                <span className="block h-full bg-danger" style={{ width: `${shares.overdue}%` }} />
              </div>
              <p className="text-caption text-text-muted">
                {shares.collected}% đã thu · {shares.overdue}% quá hạn · {shares.notDue}% chưa đến hạn · {progress.requestCount} yêu cầu thanh toán
              </p>
            </div>
          ) : (
            <p className="text-caption text-text-muted">Kỳ này không có khoản nào phải thu.</p>
          )}
        </div>
      )}
    </HomeBlock>
  );
}
