import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateCoachingDialog } from "@/features/coaching/components/create-coaching-dialog";
import { CoachingEventActions } from "@/features/coaching/components/coaching-event-actions";
import { InviteAccountDialog } from "@/features/settings/components/invite-account-dialog";
import { ManageAccountRolesDialog } from "@/features/settings/components/manage-account-roles-dialog";
import { PendingInvitationCard } from "@/features/settings/components/pending-invitation-card";

const coachingActions = vi.hoisted(() => ({
  addCoachingNoteAction: vi.fn(),
  advanceCoachingStatusAction: vi.fn(),
  createCoachingRecordAction: vi.fn(),
}));
const settingsActions = vi.hoisted(() => ({
  inviteAccountAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
  setAccountRolesAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/coaching/actions/coaching-actions", () => coachingActions);
vi.mock("@/features/settings/actions", () => settingsActions);

const studentId = "11111111-1111-4111-8111-111111111111";
const assigneeId = "22222222-2222-4222-8222-222222222222";
const coachingRecordId = "33333333-3333-4333-8333-333333333333";
const invitationId = "44444444-4444-4444-8444-444444444444";
const memberId = "55555555-5555-4555-8555-555555555555";
const roleId = "66666666-6666-4666-8666-666666666666";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

const coachingSuccess = {
  message: "Đã lưu phiếu Coaching.",
  redirectTo: "/coaching/record-1",
  status: "success" as const,
};
const actionSuccess = { message: "Đã lưu.", status: "success" as const };
const actionError = { message: "Thao tác đã bị máy chủ từ chối.", status: "error" as const };

const coachingProps = {
  assignees: [{ displayName: "Trợ lý An", id: assigneeId, roleCode: "assistant_manager" as const }],
  students: [{ fullName: "Học viên Bình", id: studentId, lifecycleStatus: "active", publicCode: "HV-001" }],
};
const roles = [{ code: "assistant", description: "Trợ lý", id: roleId, isSystem: false, name: "Trợ lý" }];

function fillCoachingCreateForm() {
  fireEvent.change(screen.getByLabelText("Học viên"), { target: { value: studentId } });
  fireEvent.change(screen.getByLabelText("Tên đợt Coaching"), { target: { value: "Theo dõi tháng 8" } });
  fireEvent.change(screen.getByLabelText("Lý do theo dõi"), { target: { value: "Cần hỗ trợ học tập" } });
}

describe("Legacy consequential Dialog migrations", () => {
  it("keeps Coaching create payload exact, locks unresolved interaction, then closes and refreshes on success", async () => {
    const pending = deferred<typeof coachingSuccess>();
    coachingActions.createCoachingRecordAction.mockReturnValueOnce(pending.promise);

    render(<CreateCoachingDialog {...coachingProps} />);
    const trigger = screen.getByRole("button", { name: "Tạo phiếu Coaching" });
    trigger.focus();
    fireEvent.click(trigger);

    const student = screen.getByLabelText("Học viên");
    await waitFor(() => expect(student).toHaveFocus());
    fillCoachingCreateForm();
    const submit = screen.getByRole("button", { name: "Tạo phiếu" });
    fireEvent.click(submit);

    await waitFor(() => expect(coachingActions.createCoachingRecordAction).toHaveBeenCalledWith({
      assistantOwnerId: assigneeId,
      campaignName: "Theo dõi tháng 8",
      priority: "medium",
      reason: "Cần hỗ trợ học tập",
      reviewAt: "",
      studentId,
    }));
    const dialog = screen.getByRole("dialog", { name: "Tạo phiếu Coaching" });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(screen.getByText("Đang tạo phiếu…")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(submit);
    expect(coachingActions.createCoachingRecordAction).toHaveBeenCalledOnce();

    pending.resolve(coachingSuccess);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.push).toHaveBeenCalledWith("/coaching/record-1");
    expect(router.refresh).toHaveBeenCalledOnce();
    // DOM removal can precede the effect cleanup that restores focus on CI.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("unlocks Coaching create dismissal immediately after returned errors", async () => {
    coachingActions.createCoachingRecordAction.mockResolvedValue(actionError);

    render(<CreateCoachingDialog {...coachingProps} />);
    const trigger = screen.getByRole("button", { name: "Tạo phiếu Coaching" });
    for (const closeAfterError of [
      (dialog: HTMLElement) => fireEvent.keyDown(dialog, { key: "Escape" }),
      (dialog: HTMLElement) => fireEvent.mouseDown(dialog.parentElement!),
      () => fireEvent.click(screen.getByRole("button", { name: "Hủy" })),
    ]) {
      fireEvent.click(trigger);
      fillCoachingCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu" }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(actionError.message));
      expect(screen.getByRole("button", { name: "Tạo phiếu" })).not.toBeDisabled();
      closeAfterError(screen.getByRole("dialog", { name: "Tạo phiếu Coaching" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
  });

  it("retries Coaching create safely after an error", async () => {
    const retry = deferred<typeof coachingSuccess>();
    coachingActions.createCoachingRecordAction
      .mockResolvedValueOnce(actionError)
      .mockReturnValueOnce(retry.promise);

    render(<CreateCoachingDialog {...coachingProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu Coaching" }));
    fillCoachingCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(actionError.message));
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu" }));
    await waitFor(() => expect(coachingActions.createCoachingRecordAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    retry.resolve(coachingSuccess);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps Coaching event actions state-specific and payload-exact", async () => {
    coachingActions.addCoachingNoteAction.mockResolvedValueOnce(actionSuccess);
    const { rerender } = render(<CoachingEventActions coachingRecordId={coachingRecordId} currentStatus="open" />);
    const noteTrigger = screen.getByRole("button", { name: "Thêm ghi chú" });
    noteTrigger.focus();
    fireEvent.click(noteTrigger);
    await waitFor(() => expect(screen.getByLabelText("Nội dung")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Đã gọi cho phụ huynh." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    await waitFor(() => expect(coachingActions.addCoachingNoteAction).toHaveBeenCalledWith({ coachingRecordId, note: "Đã gọi cho phụ huynh." }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(noteTrigger).toHaveFocus();

    coachingActions.advanceCoachingStatusAction.mockResolvedValueOnce(actionSuccess);
    fireEvent.click(screen.getByRole("button", { name: /^Bắt đầu xử lý$/ }));
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Đã bắt đầu theo dõi." } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Bắt đầu xử lý Coaching" })).getByRole("button", { name: "Bắt đầu xử lý" }));
    await waitFor(() => expect(coachingActions.advanceCoachingStatusAction).toHaveBeenCalledWith({
      coachingRecordId,
      note: "Đã bắt đầu theo dõi.",
      outcome: "",
      targetStatus: "in_progress",
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    rerender(<CoachingEventActions coachingRecordId={coachingRecordId} currentStatus="in_progress" />);
    expect(screen.queryByRole("button", { name: "Bắt đầu xử lý" })).not.toBeInTheDocument();
    coachingActions.advanceCoachingStatusAction.mockResolvedValueOnce(actionSuccess);
    fireEvent.click(screen.getByRole("button", { name: /^Đóng phiếu$/ }));
    fireEvent.change(screen.getByLabelText("Kết quả Coaching"), { target: { value: "Đã hoàn thành kế hoạch." } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Đóng phiếu Coaching" })).getByRole("button", { name: "Đóng phiếu" }));
    await waitFor(() => expect(coachingActions.advanceCoachingStatusAction).toHaveBeenLastCalledWith({
      coachingRecordId,
      note: "",
      outcome: "Đã hoàn thành kế hoạch.",
      targetStatus: "closed",
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    rerender(<CoachingEventActions coachingRecordId={coachingRecordId} currentStatus="constructor" />);
    expect(screen.queryByRole("button", { name: /Thêm ghi chú|Bắt đầu xử lý|Đóng phiếu/ })).not.toBeInTheDocument();
  });

  it("keeps Coaching event error dismissal and retry race-safe", async () => {
    const retry = deferred<typeof actionSuccess>();
    coachingActions.advanceCoachingStatusAction
      .mockResolvedValueOnce(actionError)
      .mockReturnValueOnce(retry.promise);

    render(<CoachingEventActions coachingRecordId={coachingRecordId} currentStatus="open" />);
    fireEvent.click(screen.getByRole("button", { name: /^Bắt đầu xử lý$/ }));
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Đã bắt đầu." } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Bắt đầu xử lý Coaching" })).getByRole("button", { name: "Bắt đầu xử lý" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(actionError.message));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Bắt đầu xử lý Coaching" })).getByRole("button", { name: "Bắt đầu xử lý" }));
    await waitFor(() => expect(coachingActions.advanceCoachingStatusAction).toHaveBeenCalledTimes(2));
    const dialog = screen.getByRole("dialog", { name: "Bắt đầu xử lý Coaching" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog", { name: "Bắt đầu xử lý Coaching" })).toBeInTheDocument();
    retry.resolve(actionSuccess);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("uses a shared Dialog for pending invitation revoke with exact payload and returned-error unlock", async () => {
    const retry = deferred<typeof actionSuccess>();
    settingsActions.revokeInvitationAction
      .mockResolvedValueOnce(actionError)
      .mockReturnValueOnce(retry.promise);
    const invitation = {
      acceptedAt: null,
      email: "moi@example.com",
      id: invitationId,
      invitedAt: "2026-08-11T00:00:00Z",
      invitationReason: "Bổ sung nhân sự",
      revokedAt: null,
      roleIds: [roleId],
      status: "pending",
    };
    render(<PendingInvitationCard invitation={invitation} rolesById={new Map([[roleId, { ...roles[0], isActive: true }]])} />);
    const trigger = screen.getByRole("button", { name: "Thu hồi" });
    expect(trigger).toHaveClass("min-h-11");
    expect(trigger).not.toHaveClass("sm:min-h-8");
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Lý do thu hồi")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Lý do thu hồi"), { target: { value: "Không còn nhu cầu." } });
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi lời mời" }));
    await waitFor(() => expect(settingsActions.revokeInvitationAction).toHaveBeenCalledWith({ invitationId, reason: "Không còn nhu cầu." }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(actionError.message));
    expect(screen.getByRole("button", { name: "Thu hồi lời mời" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi lời mời" }));
    await waitFor(() => expect(settingsActions.revokeInvitationAction).toHaveBeenCalledTimes(2));
    const dialog = screen.getByRole("dialog", { name: "Thu hồi lời mời" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog", { name: "Thu hồi lời mời" })).toBeInTheDocument();
    retry.resolve(actionSuccess);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("preserves pending-only invitation gating", () => {
    render(
      <PendingInvitationCard
        invitation={{ acceptedAt: null, email: "unknown@example.com", id: invitationId, invitedAt: "2026-08-11T00:00:00Z", invitationReason: "Kiểm thử", revokedAt: null, roleIds: [], status: "constructor" }}
        rolesById={new Map()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Thu hồi" })).not.toBeInTheDocument();
  });

  it("preserves adjacent Settings invite and role action payloads through shared Dialogs", async () => {
    settingsActions.inviteAccountAction
      .mockResolvedValueOnce({
        fieldErrors: { email: ["Email này đã được mời."] },
        ...actionError,
      })
      .mockResolvedValueOnce(actionSuccess);
    const { rerender } = render(<InviteAccountDialog roles={roles} />);
    const inviteTrigger = screen.getByRole("button", { name: "Thêm tài khoản" });
    inviteTrigger.focus();
    fireEvent.click(inviteTrigger);
    await waitFor(() => expect(screen.getByLabelText("Email Google")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Email Google"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Lý do cấp truy cập"), { target: { value: "Bổ sung trợ lý." } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thêm tài khoản truy cập" })).getByRole("button", { name: "Thêm tài khoản" }));
    await waitFor(() => expect(settingsActions.inviteAccountAction).toHaveBeenCalledWith({
      email: "new@example.com",
      reason: "Bổ sung trợ lý.",
      roleIds: [roleId],
    }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(actionError.message));
    expect(screen.getByLabelText("Email Google")).toHaveAttribute("aria-invalid", "true");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Thêm tài khoản truy cập" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(inviteTrigger).toHaveFocus();

    fireEvent.click(inviteTrigger);
    fireEvent.change(screen.getByLabelText("Email Google"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Lý do cấp truy cập"), { target: { value: "Bổ sung trợ lý." } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thêm tài khoản truy cập" })).getByRole("button", { name: "Thêm tài khoản" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    settingsActions.setAccountRolesAction.mockResolvedValueOnce(actionSuccess);
    rerender(
      <ManageAccountRolesDialog
        member={{ avatarUrl: null, displayName: "Nhân viên An", email: "an@example.com", employeeCode: "NV-01", employmentStatus: "active", id: memberId, joinedAt: null, lastLoginAt: null, leftAt: null, phone: null, roles: null }}
        roles={roles}
      />,
    );
    const rolesTrigger = screen.getByRole("button", { name: "Thiết lập vai trò" });
    expect(rolesTrigger).toHaveClass("min-h-11");
    expect(rolesTrigger).not.toHaveClass("sm:min-h-8");
    rolesTrigger.focus();
    fireEvent.click(rolesTrigger);
    await waitFor(() => expect(screen.getByLabelText("Lý do thay đổi")).toHaveFocus());
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Phân công hỗ trợ." } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thiết lập vai trò" })).getByRole("button", { name: "Lưu vai trò" }));
    await waitFor(() => expect(settingsActions.setAccountRolesAction).toHaveBeenCalledWith({
      reason: "Phân công hỗ trợ.",
      roleIds: [roleId],
      userId: memberId,
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(rolesTrigger).toHaveFocus();
  });
});
