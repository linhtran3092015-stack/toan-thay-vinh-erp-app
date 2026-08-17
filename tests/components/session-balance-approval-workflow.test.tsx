import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionBalanceBatchDetailPage } from "@/features/imports/session-balances/session-balance-batch-detail-page";
import { SessionBalanceImportPage } from "@/features/imports/session-balances/session-balance-import-page";
import type {
  SessionBalanceImportBatchDetail,
  SessionBalanceImportBatchListItem,
} from "@/features/imports/session-balances/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(cleanup);

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

    const linkBtn = screen.getByRole("button", { name: /Xem & Phê duyệt/i });
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
