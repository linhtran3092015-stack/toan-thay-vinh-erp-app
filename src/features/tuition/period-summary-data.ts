import "server-only";

import { unstable_rethrow } from "next/navigation";

import { fetchPaged, type SupabaseClient } from "@/features/classes/detail/class-detail-data";
import type { TuitionPeriodListItem } from "@/features/tuition/data";
import {
  summarizeTuitionPeriodRows,
  toCurrentTuitionItemRows,
  type TuitionPeriodItemQueryRow,
  type TuitionPeriodItemRow,
  type TuitionPeriodPaymentSummary,
} from "@/features/tuition/period-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAYMENT_SELECT =
  "payment_request:student_payment_requests!tuition_collection_items_payment_request_id_fkey ( status, expected_amount_vnd, paid_amount_vnd )";

function itemSelect(options: { canViewPayments: boolean; withStudent: boolean }): string {
  return [
    "id",
    "period_id",
    "student_id",
    "reissued_from_item_id",
    "payable_amount_vnd",
    options.withStudent ? "payable_sessions, student_snapshot" : null,
    // Without a payment permission RLS hides the requests; do not ask for them.
    options.canViewPayments ? PAYMENT_SELECT : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return typeof error === "string" ? error : "unknown error";
}

/** Read failures are logged with the period id and the message only, never rows. */
function logReadFailure(periodId: string, error: unknown): void {
  console.error("TUITION_SUMMARY_FAILED", periodId, errorMessage(error));
}

/** One period's items; `null` (logged) when a page failed or the read hit fetchPaged's page cap. */
async function loadPeriodItems(
  supabase: SupabaseClient,
  periodId: string,
  options: { canViewPayments: boolean; withStudent: boolean },
): Promise<TuitionPeriodItemQueryRow[] | null> {
  const select = itemSelect(options);
  let pageError: unknown = null;
  const items = await fetchPaged<TuitionPeriodItemQueryRow>(async (from, to) => {
    const result = await (supabase
      .from("tuition_collection_items")
      .select(select)
      .eq("period_id", periodId)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: TuitionPeriodItemQueryRow[] | null; error: unknown }>);
    if (result.error) pageError = result.error;
    return result;
  });
  if (!items) logReadFailure(periodId, pageError ?? "page limit reached");
  return items;
}

/**
 * Collection totals per locked period for the period list. Each period is read
 * on its own so one failed read leaves only that row without numbers
 * (`null`, logged); drafts have no items and get no entry. Next's own control
 * errors (dynamic rendering, redirect, notFound) are re-thrown, never swallowed.
 */
export async function getTuitionPeriodSummaries(
  periods: readonly TuitionPeriodListItem[],
  options: { canViewPayments: boolean; today: string },
): Promise<Record<string, TuitionPeriodPaymentSummary | null>> {
  const locked = periods.filter((period) => period.status === "locked");
  if (locked.length === 0) return {};

  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    unstable_rethrow(error);
    for (const period of locked) logReadFailure(period.id, error);
    return Object.fromEntries(locked.map((period) => [period.id, null]));
  }

  const entries = await Promise.all(
    locked.map(async (period) => {
      try {
        const items = await loadPeriodItems(supabase, period.id, { canViewPayments: options.canViewPayments, withStudent: false });
        if (!items) return [period.id, null] as const;
        const rows = toCurrentTuitionItemRows(items);
        return [period.id, summarizeTuitionPeriodRows(rows, { dueOn: period.dueOn, paymentsVisible: options.canViewPayments, today: options.today })] as const;
      } catch (error) {
        unstable_rethrow(error);
        logReadFailure(period.id, error);
        return [period.id, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

/** The locked period's current items (one per student) with their payment requests; `null` = the read failed (logged). */
export async function getTuitionPeriodItemRows(
  periodId: string,
  options: { canViewPayments: boolean },
): Promise<TuitionPeriodItemRow[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const items = await loadPeriodItems(supabase, periodId, { canViewPayments: options.canViewPayments, withStudent: true });
    return items ? toCurrentTuitionItemRows(items) : null;
  } catch (error) {
    unstable_rethrow(error);
    logReadFailure(periodId, error);
    return null;
  }
}
