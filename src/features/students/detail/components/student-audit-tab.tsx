import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditTimelineRecord } from "@/features/students/detail/types";

interface StudentAuditTabProps {
  records: AuditTimelineRecord[];
}

export function StudentAuditTab({ records }: StudentAuditTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử thay đổi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {records.map((record) => (
            <article
              className="relative rounded-lg border border-hairline bg-canvas p-4"
              key={record.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-section-title font-semibold text-ink">
                    {record.action}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {record.module}
                  </p>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {record.timestamp}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                <Info label="Người thực hiện" value={record.actorName} />
                <Info label="Dữ liệu cũ" value={record.oldData} />
                <Info label="Dữ liệu mới" value={record.newData} />
                <Info label="Lý do" value={record.reason} />
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}
