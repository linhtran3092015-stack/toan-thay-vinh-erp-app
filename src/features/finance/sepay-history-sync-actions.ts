"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/types/database.generated";
import {
  fetchSepayApiV2TransactionsPage,
  toSepayApiV2BatchTransaction,
  type SepayApiV2PageResult,
} from "./sepay-api-v2";

const MAX_SYNC_PAGES = 10;
const MAX_SYNC_TRANSACTIONS_PER_ACCOUNT = MAX_SYNC_PAGES * 100;
const STALE_SYNC_RUN_AFTER_MS = 20 * 60_000;

const historySyncInputSchema = z.object({
  accountVersionIds: z.array(z.string().uuid()).min(1).max(2),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  syncSessionId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  const from = Date.parse(`${value.dateFrom}T00:00:00Z`);
  const to = Date.parse(`${value.dateTo}T00:00:00Z`);
  const days = (to - from) / 86_400_000;
  if (!Number.isFinite(days) || days < 0 || days > 30) {
    context.addIssue({
      code: "custom",
      message: "Khoảng đồng bộ phải từ 1 đến 31 ngày.",
      path: ["dateTo"],
    });
  }
});

const batchResultSchema = z.object({
  already_processed: z.boolean(),
  completed: z.boolean(),
  duplicates: z.number().int().nonnegative(),
  linked: z.number().int().nonnegative(),
  manual_review: z.number().int().nonnegative(),
  pages_processed: z.number().int().nonnegative(),
  recorded: z.number().int().nonnegative(),
  seen: z.number().int().nonnegative(),
  total_available: z.number().int().nonnegative(),
});

interface SyncAccount {
  accountDisplayName: string;
  accountNumber: string;
  bankCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  id: string;
  purpose: "new_enrollment" | "renewal";
  sepayBankAccountId: string;
}

interface SyncRun {
  account_version_id: string;
  date_from: string;
  date_to: string;
  duplicate_count: number;
  id: string;
  linked_count: number;
  manual_review_count: number;
  pages_processed: number;
  recorded_count: number;
  requested_by: string;
  status: string;
  total_available: number;
  total_seen: number;
}

function getVietnamDateOffset(offsetDays: number): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export type SepayHistorySyncActionResult =
  | {
      accounts: Array<{
        accountVersionId: string;
        label: string;
        totalAvailable: number;
      }>;
      message: string;
      ok: true;
      continuationRequired: boolean;
    }
  | { message: string; ok: false; retryable?: boolean };

function getFetchErrorMessage(result: Extract<SepayApiV2PageResult, { ok: false }>): string {
  switch (result.error) {
    case "configuration":
      return "Hệ thống chưa được cấu hình khóa kết nối SePay API.";
    case "unauthorized":
      return "SePay từ chối khóa kết nối. Vui lòng kiểm tra lại API token.";
    case "rate_limited":
      return `SePay đang giới hạn lượt truy cập${result.retryAfterSeconds ? `; thử lại sau ${result.retryAfterSeconds} giây` : ""}.`;
    case "invalid_response":
      return "Dữ liệu SePay trả về không đúng định dạng dự kiến.";
    case "request_failed":
      return "Không thể kết nối SePay. Vui lòng thử lại sau.";
  }
}

async function authorizeAndLoadAccounts(
  input: unknown,
): Promise<
  | { accounts: SyncAccount[]; actorId: string; dateFrom: string; dateTo: string; ok: true; syncSessionId?: string }
  | { message: string; ok: false }
> {
  const parsed = historySyncInputSchema.safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Khoảng ngày hoặc tài khoản không hợp lệ.", ok: false };
  }
  if (parsed.data.dateTo >= getVietnamDateOffset(0)) {
    return { message: "Để không tranh luồng webhook trực tiếp, lịch sử chỉ được đồng bộ đến hết ngày hôm qua.", ok: false };
  }

  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("sepay.sync_history.manage")) {
    return { message: "Tài khoản hiện tại không có quyền đồng bộ lịch sử SePay.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: userData, error: userError }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("sepay_receiving_account_versions")
      .select("id,purpose,bank_code,account_number,account_display_name,effective_from,effective_to,sepay_bank_account_id,status")
      .in("id", parsed.data.accountVersionIds),
  ]);

  if (userError || !userData.user || error || !data) {
    return { message: "Không thể xác minh người thao tác hoặc tài khoản nhận.", ok: false };
  }

  const accounts = data.flatMap((row): SyncAccount[] => {
    if (
      (row.purpose !== "new_enrollment" && row.purpose !== "renewal")
      || !row.sepay_bank_account_id
      || row.status !== "active"
    ) return [];
    return [{
      accountDisplayName: row.account_display_name,
      accountNumber: row.account_number,
      bankCode: row.bank_code,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      id: row.id,
      purpose: row.purpose,
      sepayBankAccountId: row.sepay_bank_account_id,
    }];
  });

  if (accounts.length !== parsed.data.accountVersionIds.length) {
    return { message: "Có tài khoản chưa được gắn ID SePay API hoặc không còn tồn tại.", ok: false };
  }

  const outsideVersion = accounts.some((account) => (
    parsed.data.dateFrom < account.effectiveFrom
    || (account.effectiveTo !== null && parsed.data.dateTo > account.effectiveTo)
  ));
  if (outsideVersion) {
    return { message: "Khoảng ngày phải nằm trọn trong thời gian hiệu lực của từng tài khoản đã chọn.", ok: false };
  }

  return {
    accounts,
    actorId: userData.user.id,
    dateFrom: parsed.data.dateFrom,
    dateTo: parsed.data.dateTo,
    ok: true,
    syncSessionId: parsed.data.syncSessionId,
  };
}

function accountLabel(account: SyncAccount): string {
  return `${account.purpose === "renewal" ? "Tái phí" : "Tuyển mới"} · ${account.bankCode} · ${account.accountNumber}`;
}

function normalizeAccountNumber(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export async function previewSepayHistorySyncAction(
  input: unknown,
): Promise<SepayHistorySyncActionResult> {
  const authorized = await authorizeAndLoadAccounts(input);
  if (!authorized.ok) return authorized;

  const previews = await Promise.all(authorized.accounts.map(async (account) => {
    const result = await fetchSepayApiV2TransactionsPage({
      bankAccountId: account.sepayBankAccountId,
      dateFrom: `${authorized.dateFrom} 00:00:00`,
      dateTo: `${authorized.dateTo} 23:59:59`,
      page: 1,
      perPage: 100,
    });
    return { account, result };
  }));

  const failed = previews.find((preview) => !preview.result.ok);
  if (failed && !failed.result.ok) {
    return { message: `${accountLabel(failed.account)}: ${getFetchErrorMessage(failed.result)}`, ok: false };
  }

  const oversized = previews.find((preview) => (
    preview.result.ok && preview.result.total > MAX_SYNC_TRANSACTIONS_PER_ACCOUNT
  ));
  if (oversized) {
    return {
      message: `${accountLabel(oversized.account)} có trên ${MAX_SYNC_TRANSACTIONS_PER_ACCOUNT.toLocaleString("vi-VN")} giao dịch. Hãy chia khoảng ngày ngắn hơn.`,
      ok: false,
    };
  }

  const accounts = previews.flatMap((preview) => preview.result.ok ? [{
    accountVersionId: preview.account.id,
    label: accountLabel(preview.account),
    totalAvailable: preview.result.total,
  }] : []);
  const total = accounts.reduce((sum, account) => sum + account.totalAvailable, 0);

  return {
    accounts,
    continuationRequired: false,
    message: `SePay có ${total} giao dịch trong khoảng đã chọn. Xem lại số lượng trước khi xác nhận nhập.`,
    ok: true,
  };
}

export async function syncSepayHistoryAction(
  input: unknown,
): Promise<SepayHistorySyncActionResult> {
  const authorized = await authorizeAndLoadAccounts(input);
  if (!authorized.ok) return authorized;
  if (!authorized.syncSessionId) {
    return { message: "Phiên đồng bộ không hợp lệ. Vui lòng xem trước lại dữ liệu.", ok: false };
  }

  const service = createSupabaseServiceRoleClient();
  const selectedAccountIds = new Set(authorized.accounts.map((account) => account.id));
  const runColumns = "id,account_version_id,requested_by,date_from,date_to,status,total_available,total_seen,recorded_count,duplicate_count,linked_count,manual_review_count,pages_processed";
  const { data: sessionRunData, error: sessionRunError } = await service
    .from("sepay_sync_runs")
    .select(runColumns)
    .eq("sync_session_id", authorized.syncSessionId);
  if (sessionRunError || !sessionRunData) {
    return { message: "Không thể đọc tiến độ của phiên đồng bộ.", ok: false, retryable: true };
  }

  const sessionRuns = sessionRunData as SyncRun[];
  const sessionMismatch = sessionRuns.some((run) => (
    run.requested_by !== authorized.actorId
    || run.date_from !== authorized.dateFrom
    || run.date_to !== authorized.dateTo
    || !selectedAccountIds.has(run.account_version_id)
  ));
  if (sessionMismatch) {
    return { message: "Phiên đồng bộ không khớp người thao tác, khoảng ngày hoặc tài khoản đã chọn.", ok: false };
  }

  const runsByAccount = new Map(sessionRuns.map((run) => [run.account_version_id, run]));
  let targetAccount: SyncAccount | null = null;
  let targetRun: SyncRun | null = null;

  for (const account of authorized.accounts) {
    let run = runsByAccount.get(account.id) ?? null;
    if (run?.status === "failed") {
      return { message: `${accountLabel(account)} đã dừng do lỗi. Vui lòng xem trước lại để bắt đầu phiên mới.`, ok: false };
    }
    if (run?.status === "completed") continue;

    if (!run) {
      const { error: staleRunError } = await service
        .from("sepay_sync_runs")
        .update({
          completed_at: new Date().toISOString(),
          error_code: "STALE_SYNC_RUN_RECOVERED",
          status: "failed",
        })
        .eq("account_version_id", account.id)
        .eq("status", "running")
        .neq("sync_session_id", authorized.syncSessionId)
        .lt("started_at", new Date(Date.now() - STALE_SYNC_RUN_AFTER_MS).toISOString());
      if (staleRunError) {
        return { message: `Không thể kiểm tra lần đồng bộ trước của ${accountLabel(account)}.`, ok: false, retryable: true };
      }

      const { data: insertedRun, error: runError } = await service
        .from("sepay_sync_runs")
        .insert({
          account_version_id: account.id,
          date_from: authorized.dateFrom,
          date_to: authorized.dateTo,
          requested_by: authorized.actorId,
          status: "running",
          sync_session_id: authorized.syncSessionId,
        })
        .select(runColumns)
        .single();
      if (runError || !insertedRun) {
        return {
          message: runError?.code === "23505"
            ? `${accountLabel(account)} đang có một lần đồng bộ khác. Vui lòng chờ hoàn tất hoặc thử lại sau 20 phút.`
            : `Không thể tạo nhật ký đồng bộ cho ${accountLabel(account)}.`,
          ok: false,
        };
      }
      run = insertedRun as SyncRun;
      runsByAccount.set(account.id, run);
    }

    targetAccount = account;
    targetRun = run;
    break;
  }

  const getSummaries = () => authorized.accounts.map((account) => ({
    accountVersionId: account.id,
    label: accountLabel(account),
    totalAvailable: runsByAccount.get(account.id)?.total_available ?? 0,
  }));

  if (!targetAccount || !targetRun) {
    revalidatePath("/finance/sepay");
    return {
      accounts: getSummaries(),
      continuationRequired: false,
      message: "Đã nhập lịch sử SePay ở chế độ chỉ ghi nhận. Các giao dịch chưa được tự động ghi học phí hay tạo đơn hàng.",
      ok: true,
    };
  }

  const page = targetRun.pages_processed + 1;
  if (page > MAX_SYNC_PAGES) {
    await service
      .from("sepay_sync_runs")
      .update({
        completed_at: new Date().toISOString(),
        error_code: "SEPAY_SYNC_PAGE_LIMIT_EXCEEDED",
        status: "failed",
      })
      .eq("id", targetRun.id)
      .eq("status", "running");
    return {
      message: `${accountLabel(targetAccount)} có trên ${MAX_SYNC_TRANSACTIONS_PER_ACCOUNT.toLocaleString("vi-VN")} giao dịch. Hãy chia khoảng ngày ngắn hơn.`,
      ok: false,
    };
  }

  const result = await fetchSepayApiV2TransactionsPage({
    bankAccountId: targetAccount.sepayBankAccountId,
    dateFrom: `${authorized.dateFrom} 00:00:00`,
    dateTo: `${authorized.dateTo} 23:59:59`,
    page,
    perPage: 100,
  });
  if (!result.ok) {
    return {
      message: `${accountLabel(targetAccount)}: ${getFetchErrorMessage(result)} Tiến độ đã lưu; có thể bấm xác nhận để tiếp tục từ trang ${page}.`,
      ok: false,
      retryable: true,
    };
  }

  let terminalFailure = "";
  if (result.page !== page || (result.hasMore && result.data.length === 0)) {
    terminalFailure = "SePay trả về thông tin phân trang không nhất quán.";
  } else if (result.total > MAX_SYNC_TRANSACTIONS_PER_ACCOUNT || (result.hasMore && page === MAX_SYNC_PAGES)) {
    terminalFailure = `Khoảng ngày có trên ${MAX_SYNC_TRANSACTIONS_PER_ACCOUNT.toLocaleString("vi-VN")} giao dịch. Hãy chia thành khoảng ngắn hơn.`;
  } else if (result.data.some((transaction) => (
    transaction.bank_account_id !== targetAccount.sepayBankAccountId
    || normalizeAccountNumber(transaction.account_number) !== normalizeAccountNumber(targetAccount.accountNumber)
  ))) {
    terminalFailure = "ID SePay API và số tài khoản nhận không khớp cấu hình đã chọn.";
  }

  const normalized = result.data.map(toSepayApiV2BatchTransaction);
  if (!terminalFailure && normalized.some((transaction) => transaction === null)) {
    terminalFailure = "Có giao dịch SePay chứa thời gian không hợp lệ.";
  }
  if (terminalFailure) {
    const { error: failRunError } = await service
      .from("sepay_sync_runs")
      .update({
        completed_at: new Date().toISOString(),
        error_code: terminalFailure,
        status: "failed",
      })
      .eq("id", targetRun.id)
      .eq("status", "running");
    return {
      message: failRunError
        ? `${accountLabel(targetAccount)} đã dừng nhưng không thể cập nhật nhật ký đồng bộ.`
        : `${accountLabel(targetAccount)}: ${terminalFailure}`,
      ok: false,
    };
  }

  const { data: pageData, error: pageError } = await service.rpc(
    "ingest_sepay_api_v2_sync_page",
    {
      p_expected_page: page,
      p_has_more: result.hasMore,
      p_sync_run_id: targetRun.id,
      p_total_available: result.total,
      p_transactions: normalized as unknown as Json,
    },
  );
  const pageResult = batchResultSchema.safeParse(pageData);
  if (pageError || !pageResult.success) {
    return {
      message: `${accountLabel(targetAccount)}: không thể lưu trang ${page}. Tiến độ trước đó vẫn được giữ nguyên để thử lại.`,
      ok: false,
      retryable: true,
    };
  }

  runsByAccount.set(targetAccount.id, {
    ...targetRun,
    duplicate_count: pageResult.data.duplicates,
    linked_count: pageResult.data.linked,
    manual_review_count: pageResult.data.manual_review,
    pages_processed: pageResult.data.pages_processed,
    recorded_count: pageResult.data.recorded,
    status: pageResult.data.completed ? "completed" : "running",
    total_available: pageResult.data.total_available,
    total_seen: pageResult.data.seen,
  });

  const continuationRequired = !pageResult.data.completed
    || authorized.accounts.some((account) => runsByAccount.get(account.id)?.status !== "completed");
  if (continuationRequired) {
    return {
      accounts: getSummaries(),
      continuationRequired: true,
      message: `Đã lưu trang ${page} của ${accountLabel(targetAccount)}. Hệ thống đang tiếp tục từ tiến độ đã lưu.`,
      ok: true,
    };
  }

  revalidatePath("/finance/sepay");
  return {
    accounts: getSummaries(),
    continuationRequired: false,
    message: "Đã nhập lịch sử SePay ở chế độ chỉ ghi nhận. Các giao dịch chưa được tự động ghi học phí hay tạo đơn hàng.",
    ok: true,
  };
}
