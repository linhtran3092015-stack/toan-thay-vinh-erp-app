import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSystemSettings, type SystemSettings } from "@/features/settings/system-settings";

export async function getSystemSettings(): Promise<SystemSettings> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("system_settings").select("key,value");
  return parseSystemSettings(data);
}

/** A deliberately narrow, non-secret branding reader for the authenticated app shell. */
export async function getCenterDisplayName(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_center_display_name");
  return typeof data === "string" && data.trim()
    ? data
    : "Trung tâm Toán Thầy Vinh";
}
