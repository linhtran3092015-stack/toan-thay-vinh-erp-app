// Value: protects=the payslip card (design 8b): employee/period/pay date/masked account as one list, earnings then "Tổng thu nhập", deductions with a minus sign, "Thực nhận" with the amount in words, and no blocks the ERP has no data for (payslip code, personal income tax, paid-transfer line, approver names, Zalo);
// fails_when=the card shows a fabricated tax line or payslip code, deductions lose their sign, the net or amount in words disappears, or a disabled PDF action loses its reason;
// why_new=step 8 restyles PayslipDocument and drops the summary/formula cards;
// seam=PayslipDocument and PayslipToolbar render fixture PayslipDocumentData; no_claim=does not cover the PDF route (payroll-payslip-routes covers it)
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PayslipToolbar } from "@/features/payroll/payslip/components/payslip-toolbar";
import type { PayslipDocumentData, PayslipLineItem } from "@/features/payroll/payslip/types";

afterEach(cleanup);

function line(id: string, lineType: string, label: string, amountVnd: number, direction: "earning" | "deduction" = "earning"): PayslipLineItem {
  return {
    amountFormatted: `${new Intl.NumberFormat("vi-VN").format(amountVnd)} VND`,
    amountVnd,
    direction,
    formulaExplanation: null,
    id,
    label,
    lineType,
    note: null,
    quantity: null,
    unitLabel: null,
    unitRateFormatted: null,
    unitRateVnd: null,
  };
}

const data: PayslipDocumentData = {
  breakdowns: { commissions: [], grading: null, workHours: [] },
  deductions: [line("d1", "advance_deduction", "Khấu trừ tạm ứng", 2_000_000, "deduction")],
  earnings: [line("e1", "base_offline", "Lương công offline", 4_680_000), line("e2", "grading_bonus", "Thưởng chấm bài", 300_000)],
  employee: {
    avatarUrl: null,
    bankAccount: { accountHolderName: "TRAN THANH TUNG", accountNumberMasked: "•••• •••• 2291", bankName: "Techcombank" },
    department: null,
    displayName: "Trần Thanh Tùng",
    employeeCode: "NV07",
    joinedAt: null,
    positionLabel: "Trợ giảng",
    staffId: "staff-7",
  },
  isStale: false,
  period: {
    currentRevision: 3,
    feedbackClosedAt: "2026-10-02T10:00:00Z",
    feedbackOpenedAt: null,
    id: "period-9",
    lastCalculatedAt: null,
    payDate: "2026-10-05",
    payDateFormatted: "05/10/2026",
    periodEndDate: "30/09/2026",
    periodMonth: "2026-09-01",
    periodMonthFormatted: "THÁNG 09/2026",
    periodStartDate: "01/09/2026",
    status: "approved",
    statusLabel: "Đã duyệt & khóa",
  },
  statementId: "statement-7",
  totals: {
    amountInWords: "Hai triệu chín trăm tám mươi nghìn đồng chẵn./.",
    grossFormatted: "4.980.000 VND",
    grossVnd: 4_980_000,
    netFormatted: "2.980.000 VND",
    netVnd: 2_980_000,
    totalDeductionsFormatted: "2.000.000 VND",
    totalDeductionsVnd: 2_000_000,
    workHours: 52,
    workMinutes: 3_120,
    workUnits: 26,
  },
};

describe("Payslip card (8b)", () => {
  it("lists employee, period, pay date and the masked account", () => {
    render(<PayslipDocument data={data} />);

    expect(screen.getByRole("heading", { name: "Phiếu Lương" })).toBeInTheDocument();
    expect(screen.getByText("Lần tính #3")).toBeInTheDocument();
    const details = screen.getByText("Nhân sự").closest("dl") as HTMLElement;
    const terms = within(details).getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Nhân sự", "Kỳ tính", "Ngày trả lương", "Tài khoản"]);
    expect(screen.getByText("•••• •••• 2291")).toBeInTheDocument();
    expect(screen.queryByText(/\d{6,}/)).not.toBeInTheDocument();
  });

  it("runs earnings, total income, signed deductions, net pay and amount in words", () => {
    render(<PayslipDocument data={data} />);

    const earnings = screen.getByRole("region", { name: "Thu nhập" });
    expect(within(earnings).getByText("Tổng thu nhập").nextElementSibling).toHaveTextContent("4.980.000 VND");

    const deductions = screen.getByRole("region", { name: "Bù trừ & khấu trừ" });
    expect(within(deductions).getByText("Khấu trừ tạm ứng").nextElementSibling).toHaveTextContent("−2.000.000 VND");
    expect(within(deductions).getByText("Tổng bù trừ & khấu trừ").nextElementSibling).toHaveTextContent("−2.000.000 VND");

    expect(screen.getByText("Thực nhận").nextElementSibling).toHaveTextContent("2.980.000 VND");
    expect(screen.getByText(/Hai triệu chín trăm tám mươi nghìn đồng chẵn/)).toBeInTheDocument();
    expect(screen.getByText("Người nhận lương")).toBeInTheDocument();
  });

  it("drops the blocks the ERP has no data for", () => {
    render(<PayslipDocument data={data} />);

    expect(screen.queryByText(/Thuế TNCN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PL-\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đã chuyển khoản/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kế toán đối soát|Chủ trung tâm duyệt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Zalo/)).not.toBeInTheDocument();
    // No evidence to show: the breakdown disclosure is omitted.
    expect(screen.queryByText("Xem căn cứ tính công, chấm bài & hoa hồng")).not.toBeInTheDocument();
  });

  // Value: protects=a payslip for staff with no salary account says "Chưa có tài khoản nhận lương" and invents no bank or number, and a period with no lines says so in each section instead of rendering empty groups;
  // fails_when=the null bank account branch crashes, prints a placeholder number/bank, or the empty earnings / deductions messages disappear;
  // why_new=the existing fixture always carries a bank account and one line per section;
  // seam=none (PayslipDocument renders fixture data); no_claim=does not prove the loader masks real account numbers (payslip loader tests cover that)
  it("says the salary account is missing and shows empty earnings and deductions states", () => {
    render(
      <PayslipDocument
        data={{
          ...data,
          deductions: [],
          earnings: [],
          employee: { ...data.employee, bankAccount: null },
          totals: { ...data.totals, grossFormatted: "0 VND", grossVnd: 0, netFormatted: "0 VND", netVnd: 0, totalDeductionsFormatted: "0 VND", totalDeductionsVnd: 0 },
        }}
      />,
    );

    const details = screen.getByText("Nhân sự").closest("dl") as HTMLElement;
    const account = within(details).getByText("Tài khoản").nextElementSibling as HTMLElement;
    expect(account).toHaveTextContent("Chưa có tài khoản nhận lương");
    expect(account.textContent).not.toMatch(/\d|•|Techcombank/);

    const earnings = screen.getByRole("region", { name: "Thu nhập" });
    expect(within(earnings).getByText("Không có khoản thu nhập nào ghi nhận trong kỳ.")).toBeInTheDocument();
    expect(within(earnings).getByText("Tổng thu nhập").nextElementSibling).toHaveTextContent("0 VND");
    const deductions = screen.getByRole("region", { name: "Bù trừ & khấu trừ" });
    expect(within(deductions).getByText("Không phát sinh khoản tạm ứng hoặc khấu trừ trong kỳ.")).toBeInTheDocument();
    expect(within(deductions).getByText("Tổng bù trừ & khấu trừ").nextElementSibling?.textContent).toBe("0 VND");
  });

  it("keeps a disabled PDF action readable with its reason", () => {
    render(<PayslipToolbar pdfDownloadUrl="/payroll/p/statements/s/payslip/pdf" pdfUnavailableReason="Bản xem trước không tạo PDF." />);

    const pdf = screen.getByRole("button", { name: /Xuất PDF/ });
    expect(pdf).toBeDisabled();
    expect(pdf).toHaveAccessibleDescription("Bản xem trước không tạo PDF.");
    expect(screen.queryByRole("link", { name: /Xuất PDF/ })).not.toBeInTheDocument();
  });
});
