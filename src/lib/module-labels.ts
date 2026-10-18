/**
 * Vietnamese names for the module part of permission codes and audit rows
 * (`audit_logs.module`). Keyed with `Object.hasOwn`, so a code such as
 * "constructor" never reads an Object prototype member; unknown codes fall
 * back to the code itself, word by word capitalised ("student_import" →
 * "Student Import").
 */
const MODULE_LABELS: Readonly<Record<string, string>> = {
  advances: "Tạm ứng lương",
  app: "Truy cập hệ thống",
  attendance: "Điểm danh",
  audit: "Nhật ký hệ thống",
  cashflow: "Dòng tiền",
  classes: "Lớp học",
  coaching: "Coaching",
  commissions: "Hoa hồng",
  crm: "Tuyển sinh & CRM",
  dashboard: "Tổng quan",
  finance: "Tài chính",
  grading_credits: "Tín chỉ chấm bài",
  guardians: "Phụ huynh",
  imports: "Nhập dữ liệu",
  notifications: "Thông báo",
  ops: "Vận hành hệ thống",
  parent_messages: "Tin nhắn phụ huynh",
  payments: "Thanh toán",
  payroll: "Bảng lương",
  rbac: "Phân quyền",
  refunds: "Hoàn tiền",
  reports: "Báo cáo",
  results: "Kết quả học tập",
  sepay: "SePay",
  session_ledger: "Sổ buổi học",
  sessions: "Buổi học",
  settings: "Cài đặt",
  staff: "Nhân sự",
  student_care: "Chăm sóc học viên",
  students: "Học viên",
  timekeeping: "Chấm công",
};

export function formatModuleLabel(code: string): string {
  if (Object.hasOwn(MODULE_LABELS, code)) {
    return MODULE_LABELS[code];
  }

  return code
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase("vi") + part.slice(1))
    .join(" ");
}
