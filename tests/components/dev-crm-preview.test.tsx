// Value: protects=the /dev/crm preview is inert: transfer, trial booking, trial result, moving to "Chờ xác nhận nhập học", stopping, reopening, conversion, adding a note and closing a follow-up all run the preview's stubs and never the real CRM server actions (the preview runs on localhost where .env.local may point at production); the list renders from fixtures; the page 404s in production;
// fails_when=a CRM component stops accepting an injected action and falls back to transferLeadAction, bookTrialAction, recordTrialResultAction, changeCaseStatusAction, convertStudentAction, addCaseNoteAction or completeFollowUpAction, the preview stops passing previewCrmActions, or the production guard is removed;
// why_new=step 10 adds a preview of screens whose every dialog writes CRM state;
// seam=the CRM actions module is mocked so any real call is observable; AppShell is replaced by its children (the shell is not under test); next/navigation notFound throws a marker; no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrmPreview, previewCrmActions } from "@/app/dev/crm/crm-preview";
import DevCrmPage from "@/app/dev/crm/page";
import * as crmActions from "@/features/crm/actions/crm-actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/crm",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("view=list"),
}));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/crm/actions/crm-actions", () => ({
  addCaseNoteAction: vi.fn(),
  bookTrialAction: vi.fn(),
  changeCaseStatusAction: vi.fn(),
  completeFollowUpAction: vi.fn(),
  convertStudentAction: vi.fn(),
  createCrmCaseAction: vi.fn(),
  recordTrialResultAction: vi.fn(),
  transferLeadAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(crmActions)) {
    expect(action).not.toHaveBeenCalled();
  }
}

async function expectStub(dialogName: string | RegExp) {
  const dialog = screen.getByRole("dialog", { name: dialogName });
  expect(await within(dialog).findByText(STUB)).toBeInTheDocument();
}

/** Cancel once the stubbed action has settled (Hủy is disabled while it is pending). */
async function closeDialog() {
  const cancel = within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" });
  await waitFor(() => expect(cancel).toBeEnabled());
  fireEvent.click(cancel);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("/dev/crm preview", () => {
  it("covers every CRM action with a stub", () => {
    // The real module's exports, not this file's mock keys, so a new server action fails here until it gets a stub.
    const source = readFileSync(join(process.cwd(), "src/features/crm/actions/crm-actions.ts"), "utf8");
    const realActions = Array.from(source.matchAll(/export async function (\w+)Action/g), (match) => match[1]);
    expect(realActions.length).toBeGreaterThan(0);
    expect(Object.keys(previewCrmActions).sort()).toEqual(realActions.sort());
  });

  it("transfers, converts and records a trial result through stubs only", async () => {
    render(<CrmPreview role="owner" state="normal" view="detail" />);

    fireEvent.click(screen.getByRole("button", { name: "Chuyển giao Lead" }));
    fireEvent.change(screen.getByLabelText(/Chọn Sale nhận Lead/), { target: { value: "c3000000-0000-4000-8000-000000000002" } });
    fireEvent.change(screen.getByLabelText(/Lý do chuyển giao/), { target: { value: "Bàn giao theo khu vực." } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận chuyển giao" }));
    await expectStub("Xác nhận chuyển giao Lead");
    await closeDialog();

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));
    fireEvent.change(screen.getByLabelText(/Chọn lớp chính thức/), { target: { value: "c9000000-0000-4000-8000-000000000001" } });
    fireEvent.change(screen.getByLabelText(/Ngày bắt đầu học chính/), { target: { value: "2026-10-20" } });
    for (const control of within(screen.getByRole("dialog")).getAllByRole("checkbox")) {
      if (!(control as HTMLInputElement).checked) fireEvent.click(control);
    }
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận chuyển đổi" }));
    await expectStub("Xác nhận chuyển thành học viên chính thức");
    await closeDialog();

    fireEvent.click(screen.getByRole("button", { name: "Ghi kết quả" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu kết quả" }));
    await expectStub(/Kết quả học thử/);
    expectNothingReal();
  });

  it("stops the lead, books a trial and works the notes through stubs only", async () => {
    const addNote = vi.spyOn(previewCrmActions, "addCaseNote");
    const completeFollowUp = vi.spyOn(previewCrmActions, "completeFollowUp");
    render(<CrmPreview role="owner" state="normal" view="detail" />);

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu Đã dừng…" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText(/Lý do/), { target: { value: "Phụ huynh chọn nơi khác" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận dừng" }));
    await expectStub("Dừng theo dõi lead");
    await closeDialog();

    fireEvent.click(screen.getByRole("button", { name: "Đặt lịch học thử" }));
    fireEvent.change(screen.getByLabelText(/Ngày học thử dự kiến/), { target: { value: "2026-10-20" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận đặt lịch" }));
    await expectStub("Đặt lịch học thử");
    await closeDialog();

    fireEvent.change(screen.getByLabelText("Ghi chú mới"), { target: { value: "Gọi lại sau giờ học." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(await screen.findByText(STUB)).toBeInTheDocument();
    const done = screen.getByRole("button", { name: "Đã xử lý" });
    await waitFor(() => expect(done).toBeEnabled());
    fireEvent.click(done);
    await waitFor(() => expect(completeFollowUp).toHaveBeenCalledOnce());
    expect(addNote).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getAllByText(STUB)).toHaveLength(1));
    expectNothingReal();
  });

  it("moves an interested lead to waiting and reopens a dropped one through stubs only", async () => {
    const { unmount } = render(<CrmPreview role="sale" state="empty" view="detail" />);
    expect(screen.getByText(/Xác nhận chuyển đổi cần quyền/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển chờ xác nhận nhập học" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận" }));
    await expectStub("Chờ xác nhận nhập học");
    unmount();

    render(<CrmPreview role="leader" state="dropped" view="detail" />);
    fireEvent.click(screen.getByRole("button", { name: "Mở lại lead" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText(/Lý do/), { target: { value: "Phụ huynh liên hệ lại" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mở lại" }));
    await expectStub("Mở lại lead");
    expectNothingReal();
  });

  it("renders the list from fixtures and the in-frame error state", () => {
    const { unmount } = render(<CrmPreview role="owner" state="normal" view="list" />);
    expect(screen.getByRole("heading", { level: 1, name: "Lead tuyển sinh" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ CRM Nguyễn Gia Hân" })).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" })).toBeInTheDocument();
    // Fix pass 3 (H4): fixture status changes fall on/after CRM_STATUS_TRACKING_SINCE, so the dated suffixes stay visible.
    const table = screen.getByRole("table", { name: "Danh sách hồ sơ CRM và tuyển sinh" });
    const row = (name: string) => within(table).getByRole("link", { name }).closest("tr")!;
    expect(within(row("Đỗ Hoàng Long")).getByText(/^Đã nhập học · \d{2}\/\d{2}$/)).toBeInTheDocument();
    expect(within(row("Ngô Bảo Ngọc")).getByText(/^Đang quan tâm · \d+ ngày$/)).toBeInTheDocument();
    unmount();

    render(<CrmPreview role="sale" state="errors" view="list" />);
    expect(screen.getAllByText("Không tải được danh sách lead").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Thêm lead" })).toBeInTheDocument();
  });

  // Value (extension, fix pass 1): protects=the preview never links into the live /crm/new write form (localhost may point at production);
  // fails_when=createHref goes back to "/crm/new" or any preview link targets it; why_new=F13; seam=as above; no_claim=does not cover links rendered by the mocked AppShell
  it("never links to the live lead creation form", () => {
    const { container } = render(<CrmPreview role="owner" state="normal" view="list" />);
    expect(screen.getByRole("link", { name: "Thêm lead" })).toHaveAttribute("href", "/dev/crm?view=list");
    expect(Array.from(container.querySelectorAll("a[href]")).filter((link) => link.getAttribute("href")!.startsWith("/crm/new"))).toEqual([]);
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevCrmPage({ searchParams: Promise.resolve({ view: "detail" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
