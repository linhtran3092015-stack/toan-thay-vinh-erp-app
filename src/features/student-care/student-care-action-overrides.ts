import type { mutateCare } from "./actions";

/**
 * Optional replacement for the one student-care server action. Every
 * student-care form takes it and falls back to the real `mutateCare`, so the
 * real pages pass nothing while the /dev/student-care preview passes an inert
 * stub (it runs on localhost where .env.local may point at the production
 * database). Type-only import: no server module enters a bundle through here.
 */
export interface StudentCareActionOverrides {
  mutateCare?: typeof mutateCare;
}
