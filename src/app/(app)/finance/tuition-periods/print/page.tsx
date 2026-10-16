import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { loadFeeNotices } from "@/features/tuition/fee-notice-data";
import { parseFeeNoticeItemIds, sortFeeNoticesForPrint, type FeeNoticeModel } from "@/features/tuition/fee-notice-model";
import { FeeNoticePrintScreen } from "@/features/tuition/fee-notice-screens";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

function LoadError() {
  return (
    <ErrorState
      description="Chưa tải được Phiếu học phí cần in. Tải lại trang để thử lại; phiếu không bị thay đổi."
      title="Không tải được Phiếu học phí"
    />
  );
}

/**
 * Bulk print tab opened by TuitionBulkPrintControls (design 15b): one A5
 * sheet per current notice, sorted by grade then name, and unknown ids are
 * counted, never guessed.
 *
 * A superseded notice never prints (its request was cancelled; the
 * replacement is the one to pay). The id list comes from a page loaded
 * earlier, so a notice reissued since then arrives as a superseded id: it is
 * swapped for the chain's current replacement, read in a second pass, unless
 * that replacement is already in the batch. A replacement that cannot be read
 * (or was replaced again meanwhile) leaves its chain unresolved: counted once
 * per chain, apart from the unknown ids (and not again among them when that
 * replacement's id was requested too).
 */
export default async function TuitionBulkPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ itemIds?: string | string[] }>;
}) {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.export")) {
    return <PermissionDeniedState description="Yêu cầu quyền tuition_periods.export." title="Không có quyền in Phiếu học phí" />;
  }

  const ids = parseFeeNoticeItemIds((await searchParams).itemIds);
  if (ids.length === 0) return <FeeNoticePrintScreen missingCount={0} notices={[]} skippedCount={0} />;

  const result = await loadFeeNotices(ids);
  if (result.status === "error") return <LoadError />;

  const current = result.notices.filter((notice) => !notice.edition.superseded);
  const superseded = result.notices.filter((notice) => notice.edition.superseded);
  const inBatch = new Set(current.map((notice) => notice.itemId));
  const replacementIds = [
    ...new Set(superseded.flatMap(({ edition }) => (edition.currentItemId && !inBatch.has(edition.currentItemId) ? [edition.currentItemId] : []))),
  ];

  let replacements: FeeNoticeModel[] = [];
  if (replacementIds.length > 0) {
    const second = await loadFeeNotices(replacementIds);
    if (second.status === "error") return <LoadError />;
    replacements = second.notices.filter((notice) => !notice.edition.superseded);
  }

  // Each superseded notice: skipped when its replacement is printed anyway,
  // replaced when it brought that replacement in, otherwise unresolved. A
  // chain is keyed by its current item (the notice itself when unknown), so
  // two originals of one chain count once.
  const read = new Set(replacements.map((notice) => notice.itemId));
  const brought = new Set<string>();
  const unresolved = new Set<string>();
  let skippedCount = 0;
  for (const { edition, itemId } of superseded) {
    const target = edition.currentItemId;
    if (target && (inBatch.has(target) || brought.has(target))) skippedCount += 1;
    else if (target && read.has(target)) brought.add(target);
    else unresolved.add(target ?? itemId);
  }
  // An unresolved chain's current item may have been requested itself (and
  // so be unknown too): the chain is already counted as unresolved.
  const missingCount = result.missingIds.filter((missingId) => !unresolved.has(missingId)).length;

  return (
    <FeeNoticePrintScreen
      missingCount={missingCount}
      notices={sortFeeNoticesForPrint([...current, ...replacements])}
      // The superseded notices are still read, so the back link keeps its period when nothing is left to print.
      periodId={result.notices[0]?.periodId}
      replacedCount={brought.size}
      skippedCount={skippedCount}
      unresolvedCount={unresolved.size}
    />
  );
}
