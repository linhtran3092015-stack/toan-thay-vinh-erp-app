import "server-only";

import { unstable_rethrow } from "next/navigation";

import { fetchChunked, fetchPaged, type SupabaseClient } from "@/features/classes/detail/class-detail-data";
import {
  buildFeeNoticeModel,
  resolveFeeNoticeEditions,
  type FeeNoticeItemRow,
  type FeeNoticeLineRow,
  type FeeNoticeModel,
  type FeeNoticePeriodRow,
  type FeeNoticeReplacementLink,
} from "@/features/tuition/fee-notice-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ITEM_SELECT =
  "id, period_id, status, payable_amount_vnd, payable_sessions, opening_balance_sessions, scheduled_chargeable_sessions, reissued_from_item_id, student_snapshot, source_snapshot, receipt_template_snapshot, payment_contract_snapshot";
const LINE_SELECT = "id, item_id, line_kind, session_date, class_session_id, unit_price_vnd, payable_session_count";

export type FeeNoticeLoadResult =
  /** `notices` keep the requested order; `missingIds` were not found or not readable (RLS). */
  | { status: "ok"; missingIds: string[]; notices: FeeNoticeModel[] }
  | { status: "error" };

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return typeof error === "string" ? error : "unknown error";
}

/** Read failures are logged with the table and the message only, never rows. */
function logReadFailure(table: string, error: unknown): void {
  console.error("FEE_NOTICE_READ_FAILED", table, errorMessage(error));
}

/** Paged + chunked `.in` read; `null` (logged) when any page failed. */
async function readByIds<T>(table: string, ids: readonly string[], load: (chunk: string[], from: number, to: number) => Page<T>): Promise<T[] | null> {
  if (ids.length === 0) return [];
  let failure: unknown = null;
  const rows = await fetchChunked(ids, (chunk) =>
    fetchPaged<T>(async (from, to) => {
      const result = await load(chunk, from, to);
      if (result.error) failure = result.error;
      return result;
    }),
  );
  if (!rows) logReadFailure(table, failure ?? "page limit reached");
  return rows;
}

async function readItems(supabase: SupabaseClient, ids: readonly string[]) {
  return readByIds<FeeNoticeItemRow>("tuition_collection_items", ids, (chunk, from, to) =>
    supabase.from("tuition_collection_items").select(ITEM_SELECT).in("id", chunk).order("id", { ascending: true }).range(from, to) as unknown as Page<FeeNoticeItemRow>,
  );
}

/** Lines exist only on original items (a replacement has none). */
async function readLines(supabase: SupabaseClient, itemIds: readonly string[]) {
  return readByIds<FeeNoticeLineRow>("tuition_collection_item_lines", itemIds, (chunk, from, to) =>
    supabase.from("tuition_collection_item_lines").select(LINE_SELECT).in("item_id", chunk).order("id", { ascending: true }).range(from, to) as unknown as Page<FeeNoticeLineRow>,
  );
}

async function readPeriods(supabase: SupabaseClient, periodIds: readonly string[]) {
  return readByIds<FeeNoticePeriodRow>("tuition_collection_periods", periodIds, (chunk, from, to) =>
    supabase.from("tuition_collection_periods").select("id, name, due_on").in("id", chunk).order("id", { ascending: true }).range(from, to) as unknown as Page<FeeNoticePeriodRow>,
  );
}

/**
 * Every replacement in the periods involved: a replacement stays in its
 * original's period, so this also resolves chains (a replacement reissued
 * again) to the current item.
 */
async function readReplacements(supabase: SupabaseClient, periodIds: readonly string[]) {
  return readByIds<{ id: string; reissued_from_item_id: string | null }>("tuition_collection_items", periodIds, (chunk, from, to) =>
    supabase
      .from("tuition_collection_items")
      .select("id, reissued_from_item_id")
      .in("period_id", chunk)
      .not("reissued_from_item_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to) as unknown as Page<{ id: string; reissued_from_item_id: string | null }>,
  );
}

async function readAdjustments(supabase: SupabaseClient, itemIds: readonly string[]) {
  return readByIds<{ original_item_id: string; replacement_item_id: string }>("tuition_collection_item_adjustments", itemIds, (chunk, from, to) =>
    supabase
      .from("tuition_collection_item_adjustments")
      .select("original_item_id, replacement_item_id")
      .in("original_item_id", chunk)
      .order("id", { ascending: true })
      .range(from, to) as unknown as Page<{ original_item_id: string; replacement_item_id: string }>,
  );
}

/**
 * Printable notices for locked items (single notice page and bulk print).
 * Reads (all under `tuition_periods.view` RLS): the items, their periods
 * (name, due date), the original items' lines, every replacement of those
 * periods and the adjustment rows of the requested items.
 *
 * Superseded detection and the period read are required: without them a
 * cancelled request's QR or a notice without its due date could print, so a
 * failure there fails the whole load. Lines are optional: a failed line read
 * prints the session total instead of the per-rate breakdown.
 */
export async function loadFeeNotices(itemIds: readonly string[]): Promise<FeeNoticeLoadResult> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { missingIds: [], notices: [], status: "ok" };

  try {
    const supabase = await createSupabaseServerClient();
    const items = await readItems(supabase, ids);
    if (!items) return { status: "error" };

    const byId = new Map(items.map((item) => [item.id, item]));
    const found = ids.filter((id) => byId.has(id));
    const periodIds = [...new Set(items.map((item) => item.period_id))];
    const originals = items.filter((item) => item.reissued_from_item_id === null).map((item) => item.id);

    const [periods, lines, replacements, adjustments] = await Promise.all([
      readPeriods(supabase, periodIds),
      readLines(supabase, originals),
      readReplacements(supabase, periodIds),
      readAdjustments(supabase, found),
    ]);
    if (!periods || !replacements || !adjustments) return { status: "error" };

    const links: FeeNoticeReplacementLink[] = [
      ...replacements.flatMap((row) => (row.reissued_from_item_id ? [{ originalItemId: row.reissued_from_item_id, replacementItemId: row.id }] : [])),
      ...adjustments.map((row) => ({ originalItemId: row.original_item_id, replacementItemId: row.replacement_item_id })),
    ];
    const editions = resolveFeeNoticeEditions(found, links);
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const linesByItem = new Map<string, FeeNoticeLineRow[]>();
    for (const line of lines ?? []) {
      const own = linesByItem.get(line.item_id);
      if (own) own.push(line);
      else linesByItem.set(line.item_id, [line]);
    }

    return {
      missingIds: ids.filter((id) => !byId.has(id)),
      notices: found.map((id) => {
        const item = byId.get(id) as FeeNoticeItemRow;
        return buildFeeNoticeModel({
          edition: editions.get(id),
          item,
          lines: lines === null ? null : (linesByItem.get(id) ?? []),
          period: periodById.get(item.period_id) ?? null,
        });
      }),
      status: "ok",
    };
  } catch (error) {
    unstable_rethrow(error);
    logReadFailure("fee notices", error);
    return { status: "error" };
  }
}
