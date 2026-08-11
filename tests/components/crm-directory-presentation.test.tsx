import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import { CrmTable } from "@/features/crm/components/crm-table";

afterEach(cleanup);

const item = {
  birthYear: 2015,
  createdAt: "2026-08-10T00:00:00Z",
  expectedGrade: 5,
  expectedLevel: "CLC",
  expectedMode: "offline",
  fullName: "Nguyễn Minh An",
  guardianFullName: "Nguyễn Thị Mai",
  guardianPhone: "0900000000",
  id: "case-1",
  leadSourceName: "MMA Fanpage Facebook",
  publicCode: "CRM-001",
  saleOwnerId: "sale-1",
  saleOwnerName: "Lê Hương",
  status: "trial_booked" as const,
  studentId: null,
};

describe("CRM directory presentation", () => {
  it("keeps CRM lifecycle status textual and leaves metadata neutral", () => {
    render(<CrmStatusBadge status="pending_enrollment_confirmation" />);
    expect(screen.getByText("Chờ xác nhận nhập học")).toBeInTheDocument();
  });

  it("fails closed for a prototype-property status", () => {
    render(<CrmStatusBadge status={"constructor" as typeof item.status} />);

    expect(screen.getByText("Trạng thái chưa hỗ trợ: constructor")).toBeInTheDocument();
    expect(screen.queryByText(/đã nhập học|đã đặt học thử/i)).not.toBeInTheDocument();
  });

  it("uses the shared table frame plus the labelled responsive record list without pagination", () => {
    render(<CrmTable directoryQuery="source=mma_fanpage" items={[item]} />);
    expect(screen.getByRole("table", { name: "Danh sách hồ sơ CRM và tuyển sinh" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Danh sách hồ sơ CRM và tuyển sinh" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ CRM Nguyễn Minh An" })).toHaveLength(2);
    expect(screen.queryByRole("navigation", { name: /phân trang/i })).not.toBeInTheDocument();
  });
});
