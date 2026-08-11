import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AcademicYearManagementPage } from "@/features/classes/management/academic-year-management-page";
import { NotificationListPage } from "@/features/notifications/notification-list-page";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentLifecycleStatusLabel } from "@/features/students/form/student-profile-form-helpers";
import { formatLedgerEntryType } from "@/features/students/ledger-data";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/notifications/actions/notification-actions", () => ({
  markAllNotificationsReadAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Prototype-safe mounted metadata presentation", () => {
  it("preserves known Student labels and presents constructor as an unsupported raw status", () => {
    render(<StudentStatusBadge status="active" />);
    expect(screen.getByText("Đang học")).toBeInTheDocument();

    render(<StudentStatusBadge status="constructor" />);
    expect(screen.getByText("Trạng thái chưa hỗ trợ: constructor")).toBeInTheDocument();
    expect(getStudentLifecycleStatusLabel("constructor")).toBe("Trạng thái chưa hỗ trợ: constructor");
    expect(formatLedgerEntryType("constructor")).toBe("Loại phát sinh chưa hỗ trợ: constructor");
  });

  it("presents an unsupported academic-year status neutrally without mounting management controls", () => {
    render(
      <AcademicYearManagementPage
        academicYears={[
          {
            classCounts: { active: 1, archived: 0, closed: 0, draft: 0, total: 1 },
            code: "2025-2026",
            endsOn: "2026-05-31",
            id: "active-year",
            isCurrent: true,
            name: "Năm học hiện tại",
            startsOn: "2025-08-01",
            status: "active",
          },
          {
            classCounts: { active: 0, archived: 0, closed: 0, draft: 0, total: 0 },
            code: "2026-2027",
            endsOn: "2027-05-31",
            id: "year-1",
            isCurrent: false,
            name: "Năm học thử nghiệm",
            startsOn: "2026-08-01",
            status: "constructor",
          },
        ]}
        canManageAcademicYears
      />,
    );

    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái chưa hỗ trợ: constructor")).toBeInTheDocument();
    const unsupportedRow = screen.getByText("Năm học thử nghiệm").closest("article");
    expect(unsupportedRow).not.toBeNull();
    expect(within(unsupportedRow!).queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();
    expect(within(unsupportedRow!).queryByRole("button", { name: "Đóng năm học" })).not.toBeInTheDocument();
    expect(within(unsupportedRow!).queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
  });

  it("keeps an unsupported notification event segment visible rather than rendering Object metadata", () => {
    render(
      <NotificationListPage
        entries={[{
          createdAt: "2026-08-12T00:00:00.000Z",
          entityId: null,
          entityType: null,
          eventCode: "payroll.constructor",
          href: null,
          id: "notification-1",
          message: "Dữ liệu kiểm thử.",
          readAt: "2026-08-12T00:01:00.000Z",
          title: "Thông báo kiểm thử",
        }]}
        unreadCount={0}
      />,
    );

    expect(screen.getByText("Sự kiện chưa hỗ trợ: constructor")).toBeInTheDocument();
    expect(screen.queryByText(/^function constructor/)).not.toBeInTheDocument();
  });
});
