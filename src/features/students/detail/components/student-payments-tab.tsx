import Link from "next/link";
import type { ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import type {
  StudentPaymentRequestItem,
  StudentPaymentRequestStatus,
  StudentPaymentSummary,
} from "@/features/students/detail/student-activity-models";
import { formatIsoDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

interface StudentPaymentsTabProps {
  canCreatePaymentRequest: boolean;
  canViewPayments: boolean;
  /** Session ledger card (needs session_ledger.view); rendered under the requests. */
  ledgerCard?: ReactNode;
  /** `null` means the feed failed to load. */
  payments: StudentPaymentSummary | null;
  /** Tuition rate / source card; rendered last. */
  tuitionCard?: ReactNode;
}

export const paymentRequestStatusMeta: Record<
  StudentPaymentRequestStatus,
  { label: string; tone: "success" | "warning" | "neutral" | "danger" }
> = {
  cancelled: { label: "Đã hủy", tone: "neutral" },
  expired: { label: "Hết hạn", tone: "danger" },
  paid: { label: "Đã thu", tone: "success" },
  partially_paid: { label: "Thu một phần", tone: "warning" },
  pending: { label: "Chờ thanh toán", tone: "warning" },
};

function describeRequest(request: StudentPaymentRequestItem): string {
  const kind = request.topupType === "renewal" ? "Tái phí" : "Tuyển mới";
  const bonus = request.bonusSessions > 0 ? ` (+${request.bonusSessions} tặng)` : "";

  return `${kind} · ${request.purchasedSessions} buổi${bonus}`;
}

/**
 * Tab "Thanh toán & số dư buổi" (design 05a): outstanding banner, payment
 * requests with totals, then the session ledger and tuition profile cards.
 */
export function StudentPaymentsTab({
  canCreatePaymentRequest,
  canViewPayments,
  ledgerCard,
  payments,
  tuitionCard,
}: StudentPaymentsTabProps) {
  const header = (
    <tr>
      <TableHeaderCell className="w-[100px]">Ngày</TableHeaderCell>
      <TableHeaderCell className="min-w-[220px]">Nội dung</TableHeaderCell>
      <TableHeaderCell className="w-[130px]">Mã</TableHeaderCell>
      <TableHeaderCell className="w-[120px]" numeric>
        Phải thu
      </TableHeaderCell>
      <TableHeaderCell className="w-[120px]" numeric>
        Đã thu
      </TableHeaderCell>
      <TableHeaderCell className="w-[140px]">Trạng thái</TableHeaderCell>
    </tr>
  );

  let requestsBlock: ReactNode;

  if (!canViewPayments) {
    requestsBlock = (
      <DataTableFrame
        body={null}
        caption="Yêu cầu thanh toán của học sinh"
        forbidden={<TableState>Không có quyền xem yêu cầu thanh toán (payments.view).</TableState>}
        header={header}
        status="forbidden"
      />
    );
  } else if (!payments) {
    requestsBlock = (
      <DataTableFrame
        body={null}
        caption="Yêu cầu thanh toán của học sinh"
        error={<TableState>Chưa tải được yêu cầu thanh toán; chưa thể kết luận học sinh có nợ hay không.</TableState>}
        header={header}
        status="error"
      />
    );
  } else {
    requestsBlock = (
      <DataTableFrame
        body={payments.requests.map((request) => {
          const status = paymentRequestStatusMeta[request.status];
          const isOpen = request.status === "pending" || request.status === "partially_paid";

          return (
            <TableRow key={request.id} selected={isOpen}>
              <TableCell className="whitespace-nowrap text-text-muted">{formatIsoDate(request.createdAt)}</TableCell>
              <TableCell>
                <span className="block font-medium text-text-strong">{request.notes ?? describeRequest(request)}</span>
                {request.notes ? <span className="block text-caption text-text-muted">{describeRequest(request)}</span> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">{request.publicCode}</TableCell>
              <TableCell className="whitespace-nowrap" numeric>
                {formatVnd(request.expectedAmountVnd)}
              </TableCell>
              <TableCell className={request.paidAmountVnd === 0 ? "whitespace-nowrap text-text-subtle" : "whitespace-nowrap"} numeric>
                {formatVnd(request.paidAmountVnd)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge tone={status.tone}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
        caption="Yêu cầu thanh toán của học sinh"
        empty={<TableState>Chưa có yêu cầu thanh toán nào.</TableState>}
        footer={
          payments.requests.length > 0 ? (
            <>
              <span>
                Tổng phải thu <strong className="font-semibold text-text-strong">{formatVnd(payments.totalExpectedVnd)}</strong> · đã thu{" "}
                <strong className="font-semibold text-text-strong">{formatVnd(payments.totalPaidVnd)}</strong>
              </span>
              <span className={payments.outstandingVnd > 0 ? "font-semibold text-danger" : "text-text-muted"}>
                {payments.outstandingVnd > 0 ? `Còn nợ ${formatVnd(payments.outstandingVnd)}` : "Không còn nợ"}
              </span>
            </>
          ) : undefined
        }
        header={header}
        status={payments.requests.length === 0 ? "empty" : "ready"}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {canViewPayments && payments && payments.outstandingVnd > 0 ? (
        <ResultBanner
          action={
            <Link href="/finance/payment-requests">Mở danh sách yêu cầu</Link>
          }
          description={`${payments.openCount} yêu cầu chờ thanh toán. Số dư buổi chỉ được cộng sau khi tiền về.`}
          title={`Còn nợ ${formatVnd(payments.outstandingVnd)}.`}
          tone="danger"
        />
      ) : null}

      <section aria-labelledby="student-payments-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-text-strong" id="student-payments-title">
            Yêu cầu thanh toán
          </h3>
          {canCreatePaymentRequest ? (
            <Link className={getButtonClassName({ size: "sm", variant: "secondary" })} href="/finance/payment-requests/new">
              Tạo yêu cầu thanh toán
            </Link>
          ) : null}
        </div>
        {requestsBlock}
      </section>

      {ledgerCard}
      {tuitionCard}
    </div>
  );
}
