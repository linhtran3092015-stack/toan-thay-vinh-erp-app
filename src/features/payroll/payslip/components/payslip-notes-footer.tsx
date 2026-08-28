import type {
  FooterBlockSettings,
  NotesBlockSettings,
  PayslipBrandingConfig,
} from "@/features/payroll/payslip-template/types";
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

interface PayslipNotesFooterProps {
  blockSettings?: NotesBlockSettings & FooterBlockSettings;
  branding?: Partial<PayslipBrandingConfig>;
  employee: PayslipEmployeeInfo;
  mode?: "both" | "notes" | "footer";
  period: PayslipPeriodInfo;
}

export function PayslipNotesFooter({
  blockSettings = {},
  branding = {},
  employee,
  mode = "both",
  period,
}: PayslipNotesFooterProps) {
  const isFeedbackClosed = Boolean(period.feedbackClosedAt);
  const showSignatures = blockSettings.showSignatures !== false;
  const customNotes = blockSettings.customNotes;
  const employeeSignatureLabel =
    blockSettings.employeeSignatureLabel || "Người nhận lương\n(Ký, ghi rõ họ tên)";
  const managerSignatureLabel =
    blockSettings.managerSignatureLabel || "Người lập biểu\n(Ký, ghi rõ họ tên)";

  const showNotes = mode === "both" || mode === "notes";
  const showFooter = mode === "both" || mode === "footer";

  return (
    <footer className="mt-4 space-y-6 pt-2">
      {/* Notes & Signature */}
      {showNotes ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Notes Left */}
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-bold text-slate-800 uppercase">Ghi Chú</p>
            <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-500">
              {customNotes ? (
                <li>{customNotes}</li>
              ) : (
                <>
                  <li>
                    Phiếu lương này được lập tự động từ hệ thống ERP Trung tâm Toán Thầy Vinh.
                  </li>
                  <li>
                    {isFeedbackClosed
                      ? "Kỳ lương này đã hoàn tất giai đoạn đối soát và ghi nhận chính thức."
                      : "Vui lòng kiểm tra kỹ các thông tin. Mọi thắc mắc vui lòng gửi yêu cầu phản hồi trước khi kỳ lương đóng."}
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Signature Right */}
          {showSignatures ? (
            <div className="flex flex-col items-center justify-between text-center sm:items-end sm:text-right">
              <p className="text-xs italic text-slate-500">
                {formatSignatureDate(period.payDate)}
              </p>
              <div className="mt-2 text-xs text-slate-700 whitespace-pre-line">
                <p className="font-bold text-slate-800">
                  {employeeSignatureLabel.split("\n")[0]}
                </p>
                <p className="text-[11px] italic text-slate-400">
                  {employeeSignatureLabel.split("\n")[1] || ""}
                </p>
              </div>
              <div
                className="mt-12 text-sm font-bold"
                style={{ color: branding.primaryColor || "#1e3a8a" }}
              >
                {employee.displayName}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Brand Footer */}
      {showFooter ? (
        <div className="border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500 space-y-1">
          <p
            className="font-semibold uppercase tracking-wider"
            style={{ color: branding.primaryColor || "#1e3a8a" }}
          >
            {branding.companyName || "TRUNG TÂM TOÁN THẦY VINH"} · ERP VẬN HÀNH
          </p>
          {blockSettings.hotline || blockSettings.website || blockSettings.address ? (
            <p className="text-[10px] text-slate-400">
              {[
                blockSettings.hotline ? `Hotline: ${blockSettings.hotline}` : null,
                blockSettings.website ? `Website: ${blockSettings.website}` : null,
                blockSettings.address ? `Địa chỉ: ${blockSettings.address}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          ) : null}
          {blockSettings.customFooterText ? (
            <p className="text-[10px] text-slate-400 italic">
              {blockSettings.customFooterText}
            </p>
          ) : null}
        </div>
      ) : null}
    </footer>
  );
}
