import type { createBatchSessionsAction } from "./actions/session-batch-actions";

/**
 * Optional replacement for the one write /sessions/batch can reach. The
 * workspace falls back to the real server action, so the route passes
 * nothing while the /dev/forms preview passes an inert stub (it runs on
 * localhost where .env.local may point at the production database).
 * Type-only import: no server module enters the bundle through this file.
 */
export interface SessionBatchActionOverrides {
  createBatchSessions?: typeof createBatchSessionsAction;
}
