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

/**
 * Every group conversation of one nick, page by page (bulk linking matches
 * against all of them). Stops after `maxPages` and says so with `truncated`.
 */
export async function listAllZaloGroups(
  zaloAccountId: string,
  maxPages = 30,
): Promise<ZaloCrmResult<{ groups: ZaloCrmGroup[]; total: number; truncated: boolean }>> {
  // Without a nick the CRM would return every nick's groups, and staff could link a group the center nick is not in.
  if (!zaloAccountId.trim()) return { error: "Chưa chọn nick trung tâm.", ok: false };
  const groups: ZaloCrmGroup[] = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await searchZaloGroups({ limit: GROUP_PAGE_SIZE, page, zaloAccountId });
    if (!result.ok) return result;
    total = result.data.total;
    groups.push(...result.data.groups);
    if (result.data.groups.length < GROUP_PAGE_SIZE || groups.length >= total) {
      return { data: { groups, total, truncated: false }, ok: true };
    }
  }
  return { data: { groups, total, truncated: groups.length < total }, ok: true };
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
