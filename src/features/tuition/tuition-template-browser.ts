"use client";

import writeExcelFile, { type SheetData } from "write-excel-file/browser";

const REQUIRED_HEADER_BG = "#D9EAF7";
const OPTIONAL_HEADER_BG = "#F2F4F7";
const BORDER_COLOR = "#AAB2BD";

export interface StudentRateTemplateRow {
  publicCode: string;
  fullName: string;
  effectiveFrom: string;
  unitPriceVnd?: number;
  reason?: string;
}

export interface StudentSourceTemplateRow {
  publicCode: string;
  fullName: string;
  sourceCode?: string;
  sourceName?: string;
  reason?: string;
}

export async function downloadTuitionRateExcel(rows?: StudentRateTemplateRow[]): Promise<void> {
  const headerRow = [
    { value: "Mã học viên *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Họ và tên học viên", type: String, fontWeight: "bold" as const, backgroundColor: OPTIONAL_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Đơn giá mỗi buổi (VND) *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Ngày hiệu lực (YYYY-MM-DD) *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Căn cứ áp dụng *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
  ];

  const sampleRows = [
    [
      { type: String, value: "HV001", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Nguyễn Văn A", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: Number, value: 150000, format: "#,##0", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "2026-08-22", align: "center" as const, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Học phí khóa tháng 8-11", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
    ],
    [
      { type: String, value: "HV002", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Trần Thị B", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: Number, value: 120000, format: "#,##0", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "2026-08-22", align: "center" as const, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Chính sách ưu đãi khóa mới", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
    ],
  ];

  const dataRows = (rows && rows.length > 0)
    ? rows.map(r => [
        { type: String, value: r.publicCode, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.fullName, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: Number, value: r.unitPriceVnd ?? null, format: "#,##0", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.effectiveFrom, align: "center" as const, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.reason ?? "", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      ])
    : sampleRows;

  const columns = [
    { width: 22 },
    { width: 30 },
    { width: 28 },
    { width: 30 },
    { width: 35 },
  ];

  const filename = rows && rows.length > 0
    ? `danh-sach-bo-sung-don-gia-${new Date().toISOString().slice(0, 10)}.xlsx`
    : "mau-don-gia-hoc-phi.xlsx";

  const sheetData = [headerRow, ...dataRows] as SheetData;

  await writeExcelFile(
    sheetData,
    {
      columns,
      sheet: "Don_gia_hoc_phi",
      stickyRowsCount: 1,
    },
    {
      fontFamily: "Arial",
      fontSize: 11,
    },
  ).toFile(filename);
}

export async function downloadTuitionSourceExcel(
  sources: { code: string; name: string }[],
  rows?: StudentSourceTemplateRow[],
): Promise<void> {
  const headerRow = [
    { value: "Mã học viên *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Họ và tên học viên", type: String, fontWeight: "bold" as const, backgroundColor: OPTIONAL_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Mã nguồn tuyển sinh *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Tên nguồn (tham khảo)", type: String, fontWeight: "bold" as const, backgroundColor: OPTIONAL_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
    { value: "Lý do gán nguồn *", type: String, fontWeight: "bold" as const, backgroundColor: REQUIRED_HEADER_BG, borderColor: BORDER_COLOR, borderStyle: "thin" as const, align: "center" as const, alignVertical: "center" as const, height: 32 },
  ];

  const sampleRows = [
    [
      { type: String, value: "HV001", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Nguyễn Văn A", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "mma_fanpage", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "MMA Fanpage Facebook", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Đăng ký qua Fanpage", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
    ],
    [
      { type: String, value: "HV002", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Trần Thị B", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "referral_student", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Giới thiệu từ học viên cũ", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      { type: String, value: "Bạn cùng lớp giới thiệu", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
    ],
  ];

  const dataRows = (rows && rows.length > 0)
    ? rows.map(r => [
        { type: String, value: r.publicCode, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.fullName, borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.sourceCode ?? "", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.sourceName ?? sources.find(source => source.code === r.sourceCode)?.name ?? "", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
        { type: String, value: r.reason ?? "Khởi tạo dữ liệu ban đầu", borderColor: BORDER_COLOR, borderStyle: "thin" as const },
      ])
    : sampleRows;

  const columns = [
    { width: 22 },
    { width: 30 },
    { width: 25 },
    { width: 30 },
    { width: 35 },
  ];

  const filename = rows && rows.length > 0
    ? `danh-sach-bo-sung-nguon-${new Date().toISOString().slice(0, 10)}.xlsx`
    : "mau-nguon-hoc-vien.xlsx";

  const sheetData = [headerRow, ...dataRows] as SheetData;

  await writeExcelFile(
    sheetData,
    {
      columns,
      sheet: "Nguon_hoc_vien",
      stickyRowsCount: 1,
    },
    {
      fontFamily: "Arial",
      fontSize: 11,
    },
  ).toFile(filename);
}
