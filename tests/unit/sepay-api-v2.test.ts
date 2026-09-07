import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchSepayApiV2TransactionsPage,
  ingestSepayApiV2TransactionRecordOnly,
  parseSepayApiV2TransactionsResponse,
  toSepayApiV2BatchTransaction,
  toSepayApiV2IngestionArgs,
  type SepayApiV2Transaction,
} from "@/features/finance/sepay-api-v2";

const transaction: SepayApiV2Transaction = {
  account_number: "0657000001",
  amount_in: 1_000_000,
  amount_out: 0,
  bank_account_id: "91000000-0000-4000-8000-000000000001",
  bank_brand_name: "MBBank",
  code: "TTV V2 HISTORY",
  id: "95000000-0000-4000-8000-000000000001",
  reference_number: "REF-V2-001",
  transaction_content: "TTV V2 HISTORY",
  transaction_date: "2026-09-01T08:00:00+07:00",
  transfer_type: "in",
  va: null,
  va_id: null,
  webhook_success: 1,
};

function successResponse(data = [transaction]) {
  return {
    data,
    meta: {
      pagination: {
        current_page: 1,
        has_more: false,
        last_page: 1,
        per_page: 100,
        total: data.length,
      },
    },
    status: "success",
  };
}

describe("SePay API v2 record-only ingestion", () => {
  beforeEach(() => {
    process.env.SEPAY_API_TOKEN = "sepay-v2-test-token";
    process.env.SEPAY_API_BASE_URL = "https://userapi-sandbox.sepay.vn/v2";
  });

  afterEach(() => {
    delete process.env.SEPAY_API_TOKEN;
    delete process.env.SEPAY_API_BASE_URL;
    vi.unstubAllGlobals();
  });

  it("accepts UUID transaction identities and maps them without bigint conversion", () => {
    expect(parseSepayApiV2TransactionsResponse(successResponse())).not.toBeNull();
    expect(toSepayApiV2IngestionArgs(transaction)).toEqual(expect.objectContaining({
      p_sepay_v2_id: transaction.id,
      p_transaction_date: "2026-09-01T01:00:00.000Z",
      p_transfer_type: "in",
    }));
    expect(toSepayApiV2BatchTransaction(transaction)).toEqual(expect.objectContaining({
      bank_account_id: transaction.bank_account_id,
      id: transaction.id,
      transaction_date: "2026-09-01T01:00:00.000Z",
    }));
  });

  it("normalizes legacy Vietnam timestamps returned without an offset", () => {
    expect(toSepayApiV2IngestionArgs({
      ...transaction,
      transaction_date: "2026-09-01 08:00:00",
    })).toEqual(expect.objectContaining({
      p_transaction_date: "2026-09-01T01:00:00.000Z",
    }));
  });

  it("rejects malformed API envelopes before database ingestion", () => {
    expect(parseSepayApiV2TransactionsResponse({ data: [{ ...transaction, id: 42 }] })).toBeNull();
    expect(parseSepayApiV2TransactionsResponse(successResponse([{ ...transaction, amount_in: 0 }]))).toBeNull();
    expect(parseSepayApiV2TransactionsResponse(successResponse([{ ...transaction, amount_out: 1 }]))).toBeNull();
    expect(toSepayApiV2IngestionArgs({
      ...transaction,
      transaction_date: "not-a-date",
    })).toBeNull();
  });

  it("requests a bounded uncached page with the bearer token kept server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(successResponse()),
      { headers: { "content-type": "application/json" }, status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSepayApiV2TransactionsPage({
      bankAccountId: transaction.bank_account_id,
      dateFrom: "2026-01-01 00:00:00",
      dateTo: "2026-09-01 23:59:59",
      page: 1,
      perPage: 500,
    })).resolves.toEqual({
      data: [transaction],
      hasMore: false,
      ok: true,
      page: 1,
      total: 1,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("per_page=100");
    expect(url).toContain(`bank_account_id=${transaction.bank_account_id}`);
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual(expect.objectContaining({
      Authorization: "Bearer sepay-v2-test-token",
    }));
  });

  it("returns retry metadata for SePay rate limiting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, {
      headers: { "retry-after": "3" },
      status: 429,
    })));

    await expect(fetchSepayApiV2TransactionsPage({
      dateFrom: "2026-01-01 00:00:00",
      dateTo: "2026-09-01 23:59:59",
      page: 1,
    })).resolves.toEqual({
      error: "rate_limited",
      ok: false,
      retryAfterSeconds: 3,
    });
  });

  it("uses only the dedicated record-only RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { mode: "record_only", status: "recorded" },
      error: null,
    });

    await expect(ingestSepayApiV2TransactionRecordOnly({ rpc }, transaction)).resolves.toEqual({
      data: { mode: "record_only", status: "recorded" },
      ok: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "ingest_sepay_api_v2_transaction",
      expect.objectContaining({ p_sepay_v2_id: transaction.id }),
    );
    expect(rpc).not.toHaveBeenCalledWith("process_sepay_webhook_transaction", expect.anything());
  });

  it("does not contact SePay when credentials are absent", async () => {
    delete process.env.SEPAY_API_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSepayApiV2TransactionsPage({ dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 1 })).resolves.toEqual({ ok: false, error: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[401, "unauthorized"], [500, "request_failed"]])("handles HTTP %s without parsing a success payload", async (status, error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private server details", { status: Number(status) })));
    await expect(fetchSepayApiV2TransactionsPage({ dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 1 })).resolves.toEqual({ ok: false, error });
  });

  it("handles network aborts without exposing the exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private transport details")));
    await expect(fetchSepayApiV2TransactionsPage({ dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 1 })).resolves.toEqual({ ok: false, error: "request_failed" });
  });

  it.each(["not json", JSON.stringify({ status: "success", data: [] })])("rejects invalid response body %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await expect(fetchSepayApiV2TransactionsPage({ dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 1 })).resolves.toEqual({ ok: false, error: "invalid_response" });
  });

  it("does not invoke ingestion for invalid dates and reports database rejection", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "private DB detail" } });
    await expect(ingestSepayApiV2TransactionRecordOnly({ rpc }, { ...transaction, transaction_date: "invalid" })).resolves.toEqual({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    await expect(ingestSepayApiV2TransactionRecordOnly({ rpc }, transaction)).resolves.toEqual({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
