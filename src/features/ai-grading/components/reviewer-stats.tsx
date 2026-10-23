import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { ResultBanner } from "@/components/shared/result-banner";
import { REVIEW_STATS_DAYS, changeRate, totalReviewerStats, type ReviewerStats } from "@/features/ai-grading/review-stats";
import type { ReviewerStatsResult } from "@/features/ai-grading/review-stats-data";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { formatDateTime } from "@/lib/datetime";

function number(value: number): string {
  return value.toLocaleString("vi-VN");
}

/**
 * "Duyệt bài 30 ngày": how often each reviewer changed the AI's result. A rate near zero on yellow
 * papers can mean papers were approved without being read; changes on green papers show how far
 * green can be trusted.
 */
export function ReviewerStatsCard({ result }: { result: ReviewerStatsResult }) {
  const description = `Bài AI chấm đã duyệt trong ${REVIEW_STATS_DAYS} ngày qua, theo người duyệt. "Sửa" là đổi đúng/sai của ít nhất một câu so với AI; bài nộp trống (làm trên giấy) không tính vào tỉ lệ sửa.`;
  if (!result.ok) {
    return (
      <SettingsCard description={description} title={`Duyệt bài ${REVIEW_STATS_DAYS} ngày`}>
        <ResultBanner title={result.error} tone="error" />
      </SettingsCard>
    );
  }
  const total = totalReviewerStats(result.rows);
  return (
    <SettingsCard description={description} title={`Duyệt bài ${REVIEW_STATS_DAYS} ngày`}>
      {result.rows.length === 0 ? (
        <p className="text-secondary text-text-muted">Chưa có bài nào được duyệt.</p>
      ) : (
        <div className="grid gap-3">
          <p className="text-secondary text-text-default">
            Đã duyệt <span className="font-semibold text-text-strong">{number(total.approved)}</span> bài. Trợ giảng sửa kết quả AI ở{" "}
            <span className="font-semibold text-text-strong">{changeRate(total.changedPapers, total.compared)}</span> bài có làm
            {total.green > 0 ? `, trong đó ${number(total.changedGreen)} bài xanh` : ""}; {number(total.blank)} bài nộp trống chấm tay.
          </p>
          <DataTableFrame
            body={[
              ...result.rows.map((row) => <ReviewerRow key={row.reviewerId} row={row} />),
              <ReviewerRow key="total" row={{ ...total, lastReviewedAt: null, reviewerId: "total", reviewerName: "Tổng" }} total />,
            ]}
            caption={`Thống kê duyệt bài ${REVIEW_STATS_DAYS} ngày theo người duyệt`}
            header={
              <tr>
                <TableHeaderCell>Người duyệt</TableHeaderCell>
                <TableHeaderCell numeric>Đã duyệt</TableHeaderCell>
                <TableHeaderCell>Xanh · vàng · đỏ</TableHeaderCell>
                <TableHeaderCell numeric>Sửa so với AI</TableHeaderCell>
                <TableHeaderCell numeric>Bài xanh phải sửa</TableHeaderCell>
                <TableHeaderCell numeric>Câu đã sửa</TableHeaderCell>
                <TableHeaderCell numeric>Bài trống</TableHeaderCell>
                <TableHeaderCell numeric>Cộng điểm</TableHeaderCell>
                <TableHeaderCell>Lần duyệt cuối</TableHeaderCell>
              </tr>
            }
            tableClassName="min-w-[880px]"
          />
        </div>
      )}
    </SettingsCard>
  );
}

function ReviewerRow({ row, total = false }: { row: ReviewerStats; total?: boolean }) {
  return (
    <TableRow className={total ? "font-semibold" : undefined}>
      <TableCell className="text-text-strong">{row.reviewerName}</TableCell>
      <TableCell numeric>{number(row.approved)}</TableCell>
      <TableCell>
        {number(row.green)} · {number(row.yellow)} · {number(row.red)}
      </TableCell>
      <TableCell numeric>{changeRate(row.changedPapers, row.compared)}</TableCell>
      <TableCell numeric>{changeRate(row.changedGreen, row.green)}</TableCell>
      <TableCell numeric>{number(row.changedQuestions)}</TableCell>
      <TableCell numeric>{number(row.blank)}</TableCell>
      <TableCell numeric>{number(row.praiseBonus)}</TableCell>
      <TableCell>{row.lastReviewedAt ? formatDateTime(row.lastReviewedAt) : ""}</TableCell>
    </TableRow>
  );
}
