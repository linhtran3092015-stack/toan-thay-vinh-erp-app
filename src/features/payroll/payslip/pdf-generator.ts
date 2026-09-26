import { attendanceLineTypes, groupPayrollLines } from "@/features/payroll/payroll-line-groups";
import { formatCurrency } from "@/features/payroll/payroll-presentation";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";

/**
 * Escapes characters for PDF literal strings in standard ASCII/WinAnsi.
 */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Normalizes Vietnamese text to ASCII transliteration for standard Type 1 PDF font embedding fallback,
 * while preserving clear readability and structure.
 */
function toAsciiReadable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Generates a standard A4 PDF document binary (PDF-1.4) for the payslip.
 */
export function generatePayslipPdf(data: PayslipDocumentData): Uint8Array {
  // Content stream lines
  const pages: string[][] = [[]];
  let textLines = pages[0];

  const addHeader = (
    title: string,
    x: number,
    y: number,
    size = 16,
    bold = true,
  ) => {
    textLines.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(toAsciiReadable(title))}) Tj ET`,
    );
  };

  const addRightText = (text: string, y: number, size = 10, bold = false) => {
    textLines.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf 350 ${y} Td (${escapePdfText(toAsciiReadable(text))}) Tj ET`,
    );
  };

  const addText = (text: string, x: number, y: number, size = 10, bold = false) => {
    textLines.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(toAsciiReadable(text))}) Tj ET`,
    );
  };

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    textLines.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  };

  // Draw Header
  addHeader("TRUNG TAM TOAN THAY VINH", 50, 800, 14, true);
  addText("Hoc Toan tu duy - Lam chu tuong lai", 50, 786, 9, false);

  addHeader(`PHIEU LUONG - ${data.period.periodMonthFormatted}`, 50, 755, 16, true);

  // Right box: Period info
  addRightText(`Ky luong: ${data.period.periodStartDate} - ${data.period.periodEndDate}`, 790, 9, true);
  addRightText(`Ngay tra luong: ${data.period.payDateFormatted}`, 776, 9, false);
  addRightText(`Trang thai: ${data.period.statusLabel.toUpperCase()}`, 762, 9, false);

  addLine(50, 740, 545, 740);

  // Employee Information Box
  let currentY = 720;
  addHeader("THONG TIN NHAN SU", 50, currentY, 11, true);
  currentY -= 18;
  addText(`Ho va ten: ${data.employee.displayName}`, 50, currentY, 10, true);
  if (data.employee.employeeCode) {
    addText(`Ma nhan su: ${data.employee.employeeCode}`, 300, currentY, 10, false);
  }
  currentY -= 15;
  addText(`Vi tri: ${data.employee.positionLabel}`, 50, currentY, 10, false);
  if (data.employee.bankAccount) {
    addText(
      `Ngan hang: ${data.employee.bankAccount.bankName} - ${data.employee.bankAccount.accountNumberMasked}`,
      300,
      currentY,
      10,
      false
    );
  }

  currentY -= 20;
  addLine(50, currentY, 545, currentY);
  currentY -= 20;

  // Income Overview Box
  addHeader("TONG QUAN THU NHAP", 50, currentY, 11, true);
  currentY -= 18;
  addText(`Tong thu nhap (Gross): ${data.totals.grossFormatted}`, 50, currentY, 10, false);
  addText(`Tong khau tru: ${data.totals.totalDeductionsFormatted}`, 300, currentY, 10, false);
  currentY -= 18;
  addText(`THUC NHAN (Net Pay): ${data.totals.netFormatted}`, 50, currentY, 13, true);
  currentY -= 15;
  addText(`Bang chu: ${data.totals.amountInWords}`, 50, currentY, 9, false);

  currentY -= 20;
  addLine(50, currentY, 545, currentY);
  currentY -= 20;

  const ensureSpace = (height = 20) => {
    if (currentY - height < 100) {
      textLines = [];
      pages.push(textLines);
      currentY = 800;
      addHeader(`PHIEU LUONG - ${data.employee.displayName} (tiep)`, 50, currentY, 12);
      currentY -= 28;
    }
  };
  const renderSection = (title: string, lines: typeof data.earnings) => {
    if (!lines.length) return;
    ensureSpace(45);
    addHeader(title, 50, currentY, 10);
    addText(formatCurrency(lines.reduce((sum, line) => sum + line.amountVnd, 0)), 435, currentY, 9, true);
    currentY -= 20;
    for (const group of groupPayrollLines(lines)) {
      ensureSpace();
      addText(group.lines[0].label, 60, currentY, 9);
      addText(formatCurrency(group.amountVnd), 435, currentY, 9);
      currentY -= 18;
    }
    currentY -= 10;
  };
  renderSection("LUONG THEO CONG", data.earnings.filter(line => attendanceLineTypes.has(line.lineType)));
  renderSection("CHAM BAI", data.earnings.filter(line => line.lineType === "grading_bonus"));
  renderSection("THUONG & PHU CAP", data.earnings.filter(line => !attendanceLineTypes.has(line.lineType) && line.lineType !== "grading_bonus"));
  ensureSpace(30);
  addText("TONG THU NHAP", 50, currentY, 10, true);
  addText(data.totals.grossFormatted, 435, currentY, 10, true);
  currentY -= 28;
  renderSection("BU TRU & KHAU TRU", data.deductions);
  ensureSpace(60);
  addText("TONG BU TRU & KHAU TRU", 50, currentY, 10, true);
  addText(data.totals.totalDeductionsFormatted, 435, currentY, 10, true);
  currentY -= 25;
  addText("THUC NHAN", 50, currentY, 12, true);
  addText(data.totals.netFormatted, 435, currentY, 11, true);

  // Notes and Signature
  addText("Ghi chu: Phieu luong duoc lap tu dong tu he thong ERP Toan Thay Vinh.", 50, 75, 8, false);
  addText(`Nguoi nhan luong: ${data.employee.displayName}`, 350, 75, 9, true);
  addText("TRUNG TAM TOAN THAY VINH - ERP OPERATIONAL SYSTEM", 50, 45, 8, false);

  // Every page owns a content stream; no source rows or totals are silently dropped.
  const objects: string[] = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  ];
  pages.forEach((page, index) => {
    const contentId = 6 + index * 2;
    page.push(`BT /F1 8 Tf 500 45 Td (${index + 1}/${pages.length}) Tj ET`);
    const content = page.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  });

  // Build PDF Binary
  let pdfString = `%PDF-1.4\n`;
  const xrefOffsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(Buffer.byteLength(pdfString, "utf8"));
    pdfString += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startXref = Buffer.byteLength(pdfString, "utf8");
  pdfString += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i++) {
    const offset = xrefOffsets[i].toString().padStart(10, "0");
    pdfString += `${offset} 00000 n \n`;
  }

  pdfString += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  return new TextEncoder().encode(pdfString);
}
