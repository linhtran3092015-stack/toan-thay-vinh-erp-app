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
  const textLines: string[] = [];

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

  // Section I: Earnings
  addHeader("I. THU NHAP", 50, currentY, 11, true);
  currentY -= 16;
  addText("Khoan muc", 50, currentY, 9, true);
  addText("So tien", 450, currentY, 9, true);
  currentY -= 10;
  addLine(50, currentY, 545, currentY);
  currentY -= 14;

  for (const item of data.earnings) {
    addText(item.label, 50, currentY, 9, false);
    addText(item.amountFormatted, 450, currentY, 9, false);
    currentY -= 14;
    if (currentY < 120) break;
  }

  addLine(50, currentY, 545, currentY);
  currentY -= 14;
  addText("TONG CONG THU NHAP:", 50, currentY, 9, true);
  addText(data.totals.grossFormatted, 450, currentY, 9, true);

  currentY -= 20;

  // Section II: Deductions
  if (data.deductions.length > 0 && currentY > 120) {
    addHeader("II. TAM UNG & KHAU TRU", 50, currentY, 11, true);
    currentY -= 16;
    addText("Khoan muc", 50, currentY, 9, true);
    addText("So tien", 450, currentY, 9, true);
    currentY -= 10;
    addLine(50, currentY, 545, currentY);
    currentY -= 14;

    for (const item of data.deductions) {
      addText(item.label, 50, currentY, 9, false);
      addText(item.amountFormatted, 450, currentY, 9, false);
      currentY -= 14;
      if (currentY < 120) break;
    }

    addLine(50, currentY, 545, currentY);
    currentY -= 14;
    addText("TONG CONG KHAU TRU:", 50, currentY, 9, true);
    addText(data.totals.totalDeductionsFormatted, 450, currentY, 9, true);
    currentY -= 20;
  }

  // Summary formula
  if (currentY > 100) {
    addLine(50, currentY, 545, currentY);
    currentY -= 16;
    addText(
      `CONG THUC: Gross (${data.totals.grossFormatted}) - Khau tru (${data.totals.totalDeductionsFormatted}) = Thuc nhan (${data.totals.netFormatted})`,
      50,
      currentY,
      9,
      true
    );
    currentY -= 25;
  }

  // Notes and Signature
  addText("Ghi chu: Phieu luong duoc lap tu dong tu he thong ERP Toan Thay Vinh.", 50, 75, 8, false);
  addText(`Nguoi nhan luong: ${data.employee.displayName}`, 350, 75, 9, true);
  addText("TRUNG TAM TOAN THAY VINH - ERP OPERATIONAL SYSTEM", 50, 45, 8, false);

  const streamContent = textLines.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf8");

  // PDF Objects
  const objects: string[] = [
    // 1: Catalog
    `<< /Type /Catalog /Pages 2 0 R >>`,
    // 2: Pages
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    // 3: Page
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    // 4: Font 1 (Helvetica)
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    // 5: Font 2 (Helvetica-Bold)
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
    // 6: Content stream
    `<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`,
  ];

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
