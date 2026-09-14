import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { brandingSchema, createDefaultWebsite, defaultBranding, websiteSchema } from "./schema";
import { getCenterDisplayName } from "@/features/settings/system-settings-data";

// Typed boundary for new migration RPCs, until database types are regenerated.
export async function websiteRpc(name: "read_website_configuration" | "read_published_website" | "read_app_branding" | "write_website_configuration", args?: { p_draft: unknown; p_version: number; p_operation: string }) {
  const client = await createSupabaseServerClient();
  const rpc = client.rpc.bind(client) as unknown as (name: string, args?: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  return rpc(name, args);
}
export async function readWebsiteEditor() {
  const { data, error } = await websiteRpc("read_website_configuration");
  if (error || !data || typeof data !== "object") return { ok: false as const };
  const row = data as { draft: unknown; version: number; published: boolean };
  if (!Number.isInteger(row.version) || row.version < 0 || typeof row.published !== "boolean") return { ok: false as const };
  const parsed = row.draft === null ? { success: true as const, data: createDefaultWebsite(await getCenterDisplayName()) } : websiteSchema.safeParse(row.draft);
  if (!parsed.success) return { ok: false as const };
  return { ok: true as const, site: parsed.data, version: row.version, published: row.published };
}
export async function readPublishedWebsite() {
  const { data, error } = await websiteRpc("read_published_website");
  if (error) throw new Error("Không tải được website công khai.");
  return websiteSchema.safeParse(data);
}

async function _readAppBranding() {
  try { const { data } = await websiteRpc("read_app_branding"); const parsed = brandingSchema.safeParse(data); return parsed.success ? parsed.data : defaultBranding; }
  catch { return defaultBranding; }
}

/**
 * Per-request memoized version of readAppBranding.
 * Prevents duplicate RPC calls if multiple server components in the same
 * render pass both read the branding configuration.
 */
export const readAppBranding = cache(_readAppBranding);
