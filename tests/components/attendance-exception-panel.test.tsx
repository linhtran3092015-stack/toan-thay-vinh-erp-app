// Value: protects="Chấm công cần xác minh" (step 12 restyle + actions overrides): a review list the server cannot read shows its message, a thrown call shows the generic one instead of "Đang tải…" forever, "Tải lại" fetches again and an empty list reads "Không có chấm công cần xác minh."; an approver's decision goes to the decide action with the review id, decision and reason, a refused decision keeps its message without reloading, a saved one reloads the list and refreshes the route; a pending review on an open shift offers no decision;
// fails_when=the load .catch or the ok:false branch is lost in the refactor, "Tải lại" stops re-fetching (revision dropped from the effect), the decide call loses the reason/decision or reloads on a refused decision, or decision controls appear before the staff member checks out;
// why_new=timekeeping-staff-page.test.tsx renders the panel as a marker and the /dev preview test only covers a successful load without approval rights;
// seam=none (the real action module is mocked so the production fallback path is exercised; next/navigation mocked for useRouter); no_claim=does not prove the RPC filters reviews by permission or that a self-review is refused (server-owned)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceExceptionPanel } from "@/features/timekeeping/components/attendance-exception-panel";
import type { AttendanceExceptionReview } from "@/features/timekeeping/attendance-exception-schemas";

const actions = vi.hoisted(() => ({
  decideAttendanceExceptionAction: vi.fn(),
  getAttendanceExceptionReviewsAction: vi.fn(),
  requestAttendanceExceptionAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/features/timekeeping/attendance-exception-actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const LOAD_ERROR = "Chưa tải được chấm công chờ duyệt. Vui lòng thử lại.";

const closedReview: AttendanceExceptionReview = {
  check_in_at: "2026-10-10T07:52:00.000Z",
  check_in_reason: "Điện thoại báo sai vị trí trong phòng học tầng 3.",
  check_out_at: "2026-10-10T10:04:00.000Z",
  check_out_reason: null,
  decision_reason: null,
  entry_status: "checked_out",
  has_check_in_gps: false,
  has_check_out_gps: true,
  id: "d1200000-0000-4000-8000-000000000300",
  requested_at: "2026-10-10T07:53:00.000Z",
  staff_id: "d1200000-0000-4000-8000-000000000001",
  staff_name: "Lê Ngọc",
  status: "pending",
  work_date: "2026-10-10",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AttendanceExceptionPanel", () => {
  it("shows the server message, then the generic one when the call throws, and reloads on Tải lại", async () => {
    actions.getAttendanceExceptionReviewsAction
      .mockResolvedValueOnce({ message: LOAD_ERROR, ok: false })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true, reviews: [] });
    render(<AttendanceExceptionPanel canApprove={false} refreshKey="" />);

    const panel = screen.getByRole("region", { name: "Chấm công cần xác minh" });
    expect(within(panel).getByRole("status")).toHaveTextContent("Đang tải chấm công chờ duyệt…");
    expect(await within(panel).findByText(LOAD_ERROR)).toHaveAttribute("role", "status");

    fireEvent.click(within(panel).getByRole("button", { name: "Tải lại" }));
    expect(await within(panel).findByText("Chưa tải được chấm công chờ duyệt.")).toHaveAttribute("role", "status");

    fireEvent.click(within(panel).getByRole("button", { name: "Tải lại" }));
    expect(await within(panel).findByText("Không có chấm công cần xác minh.")).toBeInTheDocument();
    expect(within(panel).queryByRole("status")).not.toBeInTheDocument();
    expect(actions.getAttendanceExceptionReviewsAction).toHaveBeenCalledTimes(3);
  });

  it("sends an approver's decision with its reason, keeps a refusal on screen and reloads after a saved decision", async () => {
    const openReview: AttendanceExceptionReview = {
      ...closedReview,
      check_out_at: null,
      entry_status: "open",
      id: "d1200000-0000-4000-8000-000000000301",
      staff_name: "Trần Minh",
    };
    actions.getAttendanceExceptionReviewsAction.mockResolvedValue({ ok: true, reviews: [closedReview, openReview] });
    actions.decideAttendanceExceptionAction
      .mockResolvedValueOnce({ message: "Không tự duyệt công của mình.", status: "error" })
      .mockResolvedValueOnce({ message: "Đã ghi nhận quyết định.", status: "success" });
    render(<AttendanceExceptionPanel canApprove refreshKey="" />);

    const closedCard = (await screen.findByText("Lê Ngọc")).closest("article");
    const openCard = screen.getByText("Trần Minh").closest("article");
    if (!closedCard || !openCard) throw new Error("Expected both review cards.");

    // An open shift waits for its check-out: no decision controls yet.
    expect(within(openCard).getByText("Chờ nhân sự check-out để duyệt đủ lượt vào/ra.")).toBeInTheDocument();
    expect(within(openCard).queryByRole("button")).not.toBeInTheDocument();

    const approve = within(closedCard).getByRole("button", { name: "Duyệt công" });
    expect(approve).toBeDisabled();
    expect(within(closedCard).getByRole("button", { name: "Từ chối" })).toBeDisabled();
    fireEvent.change(within(closedCard).getByLabelText("Lý do quyết định"), { target: { value: "Đã đối chiếu lịch dạy." } });
    expect(approve).toBeEnabled();

    fireEvent.click(approve);
    expect(await within(closedCard).findByText("Không tự duyệt công của mình.")).toHaveAttribute("role", "status");
    expect(actions.decideAttendanceExceptionAction).toHaveBeenLastCalledWith({
      decision: "approved",
      reason: "Đã đối chiếu lịch dạy.",
      timeEntryId: closedReview.id,
    });
    expect(router.refresh).not.toHaveBeenCalled();
    expect(actions.getAttendanceExceptionReviewsAction).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(within(closedCard).getByRole("button", { name: "Từ chối" })).toBeEnabled());
    fireEvent.click(within(closedCard).getByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(actions.decideAttendanceExceptionAction).toHaveBeenLastCalledWith({
      decision: "rejected",
      reason: "Đã đối chiếu lịch dạy.",
      timeEntryId: closedReview.id,
    });
    await waitFor(() => expect(actions.getAttendanceExceptionReviewsAction).toHaveBeenCalledTimes(2));
    expect(actions.decideAttendanceExceptionAction).toHaveBeenCalledTimes(2);
  });
});
