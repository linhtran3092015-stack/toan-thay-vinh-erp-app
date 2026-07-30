export interface PaymentRequestReadModel {
  bonusSessions: number;
  calculatedUnitPriceVnd: number;
  createdAt: string;
  expectedAmountVnd: number;
  guardianFullName: string | null;
  guardianPhone: string | null;
  id: string;
  notes: string | null;
  paidAmountVnd: number;
  paidAt: string | null;
  publicCode: string;
  purchasedSessions: number;
  status: "pending" | "paid" | "partially_paid" | "cancelled" | "expired";
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
  topupType: "new" | "renewal";
  transferCode: string;
}

export interface SepayTransactionReadModel {
  accountNumber: string;
  amountVnd: number;
  bankBrand: string;
  bankTransactionId: string;
  createdAt: string;
  id: string;
  matchStatus:
    | "unmatched"
    | "auto_matched"
    | "manual_matched"
    | "split_allocated"
    | "amount_mismatch";
  matchedAt: string | null;
  matchedPaymentRequestCode: string | null;
  matchedStudentFullName: string | null;
  transactionAt: string;
  transferContent: string;
}

export interface CashflowRecordReadModel {
  amountVnd: number;
  category: string;
  createdAt: string;
  id: string;
  note: string;
  recordType: "receipt" | "disbursement" | "refund";
  referenceCode: string;
  studentFullName: string | null;
}

export interface CenterSessionLedgerEntryReadModel {
  classSessionId: string | null;
  createdAt: string;
  deltaSessions: number;
  effectiveOn: string;
  entryType: string;
  id: string;
  note: string | null;
  referenceCode: string | null;
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
  unitPriceVnd: number;
}

export interface FinanceOverviewReadModel {
  cashflowSummary: {
    disbursementVnd: number;
    receiptVnd: number;
    refundVnd: number;
  };
  recentCashflow: CashflowRecordReadModel[];
  recentPaymentRequests: PaymentRequestReadModel[];
  recentSepayTransactions: SepayTransactionReadModel[];
  totalPaymentRequestsCount: number;
}
