import "server-only";

import { z } from "zod";

import { getSepayApiV2Env } from "@/lib/env";

const SEPAY_API_REQUEST_TIMEOUT_MS = 8_000;

const sepayApiV2TransactionSchema = z.object({
  account_number: z.string().trim().min(1),
  amount_in: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  amount_out: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  bank_account_id: z.string().uuid(),
  bank_brand_name: z.string().trim().min(1),
  code: z.string().trim().nullable().optional(),
  id: z.string().uuid(),
  reference_number: z.string().trim().nullable().optional(),
  transaction_content: z.string().trim().min(1),
  transaction_date: z.string().trim().min(1),
  transfer_type: z.enum(["in", "out"]),
  va: z.string().nullable().optional(),
  va_id: z.string().uuid().nullable().optional(),
  webhook_success: z.union([z.literal(0), z.literal(1)]).nullable().optional(),
}).passthrough().superRefine((transaction, context) => {
  const validAmounts = transaction.transfer_type === "in"
    ? transaction.amount_in > 0 && transaction.amount_out === 0
    : transaction.amount_out > 0 && transaction.amount_in === 0;
  if (!validAmounts) {
    context.addIssue({
      code: "custom",
      message: "Transaction amounts do not match transfer_type.",
      path: [transaction.transfer_type === "in" ? "amount_in" : "amount_out"],
    });
  }
});

const sepayApiV2TransactionsResponseSchema = z.object({
  data: z.array(sepayApiV2TransactionSchema),
  meta: z.object({
    pagination: z.object({
      current_page: z.number().int().positive(),
      has_more: z.boolean(),
      last_page: z.number().int().nonnegative().optional(),
      per_page: z.number().int().positive(),
      total: z.number().int().nonnegative(),
    }),
  }),
  status: z.literal("success"),
});

export type SepayApiV2Transaction = z.infer<typeof sepayApiV2TransactionSchema>;

export interface SepayApiV2PageQuery {
  bankAccountId?: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  perPage?: number;
}

export type SepayApiV2PageResult =
  | {
      data: SepayApiV2Transaction[];
      hasMore: boolean;
      ok: true;
      page: number;
      total: number;
    }
  | {
      error: "configuration" | "invalid_response" | "rate_limited" | "request_failed" | "unauthorized";
      ok: false;
      retryAfterSeconds?: number;
    };

export interface SepayApiV2IngestionArgs {
  p_account_number: string;
  p_amount_in: number;
  p_amount_out: number;
  p_body_raw: Record<string, unknown>;
  p_code: string;
  p_content: string;
  p_gateway: string;
  p_reference_number?: string;
  p_sepay_v2_id: string;
  p_transaction_date: string;
  p_transfer_type: "in" | "out";
}

export interface SepayApiV2BatchTransaction {
  account_number: string;
  amount_in: number;
  amount_out: number;
  bank_brand_name: string;
  bank_account_id: string;
  code: string;
  id: string;
  reference_number: string | null;
  transaction_content: string;
  transaction_date: string;
  transfer_type: "in" | "out";
}

type SepayApiV2IngestionClient = {
  rpc: (
    name: "ingest_sepay_api_v2_transaction",
    args: SepayApiV2IngestionArgs,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function toIsoTransactionTimestamp(value: string): string | null {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}+07:00`
    : value;
  const timestamp = Date.parse(normalized);

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export function parseSepayApiV2TransactionsResponse(
  input: unknown,
): z.infer<typeof sepayApiV2TransactionsResponseSchema> | null {
  const result = sepayApiV2TransactionsResponseSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function toSepayApiV2IngestionArgs(
  transaction: SepayApiV2Transaction,
): SepayApiV2IngestionArgs | null {
  const transactionTimestamp = toIsoTransactionTimestamp(transaction.transaction_date);
  if (!transactionTimestamp) return null;

  return {
    p_account_number: transaction.account_number,
    p_amount_in: transaction.amount_in,
    p_amount_out: transaction.amount_out,
    p_body_raw: transaction,
    p_code: transaction.code ?? "",
    p_content: transaction.transaction_content,
    p_gateway: transaction.bank_brand_name,
    p_reference_number: transaction.reference_number ?? undefined,
    p_sepay_v2_id: transaction.id,
    p_transaction_date: transactionTimestamp,
    p_transfer_type: transaction.transfer_type,
  };
}

export function toSepayApiV2BatchTransaction(
  transaction: SepayApiV2Transaction,
): SepayApiV2BatchTransaction | null {
  const args = toSepayApiV2IngestionArgs(transaction);
  if (!args) return null;

  return {
    account_number: args.p_account_number,
    amount_in: args.p_amount_in,
    amount_out: args.p_amount_out,
    bank_brand_name: args.p_gateway,
    bank_account_id: transaction.bank_account_id,
    code: args.p_code,
    id: args.p_sepay_v2_id,
    reference_number: args.p_reference_number ?? null,
    transaction_content: args.p_content,
    transaction_date: args.p_transaction_date,
    transfer_type: args.p_transfer_type,
  };
}

export async function fetchSepayApiV2TransactionsPage(
  query: SepayApiV2PageQuery,
): Promise<SepayApiV2PageResult> {
  let env: ReturnType<typeof getSepayApiV2Env>;
  try {
    env = getSepayApiV2Env();
  } catch {
    return { error: "configuration", ok: false };
  }

  const params = new URLSearchParams({
    page: String(query.page),
    per_page: String(Math.min(Math.max(query.perPage ?? 100, 1), 100)),
    timestamp_format: "iso8601",
    transaction_date_from: query.dateFrom,
    transaction_date_sort: "asc",
    transaction_date_to: query.dateTo,
  });
  if (query.bankAccountId) params.set("bank_account_id", query.bankAccountId);

  let response: Response;
  try {
    response = await fetch(`${env.baseUrl}/transactions?${params.toString()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.token}`,
      },
      signal: AbortSignal.timeout(SEPAY_API_REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { error: "request_failed", ok: false };
  }

  if (response.status === 401) return { error: "unauthorized", ok: false };
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return {
      error: "rate_limited",
      ok: false,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
    };
  }
  if (!response.ok) return { error: "request_failed", ok: false };

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    return { error: "invalid_response", ok: false };
  }

  const parsed = parseSepayApiV2TransactionsResponse(responseBody);
  if (!parsed) return { error: "invalid_response", ok: false };

  return {
    data: parsed.data,
    hasMore: parsed.meta.pagination.has_more,
    ok: true,
    page: parsed.meta.pagination.current_page,
    total: parsed.meta.pagination.total,
  };
}

export async function ingestSepayApiV2TransactionRecordOnly(
  client: SepayApiV2IngestionClient,
  transaction: SepayApiV2Transaction,
): Promise<{ data: unknown; ok: true } | { ok: false }> {
  const args = toSepayApiV2IngestionArgs(transaction);
  if (!args) return { ok: false };

  const { data, error } = await client.rpc(
    "ingest_sepay_api_v2_transaction",
    args,
  );

  return error ? { ok: false } : { data, ok: true };
}
