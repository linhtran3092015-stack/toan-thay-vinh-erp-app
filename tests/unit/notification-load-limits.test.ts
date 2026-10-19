// Value: protects=the notification page window the loader reads (.range) and the route's "Cũ hơn" heuristic use the same NOTIFICATION_PAGE_SIZE (50), the page cap (100000) is one NOTIFICATION_MAX_PAGE shared by the loader's clamp and the route's ?page= parse, and the loader's query is otherwise unchanged (same columns, order, clamp);
// fails_when=data.ts goes back to a literal or a different size, the route compares the row count with anything else, the window for a page shifts, the loader or the page parse goes back to a bare 100000 (or a different cap), or the select/order/clamp changes in a presentation step;
// why_new=step 14d replaces the three hard-coded 50s and the three bare 100000 caps with constants (finance-load-limits.test.ts pattern); seam=source text of data.ts, notification-models.ts and the route, plus the loader run against a recording Supabase stub; no_claim=what the database returns or RLS
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getNotificationsResult } from "@/features/notifications/data";
import { NOTIFICATION_MAX_PAGE, NOTIFICATION_PAGE_SIZE } from "@/features/notifications/notification-models";

const calls = vi.hoisted(() => ({ from: vi.fn(), order: vi.fn(), range: vi.fn(), select: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => {
    const query = {
      order: (...args: unknown[]) => {
        calls.order(...args);
        return query;
      },
      range: async (...args: unknown[]) => {
        calls.range(...args);
        return { data: [], error: null };
      },
      select: (...args: unknown[]) => {
        calls.select(...args);
        return query;
      },
    };
    return {
      from: (...args: unknown[]) => {
        calls.from(...args);
        return query;
      },
    };
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const dataSource = readFileSync(join(process.cwd(), "src/features/notifications/data.ts"), "utf8");
const routeSource = readFileSync(join(process.cwd(), "src/app/(app)/notifications/page.tsx"), "utf8");
const modelsSource = readFileSync(join(process.cwd(), "src/features/notifications/notification-models.ts"), "utf8");

/** The body of one exported loader, up to the next exported function. */
function loaderBody(name: string): string {
  const start = dataSource.indexOf(`export async function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = dataSource.indexOf("export async function ", start + 1);
  return dataSource.slice(start, next === -1 ? undefined : next);
}

describe("notification page size", () => {
  it("is 50 rows", () => {
    expect(NOTIFICATION_PAGE_SIZE).toBe(50);
  });

  it("the list read's .range window uses NOTIFICATION_PAGE_SIZE and NOTIFICATION_MAX_PAGE for both bounds, with no literal size or cap left", () => {
    const body = loaderBody("getNotificationsResult");
    expect(body).toContain(
      ".range((Math.max(1, Math.min(NOTIFICATION_MAX_PAGE, page)) - 1) * NOTIFICATION_PAGE_SIZE, Math.max(1, Math.min(NOTIFICATION_MAX_PAGE, page)) * NOTIFICATION_PAGE_SIZE - 1)",
    );
    expect(body).not.toMatch(/\*\s*50\b/);
    expect(dataSource).not.toMatch(/\b100000\b/);
    expect(dataSource).toContain('import { NOTIFICATION_MAX_PAGE, NOTIFICATION_PAGE_SIZE } from "@/features/notifications/notification-models";');
  });

  it("the page cap is 100000, declared once and used by the ?page= parse", () => {
    expect(NOTIFICATION_MAX_PAGE).toBe(100000);
    expect(modelsSource.match(/\b100000\b/g)).toEqual(["100000"]);
    expect(modelsSource).toContain("export const NOTIFICATION_MAX_PAGE = 100000;");
    expect(modelsSource).toContain("Math.max(1, Math.min(NOTIFICATION_MAX_PAGE, requestedPage))");
    expect(routeSource).not.toMatch(/\b100000\b/);
  });

  it("the route offers an older page exactly when the loaded page is full", () => {
    expect(routeSource).toContain("hasNextPage={notificationsResult.data.length === NOTIFICATION_PAGE_SIZE}");
    expect(routeSource).not.toMatch(/===\s*50\b/);
  });

  it.each([
    [1, 0, 49],
    [3, 100, 149],
    [0, 0, 49],
    [200000, 4999950, 4999999],
  ])("page %d reads rows %d–%d, newest first, with the same columns", async (page, from, to) => {
    await getNotificationsResult(page);

    expect(calls.from).toHaveBeenCalledWith("notifications");
    expect(calls.select).toHaveBeenCalledWith("id,event_code,title,message,href,entity_type,entity_id,read_at,created_at");
    expect(calls.order.mock.calls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(calls.range).toHaveBeenCalledExactlyOnceWith(from, to);
  });
});
