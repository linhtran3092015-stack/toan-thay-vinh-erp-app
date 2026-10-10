import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scoreStatusMeta } from "@/features/students/detail/helpers";
import type { LearningLevel } from "@/features/students/types";
import type { ScoreStatus, StudentResultRecord } from "@/features/students/detail/types";

interface StudentResultsTabProps {
  averageScore: number;
  automaticLevel: LearningLevel;
  records: StudentResultRecord[];
}

export function StudentResultsTab({
  automaticLevel,
  averageScore,
  records,
}: StudentResultsTabProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <ScoreChart
          records={records}
          scoreKey="quizScore"
          title="Biểu đồ điểm kiểm tra cuối buổi"
        />
        <ScoreChart
          records={records}
          scoreKey="notebookScore"
          title="Biểu đồ điểm vở"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Điểm trung bình 4 buổi gần nhất" value={averageScore.toFixed(1)} />
        <Metric label="Mức tự động" value={automaticLevel} />
        <Metric label="Số buổi có điểm" value={String(records.filter((record) => record.status === "scored").length)} />
        <Metric label="Tổng bản ghi" value={String(records.length)} />
      </div>

      <section className="grid gap-3">
        <h2 className="text-section-title font-semibold text-ink">
          Danh sách từng buổi
        </h2>

        <div className="hidden max-w-full overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
          <table className="min-w-[960px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
              <tr>
                <TableHeader>Ngày</TableHeader>
                <TableHeader>Lớp</TableHeader>
                <TableHeader>Điểm kiểm tra</TableHeader>
                <TableHeader>Điểm vở</TableHeader>
                <TableHeader>Nhận xét</TableHeader>
                <TableHeader>Người chấm</TableHeader>
                <TableHeader>Trạng thái</TableHeader>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="hover:bg-[#F8FAFF]" key={record.id}>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.className}</TableCell>
                  <TableCell>{formatScore(record.quizScore)}</TableCell>
                  <TableCell>{formatScore(record.notebookScore)}</TableCell>
                  <TableCell>{record.comment}</TableCell>
                  <TableCell>{record.gradedBy}</TableCell>
                  <TableCell>
                    <ScoreStatusBadge status={record.status} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {records.map((record) => (
            <article
              className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{record.date}</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {record.className} · Buổi {record.sessionNumber}
                  </p>
                </div>
                <ScoreStatusBadge status={record.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Info label="Điểm kiểm tra" value={formatScore(record.quizScore)} />
                <Info label="Điểm vở" value={formatScore(record.notebookScore)} />
                <Info label="Người chấm" value={record.gradedBy} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {record.comment}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScoreChart({
  records,
  scoreKey,
  title,
}: {
  records: StudentResultRecord[];
  scoreKey: "notebookScore" | "quizScore";
  title: string;
}) {
  const scores = records.map((record) => record[scoreKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-3">
          {scores.map((score, index) => {
            const value = score ?? 0;

            return (
              <div className="flex flex-1 flex-col items-center gap-2" key={index}>
                <div className="flex h-36 w-full items-end rounded-md bg-canvas px-2">
                  <div
                    className="w-full rounded-t-md bg-action-primary"
                    style={{ height: `${Math.max(value * 10, 6)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-ink-muted">
                  B{records[index].sessionNumber}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
    </div>
  );
}

function ScoreStatusBadge({ status }: { status: ScoreStatus }) {
  const meta = scoreStatusMeta[status];

  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function formatScore(score: number | null): string {
  return score === null ? "-" : score.toFixed(1).replace(".0", "");
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

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b border-hairline px-4 py-3 font-semibold">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return (
    <td className="border-b border-hairline px-4 py-3 align-middle text-ink">
      {children}
    </td>
  );
}
