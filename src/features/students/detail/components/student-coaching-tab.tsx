import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  coachingPriorityMeta,
  coachingStatusMeta,
} from "@/features/students/detail/helpers";
import type { CoachingRecord } from "@/features/students/detail/types";

interface StudentCoachingTabProps {
  records: CoachingRecord[];
}

export function StudentCoachingTab({ records }: StudentCoachingTabProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h2 className="text-section-title font-semibold text-ink">
            Chưa có phiếu coaching
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Dữ liệu coaching sẽ được triển khai ở bước sau.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coaching</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {records.map((record) => {
          const priority = coachingPriorityMeta[record.priority];
          const status = coachingStatusMeta[record.status];

          return (
            <article
              className="rounded-lg border border-hairline bg-canvas p-4"
              key={record.id}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-section-title font-semibold text-ink">
                    {record.campaignName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {record.reason}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={priority.tone}>Ưu tiên {priority.label}</Badge>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
                <Info label="Tên đợt" value={record.campaignName} />
                <Info label="Ngày mở" value={record.openedAt} />
                <Info label="Trợ lý phụ trách" value={record.ownerName} />
                <Info label="Ngày xem lại" value={record.reviewAt} />
                <Info label="Kết quả" value={record.outcome} />
              </div>
            </article>
          );
        })}
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
