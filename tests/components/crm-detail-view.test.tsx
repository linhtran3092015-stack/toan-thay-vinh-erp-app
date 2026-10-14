// Value: protects=the redesigned lead page (design 12b): one primary chosen by state ("Xác nhận chuyển đổi" while the lead waits for it, else "Chuyển chờ xác nhận nhập học"), the written reason when conversion is not offered, an open lead saying next to the primary and in the read-only "Checklist nhập học" that the 10 items are confirmed together in the "Xác nhận chuyển đổi" dialog (every item "Chưa xác nhận", no n/10, no checkboxes) with the accountant hint, a converted lead alone showing 10/10 with who completed it and when, "Học thử" rows with their existing result action, the "Vòng đời" rail (current step, dropped reason), the danger-outline stop action under the rail, "Dự kiến nhập học" rows without invented data, and assignment history with method words;
// fails_when=two primaries render, conversion silently disappears for a sale without a reason, an open lead shows a partial n/10 or editable checklist boxes (only the conversion RPC writes them, all at once), a converted lead hides its 10/10 completion, the stop action becomes primary or loses its dialog, a trial row loses "Ghi kết quả" while scheduled, the rail stops naming the current or dropped step, an empty fee row renders, or raw method codes leak;
// why_new=step 10 replaces the detail page layout; crm-detail-action-gate only covers the converted case;
// seam=next/navigation is mocked; CrmDetailView is rendered with fixture read models (the page only adds permission and loader wiring); no_claim=does not submit any dialog (crm-workflow-dialogs and dev-crm-preview cover submissions)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrmDetailView, type CrmDetailViewProps } from "@/features/crm/components/crm-detail-view";
import type { CrmCaseDetailReadModel } from "@/features/crm/read-models";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const detail: CrmCaseDetailReadModel = {
  assignmentHistory: [
    { assignedByName: "Lê Thu Trang", assignmentMethod: "manual_transfer", createdAt: "2026-10-02T03:00:00Z", id: "h-2", newSaleOwnerName: "Hoàng Minh Khôi", previousSaleOwnerId: "sale-2", previousSaleOwnerName: "Đặng Phương Thảo", reason: "Lead khối 10" },
    { assignedByName: null, assignmentMethod: "auto_round_robin", createdAt: "2026-10-01T03:00:00Z", id: "h-1", newSaleOwnerName: "Đặng Phương Thảo", previousSaleOwnerId: null, previousSaleOwnerName: null, reason: "Chia đều" },
  ],
  birthYear: 2011,
  caseNotes: [],
  // Reachable open-lead state: only the convert RPC writes the boxes, all at once.
  checklist: {
    completedAt: null,
    completedByName: null,
    id: "checklist-1",
    isFullyCompleted: false,
    item10CommunicationGroupReady: false,
    item1PaymentReceived: false,
    item2SourceConfirmed: false,
    item3SaleConfirmed: false,
    item4ClassSelected: false,
    item5ModeConfirmed: false,
    item6FeeConfirmed: false,
    item7AssistantSessionsConfirmed: false,
    item8AccountantTransactionConfirmed: false,
    item9OfficialStartDateEntered: false,
  },
  createdAt: "2026-10-01T03:00:00Z",
  discountNotes: "F1 −10%",
  dropReason: null,
  droppedAt: null,
  expectedGrade: 10,
  expectedLevel: "CLC",
  expectedMode: "offline",
  expectedOfficialStartDate: null,
  expectedTuitionFeeVnd: null,
  fullName: "Phạm Đức Anh",
  guardianFullName: "Phạm Văn Hùng",
  guardianId: null,
  guardianPhone: "0934556677",
  guardianRelationship: "Bố",
  id: "case-1",
  leadSourceCode: "referral_parent",
  leadSourceName: "SB F1",
  nickname: null,
  notes: null,
  provinceCity: "Hà Nội",
  publicCode: "LD-2610-0029",
  saleOwnerId: "sale-1",
  saleOwnerName: "Hoàng Minh Khôi",
  status: "pending_enrollment_confirmation",
  // On or after CRM_STATUS_TRACKING_SINCE, so the rail trusts it on this pre-migration lead.
  statusChangedAt: "2026-10-14T08:00:00Z",
  studentId: "student-1",
  trialBookings: [
    { classSessionId: null, createdAt: "2026-10-02T04:00:00Z", id: "trial-1", learningMode: "offline", resultRecordedAt: "2026-10-05T14:00:00Z", saleNotes: "Muốn học thêm hình", status: "attended", teacherFeedback: "Nền tảng đại số tốt.", trialDate: "2026-10-05" },
  ],
};

const owner = { canConfirmOfficial: true, canTransfer: true, canUpdate: true, hasAccountantPermission: true };
const sale = { canConfirmOfficial: false, canTransfer: false, canUpdate: true, hasAccountantPermission: false };

function renderView(overrides: Partial<CrmDetailViewProps> = {}, caseOverrides: Partial<CrmCaseDetailReadModel> = {}) {
  return render(
    <CrmDetailView
      activeClasses={[{ code: "T10", id: "class-1", name: "Toán 10" }]}
      detail={{ ...detail, ...caseOverrides }}
      directoryHref="/crm?status=pending_enrollment_confirmation"
      saleOwners={[{ fullName: "Hoàng Minh Khôi", id: "sale-1" }, { fullName: "Đặng Phương Thảo", id: "sale-2" }]}
      todayIso="2026-10-14"
      {...owner}
      {...overrides}
    />,
  );
}

function primaryButtons() {
  return [...screen.getAllByRole("button"), ...screen.queryAllByRole("link")].filter((element) => element.className.includes("bg-action-primary "));
}

describe("CRM lead page", () => {
  it("makes conversion the only primary while the lead waits for it and says the checklist is confirmed in its dialog", () => {
    renderView();

    const header = screen.getByRole("heading", { level: 1, name: "Phạm Đức Anh" }).closest("header")!;
    expect(within(header).getByText("Chờ xác nhận nhập học")).toBeInTheDocument();
    expect(within(header).getByText(/LD-2610-0029 · sinh 2011 · Khối 10 dự kiến · CLC · Offline · Nguồn SB F1 · Sale Hoàng Minh Khôi · Bố Phạm Văn Hùng · 0934556677 · Hà Nội/)).toBeInTheDocument();
    expect(primaryButtons().map((element) => element.textContent)).toEqual(["Xác nhận chuyển đổi"]);
    expect(within(header).getByRole("button", { name: "Chuyển giao Lead" })).toHaveClass("bg-surface-base");
    expect(within(header).getByRole("link", { name: /Hồ sơ tạm & phiếu thu/ })).toHaveAttribute("href", "/students/student-1");
    expect(within(header).getByText(/10 mục checklist được xác nhận cùng lúc trong hộp thoại “Xác nhận chuyển đổi”\./)).toBeInTheDocument();
    expect(within(header).queryByText(/chưa xong/)).not.toBeInTheDocument();
    expect(within(header).getByText(/tạo hồ sơ học sinh chính thức/)).toBeInTheDocument();
  });

  it("makes moving to Chờ xác nhận the primary earlier in the lifecycle and keeps conversion secondary", () => {
    renderView({}, { status: "trial_completed" });
    expect(primaryButtons().map((element) => element.textContent)).toEqual(["Chuyển chờ xác nhận nhập học"]);
    expect(screen.getByRole("button", { name: "Xác nhận chuyển đổi" })).toHaveClass("bg-surface-base");
  });

  it("tells a sale why conversion is not offered and shows no primary while waiting", () => {
    renderView(sale);
    expect(primaryButtons()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Xác nhận chuyển đổi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển giao Lead" })).not.toBeInTheDocument();
    expect(screen.getByText("Xác nhận chuyển đổi cần quyền xác nhận học sinh chính thức.")).toBeInTheDocument();
    expect(screen.queryByText(/students\.confirm_official/)).not.toBeInTheDocument();
  });

  // Value: protects=an admissions role with students.confirm_official but without sepay.accountant_confirm gets no primary it can never submit: conversion stays openable as a secondary button and the header says why it cannot be completed;
  // fails_when=the conversion trigger is primary (or the "10 mục checklist" primary notice shows) for a role that cannot tick item 8, the button disappears, or the reason is missing;
  // why_new=step 10 fix pass 4 (P1); seam=none; no_claim=does not prove the role grants (read from 20260726151000_crm_foundation.sql)
  it("keeps conversion secondary with the accountant reason for a confirmer without accountant permission", () => {
    renderView({ hasAccountantPermission: false });
    const header = screen.getByRole("heading", { level: 1, name: "Phạm Đức Anh" }).closest("header")!;
    expect(primaryButtons()).toEqual([]);
    expect(within(header).getByRole("button", { name: "Xác nhận chuyển đổi" })).toHaveClass("bg-surface-base");
    expect(within(header).getByText("Người xác nhận chuyển đổi cần thêm quyền xác nhận giao dịch (kế toán).")).toBeInTheDocument();
    expect(within(header).queryByText(/10 mục checklist được xác nhận cùng lúc/)).not.toBeInTheDocument();

    cleanup();
    renderView({ hasAccountantPermission: false }, { status: "trial_completed" });
    expect(primaryButtons().map((element) => element.textContent)).toEqual(["Chuyển chờ xác nhận nhập học"]);
    expect(screen.getByRole("button", { name: "Xác nhận chuyển đổi" })).toHaveClass("bg-surface-base");
  });

  it("shows an open lead's read-only checklist as confirmed at conversion, with the accountant hint for a sale", () => {
    renderView(sale);
    const checklist = screen.getByRole("region", { name: "Checklist nhập học" });
    expect(within(checklist).getByText("Xác nhận cùng lúc khi chuyển đổi")).toBeInTheDocument();
    expect(within(checklist).queryByText(/\/10 hoàn thành/)).not.toBeInTheDocument();
    expect(within(checklist).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(checklist).getAllByText("Chưa xác nhận")).toHaveLength(10);
    expect(within(checklist).queryByText("Chưa xong")).not.toBeInTheDocument();
    const item8 = within(checklist).getByText(/8\. Kế toán xác nhận giao dịch/).closest("li")!;
    expect(within(item8).getByText("Người xác nhận chuyển đổi cần thêm quyền xác nhận giao dịch (kế toán).")).toBeInTheDocument();
    const item1 = within(checklist).getByText(/1\. Đã nhận học phí/).closest("li")!;
    expect(within(item1).getByText("Đánh dấu trong hộp thoại xác nhận chuyển đổi khi phiếu thu tuyển mới đã thanh toán.")).toBeInTheDocument();
    expect(within(checklist).getByText("Các mục được đánh dấu trong hộp thoại “Xác nhận chuyển đổi” (quyền xác nhận học sinh chính thức).")).toBeInTheDocument();
  });

  // Value: protects=a converted lead's checklist shows the RPC's all-ticked result as 10/10 with who completed it and when;
  // fails_when=the n/10 header or completed footer is hidden for a completed checklist, or items keep reading "Chưa xác nhận" after conversion;
  // why_new=fix pass 1 (F6) splits the panel on checklist.completedAt; seam=none; no_claim=does not prove the RPC stamps completedAt (read from the migration)
  it("shows a converted lead's checklist as 10/10 with its completion", () => {
    renderView({}, {
      checklist: {
        completedAt: "2026-10-08T03:00:00Z",
        completedByName: "Nguyễn Văn Vinh",
        id: "checklist-1",
        isFullyCompleted: true,
        item10CommunicationGroupReady: true,
        item1PaymentReceived: true,
        item2SourceConfirmed: true,
        item3SaleConfirmed: true,
        item4ClassSelected: true,
        item5ModeConfirmed: true,
        item6FeeConfirmed: true,
        item7AssistantSessionsConfirmed: true,
        item8AccountantTransactionConfirmed: true,
        item9OfficialStartDateEntered: true,
      },
      status: "converted",
    });
    const checklist = screen.getByRole("region", { name: "Checklist nhập học" });
    expect(within(checklist).getByText("10/10 hoàn thành")).toBeInTheDocument();
    expect(within(checklist).getAllByText("Đã xong")).toHaveLength(10);
    expect(within(checklist).getByText("Hoàn tất 08/10/2026 bởi Nguyễn Văn Vinh.")).toBeInTheDocument();
    const rail = screen.getByRole("list", { name: "Các bước vòng đời lead" });
    expect(within(rail).getAllByRole("listitem").at(-1)).toHaveTextContent("Đã nhập học · 08/10");
  });

  it("lists trials with feedback and offers the existing booking and result dialogs while open", () => {
    renderView({}, {
      status: "trial_booked",
      trialBookings: [
        { classSessionId: null, createdAt: "2026-10-10T04:00:00Z", id: "trial-2", learningMode: "online", saleNotes: null, status: "scheduled", teacherFeedback: null, trialDate: "2026-10-19" },
        detail.trialBookings[0],
      ],
    });
    const trials = screen.getByRole("heading", { level: 2, name: "Học thử" }).closest("section")!;
    expect(within(trials).getByRole("button", { name: "Đặt lịch học thử" })).toBeInTheDocument();
    const rows = within(trials).getAllByRole("listitem");
    expect(within(rows[0]).getByText("Thứ 2 19/10")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Học thử Online")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Đã đặt lịch")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: "Ghi kết quả" })).toBeInTheDocument();
    expect(within(rows[1]).getByText("Đã đến học thử")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Nền tảng đại số tốt.")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Ghi chú sale: Muốn học thêm hình")).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("button", { name: "Ghi kết quả" })).not.toBeInTheDocument();
  });

  it("draws the lifecycle with the current step and puts the stop action under it as danger-outline", () => {
    renderView();
    const rail = screen.getByRole("list", { name: "Các bước vòng đời lead" });
    const current = within(rail).getAllByRole("listitem").find((item) => item.getAttribute("aria-current") === "step")!;
    expect(current).toHaveTextContent("Chờ xác nhận nhập học · 14/10");
    expect(within(rail).getByText("Đã đặt học thử")).toBeInTheDocument();

    const stop = screen.getByRole("button", { name: "Đánh dấu Đã dừng…" });
    expect(stop).toHaveClass("border-danger");
    expect(stop).not.toHaveClass("bg-danger");
    fireEvent.click(stop);
    expect(screen.getByRole("dialog", { name: "Dừng theo dõi lead" })).toBeInTheDocument();
  });

  it("ends a dropped lead's rail on Đã dừng with its reason and offers reopening, not conversion", () => {
    renderView({}, { dropReason: "Học nơi khác", droppedAt: "2026-10-09T03:00:00Z", status: "dropped" });
    const rail = screen.getByRole("list", { name: "Các bước vòng đời lead" });
    expect(within(rail).getAllByRole("listitem").at(-1)).toHaveTextContent("Đã dừng · 09/10");
    expect(within(rail).getByText("Lý do: Học nơi khác")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở lại lead" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đánh dấu Đã dừng…" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận chuyển đổi" })).not.toBeInTheDocument();
    expect(screen.getByText("Lead đã dừng ngày 09/10/2026: Học nơi khác. Mở lại lead trước khi đặt học thử hoặc xác nhận chuyển đổi.")).toBeInTheDocument();
  });

  // Value: protects=a user without crm.update viewing a dropped lead is told reopening needs that permission instead of being told to reopen it;
  // fails_when=the dropped notice ignores canUpdate (F7/F23); seam=none; no_claim=none beyond protects
  it("tells a viewer without crm.update that reopening needs the permission", () => {
    renderView({ ...sale, canUpdate: false }, { dropReason: "Học nơi khác", droppedAt: "2026-10-09T03:00:00Z", status: "dropped" });
    expect(screen.queryByRole("button", { name: "Mở lại lead" })).not.toBeInTheDocument();
    expect(screen.getByText("Lead đã dừng ngày 09/10/2026: Học nơi khác. Cần quyền cập nhật CRM để mở lại.")).toBeInTheDocument();
  });

  // Value (extension, coverage pass 1): protects=a converted lead stays read-only for a user with crm.update: no new-note form, no trial result action on a leftover scheduled booking, no booking, stop or transfer;
  // fails_when=the view passes raw canUpdate to the notes panel or trial rows instead of the status-aware gates (pre-redesign page hid these on converted cases);
  // why_new=crm-detail-action-gate renders converted without crm.update, so the status half of these gates is never exercised in the view; seam=none; no_claim=does not prove the RPCs reject writes on converted cases
  it("keeps a converted lead read-only even with crm.update", () => {
    renderView({}, {
      status: "converted",
      trialBookings: [
        { classSessionId: null, createdAt: "2026-10-10T04:00:00Z", id: "trial-2", learningMode: "online", saleNotes: null, status: "scheduled", teacherFeedback: null, trialDate: "2026-10-19" },
      ],
    });
    expect(screen.getByRole("link", { name: /Xem hồ sơ học viên/ })).toHaveAttribute("href", "/students/student-1");
    expect(screen.queryByLabelText("Ghi chú mới")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu ghi chú" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi kết quả" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đặt lịch học thử" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đánh dấu Đã dừng…" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển giao Lead" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("shows only expected-enrollment rows that have data and warns about a missing start date", () => {
    renderView();
    const panel = screen.getByRole("heading", { level: 2, name: "Dự kiến nhập học" }).closest("section")!;
    expect(within(panel).queryByText("Học phí")).not.toBeInTheDocument();
    expect(within(panel).getByText("F1 −10%")).toBeInTheDocument();
    expect(within(panel).getByText("Chưa nhập")).toHaveClass("text-warning");
  });

  it("shows assignment history with method words and who assigned", () => {
    renderView();
    const panel = screen.getByRole("heading", { level: 2, name: "Lịch sử phân công" }).closest("section")!;
    const [transfer, initial] = within(panel).getAllByRole("listitem");
    expect(transfer).toHaveTextContent("Đặng Phương Thảo chuyển sang Hoàng Minh Khôi");
    expect(within(transfer).getByText("chuyển sang")).toHaveClass("sr-only");
    expect(transfer).toHaveTextContent("02/10/2026 · bởi Lê Thu Trang · Chuyển giao");
    expect(transfer).toHaveTextContent("Lý do: Lead khối 10");
    expect(initial).toHaveTextContent("Gán ban đầu: Đặng Phương Thảo");
    expect(initial).not.toHaveTextContent("—");
    expect(initial).not.toHaveTextContent("chuyển sang");
    expect(initial).toHaveTextContent("01/10/2026 · Tự động chia đều");
    expect(panel).not.toHaveTextContent("auto_round_robin");
  });

  it("keeps a transfer a transfer when profiles RLS hides the previous sale's name", () => {
    renderView({}, {
      assignmentHistory: [
        { assignedByName: null, assignmentMethod: "manual_transfer", createdAt: "2026-10-02T03:00:00Z", id: "h-2", newSaleOwnerName: "Hoàng Minh Khôi", previousSaleOwnerId: "sale-2", previousSaleOwnerName: null, reason: "Lead khối 10" },
      ],
    });
    const panel = screen.getByRole("heading", { level: 2, name: "Lịch sử phân công" }).closest("section")!;
    const transfer = within(panel).getByRole("listitem");
    expect(transfer).toHaveTextContent("Sale trước (không xem được tên) chuyển sang Hoàng Minh Khôi");
    expect(transfer).not.toHaveTextContent("Gán ban đầu");
  });
});
