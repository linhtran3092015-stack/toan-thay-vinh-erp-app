import type {
  allocateSepayTuitionAction,
  getAllocationDetailsAction,
  searchAllocationStudentsAction,
} from "./manual-allocation-actions";
import type { reverseSepayAllocationAction } from "./sepay-allocation-reversal-actions";
import type { previewSepayHistorySyncAction, syncSepayHistoryAction } from "./sepay-history-sync-actions";
import type {
  matchSepayHistoricalTransactionAction,
  resolveSepayHistoricalTransactionAction,
  searchSepayReconciliationCandidatesAction,
} from "./sepay-reconciliation-actions";

/**
 * Optional replacements for every server action the /finance/sepay screen can
 * reach. Each SePay client component takes the slice it uses and falls back to
 * the real action, so production passes nothing while the /dev/sepay preview
 * passes inert stubs (it runs on localhost where .env.local may point at the
 * production database). Type-only imports: no server module enters the bundle
 * through this file.
 */
export interface SepayActionOverrides {
  allocate?: typeof allocateSepayTuitionAction;
  getAllocationDetails?: typeof getAllocationDetailsAction;
  matchHistorical?: typeof matchSepayHistoricalTransactionAction;
  previewHistorySync?: typeof previewSepayHistorySyncAction;
  resolveHistorical?: typeof resolveSepayHistoricalTransactionAction;
  reverseAllocation?: typeof reverseSepayAllocationAction;
  searchAllocationStudents?: typeof searchAllocationStudentsAction;
  searchReconciliationCandidates?: typeof searchSepayReconciliationCandidatesAction;
  syncHistory?: typeof syncSepayHistoryAction;
}
