import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CashflowRecordReadModel,
  CenterSessionLedgerEntryReadModel,
  FinanceOrderFiltersState,
  FinanceOrdersDashboardReadModel,
  FinanceOverviewReadModel,
  PaymentRequestReadModel,
  SepayTransactionReadModel,
} from "./read-models";

export type FinanceReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };

const financeOrdersDashboardSchema = z.object({
  month: z.string(),
  orders: z.array(z.object({
    bankTransactionId: z.string(),
    checkedAt: z.string().nullable(),
    checkedBy: z.string().nullable(),
    classCode: z.string().nullable(),
    className: z.string().nullable(),
    guardianFullName: z.string().nullable(),
    guardianPhone: z.string().nullable(),
    isChecked: z.boolean(),
    leadSourceCode: z.string().nullable(),
    leadSourceName: z.string().nullable(),
    mechanismCode: z.string(),
    operatingCostStatus: z.enum(["configured", "unconfigured"]),
    operatingCostVnd: z.number().nullable(),
    orderType: z.enum(["new_enrollment", "renewal", "unknown"]),
    referenceCode: z.string(),
    saleOwnerFullName: z.string().nullable(),
    saleOwnerId: z.string().nullable(),
    sepayTransactionId: z.string(),
    settlementPeriod: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    sourceCashflowRecordId: z.string(),
    sourceCode: z.enum(["mma", "sb", "sb_f1"]).nullable(),
    sourceLabel: z.enum(["MMA", "SB", "SB F1"]).nullable(),
    studentFullName: z.string(),
    studentId: z.string(),
    studentPublicCode: z.string(),
    transactionAt: z.string(),
    transferContent: z.string(),
    tuitionAmountVnd: z.number(),
  })),
  settlement: z.array(z.object({
    checkedCount: z.number(),
    newEnrollmentCount: z.number(),
    operatingCostVnd: z.number(),
    period: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    renewalCount: z.number(),
    tuitionAmountVnd: z.number(),
    uncheckedCount: z.number(),
    unconfiguredCount: z.number(),
  })),
  settlementEligible: z.boolean(),
  summary: z.object({
    checkedCount: z.number(),
    operatingCostVnd: z.number(),
    orderCount: z.number(),
    tuitionAmountVnd: z.number(),
    uncheckedCount: z.number(),
    unconfiguredCount: z.number(),
  }),
});

function toSepayTransactionReadModel(transaction: {
  account_number: string;
  account_purpose: string;
  amount_vnd: number;
  bank_brand: string;
  bank_transaction_id: string;
  created_at: string;
  id: string;
  match_status: string;
  matched_at: string | null;
  matched_request: unknown;
  matched_student: unknown;
  transaction_at: string;
  transfer_content: string;
}): SepayTransactionReadModel {
  return {
    accountNumber: transaction.account_number,
    accountPurpose: transaction.account_purpose as SepayTransactionReadModel["accountPurpose"],
    amountVnd: Number(transaction.amount_vnd),
    bankBrand: transaction.bank_brand,
    bankTransactionId: transaction.bank_transaction_id,
    createdAt: transaction.created_at,
    id: transaction.id,
    matchStatus: transaction.match_status as SepayTransactionReadModel["matchStatus"],
    matchedAt: transaction.matched_at,
    matchedPaymentRequestCode: (transaction.matched_request as { public_code: string } | null)?.public_code ?? null,
    matchedStudentFullName: (transaction.matched_student as { full_name: string } | null)?.full_name ?? null,
    transactionAt: transaction.transaction_at,
    transferContent: transaction.transfer_content,
  };
}

function emptyFinanceOverview(): FinanceOverviewReadModel {
  return {
    cashflowSummary: {
      disbursementVnd: 0,
      receiptVnd: 0,
      refundVnd: 0,
    },
    recentCashflow: [],
    recentPaymentRequests: [],
    recentSepayTransactions: [],
    totalPaymentRequestsCount: 0,
  };
}

export async function getFinanceOverviewResult(): Promise<
  FinanceReadResult<FinanceOverviewReadModel>
> {
  try {
    const supabase = await createSupabaseServerClient();

    const [paymentRequestsRes, sepayTxRes, cashflowRes, cashflowSummaryRes] = await Promise.all([
      supabase
        .from("student_payment_requests")
        .select(
          `
        id,
        public_code,
        transfer_code,
        expected_amount_vnd,
        purchased_sessions,
        bonus_sessions,
        calculated_unit_price_vnd,
        topup_type,
        status,
        paid_amount_vnd,
        paid_at,
        created_at,
        notes,
        student_id,
        student:students(id, public_code, full_name),
        guardian:guardians(full_name, phone)
      `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .limit(10),

      supabase
        .from("sepay_transactions")
        .select(
          `
        id,
        bank_transaction_id,
        bank_brand,
        account_number,
        account_purpose,
        amount_vnd,
        transfer_content,
        transaction_at,
        match_status,
        matched_at,
        created_at,
        matched_student:students(full_name),
        matched_request:student_payment_requests(public_code)
          `,
        )
        .order("transaction_at", { ascending: false })
        .limit(10),

      supabase
        .from("finance_cashflow_records")
        .select(
          `
        id,
        record_type,
        category,
        amount_vnd,
        reference_code,
        note,
        created_at,
        student:students(full_name)
          `,
        )
        .order("created_at", { ascending: false })
        .limit(10),

      supabase.rpc("get_finance_cashflow_summary"),
    ]);

    if (
      paymentRequestsRes.error ||
      sepayTxRes.error ||
      cashflowRes.error ||
      cashflowSummaryRes.error
    ) {
      return { ok: false };
    }

    const requestsData = paymentRequestsRes.data ?? [];
    const sepayData = sepayTxRes.data ?? [];
    const cashflowData = cashflowRes.data ?? [];

    const recentPaymentRequests: PaymentRequestReadModel[] = requestsData.map((r) => {
      const student = r.student as unknown as {
        full_name: string;
        id: string;
        public_code: string;
      } | null;
      const guardian = r.guardian as unknown as { full_name: string; phone: string } | null;

      return {
        bonusSessions: r.bonus_sessions,
        calculatedUnitPriceVnd: Number(r.calculated_unit_price_vnd),
        createdAt: r.created_at,
        expectedAmountVnd: Number(r.expected_amount_vnd),
        guardianFullName: guardian?.full_name ?? null,
        guardianPhone: guardian?.phone ?? null,
        id: r.id,
        notes: r.notes,
        paidAmountVnd: Number(r.paid_amount_vnd),
        paidAt: r.paid_at,
        publicCode: r.public_code,
        purchasedSessions: r.purchased_sessions,
        status: r.status as PaymentRequestReadModel["status"],
        studentFullName: student?.full_name ?? "Học viên",
        studentId: r.student_id ?? "",
        studentPublicCode: student?.public_code ?? "",
        topupType: r.topup_type as PaymentRequestReadModel["topupType"],
        transferCode: r.transfer_code,
      };
    });

    const recentSepayTransactions = sepayData.map((transaction) =>
      toSepayTransactionReadModel(transaction),
    );

    const recentCashflow: CashflowRecordReadModel[] = cashflowData.map((c) => ({
      amountVnd: Number(c.amount_vnd),
      category: c.category,
      createdAt: c.created_at,
      id: c.id,
      note: c.note,
      recordType: c.record_type as CashflowRecordReadModel["recordType"],
      referenceCode: c.reference_code,
      studentFullName: (c.student as unknown as { full_name: string } | null)?.full_name ?? null,
    }));

    const cashflowSummary = cashflowSummaryRes.data?.[0];
    if (!cashflowSummary) {
      return { ok: false };
    }

    return {
      data: {
        cashflowSummary: {
          disbursementVnd: Number(cashflowSummary.disbursement_vnd ?? 0),
          receiptVnd: Number(cashflowSummary.receipt_vnd ?? 0),
          refundVnd: Number(cashflowSummary.refund_vnd ?? 0),
        },
        recentCashflow,
        recentPaymentRequests,
        recentSepayTransactions,
        totalPaymentRequestsCount: paymentRequestsRes.count ?? recentPaymentRequests.length,
      },
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

// Kept for non-route callers while pages use the error-aware result APIs.
export async function getFinanceOverview(): Promise<FinanceOverviewReadModel> {
  const result = await getFinanceOverviewResult();
  return result.ok ? result.data : emptyFinanceOverview();
}

export async function getSepayTransactionsResult(
  accountPurpose: "" | SepayTransactionReadModel["accountPurpose"] = "",
): Promise<
  FinanceReadResult<SepayTransactionReadModel[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("sepay_transactions")
      .select(
        `
      id,
      bank_transaction_id,
      bank_brand,
      account_number,
      account_purpose,
      amount_vnd,
      transfer_content,
      transaction_at,
      match_status,
      matched_at,
      created_at,
      matched_student:students(full_name),
      matched_request:student_payment_requests(public_code)
        `,
      )
      .order("transaction_at", { ascending: false })
      .limit(100);

    if (accountPurpose) {
      query = query.eq("account_purpose", accountPurpose);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false };
    }

    return {
      data: (data ?? []).map((transaction) => toSepayTransactionReadModel(transaction)),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export async function getSepayTransactions(): Promise<SepayTransactionReadModel[]> {
  const result = await getSepayTransactionsResult();
  return result.ok ? result.data : [];
}

export async function getFinanceOrdersDashboardResult(
  filters: FinanceOrderFiltersState,
): Promise<FinanceReadResult<FinanceOrdersDashboardReadModel>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_finance_orders_dashboard", {
      p_month: `${filters.month}-01`,
      p_order_type: filters.orderType || undefined,
      p_period: filters.period ? Number(filters.period) : undefined,
      p_source: filters.source || undefined,
    });

    if (error) {
      return { ok: false };
    }

    const parsed = financeOrdersDashboardSchema.safeParse(data);
    return parsed.success
      ? { data: parsed.data, ok: true }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function getPaymentRequestsResult(): Promise<
  FinanceReadResult<PaymentRequestReadModel[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("student_payment_requests")
      .select(
        `
      id,
      public_code,
      transfer_code,
      expected_amount_vnd,
      purchased_sessions,
      bonus_sessions,
      calculated_unit_price_vnd,
      topup_type,
      status,
      paid_amount_vnd,
      paid_at,
      created_at,
      notes,
      student_id,
      student:students(id, public_code, full_name),
      guardian:guardians(full_name, phone)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return { ok: false };
    }

    return {
      data: (data ?? []).map((request) => {
        const student = request.student as unknown as {
          full_name: string;
          id: string;
          public_code: string;
        } | null;
        const guardian = request.guardian as unknown as {
          full_name: string;
          phone: string;
        } | null;

        return {
          bonusSessions: request.bonus_sessions,
          calculatedUnitPriceVnd: Number(request.calculated_unit_price_vnd),
          createdAt: request.created_at,
          expectedAmountVnd: Number(request.expected_amount_vnd),
          guardianFullName: guardian?.full_name ?? null,
          guardianPhone: guardian?.phone ?? null,
          id: request.id,
          notes: request.notes,
          paidAmountVnd: Number(request.paid_amount_vnd),
          paidAt: request.paid_at,
          publicCode: request.public_code,
          purchasedSessions: request.purchased_sessions,
          status: request.status as PaymentRequestReadModel["status"],
          studentFullName: student?.full_name ?? "Học viên",
          studentId: request.student_id ?? "",
          studentPublicCode: student?.public_code ?? "",
          topupType: request.topup_type as PaymentRequestReadModel["topupType"],
          transferCode: request.transfer_code,
        };
      }),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export async function getCenterSessionLedgerEntriesResult(): Promise<
  FinanceReadResult<CenterSessionLedgerEntryReadModel[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("student_session_ledger_entries")
      .select(
        `
      id,
      student_id,
      class_session_id,
      entry_type,
      delta_sessions,
      effective_on,
      reference_code,
      unit_price_vnd,
      note,
      created_at,
      student:students(public_code, full_name)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return { ok: false };
    }

    return {
      data: (data ?? []).map((e) => {
        const student = e.student as unknown as { full_name: string; public_code: string } | null;
        return {
          classSessionId: e.class_session_id,
          createdAt: e.created_at,
          deltaSessions: e.delta_sessions,
          effectiveOn: e.effective_on,
          entryType: e.entry_type,
          id: e.id,
          note: e.note,
          referenceCode: e.reference_code,
          studentFullName: student?.full_name ?? "Học viên",
          studentId: e.student_id,
          studentPublicCode: student?.public_code ?? "",
          unitPriceVnd: Number(e.unit_price_vnd),
        };
      }),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

export async function getCenterSessionLedgerEntries(): Promise<
  CenterSessionLedgerEntryReadModel[]
> {
  const result = await getCenterSessionLedgerEntriesResult();
  return result.ok ? result.data : [];
}
