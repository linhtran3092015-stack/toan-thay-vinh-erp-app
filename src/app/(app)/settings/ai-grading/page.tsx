import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AiGradingSettingsPanel } from "@/features/ai-grading/components/ai-grading-settings";
import { PhraseLibraryEditor } from "@/features/ai-grading/components/phrase-library-editor";
import { ReviewerStatsCard } from "@/features/ai-grading/components/reviewer-stats";
import { getAiGradingOverview } from "@/features/ai-grading/overview-data";
import { getGradingCommentPhrases } from "@/features/ai-grading/phrases-data";
import { getAiGradingReviewerStats } from "@/features/ai-grading/review-stats-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

// Saving (or "Chạy lại ngay") starts the worker in after(), which runs for this page's maxDuration.
export const maxDuration = 300;

export default async function AiGradingSettingsPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.view")) {
    return <PermissionDeniedState description="Yêu cầu quyền settings.view." title="Không có quyền xem cài đặt" />;
  }
  const [overview, phrases, reviewerStats] = await Promise.all([getAiGradingOverview(), getGradingCommentPhrases(), getAiGradingReviewerStats()]);
  if (!overview.ok) return <ErrorState description={overview.error} title="Không tải được cài đặt chấm bài AI" />;
  const canManage = permissions.permissions.includes("settings.manage");
  return (
    <div className="grid gap-5">
      <AiGradingSettingsPanel
        apiKeyConfigured={overview.apiKeyConfigured}
        canManage={canManage}
        cronConfigured={overview.cronConfigured}
        overview={overview.data}
      />
      <ReviewerStatsCard result={reviewerStats} />
      <PhraseLibraryEditor canManage={canManage} initial={phrases} />
    </div>
  );
}
