import { mockStudents } from "@/features/students/mock-data";
import type { Student } from "@/features/students/types";
import type { StudentDetail } from "./types";

const studentById = new Map(mockStudents.map((student) => [student.id, student]));

export const mockStudentDetails: StudentDetail[] = [
  createMinhAnhDetail(requireStudent("student-001")),
  createGiaHuyDetail(requireStudent("student-004")),
  createThuLanDetail(requireStudent("student-006")),
];

export function getMockStudentDetail(studentId: string): StudentDetail | undefined {
  return mockStudentDetails.find((detail) => detail.student.id === studentId);
}

function requireStudent(studentId: string): Student {
  const student = studentById.get(studentId);

  if (!student) {
    throw new Error(`Missing Task 2A mock student ${studentId}`);
  }

  return student;
}

function createMinhAnhDetail(student: Student): StudentDetail {
  return {
    admissionSource: {
      partnerName: "MMA Hà Nội",
      recordedAt: "24/08/2024",
      saleOwnerName: student.saleOwnerName,
      sourceName: student.leadSourceName,
    },
    alerts: [
      {
        actionLabel: "Liên hệ phụ huynh",
        description: "Học viên vắng 2 buổi liên tiếp trong tuần gần nhất.",
        id: "alert-minh-absence",
        severity: "warning",
        title: "Vắng 2 buổi liên tiếp",
      },
      {
        actionLabel: "Mở phiếu coaching",
        description: "Điểm kiểm tra cuối buổi dưới 6 trong 2 buổi gần nhất.",
        id: "alert-minh-score",
        severity: "warning",
        title: "Điểm thấp 2 buổi liên tiếp",
      },
    ],
    attendance: [
      createAttendance("att-001", "19/07/2026", "7A", 15, "main", "unexcused_absence", "offline", 1, "Trợ giảng Hoàng Nam", true),
      createAttendance("att-002", "17/07/2026", "7A", 14, "main", "excused_absence", "offline", 1, "Trợ giảng Hoàng Nam", false),
      createAttendance("att-003", "14/07/2026", "7A", 13, "main", "present", "offline", 1, "Trợ giảng Hoàng Nam", false),
      createAttendance("att-004", "12/07/2026", "7A", 12, "main", "present", "online", 1, "Trợ giảng Minh Hà", false),
      createAttendance("att-005", "10/07/2026", "7A", 11, "additional", "additional_study", "online", 0, "Trợ giảng Minh Hà", false),
    ],
    auditTrail: [
      {
        action: "Cập nhật điểm danh",
        actorName: "Trợ giảng Hoàng Nam",
        id: "audit-001",
        module: "Điểm danh",
        newData: "Vắng KP",
        oldData: "Có mặt",
        reason: "Cập nhật muộn theo xác nhận lớp",
        timestamp: "19/07/2026 20:10",
      },
      {
        action: "Xác nhận nạp học phí",
        actorName: "Phạm Minh Hà",
        id: "audit-002",
        module: "Học phí",
        newData: "+12 buổi",
        oldData: "0 buổi",
        reason: "Đối soát giao dịch mock",
        timestamp: "15/03/2026 14:10",
      },
    ],
    coaching: [
      {
        campaignName: "Theo dõi điểm thấp tháng 7",
        id: "coach-001",
        openedAt: "18/07/2026",
        outcome: "Chờ buổi xem lại sau khi phụ huynh nhắc học bài.",
        ownerName: "Trợ lý Minh Hà",
        priority: "medium",
        reason: "Điểm kiểm tra dưới 6 trong 2 buổi liên tiếp.",
        reviewAt: "25/07/2026",
        status: "in_progress",
      },
    ],
    communicationGroup: {
      createdAt: "01/09/2024",
      createdBy: "Lê Thu Trang",
      groupName: "PH Nguyễn Minh Anh - Toán 7A",
      note: "Phụ huynh phản hồi nhanh qua Zalo.",
      status: "created",
    },
    guardian: {
      email: "ph.minhanh@example.com",
      fullName: student.guardianName,
      phone: student.guardianPhone,
      relationship: "Mẹ",
      zalo: student.guardianPhone,
    },
    ledger: [
      createLedger("ledger-001", "15/03/2026", "fee_topup", 12, 12, "TXN-20260315-001", "Phạm Minh Hà", "Nạp học phí tháng 3"),
      createLedger("ledger-002", "10/07/2026", "session_charge", -1, 8, "ATT-20260710-7A", "Hệ thống", "Trừ buổi học chính"),
      createLedger("ledger-003", "12/07/2026", "session_charge", -1, 7, "ATT-20260712-7A", "Hệ thống", "Trừ buổi học chính"),
      createLedger("ledger-004", "14/07/2026", "session_charge", -1, 6, "ATT-20260714-7A", "Hệ thống", "Trừ buổi học chính"),
    ],
    learningGoal: "Củng cố đại số lớp 7, chuẩn bị nền tảng thi chuyên.",
    mainClass: {
      className: student.mainClassName,
      officialStartDate: "01/09/2024",
      roomName: "P.101",
      scheduleText: "Thứ 3, Thứ 5 · 17:30",
      teacherName: "Thầy Vinh",
    },
    officialStartDate: "01/09/2024",
    provinceName: "Hà Nội",
    results: [
      createResult("result-001", "19/07/2026", "7A", 15, 5.5, 6, "Cần luyện lại bài biến đổi biểu thức.", "Cô Lan", "scored"),
      createResult("result-002", "17/07/2026", "7A", 14, null, null, "Vắng có phép, không áp dụng điểm.", "Cô Lan", "absent_not_applicable"),
      createResult("result-003", "14/07/2026", "7A", 13, 7, 7.5, "Hiểu bài, còn chậm ở bước trình bày.", "Cô Lan", "scored"),
      createResult("result-004", "12/07/2026", "7A", 12, 8, 7, "Có tiến bộ so với buổi trước.", "Cô Lan", "scored"),
      createResult("result-005", "10/07/2026", "7A", 11, null, 8, "Chưa nộp bài kiểm tra cuối buổi.", "Cô Lan", "not_submitted"),
    ],
    student,
    summary: {
      averageScoreLastFourSessions: 6.8,
      consecutiveAbsences: 2,
      currentUnitPrice: 250000,
      latestPaymentDate: "15/03/2026",
      totalBonusSessions: 2,
      totalPurchasedSessions: 36,
      totalUsedSessions: 30,
    },
    topups: [
      {
        amount: 3000000,
        bonusSessions: 2,
        date: "15/03/2026",
        effectiveUnitPrice: 250000,
        id: "topup-001",
        paidSessions: 12,
        status: "confirmed",
        type: "renewal",
      },
      {
        amount: 3000000,
        bonusSessions: 0,
        date: "01/09/2024",
        effectiveUnitPrice: 250000,
        id: "topup-002",
        paidSessions: 12,
        status: "confirmed",
        type: "new_enrollment",
      },
    ],
  };
}

function createGiaHuyDetail(student: Student): StudentDetail {
  const detail = createMinhAnhDetail(student);

  return {
    ...detail,
    admissionSource: {
      partnerName: "MMA Cầu Giấy",
      recordedAt: "12/09/2024",
      saleOwnerName: student.saleOwnerName,
      sourceName: student.leadSourceName,
    },
    alerts: [
      {
        actionLabel: "Tạo thanh toán",
        description: "Số dư hiện tại âm 3 buổi, cần nhắc phụ huynh đóng phí.",
        id: "alert-huy-negative",
        severity: "danger",
        title: "Âm buổi",
      },
      {
        actionLabel: "Mở coaching",
        description: "Phiếu coaching gần nhất chưa hoàn thành kết quả xem lại.",
        id: "alert-huy-coaching",
        severity: "warning",
        title: "Chưa hoàn thành coaching",
      },
    ],
    attendance: [
      createAttendance("att-huy-001", "19/07/2026", "9A", 18, "main", "present", "offline", 1, "Trợ giảng Mai Anh", false),
      createAttendance("att-huy-002", "17/07/2026", "9A", 17, "main", "present", "offline", 1, "Trợ giảng Mai Anh", false),
      createAttendance("att-huy-003", "14/07/2026", "9A", 16, "main", "unexcused_absence", "offline", 1, "Trợ giảng Mai Anh", true),
      createAttendance("att-huy-004", "12/07/2026", "9A", 15, "additional", "additional_study", "online", 0, "Trợ giảng Minh Hà", false),
    ],
    communicationGroup: {
      createdAt: "-",
      createdBy: "-",
      groupName: "Chưa có nhóm",
      note: "Cần tạo nhóm sau khi phụ huynh xác nhận lịch mới.",
      status: "missing",
    },
    guardian: {
      email: "ph.giahuy@example.com",
      fullName: student.guardianName,
      phone: student.guardianPhone,
      relationship: "Bố",
      zalo: student.guardianPhone,
    },
    ledger: [
      createLedger("ledger-huy-001", "10/06/2026", "fee_topup", 10, 5, "TXN-20260610-002", "Phạm Minh Hà", "Tái phí"),
      createLedger("ledger-huy-002", "12/07/2026", "session_charge", -1, -1, "ATT-20260712-9A", "Hệ thống", "Trừ buổi học chính"),
      createLedger("ledger-huy-003", "14/07/2026", "session_charge", -1, -2, "ATT-20260714-9A", "Hệ thống", "Trừ buổi học chính"),
      createLedger("ledger-huy-004", "19/07/2026", "session_charge", -1, -3, "ATT-20260719-9A", "Hệ thống", "Trừ buổi học chính"),
    ],
    learningGoal: "Ôn luyện thi vào lớp 10, ưu tiên phần hình học.",
    mainClass: {
      className: student.mainClassName,
      officialStartDate: "15/09/2024",
      roomName: "P.201",
      scheduleText: "Thứ 2, Thứ 6 · 19:30",
      teacherName: "Thầy Vinh",
    },
    officialStartDate: "15/09/2024",
    provinceName: "Hà Nội",
    results: [
      createResult("result-huy-001", "19/07/2026", "9A", 18, 6, 6.5, "Cần chắc lại chuyên đề đường tròn.", "Thầy Vinh", "scored"),
      createResult("result-huy-002", "17/07/2026", "9A", 17, 5.5, 6, "Làm thiếu bước giải thích.", "Thầy Vinh", "scored"),
      createResult("result-huy-003", "14/07/2026", "9A", 16, null, null, "Vắng không phép.", "Thầy Vinh", "absent_not_applicable"),
      createResult("result-huy-004", "12/07/2026", "9A", 15, 7, null, "Vở chưa nộp sau buổi học thêm.", "Thầy Vinh", "not_submitted"),
    ],
    student,
    summary: {
      averageScoreLastFourSessions: 6.1,
      consecutiveAbsences: 0,
      currentUnitPrice: 260000,
      latestPaymentDate: "10/06/2026",
      totalBonusSessions: 1,
      totalPurchasedSessions: 25,
      totalUsedSessions: 28,
    },
    topups: [
      {
        amount: 2600000,
        bonusSessions: 1,
        date: "10/06/2026",
        effectiveUnitPrice: 260000,
        id: "topup-huy-001",
        paidSessions: 10,
        status: "confirmed",
        type: "renewal",
      },
    ],
  };
}

function createThuLanDetail(student: Student): StudentDetail {
  const detail = createMinhAnhDetail(student);

  return {
    ...detail,
    admissionSource: {
      partnerName: "Sandbox",
      recordedAt: "05/10/2024",
      saleOwnerName: student.saleOwnerName,
      sourceName: student.leadSourceName,
    },
    alerts: [
      {
        actionLabel: "Xem lịch bảo lưu",
        description: "Học viên đang bảo lưu, cần ngày xem lại trước khi quay lại học.",
        id: "alert-lan-reserve",
        severity: "info",
        title: "Bảo lưu cần theo dõi",
      },
    ],
    attendance: [
      createAttendance("att-lan-001", "01/07/2026", "6A", 12, "main", "excused_absence", "online", 1, "Trợ giảng Minh Hà", false),
      createAttendance("att-lan-002", "29/06/2026", "6A", 11, "main", "present", "online", 1, "Trợ giảng Minh Hà", false),
      createAttendance("att-lan-003", "26/06/2026", "6A", 10, "main", "present", "online", 1, "Trợ giảng Minh Hà", false),
    ],
    communicationGroup: {
      createdAt: "10/10/2024",
      createdBy: "Lê Thu Trang",
      groupName: "PH Nguyễn Thu Lan - Toán 6A",
      note: "Tạm dừng trao đổi trong thời gian bảo lưu.",
      status: "created",
    },
    guardian: {
      email: "ph.thulan@example.com",
      fullName: student.guardianName,
      phone: student.guardianPhone,
      relationship: "Mẹ",
      zalo: student.guardianPhone,
    },
    ledger: [
      createLedger("ledger-lan-001", "05/10/2024", "fee_topup", 15, 15, "TXN-20241005-004", "Phạm Minh Hà", "Tuyển mới"),
      createLedger("ledger-lan-002", "01/07/2026", "adjustment", 0, 15, "RESERVE-20260701", "Nguyễn Hoàng Nam", "Bảo lưu theo yêu cầu phụ huynh"),
    ],
    learningGoal: "Giữ nhịp toán nâng cao lớp 6 sau thời gian bảo lưu.",
    mainClass: {
      className: student.mainClassName,
      officialStartDate: "10/10/2024",
      roomName: "Online",
      scheduleText: "Thứ 4, Chủ nhật · 18:00",
      teacherName: "Cô Lan",
    },
    officialStartDate: "10/10/2024",
    provinceName: "Hải Phòng",
    results: [
      createResult("result-lan-001", "01/07/2026", "6A", 12, null, null, "Được miễn do bảo lưu.", "Cô Lan", "exempt"),
      createResult("result-lan-002", "29/06/2026", "6A", 11, 8.5, 9, "Tư duy tốt, trình bày rõ.", "Cô Lan", "scored"),
      createResult("result-lan-003", "26/06/2026", "6A", 10, 8, 8.5, "Hoàn thành bài vở đầy đủ.", "Cô Lan", "scored"),
    ],
    student,
    summary: {
      averageScoreLastFourSessions: 8.4,
      consecutiveAbsences: 1,
      currentUnitPrice: 240000,
      latestPaymentDate: "05/10/2024",
      totalBonusSessions: 3,
      totalPurchasedSessions: 30,
      totalUsedSessions: 15,
    },
    topups: [
      {
        amount: 3600000,
        bonusSessions: 3,
        date: "05/10/2024",
        effectiveUnitPrice: 240000,
        id: "topup-lan-001",
        paidSessions: 15,
        status: "confirmed",
        type: "new_enrollment",
      },
    ],
  };
}

function createAttendance(
  id: string,
  date: string,
  className: string,
  sessionNumber: number,
  kind: StudentDetail["attendance"][number]["kind"],
  status: StudentDetail["attendance"][number]["status"],
  actualMode: StudentDetail["attendance"][number]["actualMode"],
  deductedSessions: number,
  markedBy: string,
  isLateUpdate: boolean,
) {
  return {
    actualMode,
    className,
    date,
    deductedSessions,
    id,
    isLateUpdate,
    kind,
    markedBy,
    sessionNumber,
    status,
  };
}

function createResult(
  id: string,
  date: string,
  className: string,
  sessionNumber: number,
  quizScore: number | null,
  notebookScore: number | null,
  comment: string,
  gradedBy: string,
  status: StudentDetail["results"][number]["status"],
) {
  return {
    className,
    comment,
    date,
    gradedBy,
    id,
    notebookScore,
    quizScore,
    sessionNumber,
    status,
  };
}

function createLedger(
  id: string,
  date: string,
  type: StudentDetail["ledger"][number]["type"],
  delta: number,
  balanceAfter: number,
  reference: string,
  actorName: string,
  note: string,
) {
  return {
    actorName,
    balanceAfter,
    date,
    delta,
    id,
    note,
    reference,
    type,
  };
}
