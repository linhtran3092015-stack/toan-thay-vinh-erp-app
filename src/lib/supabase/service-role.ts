import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  getSepayWebhookEnv,
  getSupabasePublicEnv,
} from "@/lib/env";
import type { Database } from "@/types/database.generated";

export function createSupabaseServiceRoleClient() {
  const { url } = getSupabasePublicEnv();
  const { serviceRoleKey } = getSepayWebhookEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
