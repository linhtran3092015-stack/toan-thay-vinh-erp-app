import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { TuitionTemplatePeriodRow, TuitionTemplateVersionRow } from "@/features/tuition/receipt-template-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The publisher's name comes through the FK embed; RLS (`staff.view` or self) returns null for anyone else's profile. */
const VERSION_SELECT =
  "id, version_number, content, published_at, published_by, reason, publisher:profiles!tuition_receipt_template_versions_published_by_fkey(display_name)";
const PERIOD_SELECT = "id, name, status, receipt_template_version_id";

export interface TuitionTemplatePageData {
  /** Newest first by `published_at`, the lock's own order; null = the read failed. */
  versions: TuitionTemplateVersionRow[] | null;
  /** null = not read (no `tuition_periods.view`) or the read failed: the usage line is hidden. */
  periods: TuitionTemplatePeriodRow[] | null;
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Failures are logged with the part, code and message only, never rows. */
function logReadFailure(part: string, error: unknown): void {
  const record = error && typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : {};
  const code = typeof record.code === "string" ? record.code : "unknown";
  const message = typeof record.message === "string" ? record.message : typeof error === "string" ? error : "unknown error";
  console.error("TUITION_TEMPLATE_READ_FAILED", part, code, message);
}

async function readVersions(client: Promise<ServerClient>): Promise<TuitionTemplateVersionRow[]> {
  const supabase = await client;
  const { data, error } = await supabase
    .from("tuition_receipt_template_versions")
    .select(VERSION_SELECT)
    .order("published_at", { ascending: false })
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TuitionTemplateVersionRow[];
}

async function readPeriods(client: Promise<ServerClient>): Promise<TuitionTemplatePeriodRow[]> {
  const supabase = await client;
  const { data, error } = await supabase.from("tuition_collection_periods").select(PERIOD_SELECT).order("starts_on", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function settled<T>(part: string, result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  unstable_rethrow(result.reason);
  logReadFailure(part, result.reason);
  return fallback;
}

/**
 * Versions (with publisher names) and, for users who may read periods, the
 * periods behind the usage line. The reads are independent: a failed period
 * read only hides the usage line.
 */
export async function loadTuitionTemplatePageData({ canReadPeriods }: { canReadPeriods: boolean }): Promise<TuitionTemplatePageData> {
  const client = createSupabaseServerClient();
  const [versions, periods] = await Promise.allSettled([
    readVersions(client),
    canReadPeriods ? readPeriods(client) : Promise.resolve(null),
  ]);
  return {
    periods: settled("periods", periods, null),
    versions: settled("versions", versions, null),
  };
}
