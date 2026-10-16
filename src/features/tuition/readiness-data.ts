import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { TuitionPeriodListItem } from "@/features/tuition/data";
import type { TuitionReadinessContext, TuitionRenewalAccount } from "@/features/tuition/readiness-students";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Failures are logged with the part, code and message only, never rows. */
function logReadFailure(part: string, error: unknown): void {
  const record = error && typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : {};
  const code = typeof record.code === "string" ? record.code : "unknown";
  const message = typeof record.message === "string" ? record.message : typeof error === "string" ? error : "unknown error";
  console.error("TUITION_READINESS_CONTEXT_FAILED", part, code, message);
}

async function readClassNames(client: Promise<ServerClient>, classIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(classIds)];
  if (ids.length === 0) return {};
  const supabase = await client;
  const names: Record<string, string> = {};
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from("classes").select("id, name").in("id", ids.slice(offset, offset + 200));
    if (error) throw error;
    for (const row of data ?? []) names[row.id] = row.name;
  }
  return names;
}

async function readTemplateVersion(client: Promise<ServerClient>): Promise<number | null> {
  const supabase = await client;
  const { data, error } = await supabase
    .from("tuition_receipt_template_versions")
    .select("version_number")
    .order("published_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.version_number ?? null;
}

async function readRenewalAccount(client: Promise<ServerClient>, endsOn: string): Promise<TuitionRenewalAccount | null> {
  const supabase = await client;
  // Same filter as the lock (and getTuitionPeriodSystemBlockers); two rows = ambiguous, the lock refuses.
  const { data, error } = await supabase
    .from("sepay_receiving_account_versions")
    .select("bank_code, account_number")
    .eq("purpose", "renewal")
    .eq("status", "active")
    .lte("effective_from", endsOn)
    .or(`effective_to.is.null,effective_to.gte.${endsOn}`)
    .limit(2);
  if (error) throw error;
  if (!data || data.length !== 1) return null;
  return { accountNumber: data[0].account_number, bankCode: data[0].bank_code };
}

function settled<T>(part: string, result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  unstable_rethrow(result.reason);
  logReadFailure(part, result.reason);
  return fallback;
}

/**
 * Class names, the template version and the renewal account for a draft
 * period. Each read is independent: one failing leaves the others, and the
 * page shows "—" or omits that part of the caption instead of failing.
 */
export async function getTuitionReadinessContext(period: TuitionPeriodListItem, classIds: string[]): Promise<TuitionReadinessContext> {
  const client = createSupabaseServerClient();
  const [classNames, templateVersion, renewalAccount] = await Promise.allSettled([
    readClassNames(client, classIds),
    readTemplateVersion(client),
    readRenewalAccount(client, period.endsOn),
  ]);
  return {
    classNames: settled("classes", classNames, {}),
    renewalAccount: settled("renewal_account", renewalAccount, null),
    templateVersion: settled("template_version", templateVersion, null),
  };
}
