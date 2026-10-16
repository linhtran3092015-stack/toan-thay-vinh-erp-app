// Value: protects=the draft lock caption and class names: latest template version by published_at, the single active renewal account on ends_on, independent reads;
// fails_when=an ambiguous, inactive, expired, future or admissions account is named, an older version is named, one failed read blanks the rest, or logs carry rows;
// why_new=readiness-data.ts is new in step 13 (the draft page's lock caption and class names) and the period route test mocks it out whole;
// seam=none; no_claim=does not prove PostgREST parses these filters, what RLS returns for classes, or that the lock itself picks the same account (tests/database)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TuitionPeriodListItem } from "@/features/tuition/data";
import { getTuitionReadinessContext } from "@/features/tuition/readiness-data";

const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = {
    calls: [] as Array<{ ops: unknown[][]; table: string }>,
    failTables: new Map<string, { code: string; message: string }>(),
    tables: {} as Record<string, Row[]>,
  };
  const present = (value: unknown) => value !== null && value !== undefined;
  /** `col.is.null,col.gte.v` → one predicate (the forms readiness-data sends). */
  const orFilter = (expression: string) => {
    const clauses = expression.split(",").map((clause) => {
      const [column, operator, ...rest] = clause.split(".");
      const value = rest.join(".");
      if (operator === "is" && value === "null") return (row: Row) => !present(row[column]);
      if (operator === "gte") return (row: Row) => present(row[column]) && String(row[column]) >= value;
      if (operator === "lte") return (row: Row) => present(row[column]) && String(row[column]) <= value;
      throw new Error(`unsupported or clause ${clause}`);
    });
    return (row: Row) => clauses.some((matches) => matches(row));
  };
  /** Chainable PostgREST stand-in that applies this request's own filters, order and limit. */
  const from = (table: string) => {
    const call = { ops: [] as unknown[][], table };
    state.calls.push(call);
    const filters: Array<(row: Row) => boolean> = [];
    let sort: { ascending: boolean; column: string } | null = null;
    let limit: number | null = null;
    const builder: Record<string, unknown> = {
      eq: (column: string, value: unknown) => (call.ops.push(["eq", column, value]), filters.push((row) => row[column] === value), builder),
      in: (column: string, values: unknown[]) => (call.ops.push(["in", column, values]), filters.push((row) => values.includes(row[column])), builder),
      limit: (count: number) => ((limit = count), builder),
      lte: (column: string, value: string) => (
        call.ops.push(["lte", column, value]), filters.push((row) => present(row[column]) && String(row[column]) <= value), builder
      ),
      or: (expression: string) => (call.ops.push(["or", expression]), filters.push(orFilter(expression)), builder),
      order: (column: string, options: { ascending?: boolean } = {}) => ((sort = { ascending: options.ascending !== false, column }), builder),
      select: (columns: string) => (call.ops.push(["select", columns]), builder),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        const failure = state.failTables.get(table);
        if (failure) return Promise.resolve({ data: null, error: failure }).then(resolve, reject);
        let rows = (state.tables[table] ?? []).filter((row) => filters.every((matches) => matches(row)));
        if (sort) {
          const { ascending, column } = sort;
          rows = [...rows].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : String(a[column]) > String(b[column]) ? 1 : 0) * (ascending ? 1 : -1));
        }
        if (limit !== null) rows = rows.slice(0, limit);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };
  return { from, state };
});

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ from: db.from })) }));

const CLASSES = "classes";
const VERSIONS = "tuition_receipt_template_versions";
const ACCOUNTS = "sepay_receiving_account_versions";

const period: TuitionPeriodListItem = { dueOn: "2026-11-15", endsOn: "2026-11-30", id: "nov", name: "Học phí tháng 11/2026", startsOn: "2026-11-01", status: "draft" };

const account = (bankCode: string, accountNumber: string, overrides: Record<string, unknown> = {}) => ({
  account_number: accountNumber,
  bank_code: bankCode,
  effective_from: "2026-09-01",
  effective_to: null,
  purpose: "renewal",
  status: "active",
  ...overrides,
});

function seed() {
  db.state.tables = {
    [ACCOUNTS]: [
      account("MB", "0399886886"),
      // None of these is the renewal account the lock would use on 30/11/2026.
      account("VCB", "1111", { effective_from: "2026-01-01", effective_to: "2026-08-31" }),
      account("TCB", "2222", { effective_from: "2026-12-01" }),
      account("ACB", "3333", { status: "inactive" }),
      account("BIDV", "4444", { purpose: "new_enrollment" }),
    ],
    [CLASSES]: [
      { id: "c1", name: "Toán 9A" },
      { id: "c2", name: "Luyện thi T9C" },
      { id: "c3", name: "Toán 8B" },
    ],
    // Not in publish order: the lock snapshots the latest by published_at.
    [VERSIONS]: [
      { published_at: "2026-08-28T02:05:00Z", version_number: 2 },
      { published_at: "2026-09-25T03:12:00Z", version_number: 3 },
      { published_at: "2026-07-30T01:00:00Z", version_number: 1 },
    ],
  };
}

beforeEach(() => {
  seed();
  db.state.calls = [];
  db.state.failTables.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTuitionReadinessContext", () => {
  it("returns the readable class names, the latest template version and the one renewal account effective on ends_on", async () => {
    await expect(getTuitionReadinessContext(period, ["c1", "c2", "c1", "c-hidden"])).resolves.toEqual({
      classNames: { c1: "Toán 9A", c2: "Luyện thi T9C" },
      renewalAccount: { accountNumber: "0399886886", bankCode: "MB" },
      templateVersion: 3,
    });
    const classQuery = db.state.calls.find((call) => call.table === CLASSES);
    expect(classQuery?.ops.find(([op]) => op === "in")).toEqual(["in", "id", ["c1", "c2", "c-hidden"]]);
  });

  it("names no renewal account when two are effective on ends_on (the lock refuses) or none is", async () => {
    // Ends exactly on ends_on: still effective, so the period has two accounts.
    db.state.tables[ACCOUNTS].push(account("VPB", "5555", { effective_from: "2026-11-01", effective_to: "2026-11-30" }));
    expect((await getTuitionReadinessContext(period, [])).renewalAccount).toBeNull();

    db.state.tables[ACCOUNTS] = db.state.tables[ACCOUNTS].filter((row) => row.bank_code !== "MB" && row.bank_code !== "VPB");
    expect((await getTuitionReadinessContext(period, [])).renewalAccount).toBeNull();
  });

  it("keeps the other parts when one read fails and logs only the part, code and message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.state.failTables.set(CLASSES, { code: "42501", message: "permission denied for table classes" });

    await expect(getTuitionReadinessContext(period, ["c1"])).resolves.toEqual({
      classNames: {},
      renewalAccount: { accountNumber: "0399886886", bankCode: "MB" },
      templateVersion: 3,
    });
    expect(log).toHaveBeenCalledWith("TUITION_READINESS_CONTEXT_FAILED", "classes", "42501", "permission denied for table classes");

    db.state.failTables.clear();
    db.state.failTables.set(VERSIONS, { code: "PGRST000", message: "timeout" });
    db.state.failTables.set(ACCOUNTS, { code: "PGRST000", message: "timeout" });
    await expect(getTuitionReadinessContext(period, ["c1"])).resolves.toEqual({ classNames: { c1: "Toán 9A" }, renewalAccount: null, templateVersion: null });
    for (const args of log.mock.calls) {
      expect(args).toHaveLength(4);
      for (const value of args) expect(typeof value).toBe("string");
    }
  });

  it("reads no classes without class ids and reports no version when none is published", async () => {
    db.state.tables[VERSIONS] = [];
    await expect(getTuitionReadinessContext(period, [])).resolves.toMatchObject({ classNames: {}, templateVersion: null });
    expect(db.state.calls.map((call) => call.table)).not.toContain(CLASSES);
  });
});
