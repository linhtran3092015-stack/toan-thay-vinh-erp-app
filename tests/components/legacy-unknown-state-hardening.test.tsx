import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClassDetailPage } from "@/features/classes/class-detail-page";
import { ClassListPage } from "@/features/classes/class-list-page";
import { CoachingDetailPage } from "@/features/coaching/coaching-detail-page";
import { AccountManagementPage } from "@/features/settings/account-management-page";
import type { ClassDetailReadModel, ClassDirectoryItem } from "@/features/classes/read-models";
import type { CoachingRecordDashboardEntry } from "@/features/coaching/read-models";
import type { SettingsAccountInvitation } from "@/features/settings/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
});

const classItem: ClassDirectoryItem = {
  academicYear: null,
  activeScheduleCount: 0,
  activeStudentCount: 0,
  code: "7A",
  defaultLearningMode: "offline",
  grade: 7,
  id: "class-1",
  level: "A",
  name: "Toán 7A",
  notes: null,
  status: "constructor",
  weeklySessionCount: 2,
};

const coachingRecord: CoachingRecordDashboardEntry = {
  assistantOwnerDisplayName: "Cô Mai",
  assistantOwnerId: "staff-1",
  campaignName: "Theo dõi tháng 8",
  currentStatus: "constructor",
  id: "coaching-1",
  latestEventAt: null,
  latestOutcome: null,
  openedAt: "2026-08-01T08:00:00Z",
  priority: "medium",
  reason: "Theo dõi tiến độ",
  reviewAt: null,
  studentFullName: "Nguyễn An",
  studentId: "student-1",
  studentPublicCode: "HV-001",
};

const unknownInvitation: SettingsAccountInvitation = {
  acceptedAt: null,
  email: "owner@example.com",
  id: "invitation-1",
  invitationReason: "Mời Owner",
  invitedAt: "2026-08-01T08:00:00Z",
  revokedAt: null,
  roleIds: [],
  status: "constructor",
};

describe("Legacy unknown-status fail-closed presentation", () => {
  it("keeps an unsupported Coaching status visible and actionless", () => {
    render(
      <CoachingDetailPage
        canManage
        events={[]}
        record={coachingRecord}
      />,
    );

    expect(screen.getByText("Trạng thái chưa hỗ trợ: constructor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm ghi chú" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bắt đầu xử lý" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng phiếu" })).not.toBeInTheDocument();
  });

  it("keeps known Coaching states presentable while only exact mutable states receive actions", () => {
    const openView = render(
      <CoachingDetailPage
        canManage
        events={[]}
        record={{ ...coachingRecord, currentStatus: "open" }}
      />,
    );

    expect(screen.getByText("Mở")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bắt đầu xử lý" })).toBeInTheDocument();
    openView.unmount();

    const inProgressView = render(
      <CoachingDetailPage
        canManage
        events={[]}
        record={{ ...coachingRecord, currentStatus: "in_progress" }}
      />,
    );
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng phiếu" })).toBeInTheDocument();
    inProgressView.unmount();

    render(
      <CoachingDetailPage
        canManage
        events={[]}
        record={{ ...coachingRecord, currentStatus: "closed" }}
      />,
    );
    expect(screen.getByText("Đã đóng")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm ghi chú" })).not.toBeInTheDocument();
  });

  it("keeps an unsupported invitation visible without treating it as pending", () => {
    render(
      <AccountManagementPage
        canManage
        invitations={[unknownInvitation]}
        members={[]}
        roleOptions={[]}
        roles={[]}
      />,
    );

    expect(screen.getByText("Trạng thái lời mời chưa hỗ trợ: constructor · owner@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Tài khoản chờ đăng nhập")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thu hồi" })).not.toBeInTheDocument();
  });

  it("keeps a known pending invitation eligible for its existing revoke control", () => {
    render(
      <AccountManagementPage
        canManage
        invitations={[{ ...unknownInvitation, status: "pending" }]}
        members={[]}
        roleOptions={[]}
        roles={[]}
      />,
    );

    expect(screen.getByText("Tài khoản chờ đăng nhập")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thu hồi" })).toBeInTheDocument();
  });

  it("uses neutral unsupported metadata for constructor in both Class list and detail views", () => {
    const detail: ClassDetailReadModel = {
      ...classItem,
      academicYear: {
        code: "2026-2027",
        endsOn: "2027-05-31",
        id: "year-1",
        isCurrent: true,
        name: "Năm học 2026-2027",
        startsOn: "2026-08-01",
        status: "constructor",
      },
      classinUrl: null,
      componentClasses: [],
      schedules: [],
    };
    const { rerender } = render(
      <ClassListPage canCreateClass={false} classes={[classItem]} />,
    );

    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: constructor")).not.toHaveLength(0);
    const desktopRow = screen
      .getAllByText("Toán 7A")
      .map((element) => element.closest("tr"))
      .find((row) => row !== null);
    expect(desktopRow).not.toBeNull();
    expect(desktopRow).not.toHaveTextContent(
      "Đang hoạt động",
    );

    rerender(
      <ClassDetailPage
        canEditClass
        canManageSchedule
        canViewStudentCount
        detail={detail}
      />,
    );

    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Kích hoạt|Đóng lớp|Lưu trữ/i })).not.toBeInTheDocument();
  });
});
