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
  adjustments: [],
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
  piecework: null,
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

    const deductions = screen.getByRole("region", { name: "Khấu trừ" });
    expect(within(deductions).getByText("Khấu trừ tạm ứng").nextElementSibling).toHaveTextContent("−2.000.000 VND");
    expect(within(deductions).getByText("Tổng khấu trừ").nextElementSibling).toHaveTextContent("−2.000.000 VND");

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
    const deductions = screen.getByRole("region", { name: "Khấu trừ" });
    expect(within(deductions).getByText("Không phát sinh khoản tạm ứng hoặc khấu trừ trong kỳ.")).toBeInTheDocument();
    expect(within(deductions).getByText("Tổng khấu trừ").nextElementSibling?.textContent).toBe("0 VND");
  });

  // Value: protects=staff on lương cứng + lương khoán read the floor as part of lương khoán and manual corrections as "Điều chỉnh", never as money deducted;
  // fails_when=the piecework offset or a manual deduction is listed under "Khấu trừ", the offset turns red, or the explanation drops the threshold;
  // why_new=staff read the old "Bù trừ & khấu trừ −900.000 VND" as a cut in pay;
  // seam=none (PayslipDocument renders fixture data); no_claim=does not prove the loader builds these arrays (payslip-data tests cover that)
  it("shows lương khoán and corrections under income, not as deductions", () => {
    render(
      <PayslipDocument
        data={{
          ...data,
          adjustments: [
            line("a1", "manual_reward", "Điều chỉnh tăng", 80_000),
            line("a2", "manual_deduction", "Điều chỉnh giảm", 50_000, "deduction"),
          ],
          deductions: [],
          earnings: [
            line("e1", "base_offline", "Lương công offline", 1_500_000),
            line("e2", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 900_000),
          ],
          piecework: { absorbedVnd: 900_000, addedVnd: 0, baseSalaryVnd: 1_500_000, earnedVnd: 900_000, floorBasisPoints: 8_500, thresholdVnd: 1_275_000 },
          totals: { ...data.totals, grossFormatted: "1.530.000 VND", grossVnd: 1_530_000, netFormatted: "1.530.000 VND", netVnd: 1_530_000, totalDeductionsFormatted: "0 VND", totalDeductionsVnd: 0 },
        }}
      />,
    );

    const piecework = screen.getByRole("region", { name: "Lương khoán" });
    expect(within(piecework).getByText("Thưởng tái phí khối phụ trách").nextElementSibling).toHaveTextContent("900.000 VND");
    const absorbed = within(piecework).getByText("Phần lương khoán đã tính trong lương cứng").nextElementSibling as HTMLElement;
    expect(absorbed).toHaveTextContent("−900.000 VND");
    expect(absorbed).not.toHaveClass("text-danger");
    expect(piecework).toHaveTextContent("chưa vượt 85% lương cứng (1.500.000 VND × 85% = 1.275.000 VND)");
    expect(piecework).toHaveTextContent("Không có khoản nào bị trừ.");

    const adjustments = screen.getByRole("region", { name: "Điều chỉnh" });
    expect(within(adjustments).getByText("Điều chỉnh giảm").nextElementSibling).toHaveTextContent("−50.000 VND");
    expect(within(adjustments).getByRole("heading", { name: "Điều chỉnh" }).nextElementSibling).toHaveTextContent("30.000 VND");

    const deductions = screen.getByRole("region", { name: "Khấu trừ" });
    expect(deductions).not.toHaveTextContent(/lương khoán|Điều chỉnh/);
    expect(within(deductions).getByText("Tổng khấu trừ").nextElementSibling?.textContent).toBe("0 VND");
  });

  // Value: protects=above the floor, the printable "Lương khoán" block totals the part added on top of lương cứng (earned − already paid), lists the offset row, and explains the amount added;
  // fails_when=the Lương khoán SummarySection ignores `subtotal` and shows earnedVnd (2.800.000) or the bonus sum instead of addedVnd, the offset row disappears, or the above-floor explanation is not rendered;
  // why_new=the only PayslipDocument piecework fixture is below the floor (addedVnd 0), so a header showing earnedVnd or 0 is never told apart;
  // seam=none (PayslipDocument renders fixture data); no_claim=does not prove the loader computes addedVnd (payslip-sections and payslip-data tests cover that)
  it("totals lương khoán above the floor as the part added on top of lương cứng", () => {
    render(
      <PayslipDocument
        data={{
          ...data,
          deductions: [],
          earnings: [
            line("k1", "base_offline", "Lương công offline", 2_100_000),
            line("k2", "base_online", "Lương công online", 300_000),
            line("k3", "center_renewal_duty_bonus", "Thưởng quản lý và trực tin nhắn", 1_200_000),
            line("k4", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 1_075_000),
            line("k5", "payroll_processing_bonus", "Thưởng tính lương nhân sự", 525_000),
          ],
          piecework: { absorbedVnd: 2_040_000, addedVnd: 760_000, baseSalaryVnd: 2_400_000, earnedVnd: 2_800_000, floorBasisPoints: 8_500, thresholdVnd: 2_040_000 },
          totals: { ...data.totals, grossFormatted: "3.160.000 VND", grossVnd: 3_160_000, netFormatted: "3.160.000 VND", netVnd: 3_160_000, totalDeductionsFormatted: "0 VND", totalDeductionsVnd: 0 },
        }}
      />,
    );

    const piecework = screen.getByRole("region", { name: "Lương khoán" });
    expect(within(piecework).getByRole("heading", { name: "Lương khoán" }).nextElementSibling?.textContent).toBe("760.000 VND");
    expect(within(piecework).getByText("Phần lương khoán đã tính trong lương cứng").nextElementSibling?.textContent).toBe("−2.040.000 VND");
    expect(piecework).toHaveTextContent(
      "Lương khoán đạt 2.800.000 VND. Phần đến 85% lương cứng (2.400.000 VND × 85% = 2.040.000 VND) đã được trả trong lương cứng; phần vượt 760.000 VND được cộng thêm.",
    );
  });

  // Value: protects=on a lương khoán payslip every bonus, grading included, is listed once inside "Lương khoán", so the sections add up to Tổng thu nhập;
  // fails_when=the Chấm bài or Thưởng & phụ cấp filter goes back to line type alone (the grading bonus or the renewal bonus then shows twice: in its own section and in Lương khoán);
  // why_new=the piecework fixtures had no grading_bonus line, and the total comes precomputed from the loader, so a doubled section never broke a test;
  // seam=none (PayslipDocument renders fixture data); no_claim=does not check the PDF (its own test does)
  it("keeps grading and other bonuses only inside Lương khoán", () => {
    render(
      <PayslipDocument
        data={{
          ...data,
          deductions: [],
          earnings: [
            line("g1", "base_offline", "Lương công offline", 1_500_000),
            line("g2", "grading_bonus", "Thưởng chấm bài", 244_660),
            line("g3", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 700_000),
          ],
          piecework: { absorbedVnd: 900_000, addedVnd: 0, baseSalaryVnd: 1_500_000, earnedVnd: 900_000, floorBasisPoints: 8_500, thresholdVnd: 1_275_000 },
        }}
      />,
    );

    expect(screen.queryByRole("region", { name: "Chấm bài" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Thưởng & phụ cấp" })).not.toBeInTheDocument();
    const piecework = screen.getByRole("region", { name: "Lương khoán" });
    expect(within(piecework).getByText("Thưởng chấm bài")).toBeInTheDocument();
    expect(screen.getAllByText("Thưởng chấm bài")).toHaveLength(1);
  });

  // Value: protects=when manual decreases outweigh manual increases the printable "Điều chỉnh" header reads as a net decrease with a minus sign;
  // fails_when=the Điều chỉnh SummarySection total sums amounts without direction (70.000 VND) or drops the sign of a negative net (30.000 VND);
  // why_new=the existing adjustments fixture nets positive (80.000 − 50.000), so the negative branch of formatSignedCurrency never renders;
  // seam=none (PayslipDocument renders fixture data); no_claim=does not prove the loader routes manual lines into adjustments
  it("signs a net-negative Điều chỉnh total", () => {
    render(
      <PayslipDocument
        data={{
          ...data,
          adjustments: [
            line("a1", "manual_reward", "Điều chỉnh tăng", 20_000),
            line("a2", "manual_deduction", "Điều chỉnh giảm", 50_000, "deduction"),
          ],
          totals: { ...data.totals, grossFormatted: "4.950.000 VND", grossVnd: 4_950_000, netFormatted: "2.950.000 VND", netVnd: 2_950_000 },
        }}
      />,
    );

    const adjustments = screen.getByRole("region", { name: "Điều chỉnh" });
    expect(within(adjustments).getByRole("heading", { name: "Điều chỉnh" }).nextElementSibling?.textContent).toBe("−30.000 VND");
  });

  // Value: protects=each manual correction on the printable payslip keeps its own row and the manager's note as its reason, even when two share a line type;
  // fails_when=the Điều chỉnh SummarySection loses `perLine` and groups lines by type (one "Điều chỉnh tăng" row with the summed 390.000 VND), or stops rendering `note`;
  // why_new=every adjustments fixture had one line per type and no notes, so grouping and missing notes rendered the same;
  // seam=none (PayslipDocument renders fixture data); no_claim=does not prove the loader passes the stored note through (getLineNote)
  it("lists each correction on its own row with its note", () => {
    render(
      <PayslipDocument
        data={{
          ...data,
          adjustments: [
            { ...line("a1", "manual_reward", "Điều chỉnh tăng", 150_000), note: "Phụ cấp điện thoại tháng 9" },
            { ...line("a2", "manual_reward", "Điều chỉnh tăng", 240_000), note: "Hỗ trợ đi lại sự kiện tuyển sinh" },
          ],
          totals: { ...data.totals, grossFormatted: "5.370.000 VND", grossVnd: 5_370_000, netFormatted: "3.370.000 VND", netVnd: 3_370_000 },
        }}
      />,
    );

    const adjustments = screen.getByRole("region", { name: "Điều chỉnh" });
    expect(within(adjustments).getAllByText("Điều chỉnh tăng")).toHaveLength(2);
    expect(within(adjustments).getByText("Phụ cấp điện thoại tháng 9").closest("dt")?.nextElementSibling?.textContent).toBe("150.000 VND");
    expect(within(adjustments).getByText("Hỗ trợ đi lại sự kiện tuyển sinh").closest("dt")?.nextElementSibling?.textContent).toBe("240.000 VND");
    expect(within(adjustments).getByRole("heading", { name: "Điều chỉnh" }).nextElementSibling?.textContent).toBe("390.000 VND");
  });

  it("keeps a disabled PDF action readable with its reason", () => {
    render(<PayslipToolbar pdfDownloadUrl="/payroll/p/statements/s/payslip/pdf" pdfUnavailableReason="Bản xem trước không tạo PDF." />);

    const pdf = screen.getByRole("button", { name: /Xuất PDF/ });
    expect(pdf).toBeDisabled();
    expect(pdf).toHaveAccessibleDescription("Bản xem trước không tạo PDF.");
    expect(screen.queryByRole("link", { name: /Xuất PDF/ })).not.toBeInTheDocument();
  });
});
