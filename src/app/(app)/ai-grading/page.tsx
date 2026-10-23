import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AiGradingQueuePage } from "@/features/ai-grading/components/ai-grading-queue-page";
import { parseQueueRange, type QueueStage } from "@/features/ai-grading/queue";
import { getAiGradingQueue } from "@/features/ai-grading/queue-data";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

const STAGES: ReadonlyArray<QueueStage | "all"> = ["review", "in_progress", "done", "all"];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AiGradingRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok) return <ErrorState description="Hệ thống chưa tải được quyền truy cập." title="Không tải được quyền truy cập" />;
  if (!permissions.permissions.includes("ai_grading.view")) {
    return <PermissionDeniedState description={permissionDeniedDescription("ai_grading.view")} title="Không có quyền xem chấm bài AI" />;
  }
  const params = await searchParams;
  const range = parseQueueRange({ from: first(params.from), to: first(params.to) }, getVietnamToday());
  const requested = first(params.stage);
  const stage = STAGES.includes(requested as QueueStage | "all") ? (requested as QueueStage | "all") : "review";
  const result = await getAiGradingQueue(range);
  if (!result.ok) return <ErrorState description={result.error} title="Không tải được chấm bài AI" />;
  return <AiGradingQueuePage range={range} sessions={result.sessions} stage={stage} today={result.today} />;
}
