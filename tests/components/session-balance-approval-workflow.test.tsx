// Value: protects=the session-balance approval workflow on screen: the batch list (each batch's file, creator and status word rendered once, "Chờ bạn duyệt" only for someone who may approve, "Chờ đối tác duyệt (Maker)" for the creator, one link per batch to its page), and the batch page's one panel per status: reconcile ("Bước đối soát Batch", conditions, reason required, exact "Hoàn tất đối soát -> Gửi phê duyệt"), approve ("Bước phê duyệt số dư đầu kỳ", the four-eyes and read-only sentences, "Phê duyệt batch" absent / disabled / enabled), post (checkbox + the exact phrase GHI SO DU before the write, consequence in words), the posted callout with "Xem sổ buổi", the review-row exclude editor with its prefilled reasons, and every write's exact payload + refresh;
// fails_when=the creator can approve on screen, an approver without .approve gets an enabled button, the approve panel shows before reconciliation, the post fires without the checkbox or with a near-miss phrase, a batch text renders twice (table + cards), the exclude editor loses its prefilled reasons or appears outside reconciliation, a write sends another payload or skips the refresh, or a failed write is not shown inline;
// why_new=step 15b rebuilt both pages on the shared import frame (GuardedActionPanel, Stepper, ImportReviewTable); the six original scenarios stay, Scenario 5 now finds the row action as one link (the old Link > Button nesting was invalid HTML);
// seam=next/navigation useRouter (push, refresh) is mocked with one shared router; the writes go through the pages' `actions` overrides (the real actions are never called), the six original scenarios pass no overrides;
// no_claim=does not prove the server's own checks (the RPCs no longer enforce four-eyes, see TODOS O3), the route gates (session-balance-routes.test.tsx) or the wizard (session-balance-import-page.test.tsx)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionBalanceBatchDetailPage } from "@/features/imports/session-balances/session-balance-batch-detail-page";
import { SessionBalanceImportPage } from "@/features/imports/session-balances/session-balance-import-page";
import type {
  SessionBalanceImportActionFailure,
  SessionBalanceImportBatchDetail,
  SessionBalanceImportBatchListItem,
  SessionBalanceImportBatchRecord,
  SessionBalanceImportRowRecord,
} from "@/features/imports/session-balances/types";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockBatchDetail: SessionBalanceImportBatchDetail = {
  batch: {
    approved_at: null,
    approved_by: null,
    created_at: "2026-08-17T15:00:00Z",
    created_by: "user-creator-111",
    effective_on: "2026-06-12",
    excluded_count: 0,
    id: "batch-test-001",
    invalid_count: 0,
    metadata: {},
    no_change_count: 0,
    posted_at: null,
    posted_by: null,
    posted_count: 0,
    reason: "Import số dư đầu kỳ test",
    reconciled_at: "2026-08-17T15:05:00Z",
    reconciled_by: "user-creator-111",
    review_count: 0,
    row_count: 10,
    source_filename: "so_du_test.xlsx",
    source_sha256: "abc123sha256",
    status: "awaiting_approval",
    valid_count: 10,
  },
  profiles: {
    "user-creator-111": {
      email: "creator@example.com",
      full_name: "Người Tạo Batch",
    },
    "user-approver-222": {
      email: "approver@example.com",
      full_name: "Người Duyệt Batch",
    },
  },
  rows: [],
};

const mockBatchListItems: SessionBalanceImportBatchListItem[] = [
  {
    approved_at: null,
    approved_by: null,
    created_at: "2026-08-17T15:00:00Z",
    created_by: "user-creator-111",
    creator_name: "Linh Trần Văn",
    effective_on: "2026-06-12",
    excluded_count: 0,
    id: "551f9877-9fd8-4f99-9001-67efddd32b57",
    invalid_count: 0,
    no_change_count: 0,
    posted_at: null,
    posted_by: null,
    posted_count: 0,
    reason: "Import số dư 682 học viên",
    reconciled_at: "2026-08-17T15:05:00Z",
    reconciled_by: "user-creator-111",
    review_count: 0,
    row_count: 489,
    source_filename: "session_balances.xlsx",
    source_sha256: "abc123sha256",
    status: "awaiting_approval",
    valid_count: 489,
  },
];

describe("Session Balance Import Approval Workflow UI & RBAC", () => {
  it("Scenario 1: hides approval panel when batch is still in awaiting_reconciliation status", () => {
    const detailInReconciliation: SessionBalanceImportBatchDetail = {
      ...mockBatchDetail,
      batch: {
        ...mockBatchDetail.batch,
        status: "awaiting_reconciliation",
      },
    };

    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        currentUserId="user-approver-222"
        detail={detailInReconciliation}
      />
    );

    expect(screen.getByText("Bước đối soát Batch")).toBeInTheDocument();
    expect(screen.getByText("Hoàn tất đối soát -> Gửi phê duyệt")).toBeInTheDocument();
    expect(screen.queryByText("Bước phê duyệt số dư đầu kỳ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phê duyệt batch" })).not.toBeInTheDocument();
  });

  it("Scenario 2: disables approval button for creator due to 4-eyes principle when status is awaiting_approval", () => {
    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        currentUserId="user-creator-111"
        detail={mockBatchDetail}
      />
    );

    expect(screen.getByText("Bước phê duyệt số dư đầu kỳ")).toBeInTheDocument();
    expect(
      screen.getByText(/Nguyên tắc 4 mắt \(Maker\/Checker\): Người tạo batch không được tự phê duyệt batch của mình/i)
    ).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: "Phê duyệt batch" });
    expect(approveBtn).toBeDisabled();
  });

  it("Scenario 3: enables approval button for non-creator manager account with canApprove=true when status is awaiting_approval", () => {
    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        currentUserId="user-approver-222"
        detail={mockBatchDetail}
      />
    );

    expect(screen.getByText("Bước phê duyệt số dư đầu kỳ")).toBeInTheDocument();
    expect(
      screen.queryByText(/Nguyên tắc 4 mắt \(Maker\/Checker\)/i)
    ).not.toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: "Phê duyệt batch" });
    expect(approveBtn).toBeEnabled();
  });

  it("Scenario 4: disables approval button when non-creator user lacks approval permission (canApprove=false)", () => {
    render(
      <SessionBalanceBatchDetailPage
        canApprove={false}
        currentUserId="user-approver-222"
        detail={mockBatchDetail}
      />
    );

    expect(screen.getByText("Bước phê duyệt số dư đầu kỳ")).toBeInTheDocument();
    expect(
      screen.getByText(/Tài khoản hiện tại chỉ xem thông tin read-only\. Bạn không có quyền phê duyệt/i)
    ).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: "Phê duyệt batch" });
    expect(approveBtn).toBeDisabled();
  });

  it("Scenario 5: Batch Discovery UI - renders pending batch list for Checker with 'Xem & Phê duyệt' action button", () => {
    render(
      <SessionBalanceImportPage
        batches={mockBatchListItems}
        canApprove={true}
        currentUserId="user-approver-222"
      />
    );

    expect(
      screen.getByText(/Danh sách Batch đối soát & Phê duyệt/i)
    ).toBeInTheDocument();
    expect(screen.getByText("session_balances.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Linh Trần Văn")).toBeInTheDocument();
    expect(screen.getByText("Chờ bạn duyệt")).toBeInTheDocument();

    // Deliberate equal-strength edit (step 15b): the row action is one styled link now (was a Button nested in a Link).
    const linkBtn = screen.getByRole("link", { name: /Xem & Phê duyệt/i });
    expect(linkBtn).toBeInTheDocument();
    expect(linkBtn.closest("a")).toHaveAttribute(
      "href",
      "/imports/session-balances/551f9877-9fd8-4f99-9001-67efddd32b57"
    );
  });

  it("Scenario 6: Batch Discovery UI - renders 'Chờ đối tác duyệt' badge for Maker on /imports/session-balances", () => {
    render(
      <SessionBalanceImportPage
        batches={mockBatchListItems}
        canApprove={true}
        currentUserId="user-creator-111"
      />
    );

    expect(screen.getByText("Chờ đối tác duyệt (Maker)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Step 15b extensions: list rendered once, guarded panels with reasons, the
// exclude editor, the posted callout, exact write payloads.
// ---------------------------------------------------------------------------

const failure = (message: string): SessionBalanceImportActionFailure => ({ code: "invalid_request", message, ok: false });

function makeRow(
  overrides: Partial<SessionBalanceImportRowRecord> &
    Pick<SessionBalanceImportRowRecord, "id" | "source_row_number" | "student_public_code" | "validation_status">,
): SessionBalanceImportRowRecord {
  return {
    batch_id: "batch-test-001",
    created_at: "2026-08-17T15:00:00Z",
    current_balance_before: null,
    delta_sessions: null,
    excluded_reason: null,
    expected_balance_after: null,
    ledger_entry_id: null,
    source_balance: 0,
    source_student_name: null,
    student_enrollment_id: null,
    student_id: null,
    validation_code: null,
    validation_message: null,
    ...overrides,
  };
}

function detailWith(batch: Partial<SessionBalanceImportBatchRecord>, rows: SessionBalanceImportRowRecord[] = []): SessionBalanceImportBatchDetail {
  return { ...mockBatchDetail, batch: { ...mockBatchDetail.batch, ...batch }, rows };
}

const reviewRows = [
  makeRow({
    current_balance_before: 2,
    delta_sessions: 10,
    expected_balance_after: 12,
    id: "row-valid",
    source_balance: 10,
    source_row_number: 2,
    source_student_name: "Nguyễn Ngọc Hà Anh",
    student_public_code: "TV-2026-00012",
    validation_code: "OK",
    validation_message: "Hop le. San sang import.",
    validation_status: "valid",
  }),
  makeRow({
    id: "row-fractional",
    source_balance: 7.5,
    source_row_number: 4,
    source_student_name: "Nguyễn Bảo Anh",
    student_public_code: "TV-2026-00014",
    validation_code: "BALANCE_HAS_FRACTIONAL_PART",
    validation_message: "So du co phan thap phan (7.5). Can kiem tra lai. Khong duoc lam tron hoac cat bo.",
    validation_status: "review",
  }),
  makeRow({
    id: "row-enrollment",
    source_balance: 4,
    source_row_number: 5,
    source_student_name: "Trần Gia Huy",
    student_public_code: "TV-2026-00021",
    validation_code: "NO_ACTIVE_ENROLLMENT",
    validation_message: "Hoc vien TV-2026-00021 khong co enrollment dang active. Can kiem tra truoc khi import.",
    validation_status: "review",
  }),
];

const listItem = (overrides: Partial<SessionBalanceImportBatchListItem>): SessionBalanceImportBatchListItem => ({
  ...mockBatchListItems[0],
  ...overrides,
});

describe("Session balance batch list (step 15b)", () => {
  const batches = [
    mockBatchListItems[0],
    listItem({
      created_by: "user-other-333",
      creator_name: "Phạm Quốc Anh",
      id: "a2a2a2a2-0000-4000-8000-000000000002",
      reconciled_at: null,
      reconciled_by: null,
      source_filename: "so_du_khoi_7.xlsx",
      status: "awaiting_reconciliation",
    }),
    listItem({
      created_by: "user-other-444",
      creator_name: "Lê Minh Châu",
      id: "a3a3a3a3-0000-4000-8000-000000000003",
      posted_count: 489,
      source_filename: "so_du_khoi_6.xlsx",
      status: "posted",
    }),
  ];

  it("renders each batch's file, creator and status word once, with one link per batch to its page", () => {
    render(<SessionBalanceImportPage batches={batches} canApprove={true} currentUserId="user-approver-222" />);

    expect(screen.getByRole("heading", { level: 2, name: "Danh sách Batch đối soát & Phê duyệt (3)" })).toBeInTheDocument();
    for (const text of [
      "session_balances.xlsx",
      "so_du_khoi_7.xlsx",
      "so_du_khoi_6.xlsx",
      "Linh Trần Văn",
      "Phạm Quốc Anh",
      "Lê Minh Châu",
      "Chờ bạn duyệt",
      "Đang chờ đối soát",
      "Đã ghi sổ",
    ]) {
      expect(screen.getAllByText(text), text).toHaveLength(1);
    }

    const list = screen.getByRole("list", { name: "Các lô số dư buổi" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(batches.map((batch) => `/imports/session-balances/${batch.id}`));
    expect(links.map((link) => link.textContent)).toEqual([
      "Xem & Phê duyệt, lô session_balances.xlsx",
      "Xem đối soát, lô so_du_khoi_7.xlsx",
      "Xem chi tiết, lô so_du_khoi_6.xlsx",
    ]);
    // No nested interactive control inside a row link.
    for (const link of links) expect(within(link).queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not promise 'Chờ bạn duyệt' to someone who cannot approve", () => {
    render(<SessionBalanceImportPage batches={[mockBatchListItems[0]]} canApprove={false} currentUserId="user-approver-222" />);

    expect(screen.queryByText("Chờ bạn duyệt")).not.toBeInTheDocument();
    expect(screen.getByText("Đang chờ phê duyệt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Xem chi tiết/ })).toHaveAttribute(
      "href",
      "/imports/session-balances/551f9877-9fd8-4f99-9001-67efddd32b57",
    );
  });

  it("keeps batch links on the injected href (previews stay under /dev)", () => {
    render(
      <SessionBalanceImportPage
        batches={[mockBatchListItems[0]]}
        canApprove={true}
        currentUserId="user-approver-222"
        getBatchHref={(id) => `/dev/imports?view=balance-batch&batch=${id}`}
      />,
    );
    expect(screen.getByRole("link", { name: /Xem & Phê duyệt/ })).toHaveAttribute(
      "href",
      "/dev/imports?view=balance-batch&batch=551f9877-9fd8-4f99-9001-67efddd32b57",
    );
  });

  it("shows only the list (no wizard) without imports.session_balances, with the empty text in the frame", () => {
    render(<SessionBalanceImportPage batches={[]} canApprove={true} canImport={false} currentUserId="user-approver-222" />);

    expect(screen.getByRole("heading", { level: 1, name: "Nhập số dư buổi đầu kỳ" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Các bước nhập số dư buổi" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Chọn file Excel")).not.toBeInTheDocument();
    expect(screen.getByText("Chưa có lô số dư nào.")).toBeInTheDocument();
  });
});

describe("Session balance batch page panels (step 15b)", () => {
  function stepStates() {
    const stepper = screen.getByRole("list", { name: "Các bước của lô số dư" });
    return within(stepper)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-state"));
  }

  it("derives the stage stepper from the status", () => {
    render(<SessionBalanceBatchDetailPage canApprove={true} currentUserId="user-approver-222" detail={mockBatchDetail} />);
    expect(stepStates()).toEqual(["done", "done", "current", "upcoming"]);
    cleanup();

    render(<SessionBalanceBatchDetailPage canApprove={true} currentUserId="user-approver-222" detail={detailWith({ status: "awaiting_reconciliation" })} />);
    expect(stepStates()).toEqual(["done", "current", "upcoming", "upcoming"]);
    cleanup();

    render(<SessionBalanceBatchDetailPage canApprove={true} currentUserId="user-approver-222" detail={detailWith({ status: "approved" })} />);
    expect(stepStates()).toEqual(["done", "done", "done", "current"]);
    cleanup();

    render(<SessionBalanceBatchDetailPage canApprove={true} currentUserId="user-approver-222" detail={detailWith({ status: "posted" })} />);
    expect(stepStates()).toEqual(["done", "done", "done", "done"]);
  });

  it("reconcile: blocked with reasons while review rows remain; the editor prefills each reason and excludes with the exact payload", async () => {
    const excludeSessionBalanceImportRow = vi.fn().mockResolvedValue({ data: reviewRows[2], ok: true });
    const reconcileSessionBalanceImportBatch = vi.fn();
    render(
      <SessionBalanceBatchDetailPage
        actions={{ excludeSessionBalanceImportRow, reconcileSessionBalanceImportBatch }}
        canApprove={true}
        currentUserId="user-approver-222"
        detail={detailWith({ review_count: 2, status: "awaiting_reconciliation", valid_count: 1 }, reviewRows)}
      />,
    );

    const panel = screen.getByRole("region", { name: "Bước đối soát Batch" });
    const reconcile = () => within(panel).getByRole("button", { name: "Hoàn tất đối soát -> Gửi phê duyệt" });
    expect(reconcile()).toBeDisabled();
    expect(within(panel).getByText("Xử lý hết dòng cần xem lại và không hợp lệ trước.")).toBeInTheDocument();
    expect(within(panel).getByText("Còn 2 dòng cần xem lại: bấm “Loại khỏi lô” ở bảng dòng bên dưới.")).toBeInTheDocument();
    // Typing a reason does not unblock it while review rows remain.
    fireEvent.change(within(panel).getByLabelText("Lý do hoàn tất đối soát"), { target: { value: "Đã đối chiếu" } });
    expect(reconcile()).toBeDisabled();

    // Rows: Vietnamese messages by code, review rows first.
    expect(screen.getByText("Cần xem lại: Số dư có phần lẻ; sổ buổi chỉ ghi số nguyên và không làm tròn.")).toBeInTheDocument();
    expect(
      screen.getByText("Cần xem lại: Học viên chưa có ghi danh đang hoạt động; kiểm tra trước khi nhập."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Loại khỏi lô dòng 4" }));
    expect(screen.getByLabelText("Lý do loại dòng 4")).toHaveValue("Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên.");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByLabelText("Lý do loại dòng 4")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Loại khỏi lô dòng 5" }));
    const reason = screen.getByLabelText("Lý do loại dòng 5");
    expect(reason).toHaveValue("Chưa có enrollment đang active.");
    fireEvent.change(reason, { target: { value: "  Học viên đã nghỉ, chưa ghi danh lại.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận loại" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(excludeSessionBalanceImportRow).toHaveBeenCalledTimes(1);
    expect(excludeSessionBalanceImportRow).toHaveBeenCalledWith({
      excludedReason: "Học viên đã nghỉ, chưa ghi danh lại.",
      rowId: "row-enrollment",
    });
    expect(reconcileSessionBalanceImportBatch).not.toHaveBeenCalled();
  });

  it("exclude: a refused write stays inline and nothing refreshes", async () => {
    const excludeSessionBalanceImportRow = vi.fn().mockResolvedValue(failure("Trạng thái batch hiện tại không cho phép loại dòng."));
    render(
      <SessionBalanceBatchDetailPage
        actions={{ excludeSessionBalanceImportRow }}
        canApprove={true}
        currentUserId="user-approver-222"
        detail={detailWith({ review_count: 2, status: "awaiting_reconciliation" }, reviewRows)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Loại khỏi lô dòng 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận loại" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Trạng thái batch hiện tại không cho phép loại dòng.");
    expect(screen.getByLabelText("Lý do loại dòng 4")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("reconcile: needs a reason, sends it trimmed and refreshes; invalid rows block with the fix in words and no exclude button", async () => {
    const reconcileSessionBalanceImportBatch = vi.fn().mockResolvedValue({ data: mockBatchDetail.batch, ok: true });
    render(
      <SessionBalanceBatchDetailPage
        actions={{ reconcileSessionBalanceImportBatch }}
        canApprove={false}
        currentUserId="user-creator-111"
        detail={detailWith({ status: "awaiting_reconciliation" }, [reviewRows[0]])}
      />,
    );

    const reconcile = () => screen.getByRole("button", { name: "Hoàn tất đối soát -> Gửi phê duyệt" });
    expect(reconcile()).toBeDisabled();
    expect(screen.getByText("Nhập lý do đối soát trước.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lý do hoàn tất đối soát"), { target: { value: "  Đã đối chiếu sổ tay  " } });
    expect(reconcile()).toBeEnabled();
    fireEvent.click(reconcile());

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(reconcileSessionBalanceImportBatch).toHaveBeenCalledWith({ batchId: "batch-test-001", reason: "Đã đối chiếu sổ tay" });
    cleanup();

    const invalidRow = makeRow({
      id: "row-invalid",
      source_balance: 6,
      source_row_number: 6,
      student_public_code: "TV-2026-09999",
      validation_code: "STUDENT_NOT_FOUND",
      validation_message: "Khong tim thay hoc vien voi ma TV-2026-09999.",
      validation_status: "invalid",
    });
    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        currentUserId="user-approver-222"
        detail={detailWith({ invalid_count: 1, status: "awaiting_reconciliation" }, [invalidRow])}
      />,
    );
    expect(
      screen.getByText("Còn 1 dòng không hợp lệ: lô này không đối soát được. Sửa file Excel rồi tạo lô mới."),
    ).toBeInTheDocument();
    expect(screen.getByText("Không hợp lệ: Không tìm thấy học viên có mã này.")).toBeInTheDocument();
    expect(screen.getByText("Sửa file, tạo lô mới")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Loại khỏi lô/ })).not.toBeInTheDocument();
  });

  it("reconcile without imports.session_balances: no button, no exclude editor, who does it in words", () => {
    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        canReconcile={false}
        currentUserId="user-approver-222"
        detail={detailWith({ review_count: 2, status: "awaiting_reconciliation" }, reviewRows)}
      />,
    );

    expect(screen.getByText("Bước đối soát Batch")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hoàn tất đối soát -> Gửi phê duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Loại khỏi lô/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Tài khoản này không có quyền nhập số dư buổi học nên không đối soát được; người có quyền đó sẽ thực hiện bước này."),
    ).toBeInTheDocument();
  });

  it("approve: the disabled button says why; an enabled one sends the batch id and refreshes; failures stay inline", async () => {
    render(<SessionBalanceBatchDetailPage canApprove={true} currentUserId="user-creator-111" detail={mockBatchDetail} />);
    expect(screen.getByText("Người tạo lô không tự phê duyệt được.")).toBeInTheDocument();
    cleanup();

    render(<SessionBalanceBatchDetailPage canApprove={false} currentUserId="user-approver-222" detail={mockBatchDetail} />);
    expect(screen.getByText("Cần quyền duyệt số dư buổi học đã nhập.")).toBeInTheDocument();
    cleanup();

    const approveSessionBalanceImportBatch = vi
      .fn()
      .mockResolvedValueOnce(failure("Batch phải ở trạng thái Đang chờ phê duyệt."))
      .mockResolvedValueOnce({ data: mockBatchDetail.batch, ok: true });
    render(
      <SessionBalanceBatchDetailPage
        actions={{ approveSessionBalanceImportBatch }}
        canApprove={true}
        currentUserId="user-approver-222"
        detail={mockBatchDetail}
      />,
    );
    const panel = screen.getByRole("region", { name: "Bước phê duyệt số dư đầu kỳ" });
    expect(panel).toHaveTextContent("Phê duyệt chuyển lô sang chờ ghi sổ: 10 dòng hợp lệ, 0 dòng đã loại, 0 dòng không thay đổi.");

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt batch" }));
    expect(await screen.findByText("Batch phải ở trạng thái Đang chờ phê duyệt.")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();

    await waitFor(() => expect(screen.getByRole("button", { name: "Phê duyệt batch" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt batch" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(approveSessionBalanceImportBatch).toHaveBeenLastCalledWith({ batchId: "batch-test-001" });
  });

  it("approve: a lost answer is reported as unknown and the page reloads", async () => {
    const approveSessionBalanceImportBatch = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <SessionBalanceBatchDetailPage
        actions={{ approveSessionBalanceImportBatch }}
        canApprove={true}
        currentUserId="user-approver-222"
        detail={mockBatchDetail}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt batch" }));
    expect(await screen.findByText("Không rõ kết quả. Mở lại trang lô để kiểm tra trước khi thử lại.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("post: consequence in words; enabled only with the checkbox and the exact GHI SO DU; sends the exact payload (primary, not danger)", async () => {
    const postSessionBalanceImportBatch = vi.fn().mockResolvedValue({ data: mockBatchDetail.batch, ok: true });
    const postRows = [
      reviewRows[0],
      makeRow({ delta_sessions: -2, id: "row-negative", source_balance: -2, source_row_number: 3, student_public_code: "TV-2026-00013", validation_status: "valid" }),
    ];
    render(
      <SessionBalanceBatchDetailPage
        actions={{ postSessionBalanceImportBatch }}
        canApprove={true}
        currentUserId="user-creator-111"
        detail={detailWith({ approved_at: "2026-08-18T02:00:00Z", approved_by: "user-approver-222", status: "approved", valid_count: 2 }, postRows)}
      />,
    );

    const panel = screen.getByRole("region", { name: "Ghi số dư vào sổ buổi" });
    expect(panel).toHaveTextContent("Ghi sổ tạo 2 bút toán điều chỉnh số buổi (tổng +8 buổi), ngày hiệu lực 12/06/2026.");
    expect(panel).toHaveTextContent("Đây là bước không hoàn tác");
    expect(screen.queryByRole("button", { name: "Phê duyệt batch" })).not.toBeInTheDocument();

    const post = () => within(panel).getByRole("button", { name: "Ghi số dư vào sổ buổi" });
    expect(post()).toBeDisabled();
    expect(post().className).toContain("bg-action-primary");
    expect(post().className).not.toMatch(/danger/);
    expect(panel.className).not.toContain("border-danger-border");

    fireEvent.change(within(panel).getByLabelText("Gõ GHI SO DU để xác nhận"), { target: { value: "GHI SO DU" } });
    expect(post()).toBeDisabled();
    expect(within(panel).getByText("Đánh dấu ô xác nhận.")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("checkbox", { name: /Tôi xác nhận đã kiểm tra lô đã phê duyệt/ }));
    fireEvent.change(within(panel).getByLabelText("Gõ GHI SO DU để xác nhận"), { target: { value: "ghi so du" } });
    expect(post()).toBeDisabled();
    fireEvent.change(within(panel).getByLabelText("Gõ GHI SO DU để xác nhận"), { target: { value: "GHI SO DU" } });
    expect(post()).toBeEnabled();
    // Armed: the panel border turns danger (the button stays the page's primary).
    expect(panel.className).toContain("border-danger-border");
    fireEvent.click(post());

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(postSessionBalanceImportBatch).toHaveBeenCalledWith({
      batchId: "batch-test-001",
      confirmationText: "GHI SO DU",
      confirmedCheck: true,
    });
  });

  it("post without the approval permission: disabled, said in words", () => {
    render(
      <SessionBalanceBatchDetailPage canApprove={false} currentUserId="user-approver-222" detail={detailWith({ status: "approved" })} />,
    );
    expect(screen.getByText("Tài khoản hiện tại không có quyền ghi sổ số dư buổi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ghi số dư vào sổ buổi" })).toBeDisabled();
  });

  it("posted: the callout names who posted, links the ledger once, and no action panel remains", () => {
    const postedRows = [{ ...reviewRows[0], ledger_entry_id: "ledger-1", validation_status: "posted" as const }];
    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        currentUserId="user-approver-222"
        detail={detailWith(
          { posted_at: "2026-08-18T03:30:00Z", posted_by: "user-approver-222", posted_count: 1, status: "posted" },
          postedRows,
        )}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Đã ghi số dư đầu kỳ vào sổ buổi. 1 bút toán, ghi bởi Người Duyệt Batch lúc 18/08/2026 10:30.",
    );
    expect(screen.getAllByRole("link", { name: "Xem sổ buổi" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Xem sổ buổi" })).toHaveAttribute("href", "/finance/session-ledger");
    expect(screen.getByRole("link", { name: /Danh sách lô/ })).toHaveAttribute("href", "/imports/session-balances");
    for (const name of ["Phê duyệt batch", "Ghi số dư vào sổ buổi", "Hoàn tất đối soát -> Gửi phê duyệt"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByText("Đã ghi sổ.")).toBeInTheDocument();
  });

  it("renders every row once (one table, no cards in jsdom) with excluded reasons in words", () => {
    const rows = [
      reviewRows[0],
      { ...reviewRows[1], excluded_reason: "Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên.", validation_status: "excluded" as const },
      makeRow({ id: "row-zero", source_row_number: 6, student_public_code: "TV-2026-00022", validation_code: "BALANCE_IS_ZERO", validation_status: "no_change" }),
    ];
    render(
      <SessionBalanceBatchDetailPage
        canApprove={true}
        currentUserId="user-approver-222"
        detail={detailWith({ excluded_count: 1, no_change_count: 1, status: "awaiting_approval", valid_count: 1 }, rows)}
        ledgerHref="/dev/lists?view=session-ledger"
        listHref="/dev/imports?view=balances"
      />,
    );

    for (const code of ["TV-2026-00012", "TV-2026-00014", "TV-2026-00022"]) {
      expect(screen.getAllByText(code), code).toHaveLength(1);
    }
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByText("Đã loại: Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên.")).toBeInTheDocument();
    expect(screen.getByText("Không thay đổi: Số dư bằng 0, không tạo bút toán.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Danh sách lô/ })).toHaveAttribute("href", "/dev/imports?view=balances");
  });
});
