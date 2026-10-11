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

export interface PaymentRequestFiltersState {
  createdFrom: string;
  createdTo: string;
  search: string;
  status: "" | PaymentRequestReadModel["status"];
  topupType: "" | PaymentRequestReadModel["topupType"];
}

export interface SepayTransactionReadModel {
  accountNumber: string;
  accountPurpose: "new_enrollment" | "renewal" | "unknown";
  amountVnd: number;
  bankBrand: string;
  bankTransactionId: string;
  createdAt: string;
  id: string;
  ingestionSource: "webhook" | "api_v2" | "reconciled";
  matchStatus:
    | "unmatched"
    | "auto_matched"
    | "manual_matched"
    | "split_allocated"
    | "amount_mismatch"
    | "account_purpose_mismatch"
    | "identity_conflict"
    | "historical_accounted"
    | "ignored";
  matchedAt: string | null;
  matchedPaymentRequestCode: string | null;
  matchedStudentFullName: string | null;
  referenceNumber: string | null;
  sepayV2Id: string | null;
  transactionAt: string;
  transferType: "in" | "out" | null;
  transferContent: string;
}

export interface SepayTransactionsPageReadModel {
  page: number;
  pageSize: number;
  /** Inbound transfers still waiting for reconciliation, regardless of filters. */
  reviewCount: number;
  total: number;
  transactions: SepayTransactionReadModel[];
}

export interface SepayReconciliationCandidateReadModel {
  expectedAmountVnd: number;
  id: string;
  publicCode: string;
  studentFullName: string;
  topupType: "new" | "renewal";
}

export interface FinanceOrderFiltersState {
  month: string;
  orderType: "" | "new_enrollment" | "renewal";
  period: "" | "1" | "2" | "3";
  source: "" | "mma" | "sb" | "sb_f1";
}

export interface FinanceOrderReadModel {
  bankTransactionId: string;
  checkedAt: string | null;
  checkedBy: string | null;
  classCode: string | null;
  className: string | null;
  isChecked: boolean;
  leadSourceCode: string | null;
  leadSourceName: string | null;
  mechanismCode: string;
  operatingCostStatus: "configured" | "unconfigured";
  operatingCostVnd: number | null;
  orderType: "new_enrollment" | "renewal" | "unknown";
  referenceCode: string;
  saleOwnerFullName: string | null;
  saleOwnerId: string | null;
  sepayTransactionId: string;
  settlementPeriod: 1 | 2 | 3;
  sourceCashflowRecordId: string;
  sourceCode: "mma" | "sb" | "sb_f1" | null;
  sourceLabel: "MMA" | "SB" | "SB F1" | null;
  studentFullName: string;
  studentId: string;
  studentPublicCode: string;
  transactionAt: string;
  transferContent: string;
  tuitionAmountVnd: number;
  guardianFullName: string | null;
  guardianPhone: string | null;
}

export interface FinanceOrderSummaryReadModel {
  checkedCount: number;
  operatingCostVnd: number;
  orderCount: number;
  tuitionAmountVnd: number;
  uncheckedCount: number;
  unconfiguredCount: number;
}

export interface FinanceOrderSettlementReadModel {
  checkedCount: number;
  newEnrollmentCount: number;
  operatingCostVnd: number;
  period: 1 | 2 | 3;
  renewalCount: number;
  tuitionAmountVnd: number;
  uncheckedCount: number;
  unconfiguredCount: number;
}

export interface FinanceOrdersDashboardReadModel {
  month: string;
  orders: FinanceOrderReadModel[];
  settlement: FinanceOrderSettlementReadModel[];
  settlementEligible: boolean;
  summary: FinanceOrderSummaryReadModel;
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
