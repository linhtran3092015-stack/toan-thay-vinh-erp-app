import type { StudentLifecycleStatus } from "@/types/domain";

export interface KpiMetric {
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "success" | "warning" | "danger" | "purple";
  trend: "up" | "down" | "flat";
  points: number[];
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  transactions: number;
}

export interface DistributionItem {
  label: string;
  percent: number;
  count: number;
  color: string;
}

export interface NotificationItem {
  title: string;
  description: string;
  time: string;
  tone: "danger" | "warning" | "info" | "success" | "purple";
}

export interface ScheduleItem {
  time: string;
  className: string;
  tutor: string;
  room: string;
  attendance: string;
  tone: "success" | "neutral";
}

export interface AttentionStudent {
  name: string;
  code: string;
  className: string;
  issue: string;
  status: string;
  statusTone: "danger" | "warning" | "info" | "purple";
  initials: string;
  lifecycleStatus: StudentLifecycleStatus;
}

export const kpiMetrics: KpiMetric[] = [
  {
    label: "Tổng học viên",
    value: "1.248",
    helper: "12% so với tháng trước",
    tone: "primary",
    trend: "up",
    points: [18, 13, 16, 10, 7, 12, 15],
  },
  {
    label: "Học viên đang học",
    value: "1.050",
    helper: "8% so với tháng trước",
    tone: "success",
    trend: "up",
    points: [17, 11, 13, 8, 11, 7, 10],
  },
  {
    label: "Doanh thu tháng này",
    value: "523.450.000đ",
    helper: "18% so với tháng trước",
    tone: "purple",
    trend: "up",
    points: [16, 11, 17, 12, 9, 14, 11],
  },
  {
    label: "Công nợ cần thu",
    value: "128.750.000đ",
    helper: "5% so với tháng trước",
    tone: "warning",
    trend: "down",
    points: [12, 18, 14, 20, 12, 16, 15],
  },
  {
    label: "Học viên cảnh báo",
    value: "37",
    helper: "Cần xử lý hôm nay",
    tone: "danger",
    trend: "flat",
    points: [18, 14, 17, 10, 13, 9, 12],
  },
];

export const revenuePoints: RevenuePoint[] = [
  { month: "T11/2024", revenue: 462, transactions: 176 },
  { month: "T12/2024", revenue: 538, transactions: 368 },
  { month: "T01/2025", revenue: 612, transactions: 246 },
  { month: "T02/2025", revenue: 568, transactions: 368 },
  { month: "T03/2025", revenue: 648, transactions: 282 },
  { month: "T04/2025", revenue: 512, transactions: 296 },
];

export const gradeDistribution: DistributionItem[] = [
  { label: "Lớp 6", percent: 28, count: 349, color: "#4F72FF" },
  { label: "Lớp 7", percent: 26, count: 325, color: "#2FB8A6" },
  { label: "Lớp 8", percent: 24, count: 299, color: "#7C5CFC" },
  { label: "Lớp 9", percent: 15, count: 187, color: "#F59E0B" },
  { label: "Lớp 10", percent: 7, count: 88, color: "#EC4899" },
];

export const sourceDistribution: DistributionItem[] = [
  { label: "MMA", percent: 68, count: 356, color: "#4F72FF" },
  { label: "Sandbox", percent: 32, count: 168, color: "#2FB8A6" },
];

export const notifications: NotificationItem[] = [
  {
    title: "Học viên Nguyễn Minh Anh (Lớp 7A)",
    description: "Vắng 3 buổi liên tiếp",
    time: "10 phút trước",
    tone: "danger",
  },
  {
    title: "5 học viên sắp hết buổi học",
    description: "Xem danh sách",
    time: "25 phút trước",
    tone: "warning",
  },
  {
    title: "12 giao dịch chưa đối soát",
    description: "Kiểm tra sau khi kết nối SePay",
    time: "1 giờ trước",
    tone: "info",
  },
  {
    title: "Bảng lương tháng 4/2025",
    description: "Chờ duyệt",
    time: "2 giờ trước",
    tone: "success",
  },
  {
    title: "3 phiếu coaching mới",
    description: "Ưu tiên xử lý",
    time: "3 giờ trước",
    tone: "purple",
  },
];

export const todaySchedule: ScheduleItem[] = [
  {
    time: "17:30",
    className: "Lớp 7A - Buổi 12",
    tutor: "Thầy Vinh",
    room: "P.101",
    attendance: "28/30",
    tone: "success",
  },
  {
    time: "19:30",
    className: "Lớp 8B - Buổi 15",
    tutor: "Thầy Vinh",
    room: "P.102",
    attendance: "26/28",
    tone: "success",
  },
  {
    time: "17:30",
    className: "Lớp 9A - Buổi 10",
    tutor: "Cô Lan",
    room: "P.201",
    attendance: "30/30",
    tone: "neutral",
  },
  {
    time: "19:30",
    className: "Lớp 6A - Buổi 8",
    tutor: "Thầy Nam",
    room: "P.202",
    attendance: "24/25",
    tone: "success",
  },
];

export const attentionStudents: AttentionStudent[] = [
  {
    name: "Nguyễn Minh Anh",
    code: "TV-2026-00125",
    className: "7A",
    issue: "Vắng 3 buổi liên tiếp",
    status: "Cảnh báo",
    statusTone: "danger",
    initials: "NA",
    lifecycleStatus: "active",
  },
  {
    name: "Trần Quốc Bảo",
    code: "TV-2026-00126",
    className: "8B",
    issue: "Điểm thấp 2 buổi liên tiếp",
    status: "Cảnh báo",
    statusTone: "danger",
    initials: "QB",
    lifecycleStatus: "active",
  },
  {
    name: "Lê Phương Thảo",
    code: "TV-2026-00127",
    className: "6A",
    issue: "Sắp hết học phí (còn 1 buổi)",
    status: "Sắp hết",
    statusTone: "warning",
    initials: "PT",
    lifecycleStatus: "active",
  },
  {
    name: "Phạm Gia Huy",
    code: "TV-2026-00128",
    className: "9A",
    issue: "Nợ học phí 2.500.000đ",
    status: "Công nợ",
    statusTone: "info",
    initials: "GH",
    lifecycleStatus: "active",
  },
  {
    name: "Hoàng Thanh Tùng",
    code: "TV-2026-00129",
    className: "7B",
    issue: "Chưa có phiếu coaching",
    status: "Cần coaching",
    statusTone: "purple",
    initials: "TT",
    lifecycleStatus: "active",
  },
];

export const quickActions = [
  "Thêm học viên",
  "Tạo lớp học",
  "Điểm danh",
  "Yêu cầu TT",
  "Chăm sóc CRM",
  "Phiếu coaching",
  "Báo cáo",
];
