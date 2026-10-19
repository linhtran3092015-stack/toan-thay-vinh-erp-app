import type {
  approveSessionBalanceImportBatchAction,
  createSessionBalanceImportBatchAction,
  dryRunSessionBalanceImportAction,
  excludeSessionBalanceImportRowAction,
  postSessionBalanceImportBatchAction,
  reconcileSessionBalanceImportBatchAction,
} from "./actions";

/**
 * Optional replacements for every server action the session-balance import
 * pages can reach (the wizard: dry-run and create; the batch page: exclude a
 * row, reconcile, approve, post). Each key is the action's name without
 * "Action". Production passes nothing and the pages use the real actions; the
 * /dev/imports preview passes inert stubs (it runs on localhost where
 * .env.local may point at the production database). Type-only imports: no
 * server module enters the bundle through this file.
 */
export interface SessionBalanceImportActionOverrides {
  approveSessionBalanceImportBatch?: typeof approveSessionBalanceImportBatchAction;
  createSessionBalanceImportBatch?: typeof createSessionBalanceImportBatchAction;
  dryRunSessionBalanceImport?: typeof dryRunSessionBalanceImportAction;
  excludeSessionBalanceImportRow?: typeof excludeSessionBalanceImportRowAction;
  postSessionBalanceImportBatch?: typeof postSessionBalanceImportBatchAction;
  reconcileSessionBalanceImportBatch?: typeof reconcileSessionBalanceImportBatchAction;
}

/** What the import page (wizard + batch list) can reach. */
export type SessionBalanceImportPageActions = Pick<
  SessionBalanceImportActionOverrides,
  "createSessionBalanceImportBatch" | "dryRunSessionBalanceImport"
>;

/** What the batch page can reach. */
export type SessionBalanceBatchDetailActions = Pick<
  SessionBalanceImportActionOverrides,
  | "approveSessionBalanceImportBatch"
  | "excludeSessionBalanceImportRow"
  | "postSessionBalanceImportBatch"
  | "reconcileSessionBalanceImportBatch"
>;
