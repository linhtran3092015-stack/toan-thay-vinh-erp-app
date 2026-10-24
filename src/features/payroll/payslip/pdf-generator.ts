import { attendanceLineTypes, groupPayrollLines, PIECEWORK_OFFSET } from "@/features/payroll/payroll-line-groups";
import { formatCurrency, formatSignedCurrency, getLineTypeLabel } from "@/features/payroll/payroll-presentation";
import { getPayslipSection, getPieceworkExplanation, signedAmount } from "@/features/payroll/payslip-sections";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";

/**
 * Escapes characters for PDF literal strings in standard ASCII/WinAnsi.
 */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Normalizes Vietnamese text to ASCII transliteration for standard Type 1 PDF font embedding fallback,
 * while preserving clear readability and structure. The content stream is written as UTF-8 under
 * /WinAnsiEncoding, so anything left outside printable ASCII would print as garbage ("×" as "Ã—").
 */
function toAsciiReadable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[×✕]/g, "x")
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/•/g, "*")
    .replace(/\s/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
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
  addText(`Tong thu nhap: ${data.totals.grossFormatted}`, 50, currentY, 10, false);
  const deductionsSigned = `${data.totals.totalDeductionsVnd > 0 ? "-" : ""}${data.totals.totalDeductionsFormatted}`;
  addText(`Khau tru: ${deductionsSigned}`, 300, currentY, 10, false);
  currentY -= 18;
  addText(`THUC NHAN: ${data.totals.netFormatted}`, 50, currentY, 13, true);
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
  // Helvetica 8pt: 90 characters stay inside the right margin from x = 70 even
  // for capital-heavy text (about 5.3pt a capital).
  const WRAP_CHARS = 90;
  const addWrapped = (text: string, x: number) => {
    let line = "";
    // A word longer than a line (a pasted link) is cut into line-sized pieces.
    const words = toAsciiReadable(text).split(/\s+/).flatMap((word) => word.match(new RegExp(`.{1,${WRAP_CHARS}}`, "g")) ?? []);
    for (const word of words) {
      if (line && line.length + word.length + 1 > WRAP_CHARS) {
        ensureSpace(14);
        addText(line, x, currentY, 8);
        currentY -= 12;
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) {
      ensureSpace(14);
      addText(line, x, currentY, 8);
      currentY -= 12;
    }
  };
  const renderSection = (title: string, lines: typeof data.earnings, options: {
    extraRows?: readonly { label: string; value: string }[];
    footnote?: string;
    perLine?: boolean;
    subtotal?: number;
  } = {}) => {
    const extraRows = options.extraRows ?? [];
    if (!lines.length && !extraRows.length) return;
    ensureSpace(45);
    addHeader(title, 50, currentY, 10);
    addText(formatSignedCurrency(options.subtotal ?? lines.reduce((sum, line) => sum + signedAmount(line), 0)), 435, currentY, 9, true);
    currentY -= 20;
    if (options.perLine) {
      // One row per line with the manager's note, so each correction carries its reason.
      for (const line of lines) {
        ensureSpace();
        addText(line.label, 60, currentY, 9);
        addText(formatSignedCurrency(signedAmount(line)), 435, currentY, 9);
        currentY -= 14;
        if (line.note) addWrapped(line.note, 70);
        currentY -= 4;
      }
    } else {
      for (const group of groupPayrollLines(lines)) {
        ensureSpace();
        addText(group.lines[0].label, 60, currentY, 9);
        addText(formatSignedCurrency(group.direction === "deduction" ? -group.amountVnd : group.amountVnd), 435, currentY, 9);
        currentY -= 18;
      }
    }
    for (const row of extraRows) {
      ensureSpace();
      addText(row.label, 60, currentY, 9);
      addText(row.value, 435, currentY, 9);
      currentY -= 18;
    }
    if (options.footnote) addWrapped(options.footnote, 60);
    currentY -= 10;
  };
  const sectionOf = (line: (typeof data.earnings)[number]) => getPayslipSection(line, data.piecework !== null);
  renderSection("LUONG THEO CONG", data.earnings.filter(line => attendanceLineTypes.has(line.lineType)));
  renderSection("CHAM BAI", data.earnings.filter(line => sectionOf(line) === "grading"));
  if (data.piecework) {
    renderSection("LUONG KHOAN", data.earnings.filter(line => sectionOf(line) === "piecework"), {
      extraRows: [{ label: getLineTypeLabel(PIECEWORK_OFFSET), value: `-${formatCurrency(data.piecework.absorbedVnd)}` }],
      footnote: getPieceworkExplanation(data.piecework),
      subtotal: data.piecework.addedVnd,
    });
  }
  renderSection("THUONG & PHU CAP", data.earnings.filter(line => sectionOf(line) === "earnings"));
  renderSection("DIEU CHINH", data.adjustments, { perLine: true });
  ensureSpace(30);
  addText("TONG THU NHAP", 50, currentY, 10, true);
  addText(data.totals.grossFormatted, 435, currentY, 10, true);
  currentY -= 28;
  renderSection("KHAU TRU", data.deductions);
  ensureSpace(60);
  addText("TONG KHAU TRU", 50, currentY, 10, true);
  addText(deductionsSigned, 435, currentY, 10, true);
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
