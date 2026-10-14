// Value: protects=getSepayTransactionsResult survives a stale ?page= past the last row (PostgREST PGRST103) by returning an empty page with the real filtered total, keeps a stable id tiebreaker after transaction_at, and reports a failed review count as null instead of 0;
// fails_when=PGRST103 turns the whole SePay page into an error, the fallback count drops the purpose/review filters, the tiebreaker order disappears, or a failed review count reads as "nothing waiting";
// why_new=adversarial review on step 7b; the route tests mock this loader;
// seam=Supabase server client mocked as chainable thenables, one result per from() call in call order; no_claim=that PostgREST really answers PGRST103 here or that the SQL filters match RLS
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { count?: number | null; data?: unknown[] | null; error: { code?: string; message: string } | null };

const db = vi.hoisted(() => ({
  builders: [] as { calls: [string, unknown[]][]; table: string }[],
  results: [] as Result[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      const record = { calls: [] as [string, unknown[]][], table };
      const result = db.results[db.builders.length];
      db.builders.push(record);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "order", "range", "eq", "in"]) {
        builder[method] = (...args: unknown[]) => {
          record.calls.push([method, args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  }),
}));

import { getSepayTransactionsResult } from "@/features/finance/data";

beforeEach(() => {
  db.builders = [];
  db.results = [];
});

describe("getSepayTransactionsResult", () => {
  it("orders by transaction_at then id, both newest first", async () => {
    db.results = [{ count: 0, data: [], error: null }, { count: 2, error: null }];

    await expect(getSepayTransactionsResult()).resolves.toMatchObject({ data: { reviewCount: 2, total: 0, transactions: [] }, ok: true });
    const orders = db.builders[0].calls.filter(([method]) => method === "order").map(([, args]) => args);
    expect(orders).toEqual([["transaction_at", { ascending: false }], ["id", { ascending: false }]]);
  });

  it("returns an empty page with the filtered total when the offset is past the last row", async () => {
    db.results = [
      { count: null, data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } },
      { count: 7, error: null },
      { count: 12, error: null },
    ];

    await expect(getSepayTransactionsResult("renewal", 3, "review")).resolves.toEqual({
      data: { page: 3, pageSize: 50, reviewCount: 7, total: 12, transactions: [] },
      ok: true,
    });
    const fallback = db.builders[2];
    expect(fallback.table).toBe("sepay_transactions");
    expect(fallback.calls).toContainEqual(["select", ["id", { count: "exact", head: true }]]);
    expect(fallback.calls).toContainEqual(["eq", ["account_purpose", "renewal"]]);
    expect(fallback.calls).toContainEqual(["in", ["match_status", ["unmatched", "amount_mismatch", "account_purpose_mismatch", "identity_conflict"]]]);
    expect(fallback.calls).toContainEqual(["eq", ["transfer_type", "in"]]);
  });

  it("still fails on other errors and on a failed fallback count", async () => {
    db.results = [{ data: null, error: { code: "42501", message: "denied" } }, { count: 1, error: null }];
    await expect(getSepayTransactionsResult()).resolves.toEqual({ ok: false });

    db.builders = [];
    db.results = [
      { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } },
      { count: 1, error: null },
      { count: null, error: { message: "boom" } },
    ];
    await expect(getSepayTransactionsResult("", 2)).resolves.toEqual({ ok: false });
  });

  it("reports a failed review count as null, not zero", async () => {
    db.results = [{ count: 0, data: [], error: null }, { count: null, error: { message: "boom" } }];
    await expect(getSepayTransactionsResult()).resolves.toMatchObject({ data: { reviewCount: null }, ok: true });
  });
});
