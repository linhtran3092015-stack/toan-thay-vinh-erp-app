import type { listZaloAccountsAction } from "@/features/parent-messages/actions";
import type { saveWebsite } from "@/features/website/actions";
import type { Palette } from "@/features/website/schema";

import type { setRolePermissionsAction, updateSystemSettingsAction, updateZaloCommentTemplateAction } from "./actions";

/**
 * Optional replacements for every write (and external read) the settings hub
 * can reach. Each settings component takes the slice it uses and falls back to
 * the real action, so production passes nothing while the /dev/settings
 * preview passes inert stubs (it runs on localhost where .env.local may point
 * at the production database). Type-only imports: no server module enters the
 * bundle through this file.
 */
export interface SettingsActionOverrides {
  /** Personal palette on this browser (localStorage). `null` = follow the centre. Returns the result line. */
  applyPersonalAppearance?: (palette: Palette | null) => string;
  listZaloAccounts?: typeof listZaloAccountsAction;
  saveWebsite?: typeof saveWebsite;
  setRolePermissions?: typeof setRolePermissionsAction;
  updateSystemSettings?: typeof updateSystemSettingsAction;
  updateZaloCommentTemplate?: typeof updateZaloCommentTemplateAction;
}
