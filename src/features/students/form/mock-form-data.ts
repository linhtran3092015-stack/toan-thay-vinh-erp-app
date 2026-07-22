import type {
  ChecklistItemDefinition,
  MockClass,
  MockLeadSource,
  MockSaleOwner,
} from "./student-form-types";

export const mockClasses: MockClass[] = [
  ...Array.from({ length: 12 }).flatMap((_, index) => {
    const grade = index + 1;

    return [
      createMockClass(grade, "A", "A", "offline"),
      createMockClass(grade, "B", "B", "offline"),
      createMockClass(grade, "CLC", "CLC", grade % 2 === 0 ? "online" : "hybrid"),
    ];
  }),
  createMockClass(2, "AC1", "A", "hybrid"),
  createMockClass(5, "AC1", "A", "hybrid"),
  createMockClass(7, "CLC1", "CLC", "offline"),
  createMockClass(9, "CLC1", "CLC", "online"),
];

export const mockLeadSources: MockLeadSource[] = [
  { defaultPartnerName: "MMA Hà Nội", id: "mma", label: "MMA" },
  { defaultPartnerName: "Sandbox", id: "sandbox", label: "Sandbox" },
  { id: "zalo-personal", label: "Zalo cá nhân" },
  { id: "zalo-thay-vinh", label: "Zalo Thầy Vinh" },
  { id: "ads", label: "Quảng cáo" },
  { id: "school-telesale", label: "Telesale nhà trường" },
  { id: "word-of-mouth", label: "Truyền miệng" },
  { id: "self-sourced-data", label: "Data tự tìm" },
  { id: "other", label: "Nguồn khác" },
];

export const mockSaleOwners: MockSaleOwner[] = [
  { id: "sale-le-thu-trang", name: "Lê Thu Trang" },
  { id: "sale-nguyen-hoang-nam", name: "Nguyễn Hoàng Nam" },
  { id: "sale-pham-minh-khang", name: "Phạm Minh Khang" },
];

export const enrollmentChecklistItems: ChecklistItemDefinition[] = [
  { id: "paymentReceived", label: "Đã nhận học phí" },
  { id: "sourceConfirmed", label: "Đã xác nhận nguồn" },
  { id: "saleConfirmed", label: "Đã xác nhận sale chốt" },
  { id: "classSelected", label: "Đã chọn lớp chính" },
  { id: "modeConfirmed", label: "Đã xác nhận online/offline" },
  { id: "feeConfirmed", label: "Đã xác nhận học phí và ưu đãi" },
  {
    id: "assistantSessionsConfirmed",
    label: "Trợ lý đã xác nhận số buổi",
  },
  {
    accountingPermission: "sepay.accountant_confirm",
    id: "accountantTransactionConfirmed",
    label: "Kế toán đã xác nhận giao dịch",
  },
  { id: "officialStartDateEntered", label: "Đã nhập ngày học chính" },
  {
    id: "communicationGroupReady",
    label: "Sổ liên lạc đã tạo hoặc đang chờ",
  },
];

export const mockGuardianFamilies = [
  {
    children: [
      {
        className: "7A",
        fullName: "Nguyễn Minh Anh",
        id: "student-001",
        publicCode: "TV-2026-00125",
        statusLabel: "Đang học",
      },
      {
        className: "4A",
        fullName: "Nguyễn Minh Khoa",
        id: "mock-sibling-001",
        publicCode: "TV-2026-00088",
        statusLabel: "Đang học",
      },
    ],
    guardianName: "Nguyễn Thu Hà",
    normalizedPhone: "0901234125",
  },
  {
    children: [
      {
        className: "9A",
        fullName: "Phạm Gia Huy",
        id: "student-004",
        publicCode: "TV-2026-00128",
        statusLabel: "Đang học",
      },
    ],
    guardianName: "Phạm Ngọc Anh",
    normalizedPhone: "0904234128",
  },
];

function createMockClass(
  grade: number,
  suffix: string,
  learningLevel: MockClass["learningLevel"],
  mode: MockClass["mode"],
): MockClass {
  const name = `${grade}${suffix}`;
  const isOnlineLike = mode === "online" || mode === "hybrid";

  return {
    grade,
    id: `class-${grade}-${suffix.toLowerCase()}`,
    learningLevel,
    mode,
    name,
    schedule: {
      classInUrl: isOnlineLike
        ? `https://classin.example.com/toan-thay-vinh/${grade}-${suffix.toLowerCase()}`
        : undefined,
      roomName: isOnlineLike ? "Online" : `P.${grade}0${suffix === "A" ? 1 : 2}`,
      scheduleText:
        suffix === "B"
          ? "Thứ 2, Thứ 6 · 19:30"
          : "Thứ 3, Thứ 5 · 17:30",
      teacherName: learningLevel === "CLC" ? "Cô Lan" : "Thầy Vinh",
    },
  };
}
