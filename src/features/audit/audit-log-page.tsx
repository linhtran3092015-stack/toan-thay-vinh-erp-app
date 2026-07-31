import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type {
  AuditFilters,
  AuditLogEntry,
  AuditLogReadModel,
} from "@/features/audit/read-models";
import type { Json } from "@/types/database.generated";

interface AuditLogPageProps {
  model: AuditLogReadModel;
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

function humanizeCode(value: string): string {
  const normalized = value.replaceAll("_", " ").trim();

  if (!normalized) {
    return "Không xác định";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function stringifyJson(value: Json): string {
  return JSON.stringify(value, null, 2) ?? String(value);
}

function hasActiveFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export function AuditLogPage({
  model,
}: AuditLogPageProps) {
  const uniqueModules = new Set(
    model.entries.map((entry) => entry.module),
  ).size;

  const actorCount = new Set(
    model.entries
      .map((entry) => entry.actorUserId)
      .filter(Boolean),
  ).size;

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-hairline bg-surface-1 p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Quản trị hệ thống
        </p>

        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
          Nhật ký hệ thống
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Theo dõi các thao tác đã được ghi nhận từ workflow và trigger
          của hệ thống. Nhật ký chỉ đọc, không thể sửa hoặc xóa từ ứng dụng.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Kết quả phù hợp"
          value={model.totalCount}
        />
        <SummaryCard
          label="Đang hiển thị"
          value={model.entries.length}
        />
        <SummaryCard
          label="Module trong trang"
          value={uniqueModules}
        />
        <SummaryCard
          label="Người thao tác"
          value={actorCount}
        />
      </section>

      <AuditFilterForm model={model} />

      {model.entries.length === 0 ? (
        <section className="rounded-xl border border-dashed border-hairline bg-surface-1 px-6 py-12 text-center">
          <h2 className="font-display text-lg font-bold text-ink">
            Không có nhật ký phù hợp
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Thay đổi hoặc xóa bộ lọc để xem các thao tác khác.
          </p>
        </section>
      ) : (
        <AuditResults entries={model.entries} />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function AuditFilterForm({
  model,
}: {
  model: AuditLogReadModel;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Bộ lọc nhật ký
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Thời gian được hiểu theo múi giờ Việt Nam.
          </p>
        </div>

        {hasActiveFilters(model.filters) ? (
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-hairline bg-surface-1 px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
            href="/audit"
          >
            Xóa bộ lọc
          </Link>
        ) : null}
      </div>

      <form
        action="/audit"
        className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        method="get"
      >
        <FilterSelect
          label="Module"
          name="module"
          options={model.options.modules}
          value={model.filters.module}
        />

        <FilterSelect
          label="Hành động"
          name="action"
          options={model.options.actions}
          value={model.filters.action}
        />

        <FilterSelect
          label="Loại đối tượng"
          name="entityType"
          options={model.options.entityTypes}
          value={model.filters.entityType}
        />

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Người thao tác
          </span>

          <select
            className="h-10 rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
            defaultValue={model.filters.actorId}
            name="actorId"
          >
            <option value="">Tất cả</option>
            {model.options.actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Từ ngày
          </span>
          <input
            className="h-10 rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
            defaultValue={model.filters.fromDate}
            name="fromDate"
            type="date"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Đến ngày
          </span>
          <input
            className="h-10 rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
            defaultValue={model.filters.toDate}
            name="toDate"
            type="date"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Mã đối tượng
          </span>
          <input
            className="h-10 rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-[3px] focus:ring-primary/15"
            defaultValue={model.filters.entityId}
            name="entityId"
            placeholder="UUID hoặc mã nghiệp vụ"
            type="text"
          />
        </label>

        <div className="flex items-end">
          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
            type="submit"
          >
            Áp dụng bộ lọc
          </button>
        </div>
      </form>
    </section>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </span>

      <select
        className="h-10 rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
        defaultValue={value}
        name={name}
      >
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {humanizeCode(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AuditResults({
  entries,
}: {
  entries: readonly AuditLogEntry[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-card">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="font-display text-base font-bold text-ink">
          Các thao tác gần nhất
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Hiển thị tối đa 100 bản ghi, mới nhất trước.
        </p>
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Thời gian</th>
              <th className="px-5 py-3 font-semibold">Người thao tác</th>
              <th className="px-5 py-3 font-semibold">Hành động</th>
              <th className="px-5 py-3 font-semibold">Đối tượng</th>
              <th className="px-5 py-3 font-semibold">Lý do</th>
              <th className="px-5 py-3 font-semibold">Chi tiết</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {entries.map((entry) => (
              <AuditDesktopRow entry={entry} key={entry.id} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 xl:hidden">
        {entries.map((entry) => (
          <AuditMobileCard entry={entry} key={entry.id} />
        ))}
      </div>
    </section>
  );
}

function AuditDesktopRow({
  entry,
}: {
  entry: AuditLogEntry;
}) {
  return (
    <tr className="align-top hover:bg-canvas/70">
      <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
        {formatDateTime(entry.occurredAt)}
      </td>

      <td className="min-w-[220px] px-5 py-4">
        <ActorIdentity entry={entry} />
      </td>

      <td className="min-w-[220px] px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{humanizeCode(entry.module)}</Badge>
          <Badge tone="neutral">{humanizeCode(entry.action)}</Badge>
        </div>
        <code className="mt-2 block break-all text-xs text-ink-muted">
          {entry.action}
        </code>
      </td>

      <td className="min-w-[230px] px-5 py-4">
        <p className="font-semibold text-ink">
          {entry.entityType
            ? humanizeCode(entry.entityType)
            : "Không xác định"}
        </p>
        <code className="mt-1 block break-all text-xs text-ink-muted">
          {entry.entityId ?? "Không có mã"}
        </code>
      </td>

      <td className="max-w-[280px] px-5 py-4 text-ink-muted">
        {entry.reason ?? "Không ghi nhận lý do"}
      </td>

      <td className="px-5 py-4">
        <AuditDetails entry={entry} />
      </td>
    </tr>
  );
}

function AuditMobileCard({
  entry,
}: {
  entry: AuditLogEntry;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{humanizeCode(entry.module)}</Badge>
          <Badge tone="neutral">{humanizeCode(entry.action)}</Badge>
        </div>

        <time className="text-xs font-medium text-ink-muted">
          {formatDateTime(entry.occurredAt)}
        </time>
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Người thao tác
          </dt>
          <dd className="mt-1">
            <ActorIdentity entry={entry} />
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Đối tượng
          </dt>
          <dd className="mt-1 font-semibold text-ink">
            {entry.entityType
              ? humanizeCode(entry.entityType)
              : "Không xác định"}
          </dd>
          <code className="mt-1 block break-all text-xs text-ink-muted">
            {entry.entityId ?? "Không có mã"}
          </code>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Lý do
          </dt>
          <dd className="mt-1 text-ink-muted">
            {entry.reason ?? "Không ghi nhận lý do"}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <AuditDetails entry={entry} />
      </div>
    </article>
  );
}

function ActorIdentity({
  entry,
}: {
  entry: AuditLogEntry;
}) {
  if (!entry.actorUserId) {
    return (
      <div>
        <p className="font-semibold text-ink">Hệ thống / Migration</p>
        <p className="mt-1 text-xs text-ink-muted">
          Không có actor_user_id
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-semibold text-ink">
        {entry.actor?.displayName ?? "Không đọc được hồ sơ"}
      </p>
      <p className="mt-1 break-all text-xs text-ink-muted">
        {entry.actor?.email ?? entry.actorUserId}
      </p>
    </div>
  );
}

function AuditDetails({
  entry,
}: {
  entry: AuditLogEntry;
}) {
  return (
    <details className="min-w-[150px]">
      <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">
        Xem dữ liệu
      </summary>

      <div className="mt-3 grid max-w-3xl gap-3">
        <JsonPanel label="Dữ liệu trước" value={entry.oldData} />
        <JsonPanel label="Dữ liệu sau" value={entry.newData} />
        <JsonPanel label="Metadata" value={entry.metadata} />

        {entry.requestId ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Request ID
            </p>
            <code className="mt-1 block break-all rounded-md bg-canvas p-3 text-xs text-ink">
              {entry.requestId}
            </code>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function JsonPanel({
  label,
  value,
}: {
  label: string;
  value: Json | null;
}) {
  if (value === null) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-canvas p-3 text-xs leading-5 text-ink">
        {stringifyJson(value)}
      </pre>
    </div>
  );
}
