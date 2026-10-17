import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getSalesCommissionAccrualsDashboardResult } from "@/features/commissions/data";

const dependencies = vi.hoisted(() => ({ rpc: vi.fn() }));

// Only the behavior test below reaches the client; the source checks read the file.
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ rpc: dependencies.rpc })) }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Commission reader normalization", () => {
  it("maps stored source-group and status values directly instead of coercing unknown values", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/commissions/data.ts"),
      "utf8",
    );

    expect(source).toContain("leadSourceGroup: entry.lead_source_group");
    expect(source).toContain("status: entry.accrual_status");
    expect(source).not.toContain("normalizeLeadSourceGroup");
    expect(source).not.toMatch(/status:\s*"provisional"/);
  });

  // Value: protects=the loader sends the RPC's own default p_limit 200 when called without a limit and passes the caller's cap through unchanged (the /commissions route asks for 500); fails_when=the default drifts from 200 (e.g. the shared COMMISSIONS_DEFAULT_LIMIT changes) or the loader hardcodes/clamps p_limit; why_new=replaces a source regex on `limit = 200` that broke as soon as the default became the shared constant; seam=@/lib/supabase/server mocked to a client exposing only `rpc` (grading-credits-route precedent); no_claim=the RPC's own 1-500 range check or the row mapping
  it("passes the caller's row cap to the RPC and keeps 200 as the default", async () => {
    dependencies.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getSalesCommissionAccrualsDashboardResult()).resolves.toEqual({ data: [], ok: true });
    expect(dependencies.rpc).toHaveBeenLastCalledWith("get_sales_commission_accruals_dashboard", { p_limit: 200 });

    await getSalesCommissionAccrualsDashboardResult(500);
    expect(dependencies.rpc).toHaveBeenLastCalledWith("get_sales_commission_accruals_dashboard", { p_limit: 500 });
    expect(dependencies.rpc).toHaveBeenCalledTimes(2);
  });
});
