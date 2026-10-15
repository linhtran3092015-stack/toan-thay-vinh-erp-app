// Value: protects=the Coaching record (design 13c): the "Sự kiện" card lists events newest first although the RPC returns them oldest first; a status change shows "previous → new" with the previous status read from the closest earlier event that has one (notes carry none); an outcome shows its quoted text plus "Ghi chú:" for its note; times are Vietnam time; no events shows the empty line; the responses card appears only with canViewResponses (fail-closed default), dates each submission in Vietnam time, names every "Xem phản hồi" link distinctly, and says when responses, the link history or the forms list failed to load (issuing then unavailable or the cause named); the create dialog, list badge and record header use one priority wording; header actions exist only while open or in progress (no empty slot otherwise); an event action call that never reaches the server keeps its dialog and text and shows the connection message, then a retry goes through; the /coaching list (table badge and phone card) words each priority exactly as the record header does (extended by /ship test audit, Claude Opus 5.5, 2026-10-15);
// fails_when=the timeline is rendered in RPC order, the previous status is taken from the immediately preceding event (a note in between hides "Mở →"), the outcome's note or quote is dropped, times shift out of Vietnam time (a 17:30Z event must read 14/10 00:30), or the empty state disappears; a caller that omits canViewResponses sees responses, screen readers hear several identical "Xem phản hồi" links, a failed loader reads as "Chưa có phản hồi công khai nào." / "Chưa phát hành liên kết nào." / "publish a form first", the page stops forwarding the forms flags, the dialog offers "Trung bình" again, a closed record keeps an empty actions slot, or a rejected addNote/advanceStatus reaches the error boundary, closes the dialog, wipes the text or refreshes the route; the list's priority wording drifts from the header's again (the list said 'Ưu tiên trung bình' where the header says 'Ưu tiên vừa');
// why_new=step 11b replaces the oldest-first "Lịch sử phiếu" list with buildCoachingTimeline and adds the responses card and the injected event actions; the dev preview only checks two quoted texts and legacy-unknown-state-hardening only status badges/actions; legacy-consequential-dialogs covers returned errors, not rejected calls; the list badge now reads getCoachingPriorityPresentation, which coaching-presentation.test.ts pins only as a function (its no_claim leaves the list unrendered);
// seam=next/navigation is mocked with one observable router; the two Coaching action modules are mocked so any real call is observable, and event actions are injected through the actions prop; CoachingListPage is rendered directly (a synchronous component, no loaders); no_claim=does not prove get_coaching_record_events orders by event_sequence asc (migration 20260802200000), that the route flags only a permitted loader that returned null (route wiring: coaching-detail-route.test.tsx), nor the two-column lg layout
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { addCoachingNoteAction, advanceCoachingStatusAction } from "@/features/coaching/actions/coaching-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { CoachingDetailPage } from "@/features/coaching/coaching-detail-page";
import { CoachingPriorityBadge } from "@/features/coaching/coaching-list-page";
import { CoachingListPage } from "@/features/coaching/coaching-list-page";
import type { CoachingFormSummary, CoachingRecordResponseSummary } from "@/features/coaching/coaching-form-data";
import { COACHING_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import { CreateCoachingDialog } from "@/features/coaching/components/create-coaching-dialog";
import type { CoachingRecordDashboardEntry, CoachingRecordEvent } from "@/features/coaching/read-models";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/coaching/actions/coaching-actions", () => ({
  addCoachingNoteAction: vi.fn(),
  advanceCoachingStatusAction: vi.fn(),
  createCoachingRecordAction: vi.fn(),
}));
vi.mock("@/features/coaching/actions/coaching-form-actions", () => ({
  createCoachingFormVersionDraftAction: vi.fn(),
  issueCoachingPublicLinkAction: vi.fn(),
  publishCoachingFormAction: vi.fn(),
  revokeCoachingPublicLinkAction: vi.fn(),
  saveCoachingFormDraftAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const record: CoachingRecordDashboardEntry = {
  assistantOwnerDisplayName: "Cô Hạnh",
  assistantOwnerId: "staff-1",
  campaignName: "Theo sát HS lớp 9",
  currentStatus: "closed",
  id: "coaching-1",
  latestEventAt: "2026-10-13T17:30:00Z",
  latestOutcome: "Học thêm 1 buổi/tuần",
  openedAt: "2026-09-20T02:00:00Z",
  priority: "high",
  reason: "Điểm giảm liên tục 3 tuần",
  reviewAt: "2026-10-20",
  studentFullName: "Bùi Quang Minh",
  studentId: "student-1",
  studentPublicCode: "TTV-00117",
};

/** As get_coaching_record_events returns them: event_sequence ascending, oldest first. */
const events: CoachingRecordEvent[] = [
  {
    eventType: "opened",
    id: "event-1",
    note: null,
    occurredAt: "2026-09-20T02:00:00Z",
    occurredByDisplayName: "Cô Hạnh",
    outcome: null,
    status: "open",
  },
  {
    eventType: "note_added",
    id: "event-2",
    note: "Em áp lực thi vào 10",
    occurredAt: "2026-09-21T03:00:00Z",
    occurredByDisplayName: "Cô Hạnh",
    outcome: null,
    status: null,
  },
  {
    eventType: "status_changed",
    id: "event-3",
    note: "Đã gọi phụ huynh",
    occurredAt: "2026-09-22T03:00:00Z",
    occurredByDisplayName: "Cô Hạnh",
    outcome: null,
    status: "in_progress",
  },
  {
    eventType: "outcome_recorded",
    id: "event-4",
    note: "Phụ huynh đồng ý qua Zalo",
    occurredAt: "2026-10-13T17:30:00Z",
    occurredByDisplayName: "Thầy Vinh",
    outcome: "Học thêm 1 buổi/tuần",
    status: "closed",
  },
];

const statusBadges = (row: HTMLElement) =>
  within(row)
    .queryAllByText(/^(Mở|Đang xử lý|Đã đóng)$/)
    .map((badge) => badge.textContent);

describe("CoachingDetailPage events", () => {
  it("lists events newest first with the previous status of a change, the outcome's note and Vietnam times", () => {
    render(<CoachingDetailPage canManage={false} events={events} record={record} />);

    const list = screen.getByRole("list", { name: "Sự kiện của phiếu, mới nhất trước" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => /^(Kết quả|Đổi trạng thái|Ghi chú|Mở phiếu)/.exec(row.textContent ?? "")?.[0])).toEqual([
      "Kết quả",
      "Đổi trạng thái",
      "Ghi chú",
      "Mở phiếu",
    ]);

    const [outcome, change, note, opened] = rows as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    expect(within(outcome).getByText("“Học thêm 1 buổi/tuần”")).toBeInTheDocument();
    expect(within(outcome).getByText("Ghi chú: Phụ huynh đồng ý qua Zalo")).toBeInTheDocument();
    // 17:30 UTC on 13/10 is 00:30 on 14/10 in Vietnam.
    expect(within(outcome).getByText("14/10 00:30")).toHaveAttribute("datetime", "2026-10-13T17:30:00Z");
    expect(outcome).toHaveTextContent("Thầy Vinh");
    expect(statusBadges(outcome)).toEqual([]);

    // The note in between carries no status, so the change reads from the opening event.
    expect(statusBadges(change)).toEqual(["Mở", "Đang xử lý"]);
    expect(within(change).getByText("“Đã gọi phụ huynh”")).toBeInTheDocument();
    expect(within(change).getByText("22/09 10:00")).toBeInTheDocument();

    expect(within(note).getByText("“Em áp lực thi vào 10”")).toBeInTheDocument();
    expect(statusBadges(note)).toEqual([]);
    expect(within(opened).queryByText(/“/)).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có sự kiện nào được ghi nhận.")).not.toBeInTheDocument();
    cleanup();

    // No events yet: the empty line instead of a list.
    render(<CoachingDetailPage canManage={false} events={[]} record={{ ...record, currentStatus: "open" }} />);
    expect(screen.getByText("Chưa có sự kiện nào được ghi nhận.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Sự kiện của phiếu, mới nhất trước" })).not.toBeInTheDocument();
  });
});

const responses: CoachingRecordResponseSummary[] = [
  {
    formName: "Phiếu học kỳ",
    id: "response-1",
    studentName: "Bùi Quang Minh",
    submittedAt: "2026-10-13T17:30:00Z",
    versionNumber: 2,
  },
  {
    formName: "Phiếu học kỳ",
    id: "response-2",
    studentName: "Bùi Quang Minh",
    submittedAt: "2026-09-19T20:05:00Z",
    versionNumber: 1,
  },
];

const publishedForm: CoachingFormSummary = {
  formId: "form-1",
  formStatus: "active",
  name: "Phiếu học kỳ",
  publishedAt: "2026-08-16T00:00:00.000Z",
  responseCount: 0,
  title: "Phiếu học kỳ",
  versionId: "version-1",
  versionNumber: 1,
  versionStatus: "published",
};

const RESPONSES_HEADING = { level: 2, name: "Phản hồi Phiếu Coaching" } as const;

describe("CoachingDetailPage responses and links", () => {
  it("shows responses only with canViewResponses, each dated in Vietnam time behind a distinctly named link", () => {
    // Omitting the flag fails closed, even with rows in hand.
    render(<CoachingDetailPage canManage={false} events={[]} record={record} responses={responses} />);
    expect(screen.queryByRole("heading", RESPONSES_HEADING)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Xem phản hồi/ })).not.toBeInTheDocument();
    cleanup();

    render(<CoachingDetailPage canManage={false} canViewResponses events={[]} record={record} responses={responses} />);
    expect(screen.getByRole("heading", RESPONSES_HEADING)).toBeInTheDocument();
    // 17:30Z on 13/10 is 00:30 on 14/10; 20:05Z on 19/09 is 03:05 on 20/09.
    expect(screen.getByText("nộp 14/10/2026 00:30")).toBeInTheDocument();
    expect(screen.getByText("nộp 20/09/2026 03:05")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem phản hồi Phiếu học kỳ v2, nộp 14/10/2026 00:30" })).toHaveAttribute(
      "href",
      "/coaching/responses/response-1",
    );
    expect(screen.getByRole("link", { name: "Xem phản hồi Phiếu học kỳ v1, nộp 20/09/2026 03:05" })).toHaveAttribute(
      "href",
      "/coaching/responses/response-2",
    );
    expect(screen.getByRole("link", { name: "Xem tất cả phản hồi" })).toHaveAttribute("href", "/coaching/responses");
  });

  it("says when responses or the link history could not be loaded instead of showing them as empty", () => {
    render(
      <CoachingDetailPage
        canManage={false}
        canManageLinks
        canViewResponses
        events={[]}
        forms={[publishedForm]}
        linksUnavailable
        record={record}
        responsesUnavailable
      />,
    );

    expect(screen.getByText("Không tải được phản hồi.")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có phản hồi công khai nào.")).not.toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Link phiếu công khai" });
    expect(
      within(panel).getByText("Không tải được lịch sử liên kết. Tải lại trang trước khi phát link mới."),
    ).toBeInTheDocument();
    expect(within(panel).queryByText("Chưa phát hành liên kết nào.")).not.toBeInTheDocument();
    // No issuing: a new link would silently replace one the panel cannot show.
    expect(within(panel).getByRole("button", { name: "Phát link mới" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Phát link mới" })).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();
    cleanup();

    // The forms list failed to load, or the viewer may not read forms: named instead of "publish a form first".
    render(<CoachingDetailPage canManage={false} canManageLinks events={[]} formsUnavailable record={record} />);
    expect(screen.getByText("Không tải được danh sách biểu mẫu. Tải lại trang để phát link.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo liên kết" })).not.toBeInTheDocument();
    cleanup();
    render(<CoachingDetailPage canManage={false} canManageLinks canViewForms={false} events={[]} record={record} />);
    expect(screen.getByText("Cần quyền xem mẫu coaching để chọn phiên bản khi phát link.")).toBeInTheDocument();
    expect(screen.queryByText("Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.")).not.toBeInTheDocument();
    cleanup();

    // Loaded and empty: the empty lines, and the create form open from the start.
    render(<CoachingDetailPage canManage={false} canManageLinks canViewResponses events={[]} forms={[publishedForm]} record={record} />);
    expect(screen.getByText("Chưa có phản hồi công khai nào.")).toBeInTheDocument();
    expect(screen.getByText("Chưa phát hành liên kết nào.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo liên kết" })).toBeInTheDocument();
  });
});

describe("Coaching priority wording", () => {
  it("offers in the create dialog the same priorities the record and the list badge show", () => {
    const studentId = "11111111-1111-4111-8111-111111111111";
    render(
      <CreateCoachingDialog
        assignees={[{ displayName: "Cô Hạnh", id: "staff-1", roleCode: "assistant_manager" }]}
        students={[{ fullName: "Bùi Quang Minh", id: studentId, lifecycleStatus: "active", publicCode: "TTV-00117" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu Coaching" }));
    const options = within(screen.getByLabelText("Mức ưu tiên")).getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((option) => [option.value, option.textContent])).toEqual([
      ["low", "Thấp"],
      ["medium", "Vừa"],
      ["high", "Cao"],
    ]);
    // The old dialog said "Trung bình" while the list said "Ưu tiên trung bình" and the record "Ưu tiên vừa".
    expect(screen.getByLabelText("Mức ưu tiên")).toHaveValue("medium");
    cleanup();

    for (const [priority, label] of [
      ["low", "Ưu tiên thấp"],
      ["medium", "Ưu tiên vừa"],
      ["high", "Ưu tiên cao"],
    ] as const) {
      const { unmount } = render(<CoachingPriorityBadge priority={priority} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
      render(<CoachingDetailPage canManage={false} events={[]} record={{ ...record, priority }} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      cleanup();
    }
  });
});

type AddNote = NonNullable<CoachingActionOverrides["addCoachingNote"]>;
type AdvanceStatus = NonNullable<CoachingActionOverrides["advanceCoachingStatus"]>;

describe("CoachingDetailPage event actions", () => {
  it("gives closed and unknown records no actions slot at all", () => {
    for (const currentStatus of ["closed", "constructor"]) {
      const { container, unmount } = render(
        <CoachingDetailPage canManage events={[]} record={{ ...record, currentStatus }} />,
      );
      // Only the title block: an empty actions div would add PageHeader's gap on mobile.
      expect(container.querySelector("header")?.children).toHaveLength(1);
      unmount();
    }

    const { container } = render(<CoachingDetailPage canManage events={[]} record={{ ...record, currentStatus: "open" }} />);
    expect(container.querySelector("header")?.children).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Bắt đầu xử lý" })).toBeInTheDocument();
  });

  it("keeps the dialog and what was typed when the call never reaches the server, then retries", async () => {
    const actions = {
      addCoachingNote: vi.fn<AddNote>().mockRejectedValueOnce(new Error("Server Action was not found on the server.")),
      advanceCoachingStatus: vi
        .fn<AdvanceStatus>()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce({ message: "Đã lưu.", status: "success" }),
    };
    render(
      <CoachingDetailPage actions={actions} canManage events={[]} record={{ ...record, currentStatus: "in_progress" }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    const noteDialog = screen.getByRole("dialog", { name: "Thêm ghi chú Coaching" });
    fireEvent.change(within(noteDialog).getByLabelText("Nội dung"), { target: { value: "Gọi lại sau giờ học." } });
    fireEvent.click(within(noteDialog).getByRole("button", { name: "Lưu ghi chú" }));
    expect(await within(noteDialog).findByRole("alert")).toHaveTextContent(COACHING_CONNECTION_ERROR_MESSAGE);
    expect(within(noteDialog).getByLabelText("Nội dung")).toHaveValue("Gọi lại sau giờ học.");
    expect(within(noteDialog).getByLabelText("Nội dung")).toBeEnabled();
    fireEvent.click(within(noteDialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^Đóng phiếu$/ }));
    const closeDialog = screen.getByRole("dialog", { name: "Đóng phiếu Coaching" });
    fireEvent.change(within(closeDialog).getByLabelText("Kết quả Coaching"), { target: { value: "Đồng ý học thêm 1 buổi." } });
    fireEvent.change(within(closeDialog).getByLabelText("Ghi chú bổ sung"), { target: { value: "Qua Zalo." } });
    fireEvent.click(within(closeDialog).getByRole("button", { name: "Đóng phiếu" }));
    expect(await within(closeDialog).findByRole("alert")).toHaveTextContent(COACHING_CONNECTION_ERROR_MESSAGE);
    expect(within(closeDialog).getByLabelText("Kết quả Coaching")).toHaveValue("Đồng ý học thêm 1 buổi.");
    expect(within(closeDialog).getByLabelText("Ghi chú bổ sung")).toHaveValue("Qua Zalo.");
    expect(router.refresh).not.toHaveBeenCalled();

    // The same dialog retries with the same text.
    fireEvent.click(within(closeDialog).getByRole("button", { name: "Đóng phiếu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(actions.advanceCoachingStatus).toHaveBeenCalledTimes(2);
    expect(actions.advanceCoachingStatus).toHaveBeenLastCalledWith({
      coachingRecordId: record.id,
      note: "Qua Zalo.",
      outcome: "Đồng ý học thêm 1 buổi.",
      targetStatus: "closed",
    });
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(addCoachingNoteAction).not.toHaveBeenCalled();
    expect(advanceCoachingStatusAction).not.toHaveBeenCalled();
  });
});

describe("Coaching priority wording", () => {
  it("says each priority in the same words on the /coaching list (table and phone card) as in the record header", () => {
    const priorities = ["high", "medium", "low"] as const;
    const expected = ["Ưu tiên cao", "Ưu tiên vừa", "Ưu tiên thấp"];

    const headerLabels = priorities.map((priority) => {
      const { container, unmount } = render(<CoachingDetailPage canManage={false} events={[]} record={{ ...record, priority }} />);
      const label = within(container.querySelector("header")!).getByText(/^Ưu tiên /).textContent;
      unmount();
      return label;
    });
    expect(headerLabels).toEqual(expected);

    const entries = priorities.map((priority, index) => ({ ...record, id: `coaching-${index}`, priority }));
    const { container } = render(<CoachingListPage canManage={false} entries={entries} managementOptions={null} />);
    const tableRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(tableRows.map((row) => within(row).getByText(/^Ưu tiên /).textContent)).toEqual(expected);
    const cardLabels = Array.from(container.querySelectorAll("dt"))
      .filter((term) => term.textContent === "Ưu tiên")
      .map((term) => term.nextElementSibling?.textContent);
    expect(cardLabels).toEqual(expected);
  });
});
