import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffRoleManagement } from "@/features/staff/components/staff-role-management";
import type { StaffDirectoryMember, StaffRoleOption } from "@/features/staff/types";

const actions = vi.hoisted(() => ({
  assignStaffRoleAction: vi.fn(),
  revokeStaffRoleAction: vi.fn(),
}));

vi.mock("@/features/staff/role-actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const member: StaffDirectoryMember = {
  avatarUrl: null,
  displayName: "Nguyễn Minh An",
  email: "an@example.com",
  employeeCode: "NS-001",
  employmentStatus: "active",
  id: "11111111-1111-4111-8111-111111111111",
  joinedAt: "2025-08-01",
  lastLoginAt: null,
  leftAt: null,
  phone: "0900000000",
  roles: [{
    assignedAt: "2025-08-01T00:00:00Z",
    assignmentId: "22222222-2222-4222-8222-222222222222",
    code: "teacher",
    id: "33333333-3333-4333-8333-333333333333",
    name: "Giáo viên",
  }],
};

const roleOptions: StaffRoleOption[] = [
  {
    code: "teacher",
    description: "Giảng dạy",
    id: "33333333-3333-4333-8333-333333333333",
    isSystem: false,
    name: "Giáo viên",
  },
  {
    code: "manager",
    description: "Quản lý",
    id: "44444444-4444-4444-8444-444444444444",
    isSystem: false,
    name: "Quản lý",
  },
];

function renderManagement() {
  return render(<StaffRoleManagement member={member} roleOptions={roleOptions} />);
}

function openManagement() {
  fireEvent.click(screen.getByText("Mở quản lý vai trò"));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("Staff role management", () => {
  it("keeps the existing available-role choice and exposes only the inline role workflows", () => {
    renderManagement();
    openManagement();

    expect(screen.getByRole("heading", { name: "Quản lý vai trò" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản lý" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Giáo viên" })).not.toBeInTheDocument();
    expect(screen.getByText("Thu hồi: Giáo viên")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cấp hàng loạt|thu hồi hàng loạt|chỉnh sửa vai trò|phân quyền/i })).not.toBeInTheDocument();
  });

  it("keeps assignment reason required and does not submit a blank assignment", () => {
    renderManagement();
    openManagement();

    const reason = screen.getByLabelText(/Lý do cấp vai trò/);
    expect(reason).toBeRequired();
    fireEvent.click(screen.getByRole("button", { name: "Cấp vai trò" }));

    expect(actions.assignStaffRoleAction).not.toHaveBeenCalled();
  });

  it("submits the existing assignment payload once, keeps the disclosure open while pending, and presents the server result", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.assignStaffRoleAction.mockReturnValueOnce(pending.promise);
    renderManagement();
    openManagement();

    fireEvent.change(screen.getByLabelText(/Vai trò cần cấp/), { target: { value: "manager" } });
    fireEvent.change(screen.getByLabelText(/Lý do cấp vai trò/), { target: { value: "Phân công quản lý ca học" } });
    const submit = screen.getByRole("button", { name: "Cấp vai trò" });
    const disclosure = screen.getByText("Mở quản lý vai trò").closest("details");

    fireEvent.click(submit);

    await waitFor(() => expect(actions.assignStaffRoleAction).toHaveBeenCalledOnce());
    const formData = actions.assignStaffRoleAction.mock.calls[0]?.[1] as FormData;
    expect(formData.get("userId")).toBe(member.id);
    expect(formData.get("roleCode")).toBe("manager");
    expect(formData.get("reason")).toBe("Phân công quản lý ca học");
    expect(submit).toBeDisabled();
    expect(disclosure).toHaveAttribute("open");

    fireEvent.click(screen.getByText("Mở quản lý vai trò"));
    expect(disclosure).toHaveAttribute("open");
    fireEvent.click(submit);
    expect(actions.assignStaffRoleAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Đã cấp vai trò thành công.", status: "success" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã cấp vai trò thành công."));
  });

  it("presents an authoritative assignment failure without recreating assignment eligibility", async () => {
    actions.assignStaffRoleAction.mockResolvedValueOnce({
      message: "Nhân sự này đã có vai trò được chọn.",
      status: "error",
    });
    renderManagement();
    openManagement();

    fireEvent.change(screen.getByLabelText(/Vai trò cần cấp/), { target: { value: "manager" } });
    fireEvent.change(screen.getByLabelText(/Lý do cấp vai trò/), { target: { value: "Phân công bổ sung" } });
    fireEvent.click(screen.getByRole("button", { name: "Cấp vai trò" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Nhân sự này đã có vai trò được chọn."));
  });

  it("keeps revocation reason required and presents server-owned revocation failures with a labelled error", async () => {
    actions.revokeStaffRoleAction.mockResolvedValueOnce({
      fieldErrors: { reason: ["Bắt buộc nhập lý do thu hồi vai trò."] },
      message: "Không thể thu hồi Owner cuối cùng đang hoạt động.",
      status: "error",
    });
    renderManagement();
    openManagement();
    fireEvent.click(screen.getByText("Thu hồi: Giáo viên"));

    const reason = screen.getByLabelText(/Lý do thu hồi/);
    const submit = screen.getByRole("button", { name: "Xác nhận thu hồi Giáo viên" });
    expect(reason).toBeRequired();
    fireEvent.click(submit);
    expect(actions.revokeStaffRoleAction).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "Điều chỉnh phân công" } });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.revokeStaffRoleAction).toHaveBeenCalledOnce());
    const formData = actions.revokeStaffRoleAction.mock.calls[0]?.[1] as FormData;
    expect(formData.get("assignmentId")).toBe(member.roles?.[0]?.assignmentId);
    expect(formData.get("reason")).toBe("Điều chỉnh phân công");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể thu hồi Owner cuối cùng đang hoạt động."));
    const error = screen.getByText("Bắt buộc nhập lý do thu hồi vai trò.");
    const errorId = reason.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId ?? "")).toContainElement(error);
    expect(error.closest("label")).toBeNull();
  });

  it("prevents duplicate revocation submission while the existing inline workflow is pending", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.revokeStaffRoleAction.mockReturnValueOnce(pending.promise);
    renderManagement();
    openManagement();
    fireEvent.click(screen.getByText("Thu hồi: Giáo viên"));

    fireEvent.change(screen.getByLabelText(/Lý do thu hồi/), { target: { value: "Kết thúc phân công" } });
    const submit = screen.getByRole("button", { name: "Xác nhận thu hồi Giáo viên" });
    const disclosure = screen.getByText("Thu hồi: Giáo viên").closest("details");
    fireEvent.click(submit);

    await waitFor(() => expect(actions.revokeStaffRoleAction).toHaveBeenCalledOnce());
    expect(submit).toBeDisabled();
    expect(disclosure).toHaveAttribute("open");
    fireEvent.click(screen.getByText("Thu hồi: Giáo viên"));
    expect(disclosure).toHaveAttribute("open");
    fireEvent.click(submit);
    expect(actions.revokeStaffRoleAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Đã thu hồi vai trò thành công.", status: "success" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã thu hồi vai trò thành công."));
  });
});
