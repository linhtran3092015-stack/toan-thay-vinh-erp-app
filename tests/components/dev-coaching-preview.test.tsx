// Value: protects=the /dev/coaching preview is inert: adding a note, closing a record, issuing and revoking a public link, saving and publishing a form draft, starting a new version and submitting the parent's form all run the preview's stubs and never the real Coaching server actions (the preview runs on localhost where .env.local may point at production); the record, builder and public form render from fixtures per role and state; the page 404s in production;
// fails_when=a Coaching component stops accepting an injected action and falls back to its real action, the preview stops passing previewCoachingActions, a new Coaching server action is added without a stub, or the production guard is removed;
// why_new=step 11b adds a preview of screens whose every form writes Coaching state;
// seam=the three Coaching action modules are mocked so any real call is observable; AppShell is replaced by a marked wrapper around its children (the shell is not under test); next/navigation notFound throws a marker; no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoachingPreview, previewCoachingActions } from "@/app/dev/coaching/coaching-preview";
import DevCoachingPage from "@/app/dev/coaching/page";
import * as coachingActions from "@/features/coaching/actions/coaching-actions";
import * as coachingFormActions from "@/features/coaching/actions/coaching-form-actions";
import * as publicCoachingFormActions from "@/features/coaching/actions/public-coaching-form-actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/coaching",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("view=record"),
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
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
vi.mock("@/features/coaching/actions/public-coaching-form-actions", () => ({
  submitPublicCoachingFormAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const ACTION_SOURCES = [
  "src/features/coaching/actions/coaching-actions.ts",
  "src/features/coaching/actions/coaching-form-actions.ts",
  "src/features/coaching/actions/public-coaching-form-actions.ts",
];

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const actionsModule of [coachingActions, coachingFormActions, publicCoachingFormActions]) {
    for (const action of Object.values(actionsModule)) {
      expect(action).not.toHaveBeenCalled();
    }
  }
  // A real success would refresh the route or open the saved form.
  expect(router.refresh).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
}

describe("/dev/coaching preview", () => {
  // Value: protects=the preview stubs keep covering every export of the three real "use server" modules, so a new Coaching action cannot reach production from /dev without a stub;
  // fails_when=a Coaching actions module gains an exported action that previewCoachingActions does not stub, exports an async function whose name does not end in "Action", or exports anything in a form the scan cannot see (`export const x = async`, `export { … }`, `export default`);
  // why_new=the mock keys above are this file's, not the modules'; seam=source scan (importing the modules would load the Supabase server client); no_claim=does not prove every component passes the override
  it("covers every Coaching server action with a stub", () => {
    const sources = ACTION_SOURCES.map((file) => readFileSync(join(process.cwd(), file), "utf8"));
    const exportedFunctions = sources.flatMap((source) => Array.from(source.matchAll(/export\s+async\s+function\s+(\w+)/g), (match) => match[1]));
    const realActions = sources.flatMap((source) => Array.from(source.matchAll(/export async function (\w+)Action/g), (match) => match[1]));
    expect(realActions.length).toBeGreaterThan(0);
    expect(exportedFunctions.every((name) => name.endsWith("Action"))).toBe(true);
    expect(exportedFunctions).toHaveLength(realActions.length);
    expect(Object.keys(previewCoachingActions).sort()).toEqual(realActions.sort());

    // The scan above only sees `export async function`; a "use server" module can also export an
    // action as `export const x = async …`, `export { … }` or `export default`. Only types may sit beside the actions.
    const otherExports = (source: string) =>
      Array.from(source.matchAll(/\bexport\b(?!\s+(?:async\s+function|type|interface)\s)[^\n]*/g), (match) => match[0]);
    expect(otherExports("export const lateAction = async () => ({});")).toHaveLength(1);
    expect(otherExports("export { lateAction };")).toHaveLength(1);
    expect(otherExports("export default async function lateAction() {}")).toHaveLength(1);
    expect(otherExports("export type State = {};\nexport async function oneAction() {}")).toEqual([]);
    for (const [index, source] of sources.entries()) {
      expect({ file: ACTION_SOURCES[index], otherExports: otherExports(source) }).toEqual({
        file: ACTION_SOURCES[index],
        otherExports: [],
      });
    }
  });

  it("adds a note and closes the record through stubs only", async () => {
    const user = userEvent.setup();
    render(<CoachingPreview role="manager" state="in_progress" view="record" />);
    expect(screen.getByRole("heading", { level: 1, name: "Theo sát HS lớp 9 · Bùi Quang Minh" })).toBeInTheDocument();
    expect(screen.getByText("TTV-00117 · mở 20/09/2026 · phụ trách Phạm Thu Hạnh · xem lại 20/10 · lý do: Điểm giảm liên tục 3 tuần")).toBeInTheDocument();
    expect(screen.getByText("“Em áp lực thi vào 10, ngủ muộn”")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    const noteDialog = screen.getByRole("dialog", { name: "Thêm ghi chú Coaching" });
    await user.type(within(noteDialog).getByRole("textbox", { name: "Nội dung" }), "Gọi lại sau giờ học.");
    await user.click(within(noteDialog).getByRole("button", { name: "Lưu ghi chú" }));
    expect(await within(noteDialog).findByRole("alert")).toHaveTextContent(STUB);
    await user.click(within(noteDialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đóng phiếu" }));
    const closeDialog = screen.getByRole("dialog", { name: "Đóng phiếu Coaching" });
    await user.type(within(closeDialog).getByRole("textbox", { name: "Kết quả Coaching" }), "Đồng ý học thêm 1 buổi.");
    await user.click(within(closeDialog).getByRole("button", { name: "Đóng phiếu" }));
    expect(await within(closeDialog).findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("revokes a public link with a reason and issues one through stubs only", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CoachingPreview role="manager" state="in_progress" view="record" />);
    const panel = screen.getByRole("region", { name: "Link phiếu công khai" });
    expect(within(panel).getByText("Đang hoạt động · chưa nộp")).toBeInTheDocument();
    expect(within(panel).getByText("Lý do thu hồi: Gửi nhầm cho phụ huynh khác")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Thu hồi" }));
    await user.type(within(panel).getByRole("textbox", { name: /Lý do thu hồi/ }), "Phụ huynh đổi số Zalo");
    await user.click(within(panel).getByRole("button", { name: "Thu hồi" }));
    expect(await within(panel).findByText(STUB)).toHaveAttribute("role", "status");
    unmount();

    // No link yet: the create form is open from the start.
    render(<CoachingPreview role="manager" state="empty" view="record" />);
    const emptyPanel = screen.getByRole("region", { name: "Link phiếu công khai" });
    expect(within(emptyPanel).getByText("Chưa phát hành liên kết nào.")).toBeInTheDocument();
    await user.click(within(emptyPanel).getByRole("button", { name: "Tạo liên kết" }));
    expect(await within(emptyPanel).findByText(STUB)).toHaveAttribute("role", "status");
    expectNothingReal();
  });

  it("shows each record state and role what they may do", () => {
    const { unmount } = render(<CoachingPreview role="manager" state="open" view="record" />);
    expect(screen.getByRole("button", { name: "Bắt đầu xử lý" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm ghi chú" })).toBeInTheDocument();
    unmount();

    const closed = render(<CoachingPreview role="manager" state="closed" view="record" />);
    expect(screen.getByText("“Đồng ý học thêm 1 buổi bổ trợ hình/tuần từ 20/10”")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm ghi chú" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng phiếu" })).not.toBeInTheDocument();
    closed.unmount();

    // The editor reads responses but cannot record events or manage links.
    const editor = render(<CoachingPreview role="editor" state="in_progress" view="record" />);
    expect(screen.getByRole("heading", { level: 2, name: "Phản hồi Phiếu Coaching" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm ghi chú" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Link phiếu công khai" })).not.toBeInTheDocument();
    editor.unmount();

    const viewer = render(<CoachingPreview role="viewer" state="in_progress" view="record" />);
    expect(screen.getByRole("heading", { level: 2, name: "Sự kiện" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Phản hồi Phiếu Coaching" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Link phiếu công khai" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm ghi chú" })).not.toBeInTheDocument();
    viewer.unmount();

    render(<CoachingPreview role="manager" state="error" view="record" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được phiếu Coaching.");
  });

  it("saves and publishes the draft through stubs only", async () => {
    const user = userEvent.setup();
    render(<CoachingPreview role="manager" state="draft" view="builder" />);
    expect(screen.getByRole("heading", { level: 1, name: "Phiếu tự đánh giá tháng" })).toBeInTheDocument();
    expect(screen.getByText("v4 · Nháp")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3, name: /^Câu \d$/ })).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);

    await user.click(screen.getByRole("button", { name: "Xuất bản v4" }));
    const dialog = screen.getByRole("dialog", { name: "Xuất bản v4?" });
    await user.click(within(dialog).getByRole("button", { name: "Xuất bản v4" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("starts a new version of a published form through a stub only", async () => {
    const user = userEvent.setup();
    render(<CoachingPreview role="manager" state="published" view="builder" />);
    expect(screen.getByText("v3 · Đang xuất bản")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tạo bản nháp phiên bản mới" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("gives the editor no publish right and the viewer no edit right", () => {
    const { unmount } = render(<CoachingPreview role="editor" state="draft" view="builder" />);
    const publish = screen.getByRole("button", { name: "Xuất bản v4" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription("Cần quyền xuất bản mẫu coaching.");
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeEnabled();
    unmount();

    render(<CoachingPreview role="viewer" state="draft" view="builder" />);
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xuất bản v4" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Tên biểu mẫu/)).toBeDisabled();
    expect(screen.getByLabelText(/Tiêu đề hiển thị cho phụ huynh/)).toBeDisabled();
    expect(screen.getByText("Bạn chỉ xem được bản nháp này; cần quyền quản lý mẫu coaching để sửa.")).toBeInTheDocument();
  });

  it("renders the first-draft, new-form and error builder states", () => {
    const first = render(<CoachingPreview role="manager" state="first" view="builder" />);
    expect(screen.getByRole("button", { name: "Xuất bản v1" })).toBeEnabled();
    expect(screen.getByText(/Chưa xuất bản phiên bản nào/)).toBeInTheDocument();
    first.unmount();

    const created = render(<CoachingPreview role="manager" state="new" view="builder" />);
    expect(screen.getByRole("heading", { level: 1, name: "Tạo biểu mẫu Coaching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất bản v1" })).toBeDisabled();
    expect(screen.getByText("Lưu nháp lần đầu rồi mới xuất bản được.")).toBeInTheDocument();
    created.unmount();

    render(<CoachingPreview role="manager" state="error" view="builder" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được biểu mẫu Coaching.");
  });

  it("checks the required answers, then submits through the stub only", async () => {
    const user = userEvent.setup();
    render(<CoachingPreview role="manager" state="active" view="public" />);
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Con học tháng này thế nào?" })).toBeInTheDocument();
    // As on the real route: the given name only.
    expect(screen.getByText("Toán Thầy Vinh · Minh")).toBeInTheDocument();
    expect(screen.queryByText(/Bùi Quang/)).not.toBeInTheDocument();
    // The public RPC returns no expiry, so the form promises only what it knows.
    expect(screen.getByText("Phiếu chỉ gửi được một lần.")).toBeInTheDocument();
    expect(screen.queryByText(/Link hết hạn/)).not.toBeInTheDocument();

    // Only the scale is required: the form says so before anything is sent.
    await user.click(screen.getByRole("button", { name: "Gửi phiếu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng trả lời các câu hỏi bắt buộc.");
    expect(screen.getByText("Câu này bắt buộc. Vui lòng trả lời.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("checkbox", { name: "Đại số" }));
    await user.click(screen.getByRole("button", { name: "Gửi phiếu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expect(screen.queryByText("Phiếu Coaching đã được gửi thành công.")).not.toBeInTheDocument();
    expectNothingReal();
  });

  it.each([
    ["submitted", "Phiếu này đã được gửi."],
    ["expired", "Liên kết đã hết hạn."],
    ["revoked", "Liên kết không còn hiệu lực."],
    ["invalid", "Liên kết không hợp lệ."],
    ["unavailable", "Chưa tải được phiếu."],
  ] as const)("renders the %s public link state outside the shell", (state, copy) => {
    render(<CoachingPreview role="manager" state={state} view="public" />);
    expect(screen.getByRole("heading", { level: 1, name: copy })).toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi phiếu" })).not.toBeInTheDocument();
  });

  it("offers Tải lại trang on the unavailable screen only, reloading the preview itself", () => {
    const { unmount } = render(<CoachingPreview role="manager" state="unavailable" view="public" />);
    expect(screen.getByRole("link", { name: "Tải lại trang" })).toHaveAttribute(
      "href",
      "/dev/coaching?view=public&state=unavailable",
    );
    unmount();

    render(<CoachingPreview role="manager" state="expired" view="public" />);
    expect(screen.queryByRole("link", { name: "Tải lại trang" })).not.toBeInTheDocument();
  });

  it("whitelists the view, role and state of the page URL", async () => {
    // Unknown everything: the record view as manager, in progress.
    const { unmount } = render(await DevCoachingPage({ searchParams: Promise.resolve({ role: "nobody", state: "nope", view: "bogus" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Theo sát HS lớp 9 · Bùi Quang Minh" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng phiếu" })).toBeInTheDocument();
    unmount();

    // A state of another view reads as this view's default (the public form, active).
    const foreign = render(await DevCoachingPage({ searchParams: Promise.resolve({ state: "draft", view: "public" }) }));
    expect(screen.getByRole("button", { name: "Gửi phiếu" })).toBeInTheDocument();
    foreign.unmount();

    // Repeated keys: the first value wins.
    render(await DevCoachingPage({ searchParams: Promise.resolve({ role: ["viewer", "manager"], state: "published", view: ["builder", "public"] }) }));
    expect(screen.getByText("v3 · Đang xuất bản")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên biểu mẫu/)).toBeDisabled();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevCoachingPage({ searchParams: Promise.resolve({ view: "record" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
