// Value: protects=the /dev/fee-notices preview is inert: publishing a template version and reissuing a notice run the preview's stubs (previewFeeNoticeActions) and never the real tuition server actions, print buttons never call window.print, and every QR is the local placeholder (the preview runs on localhost where .env.local may point at production); each view and state renders its design-15b screen from row-shaped fixtures through the real model (templates normal/first/empty, the accountant's permission-denied state, the print batch sorted by grade then name with the superseded original skipped, every notice edition and the accountant without the reissue form); the shell gets the real route as previewPathname and no timekeeping props; the URL whitelist falls back per view; the page 404s in production;
// fails_when=a fee-notice screen stops accepting an injected action or print handler and falls back to the real one, the preview stops passing its stubs, a new write reachable from these screens has no override, the mock below stops covering an export of the actions module, a fixture QR points at vietqr.app, a superseded original is printed, the accountant gets publish or reissue controls, or the production guard is removed;
// why_new=step 13 adds a preview of the template page, bulk print tab and notice page;
// seam=the tuition "use server" actions module is mocked with every export so any real call is observable; AppShell is replaced by a marked wrapper exposing its props (the shell is not under test); next/navigation notFound throws a marker; window.print is spied; no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FeeNoticesPreview,
  previewFeeNoticeActions,
  previewFeeNoticePrint,
  type FeeNoticesNoticeState,
} from "@/app/dev/fee-notices/fee-notices-preview";
import DevFeeNoticesPage from "@/app/dev/fee-notices/page";
import * as tuitionActions from "@/features/tuition/actions";
import { FEE_NOTICE_PLACEHOLDER_QR } from "@/features/tuition/fee-notice-model";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const shellProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/fee-notices",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => {
    shellProps.last = props;
    return <div data-testid="app-shell">{children}</div>;
  },
}));
// Every export of the real module, so a call to any of them is observable.
vi.mock("@/features/tuition/actions", () => ({
  createTuitionPeriodAction: vi.fn(),
  lockTuitionPeriodAction: vi.fn(),
  publishTuitionTemplateAction: vi.fn(),
  reissueTuitionItemAction: vi.fn(),
  setTuitionPeriodRatesAction: vi.fn(),
  setTuitionPeriodSourcesAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const PERIOD_ID = "f1500000-0000-4000-8000-000000000001";
const ITEM = {
  anh: "f1500000-0000-4000-8000-000000000101",
  minh: "f1500000-0000-4000-8000-000000000103",
  minhReplacement: "f1500000-0000-4000-8000-000000000104",
};
const ANH_TRANSFER = "NGUYEN MINH ANH 2011 0912345678 PAY-261015-1A2B3C4D5E6F";
/** Fee-notice screens the preview renders; any action they import as a value must have an override. */
const SCREEN_SOURCES = [
  "src/features/tuition/template-management.tsx",
  "src/features/tuition/reissue-form.tsx",
  "src/features/tuition/fee-notice-screens.tsx",
  "src/features/tuition/fee-notice-a5.tsx",
  "src/features/tuition/print-button.tsx",
  "src/app/dev/fee-notices/fee-notices-preview.tsx",
];

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
/** Intl puts a no-break space before ₫; compare the words. */
const plain = (value: string | null | undefined) => (value ?? "").replace(/ /g, " ");

let printSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  shellProps.last = null;
  printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function spyOnStubs() {
  return {
    print: vi.spyOn(previewFeeNoticePrint, "print"),
    publish: vi.spyOn(previewFeeNoticeActions, "publish"),
    reissue: vi.spyOn(previewFeeNoticeActions, "reissue"),
  };
}

function expectNothingReal() {
  for (const action of Object.values(tuitionActions)) {
    if (typeof action === "function") expect(action).not.toHaveBeenCalled();
  }
  expect(printSpy).not.toHaveBeenCalled();
  expect(router.refresh).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
}

function expectShell(pathname: string) {
  expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  expect(shellProps.last?.previewPathname).toBe(pathname);
  // The topbar's timekeeping pill would mount the real check-in dialog.
  for (const key of ["attendancePolicy", "canCheckTimekeeping", "hasOpenTimekeepingEntry", "openOfflineEntryId", "openTimekeepingEntryId"]) {
    expect(shellProps.last).not.toHaveProperty(key);
  }
  expect(shellProps.last?.permissions).not.toContain("student_care.view");
}

function expectPlaceholderQrs(min: number) {
  const images = screen.queryAllByRole("img");
  expect(images.length).toBeGreaterThanOrEqual(min);
  for (const image of images) expect(image).toHaveAttribute("src", FEE_NOTICE_PLACEHOLDER_QR);
}

describe("/dev/fee-notices preview", () => {
  // Value: protects=the stubs keep covering every write the fee-notice screens can reach, and this file's mock keeps covering every export of the real actions module;
  // fails_when=tuition/actions.ts gains an export the mock above misses, an exported async function does not end in "Action" or is exported in a form the scan cannot see, a screen imports a new action as a value without an override, or previewFeeNoticeActions drifts from TuitionNoticeActionOverrides;
  // why_new=the mock keys and stub keys are this file's, not the modules'; seam=source scan (importing the real module would load the Supabase server client); no_claim=does not prove every component passes the override (the interaction tests do)
  it("stubs every fee-notice write the previewed screens can reach", () => {
    const actionsSource = read("src/features/tuition/actions.ts");
    const exported = Array.from(actionsSource.matchAll(/export\s+async\s+function\s+(\w+)/g), (match) => match[1]);
    const realActions = Array.from(actionsSource.matchAll(/export async function (\w+Action)\b/g), (match) => match[1]);
    expect(realActions.length).toBeGreaterThan(0);
    expect(exported.every((name) => name.endsWith("Action"))).toBe(true);
    expect(exported).toHaveLength(realActions.length);
    expect(Object.keys(tuitionActions).sort()).toEqual([...realActions].sort());

    // Only types may sit beside the actions in the "use server" module.
    const otherExports = (source: string) =>
      Array.from(source.matchAll(/\bexport\b(?!\s+(?:async\s+function|type|interface)\s)[^\n]*/g), (match) => match[0]);
    expect(otherExports("export const lateAction = async () => ({});")).toHaveLength(1);
    expect(otherExports("export type State = {};\nexport async function oneAction() {}")).toEqual([]);
    expect(otherExports(actionsSource)).toEqual([]);

    // previewFeeNoticeActions = exactly the override keys, each typed after a real action.
    const overrides = Array.from(
      read("src/features/tuition/tuition-action-overrides.ts").matchAll(/^\s*(\w+)\?: typeof (\w+);$/gm),
      (match) => ({ action: match[2], key: match[1] }),
    );
    expect(overrides.map((entry) => entry.key).sort()).toEqual(["publish", "reissue"]);
    expect(Object.keys(previewFeeNoticeActions).sort()).toEqual(overrides.map((entry) => entry.key).sort());
    for (const entry of overrides) expect(realActions).toContain(entry.action);

    // Every action a previewed screen imports as a value is one the overrides replace.
    const valueImports = SCREEN_SOURCES.flatMap((file) =>
      Array.from(read(file).matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/features\/tuition\/actions"/g), (match) =>
        match[1]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name && !name.startsWith("type ")),
      ).flat(),
    );
    expect([...new Set(valueImports)].sort()).toEqual(["publishTuitionTemplateAction", "reissueTuitionItemAction"]);
    for (const name of valueImports) expect(overrides.map((entry) => entry.action)).toContain(name);
  });

  it("publishes a template version through the stub only", async () => {
    const stubs = spyOnStubs();
    const { container } = render(<FeeNoticesPreview role="owner" state="normal" view="templates" />);
    expectShell("/finance/tuition-periods/templates");

    expect(screen.getByRole("heading", { level: 1, name: "Mẫu Phiếu học phí" })).toBeInTheDocument();
    expect(screen.getByText("v3 đang dùng")).toBeInTheDocument();
    expect(screen.getByText("TUITION_NOTICE_DEFAULT · xuất bản 25/09/2026 10:12 bởi Nguyễn Thu Hằng")).toBeInTheDocument();
    expect(screen.getByText("Kỳ đã khóa dùng v3: Học phí tháng 10/2026 · 1 kỳ nháp sẽ dùng phiên bản mới nhất khi khóa")).toBeInTheDocument();
    const history = within(screen.getByRole("region", { name: "Lịch sử phiên bản" })).getAllByRole("listitem");
    expect(history).toHaveLength(3);
    expect(history[2]).toHaveTextContent("30/07/2026 · Hệ thống");
    expect(container.querySelectorAll('button[class~="bg-action-primary"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Xuất bản phiên bản v4" })).toHaveAccessibleDescription("Chưa có thay đổi so với v3.");
    expectPlaceholderQrs(1);

    fireEvent.change(screen.getByLabelText("Chân trang"), { target: { value: "Thắc mắc liên hệ 0901 234 567 (cô Hằng)" } });
    fireEvent.change(screen.getByLabelText("Lý do xuất bản"), { target: { value: "Đổi số liên hệ" } });
    fireEvent.click(screen.getByRole("button", { name: "Xuất bản phiên bản v4" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(STUB));
    expect(stubs.publish).toHaveBeenCalledTimes(1);
    expect(stubs.publish).toHaveBeenCalledWith(expect.objectContaining({ footer: "Thắc mắc liên hệ 0901 234 567 (cô Hằng)", reason: "Đổi số liên hệ" }));
    expectNothingReal();
  });

  it.each([
    ["first", "v1 đang dùng", "TUITION_NOTICE_DEFAULT · xuất bản 30/07/2026 08:00 bởi Hệ thống", "Xuất bản phiên bản v2"],
    ["empty", "Chưa có phiên bản", "TUITION_NOTICE_DEFAULT · chưa xuất bản phiên bản nào; kỳ thu chỉ khóa được khi đã có mẫu.", "Xuất bản phiên bản v1"],
  ] as const)("renders the %s template state", (state, badge, context, button) => {
    render(<FeeNoticesPreview role="owner" state={state} view="templates" />);
    expect(screen.getByText(badge)).toBeInTheDocument();
    expect(screen.getByText(context)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: button })).toBeDisabled();
    expectNothingReal();
  });

  it("shows the accountant the route's permission-denied state instead of the template editor", () => {
    render(<FeeNoticesPreview role="accountant" state="normal" view="templates" />);
    expectShell("/finance/tuition-periods/templates");
    expect(screen.getByRole("heading", { level: 1, name: "Không có quyền quản lý mẫu" })).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu quyền settings.receipts.manage.")).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xuất bản phiên bản/ })).not.toBeInTheDocument();
  });

  it("prints the current notices by grade then given name, skipping the superseded original, through the print stub", () => {
    const stubs = spyOnStubs();
    const { container } = render(<FeeNoticesPreview role="owner" state="normal" view="print" />);
    expectShell("/finance/tuition-periods/print");

    const batch = screen.getByRole("region", { name: "Phiếu học phí cần in" });
    const sheets = within(batch).getAllByRole("article");
    expect(sheets.map((sheet) => sheet.getAttribute("aria-label"))).toEqual([
      "Phiếu học phí của Mai Phương Linh",
      "Phiếu học phí của Trịnh Bảo Châu",
      "Phiếu học phí của Nguyễn Minh Anh",
      "Phiếu học phí của Bùi Quang Minh",
      "Phiếu học phí của Lê Hoàng Nam",
    ]);
    expect(screen.getByText("Bỏ qua 1 phiếu đã được thay thế (in bản thay thế hiện hành).")).toBeInTheDocument();
    expect(screen.getByText("5 phiếu · mỗi phiếu một trang A5")).toBeInTheDocument();

    const [linh, chau, anh, minh, nam] = sheets;
    expect(within(anh).getByText(ANH_TRANSFER)).toBeInTheDocument();
    expect(plain(anh.textContent)).toContain("12 buổi × 200.000 ₫ · 8 buổi × 250.000 ₫ · 1 buổi nợ đầu kỳ × 200.000 ₫");
    expect(plain(anh.textContent)).toContain("−1 buổi (nợ)");
    expect(plain(anh.textContent)).toContain("Số tiền phải nộp4.600.000 ₫");
    expect(within(nam).getByText("KHÔNG CẦN THANH TOÁN")).toBeInTheDocument();
    expect(plain(nam.textContent)).toContain("12 buổi kỳ này · số dư đầu kỳ 15 buổi · còn lại sau kỳ 3 buổi");
    expect(within(minh).getByText("BẢN THAY THẾ HIỆN HÀNH")).toBeInTheDocument();
    expect(within(minh).getByText("BUI QUANG MINH 2011 0903456789 PAY-261005-9C8B7A6D5E4F")).toBeInTheDocument();
    // Paper tells parents to contact the center; the staff diagnosis stays on screen only.
    expect(within(chau).getByText("Thiếu thông tin chuyển khoản trên phiếu này. Vui lòng liên hệ trung tâm để được hướng dẫn thanh toán.").closest(".print\\:hidden")).toBeNull();
    expect(within(chau).getByText("Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.").closest(".print\\:hidden")).not.toBeNull();
    expect(within(chau).queryByRole("img")).not.toBeInTheDocument();
    expect(within(nam).queryByRole("img")).not.toBeInTheDocument();
    expect(within(linh).getByRole("img", { name: "Mã QR thanh toán tái phí" })).toBeInTheDocument();
    // The superseded original's cancelled request never reaches paper.
    expect(screen.queryByText(/PAY-260928-7F3E9A0B1C2D/)).not.toBeInTheDocument();
    expectPlaceholderQrs(3);

    const primaries = container.querySelectorAll('button[class~="bg-action-primary"]');
    expect(primaries).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "In 5 phiếu" }));
    expect(stubs.print).toHaveBeenCalledTimes(1);
    expectNothingReal();
  });

  it("renders the empty print state", () => {
    render(<FeeNoticesPreview role="accountant" state="empty" view="print" />);
    expect(screen.getByRole("heading", { name: "Chưa chọn phiếu nào để in." })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^In \d+ phiếu$/ })).not.toBeInTheDocument();
  });

  it("reissues and prints a payable notice through the stubs only", async () => {
    const stubs = spyOnStubs();
    render(<FeeNoticesPreview role="owner" state="payable" view="notice" />);
    expectShell(`/finance/tuition-periods/${PERIOD_ID}/items/${ITEM.anh}/notice`);

    expect(screen.getByRole("heading", { level: 1, name: "Phiếu học phí · Nguyễn Minh Anh" })).toBeInTheDocument();
    expect(screen.getByText("Bản gốc")).toBeInTheDocument();
    expect(screen.getByText(ANH_TRANSFER)).toBeInTheDocument();
    expectPlaceholderQrs(1);

    fireEvent.click(screen.getByRole("button", { name: "In phiếu" }));
    expect(stubs.print).toHaveBeenCalledTimes(1);

    const form = screen.getByRole("form", { name: "Điều chỉnh / phát hành lại" });
    fireEvent.change(within(form).getByLabelText("Số tiền mới (₫)"), { target: { value: "4400000" } });
    fireEvent.change(within(form).getByLabelText("Lý do điều chỉnh"), { target: { value: "Giảm 1 buổi nghỉ có phép" } });
    fireEvent.submit(form);

    await waitFor(() => expect(within(form).getByRole("alert")).toHaveTextContent(STUB));
    expect(stubs.reissue).toHaveBeenCalledWith(ITEM.anh, 4_400_000, "Giảm 1 buổi nghỉ có phép");
    expectNothingReal();
  });

  it("gives the accountant no reissue form", () => {
    render(<FeeNoticesPreview role="accountant" state="payable" view="notice" />);
    expect(screen.getByRole("heading", { level: 1, name: "Phiếu học phí · Nguyễn Minh Anh" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Điều chỉnh / phát hành lại" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In phiếu" })).toBeInTheDocument();
  });

  it.each([
    ["no_payment", "Phiếu học phí · Lê Hoàng Nam", "Bản gốc", "KHÔNG CẦN THANH TOÁN", 0, true],
    ["replacement", "Phiếu học phí · Bùi Quang Minh", "Bản thay thế hiện hành", "BẢN THAY THẾ HIỆN HÀNH", 1, true],
    [
      "superseded",
      "Phiếu học phí · Bùi Quang Minh",
      "Bản gốc · đã có 1 bản thay thế",
      "Phiếu này đã được thay thế. Vui lòng thanh toán theo bản thay thế hiện hành; mã chuyển khoản cũ không còn hiệu lực.",
      0,
      false,
    ],
    ["malformed", "Phiếu học phí · Trịnh Bảo Châu", "Bản gốc", "Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.", 0, true],
  ] as const)("renders the %s notice", (state, heading, edition, copy, qrCount, reissue) => {
    render(<FeeNoticesPreview role="owner" state={state as FeeNoticesNoticeState} view="notice" />);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByText(edition)).toBeInTheDocument();
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toHaveLength(qrCount);
    expectPlaceholderQrs(qrCount);
    expect(screen.queryByRole("form", { name: "Điều chỉnh / phát hành lại" }) !== null).toBe(reissue);
    expectNothingReal();
  });

  it("adds a parent-safe line to the malformed notice's sheet, apart from the staff sentence", () => {
    render(<FeeNoticesPreview role="owner" state="malformed" view="notice" />);
    const sheet = screen.getByRole("article", { name: "Phiếu học phí của Trịnh Bảo Châu" });
    expect(within(sheet).getByText("Thiếu thông tin chuyển khoản trên phiếu này. Vui lòng liên hệ trung tâm để được hướng dẫn thanh toán.").closest(".print\\:hidden")).toBeNull();
    expect(within(sheet).getByText("Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.").closest(".print\\:hidden")).not.toBeNull();
  });

  it("points the superseded notice's shell at the original and the replacement link at the current item", () => {
    render(<FeeNoticesPreview role="owner" state="superseded" view="notice" />);
    expectShell(`/finance/tuition-periods/${PERIOD_ID}/items/${ITEM.minh}/notice`);
    expect(screen.getByRole("link", { name: "Mở bản thay thế hiện hành" })).toHaveAttribute(
      "href",
      `/finance/tuition-periods/${PERIOD_ID}/items/${ITEM.minhReplacement}/notice`,
    );
  });

  it("whitelists the view, role and state of the page URL", async () => {
    // Unknown everything: the templates view as owner, normal.
    const unknown = render(await DevFeeNoticesPage({ searchParams: Promise.resolve({ role: "nobody", state: "nope", view: "bogus" }) }));
    expect(screen.getByText("v3 đang dùng")).toBeInTheDocument();
    unknown.unmount();

    // A state of another view reads as this view's default (the print batch, normal).
    const foreign = render(await DevFeeNoticesPage({ searchParams: Promise.resolve({ state: "superseded", view: "print" }) }));
    expect(within(screen.getByRole("region", { name: "Phiếu học phí cần in" })).getAllByRole("article")).toHaveLength(5);
    foreign.unmount();

    const foreignNotice = render(await DevFeeNoticesPage({ searchParams: Promise.resolve({ state: "empty", view: "notice" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Phiếu học phí · Nguyễn Minh Anh" })).toBeInTheDocument();
    foreignNotice.unmount();

    // Repeated keys: the first value wins.
    render(
      await DevFeeNoticesPage({
        searchParams: Promise.resolve({ role: ["accountant", "owner"], state: ["no_payment", "payable"], view: ["notice", "print"] }),
      }),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Phiếu học phí · Lê Hoàng Nam" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Điều chỉnh / phát hành lại" })).not.toBeInTheDocument();
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevFeeNoticesPage({ searchParams: Promise.resolve({ view: "templates" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
