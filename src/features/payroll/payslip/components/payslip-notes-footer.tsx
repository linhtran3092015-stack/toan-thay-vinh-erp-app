import type {
  PayslipEmployeeInfo,
  PayslipPeriodInfo,
} from "@/features/payroll/payslip/types";

function formatSignatureDate(payDate: string): string {
  const date = new Date(`${payDate}T00:00:00`);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `Hà Nội, ngày ${day} tháng ${month} năm ${year}`;
}

/**
 * Notes and the recipient signature. Reconciler and approver names are not
 * loaded for the payslip, so only the recipient block is shown.
 */
export function PayslipNotesFooter({
  employee,
  period,
}: {
  employee: PayslipEmployeeInfo;
  period: PayslipPeriodInfo;
}) {
  const isFeedbackClosed = Boolean(period.feedbackClosedAt);

  return (
    <footer className="grid gap-5 border-t border-border-row pt-4 text-caption text-text-muted">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="font-semibold uppercase tracking-[0.02em] text-text-default">Ghi chú</p>
          <ul className="list-disc space-y-1 pl-4 leading-relaxed">
            <li>
              Phiếu lương này được lập tự động từ hệ thống ERP Trung tâm Toán Thầy Vinh.
            </li>
            <li>
              {isFeedbackClosed
                ? "Kỳ lương này đã hoàn tất giai đoạn đối soát và ghi nhận chính thức."
                : "Vui lòng kiểm tra kỹ các thông tin. Mọi thắc mắc vui lòng gửi yêu cầu phản hồi trước khi kỳ lương đóng."}
            </li>
          </ul>
        </div>

        <div className="flex flex-col items-start sm:items-end sm:text-right">
          <p className="italic">{formatSignatureDate(period.payDate)}</p>
          <p className="mt-2 font-semibold text-text-strong">Người nhận lương</p>
          <p className="italic">(Ký, ghi rõ họ tên)</p>
          <p className="mt-10 text-secondary font-semibold text-text-strong">{employee.displayName}</p>
        </div>
      </div>

      <p className="text-center font-semibold text-text-default">
        TRUNG TÂM TOÁN THẦY VINH · ERP VẬN HÀNH
      </p>
    </footer>
  );
}
