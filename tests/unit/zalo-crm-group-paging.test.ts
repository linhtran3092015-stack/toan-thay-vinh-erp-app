// Value: protects=bulk linking reads every group of the center nick 100 at a time, says when it stopped early, and fails instead of matching a partial list;
// fails_when=page size drifts from the CRM cap of 100 (then it stops after page 1), an empty extra page is fetched, truncated is wrong, or errors are ignored;
// why_new=listAllZaloGroups had no test, and the bulk link page and its checklist rely on its groups/total/truncated;
// seam=none; no_claim=does not prove the real ZaloCRM API pages this way or the 15 s per-call timeout
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAllZaloGroups } from "@/lib/zalo-crm";

function conversations(page: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    externalThreadId: `thread-${page}-${index}`,
    groupAvatarUrl: null,
    groupMembersCount: 3,
    groupName: `Nhom mau ${page}-${index}`,
    id: `conv-${page}-${index}`,
    lastMessageAt: null,
    zaloAccountId: "acc-test",
  }));
}

/** ZaloCRM stub: `sizes[page - 1]` conversations per page; a number in `failAt` answers HTTP 500. */
function stubCrm(total: number, sizes: number[], failAt?: number) {
  const fetchMock = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams;
    const page = Number(params.get("page"));
    if (page === failAt) return new Response(JSON.stringify({ error: "CRM tam thoi loi." }), { status: 500 });
    return new Response(JSON.stringify({ conversations: conversations(page, sizes[page - 1] ?? 0), total }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedPages(fetchMock: ReturnType<typeof stubCrm>) {
  return fetchMock.mock.calls.map(([url]) => {
    const params = new URL(url).searchParams;
    return `${params.get("page")}:${params.get("limit")}:${params.get("zaloAccountId")}:${params.get("threadType")}`;
  });
}

beforeEach(() => {
  vi.stubEnv("ZALOCRM_BASE_URL", "https://crm.example.test");
  vi.stubEnv("ZALOCRM_API_KEY", "test-key-not-real");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("listAllZaloGroups", () => {
  it("reads every page of 100 and stops, truncates or fails at the right page", async () => {
    // Short last page: three requests, everything read.
    let fetchMock = stubCrm(250, [100, 100, 50]);
    let result = await listAllZaloGroups("acc-test");
    expect(requestedPages(fetchMock)).toEqual(["1:100:acc-test:group", "2:100:acc-test:group", "3:100:acc-test:group"]);
    expect(result).toEqual({ data: { groups: expect.any(Array), total: 250, truncated: false }, ok: true });
    expect(new Set(result.ok ? result.data.groups.map((group) => group.externalThreadId) : []).size).toBe(250);

    // Total reached on a full page: no extra request for an empty page.
    fetchMock = stubCrm(200, [100, 100]);
    result = await listAllZaloGroups("acc-test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok && result.data).toMatchObject({ total: 200, truncated: false });

    // Page cap hit before the total: says so.
    fetchMock = stubCrm(500, [100, 100, 100, 100, 100]);
    result = await listAllZaloGroups("acc-test", 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok && result.data.groups).toHaveLength(200);
    expect(result.ok && result.data).toMatchObject({ total: 500, truncated: true });

    // An error mid-way fails the whole read (no partial list to match against).
    fetchMock = stubCrm(250, [100, 100, 50], 2);
    result = await listAllZaloGroups("acc-test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ error: "CRM tam thoi loi.", ok: false });
  });
});
