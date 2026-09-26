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

export function PayslipNotesFooter({
  employee,
  period,
}: {
  employee: PayslipEmployeeInfo;
  period: PayslipPeriodInfo;
}) {
  const isFeedbackClosed = Boolean(period.feedbackClosedAt);

  return (
    <footer className="mt-4 space-y-6 pt-2">
      {/* Notes & Signature */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Notes Left */}
        <div className="space-y-2 text-xs text-text-default">
          <p className="font-bold text-text-strong uppercase">Ghi Chú</p>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-text-muted">
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

        {/* Signature Right */}
        <div className="flex flex-col items-center justify-between text-center sm:items-end sm:text-right">
          <p className="text-xs italic text-text-muted">
            {formatSignatureDate(period.payDate)}
          </p>
          <div className="mt-2 text-xs text-text-default">
            <p className="font-bold text-text-strong">Người nhận lương</p>
            <p className="text-[11px] italic text-text-muted">
              (Ký, ghi rõ họ tên)
            </p>
          </div>
          <div className="mt-12 text-sm font-bold text-text-strong">
            {employee.displayName}
          </div>
        </div>
      </div>

      {/* Brand Footer */}
      <div className="border-t border-border-subtle pt-3 text-center text-[11px] text-text-muted">
        <p className="font-semibold text-text-default">
          TRUNG TÂM TOÁN THẦY VINH · ERP VẬN HÀNH
        </p>
      </div>
    </footer>
  );
}
