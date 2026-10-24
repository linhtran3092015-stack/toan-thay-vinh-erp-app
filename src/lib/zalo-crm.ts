import "server-only";

import { getZaloCrmEnv } from "@/lib/env";

/** Minimal client for the ZaloCRM public API (fork at crm.vanlinhtran.id.vn, X-Api-Key). */

export interface ZaloCrmAccount {
  displayName: string | null;
  id: string;
  phone: string | null;
  status: string;
  zaloUid: string | null;
}

export interface ZaloCrmGroup {
  externalThreadId: string;
  groupAvatarUrl: string | null;
  groupMembersCount: number | null;
  groupName: string | null;
  id: string;
  lastMessageAt: string | null;
  zaloAccountId: string;
}

export interface ZaloCrmGroupMember {
  displayName: string | null;
  isAdmin: boolean;
  memberUid: string;
  zaloName: string | null;
}

export type ZaloCrmResult<T> = { data: T; ok: true } | { error: string; ok: false };

async function call<T>(path: string, init?: RequestInit): Promise<ZaloCrmResult<T>> {
  const env = getZaloCrmEnv();
  if (!env) return { error: "Chưa cấu hình ZALOCRM_BASE_URL / ZALOCRM_API_KEY.", ok: false };
  try {
    const response = await fetch(`${env.ZALOCRM_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Api-Key": env.ZALOCRM_API_KEY, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => null)) as (T & { code?: string; error?: string }) | null;
    if (!response.ok) {
      return { error: body?.error ?? `ZaloCRM trả về mã ${response.status}.`, ok: false };
    }
    if (!body) return { error: "ZaloCRM không trả dữ liệu.", ok: false };
    return { data: body, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? `Không kết nối được ZaloCRM: ${error.message}` : "Không kết nối được ZaloCRM.", ok: false };
  }
}

export function isZaloCrmConfigured(): boolean {
  return getZaloCrmEnv() !== null;
}

export async function listZaloAccounts(): Promise<ZaloCrmResult<ZaloCrmAccount[]>> {
  const result = await call<{ accounts: ZaloCrmAccount[] }>("/api/public/zalo-accounts");
  return result.ok ? { data: result.data.accounts ?? [], ok: true } : result;
}

export async function searchZaloGroups(input: {
  limit?: number;
  page?: number;
  search?: string;
  zaloAccountId?: string;
}): Promise<ZaloCrmResult<{ groups: ZaloCrmGroup[]; total: number }>> {
  const params = new URLSearchParams({ limit: String(input.limit ?? 20), page: String(input.page ?? 1), threadType: "group" });
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.zaloAccountId) params.set("zaloAccountId", input.zaloAccountId);
  const result = await call<{ conversations: ZaloCrmGroup[]; total: number }>(`/api/public/conversations?${params.toString()}`);
  return result.ok ? { data: { groups: result.data.conversations ?? [], total: result.data.total ?? 0 }, ok: true } : result;
}

/** ZaloCRM caps a page at 100 conversations. */
const GROUP_PAGE_SIZE = 100;
/** Pages read at once after the first one. */
const GROUP_PAGE_CONCURRENCY = 5;
/** One CRM call may run this long (see `call`). */
const CALL_TIMEOUT_MS = 15_000;
/**
 * Paging stops starting new calls once a call could end after this budget,
 * so 25 s + one 15 s call still leaves room inside the page's 60 s limit for
 * the database reads, the nick check and matching.
 */
export const GROUP_READ_BUDGET_MS = 25_000;

type GroupListResult = ZaloCrmResult<{ groups: ZaloCrmGroup[]; total: number; truncated: boolean }>;

/**
 * Every group conversation of one nick: page 1 gives the total, the rest are
 * read 5 at a time. Stops at `maxPages` or when the time budget runs out and
 * says so with `truncated`. The CRM orders by last message, so a group that
 * moves between pages can come back twice: duplicates are dropped by thread id.
 */
export async function listAllZaloGroups(zaloAccountId: string, maxPages = 30, budgetMs = GROUP_READ_BUDGET_MS): Promise<GroupListResult> {
  // Without a nick the CRM would return every nick's groups, and staff could link a group the center nick is not in.
  if (!zaloAccountId.trim()) return { error: "Chưa chọn nick trung tâm.", ok: false };
  const deadline = Date.now() + budgetMs;
  const first = await searchZaloGroups({ limit: GROUP_PAGE_SIZE, page: 1, zaloAccountId });
  if (!first.ok) return first;
  const total = first.data.total;
  const byThread = new Map<string, ZaloCrmGroup>();
  const keep = (groups: ZaloCrmGroup[]) => {
    for (const group of groups) {
      // Do not rely on the CRM honouring the filter: a group of another nick is never offered.
      if (group.zaloAccountId && group.zaloAccountId !== zaloAccountId) continue;
      if (!byThread.has(group.externalThreadId)) byThread.set(group.externalThreadId, group);
    }
  };
  keep(first.data.groups);
  const lastPage = Math.min(maxPages, Math.ceil(total / GROUP_PAGE_SIZE));
  let truncated = Math.ceil(total / GROUP_PAGE_SIZE) > maxPages;
  // Offset paging over a list ordered by last message: a group that moves to page 1 mid-read is
  // missed (its duplicate later is dropped), so fewer distinct groups than `total` is a short read.
  const done = () => ({ data: { groups: [...byThread.values()], total, truncated: truncated || byThread.size < total }, ok: true as const });
  if (first.data.groups.length < GROUP_PAGE_SIZE) return done();
  for (let page = 2; page <= lastPage; page += GROUP_PAGE_CONCURRENCY) {
    if (Date.now() + CALL_TIMEOUT_MS > deadline) {
      truncated = true;
      break;
    }
    const pages = Array.from({ length: Math.min(GROUP_PAGE_CONCURRENCY, lastPage - page + 1) }, (_, index) => page + index);
    const results = await Promise.all(pages.map((number) => searchZaloGroups({ limit: GROUP_PAGE_SIZE, page: number, zaloAccountId })));
    for (const result of results) {
      if (!result.ok) return result;
      keep(result.data.groups);
    }
  }
  return done();
}

/** Group lists for matching, kept 60 s per nick so a refresh after each link does not re-read every page. */
const GROUP_CACHE_TTL_MS = 60_000;
const groupCache = new Map<string, { at: number; result: GroupListResult }>();

export async function listAllZaloGroupsCached(zaloAccountId: string): Promise<GroupListResult> {
  const cached = groupCache.get(zaloAccountId);
  if (cached && Date.now() - cached.at < GROUP_CACHE_TTL_MS) return cached.result;
  const result = await listAllZaloGroups(zaloAccountId);
  // Only complete reads are kept; an error or a truncated read is retried next time.
  if (result.ok && !result.data.truncated) groupCache.set(zaloAccountId, { at: Date.now(), result });
  return result;
}

export async function getZaloGroupByThread(
  externalThreadId: string,
  zaloAccountId?: string,
): Promise<ZaloCrmResult<(ZaloCrmGroup & { zaloAccount?: { archivedAt: string | null; displayName: string | null; status: string } }) | null>> {
  const params = zaloAccountId ? `?zaloAccountId=${encodeURIComponent(zaloAccountId)}` : "";
  const result = await call<{ conversation: ZaloCrmGroup & { zaloAccount?: { archivedAt: string | null; displayName: string | null; status: string } } }>(
    `/api/public/conversations/by-thread/${encodeURIComponent(externalThreadId)}${params}`,
  );
  if (!result.ok) {
    return result.error.includes("not found") ? { data: null, ok: true } : result;
  }
  return { data: result.data.conversation, ok: true };
}

export async function getZaloGroupMembers(externalThreadId: string): Promise<ZaloCrmResult<ZaloCrmGroupMember[]>> {
  const result = await call<{ members: ZaloCrmGroupMember[] }>(`/api/public/groups/${encodeURIComponent(externalThreadId)}/members`);
  return result.ok ? { data: result.data.members ?? [], ok: true } : result;
}

export async function sendZaloMessage(input: {
  content: string;
  threadId: string;
  threadType: "group" | "user";
  zaloAccountId: string;
}): Promise<ZaloCrmResult<{ messageId: string | null }>> {
  const result = await call<{ messageId?: string | null; success: boolean }>("/api/public/messages/send", {
    body: JSON.stringify(input),
    method: "POST",
  });
  if (!result.ok) return result;
  if (!result.data.success) return { error: "ZaloCRM báo gửi không thành công.", ok: false };
  return { data: { messageId: result.data.messageId ?? null }, ok: true };
}
