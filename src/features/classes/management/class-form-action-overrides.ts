import type { createClassAction, updateClassAction } from "@/features/classes/actions/class-actions";

/**
 * Optional replacements for the two writes the class form can reach
 * (/classes/new and /classes/[classId]/edit). The form falls back to the real
 * server actions, so the routes pass nothing while the /dev/forms preview
 * passes inert stubs (it runs on localhost where .env.local may point at the
 * production database). Type-only imports: no server module enters the
 * bundle through this file.
 */
export interface ClassFormActionOverrides {
  createClass?: typeof createClassAction;
  updateClass?: typeof updateClassAction;
}
