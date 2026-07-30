import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CashflowRecordReadModel,
  CenterSessionLedgerEntryReadModel,
  FinanceOverviewReadModel,
  PaymentRequestReadModel,
  SepayTransactionReadModel,
} from "./read-models";

export type FinanceReadResult<T> =
  | { data: T; ok: true }
  | { ok: false };

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

    const recentSepayTransactions: SepayTransactionReadModel[] = sepayData.map((t) => ({
      accountNumber: t.account_number,
      amountVnd: Number(t.amount_vnd),
      bankBrand: t.bank_brand,
      bankTransactionId: t.bank_transaction_id,
      createdAt: t.created_at,
      id: t.id,
      matchStatus: t.match_status as SepayTransactionReadModel["matchStatus"],
      matchedAt: t.matched_at,
      matchedPaymentRequestCode: (t.matched_request as unknown as { public_code: string } | null)?.public_code ?? null,
      matchedStudentFullName: (t.matched_student as unknown as { full_name: string } | null)?.full_name ?? null,
      transactionAt: t.transaction_at,
      transferContent: t.transfer_content,
    }));

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

export async function getSepayTransactionsResult(): Promise<
  FinanceReadResult<SepayTransactionReadModel[]>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sepay_transactions")
      .select(
        `
      id,
      bank_transaction_id,
      bank_brand,
      account_number,
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

    if (error) {
      return { ok: false };
    }

    return {
      data: (data ?? []).map((t) => ({
        accountNumber: t.account_number,
        amountVnd: Number(t.amount_vnd),
        bankBrand: t.bank_brand,
        bankTransactionId: t.bank_transaction_id,
        createdAt: t.created_at,
        id: t.id,
        matchStatus: t.match_status as SepayTransactionReadModel["matchStatus"],
        matchedAt: t.matched_at,
        matchedPaymentRequestCode: (t.matched_request as unknown as { public_code: string } | null)?.public_code ?? null,
        matchedStudentFullName: (t.matched_student as unknown as { full_name: string } | null)?.full_name ?? null,
        transactionAt: t.transaction_at,
        transferContent: t.transfer_content,
      })),
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
