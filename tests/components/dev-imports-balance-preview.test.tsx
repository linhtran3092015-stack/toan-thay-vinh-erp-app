// Value: protects=the /dev/imports session-balance previews are inert and truthful per role: every server action the two pages can reach has a stub (source scan of the pages' imports), writes answer "Bản xem trước không ghi dữ liệu." inline and never call a real action, push or refresh, the dry run answers the fixture; the owner (import + approve) can approve someone else's batch, the maker (import only) sees the read-only sentence and no approve link, the own batch shows the four-eyes sentence; the viewer gets the routes' denials; every link stays under /dev and a list link opens its own batch state for the same role; the fixtures agree with themselves (counts vs rows, own batch = the role's user, newest first on the fixed clock);
// fails_when=a page imports a new action without a stub, a stub writes or navigates, a fixture link leaves /dev or points at another batch, the maker can approve or post, the creator's own batch can be approved, the viewer sees data, or a batch's counts disagree with its rows;
// why_new=step 15b adds the session-balance bodies of /dev/imports;
// seam=the session-balance actions module is mocked so any real call is observable; next/navigation useRouter (push, refresh) is mocked; the body is rendered without the AppShell (the controller wraps it, covered by dev-imports-page.test.tsx);
// no_claim=does not prove the /dev/imports page wiring or its production 404 (dev-imports-page.test.tsx), or the real pages' behaviour with real actions (page and workflow tests)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BALANCE_PREVIEW_BATCH_IDS,
  BALANCE_PREVIEW_DRY_RUN,
  getBalancePreviewBatches,
  getBalancePreviewBatchHref,
  getBalancePreviewDetail,
} from "@/app/dev/imports/balance-import-fixtures";
import { BalanceImportPreviewBody, previewBalanceImportActions } from "@/app/dev/imports/balance-import-preview";
import { IMPORTS_PREVIEW_TODAY, IMPORTS_PREVIEW_USERS, type ImportsPreviewRole } from "@/app/dev/imports/imports-preview-params";
import * as realActions from "@/features/imports/session-balances/actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/imports/session-balances/actions", () => ({
  approveSessionBalanceImportBatchAction: vi.fn(),
  createSessionBalanceImportBatchAction: vi.fn(),
  dryRunSessionBalanceImportAction: vi.fn(),
  excludeSessionBalanceImportRowAction: vi.fn(),
  postSessionBalanceImportBatchAction: vi.fn(),
  reconcileSessionBalanceImportBatchAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const roles: readonly ImportsPreviewRole[] = ["owner", "maker", "viewer"];
const balanceStates = ["file", "review", "list"] as const;
const batchStates = ["reconcile", "approve", "approve-own", "post", "posted"] as const;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(realActions)) expect(action).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
  expect(router.refresh).not.toHaveBeenCalled();
}

function expectLinksUnderDev() {
  for (const link of document.querySelectorAll("a[href]")) {
    expect(link.getAttribute("href"), link.textContent ?? "").toMatch(/^\/dev\//);
  }
}

describe("/dev/imports session-balance preview", () => {
  it("stubs every session-balance action the two pages can reach", () => {
    const root = join(process.cwd(), "src/features/imports/session-balances");
    const reachable = new Set<string>();
    for (const file of ["session-balance-import-page.tsx", "session-balance-batch-detail-page.tsx", "session-balance-batch-list.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/features\/imports\/session-balances\/actions"/g)) {
        for (const name of match[1].split(",").map((part) => part.trim()).filter(Boolean)) reachable.add(name.replace(/Action$/, ""));
      }
    }
    expect([...reachable].sort()).toEqual([
      "approveSessionBalanceImportBatch",
      "createSessionBalanceImportBatch",
      "dryRunSessionBalanceImport",
      "excludeSessionBalanceImportRow",
      "postSessionBalanceImportBatch",
      "reconcileSessionBalanceImportBatch",
    ]);
    expect(Object.keys(previewBalanceImportActions).sort()).toEqual([...reachable].sort());
  });

  it("answers every write with the stub message and the dry run with the fixture", async () => {
    const { dryRunSessionBalanceImport, ...writes } = previewBalanceImportActions;
    for (const write of Object.values(writes)) {
      await expect((write as () => Promise<unknown>)()).resolves.toEqual({ code: "invalid_request", message: STUB, ok: false });
    }
    await expect(dryRunSessionBalanceImport({ effective_on: IMPORTS_PREVIEW_TODAY, rows: [] })).resolves.toEqual({
      data: BALANCE_PREVIEW_DRY_RUN,
      ok: true,
    });
    expectNothingReal();
  });

  it("gives the viewer the routes' denials", () => {
    render(<BalanceImportPreviewBody role="viewer" state="list" view="balances" />);
    expect(screen.getByRole("heading", { level: 1, name: "Không có quyền truy cập" })).toBeInTheDocument();
    expect(screen.getByText("Tài khoản hiện tại không có quyền xem hoặc duyệt import số dư buổi.")).toBeInTheDocument();
    expect(screen.queryByText("Danh sách Batch đối soát & Phê duyệt", { exact: false })).not.toBeInTheDocument();
    cleanup();

    render(<BalanceImportPreviewBody role="viewer" state="approve" view="balance-batch" />);
    expect(screen.getByText("Tài khoản hiện tại không có quyền xem chi tiết batch import số dư.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("list: the owner may approve another account's batch; the maker cannot; each link opens its own batch state under /dev", () => {
    render(<BalanceImportPreviewBody role="owner" state="list" view="balances" />);
    const ownerList = screen.getByRole("list", { name: "Các lô số dư buổi" });
    expect(within(ownerList).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Chờ đối tác duyệt (Maker)")).toBeInTheDocument();
    expect(screen.getByText("Chờ bạn duyệt")).toBeInTheDocument();
    expect(within(ownerList).getByRole("link", { name: /^Xem & Phê duyệt/ })).toHaveAttribute(
      "href",
      "/dev/imports?view=balance-batch&state=approve&role=owner",
    );
    expect(within(ownerList).getByRole("link", { name: /^Xem & ghi sổ/ })).toHaveAttribute(
      "href",
      "/dev/imports?view=balance-batch&state=post&role=owner",
    );
    expectLinksUnderDev();
    cleanup();

    render(<BalanceImportPreviewBody role="maker" state="list" view="balances" />);
    const makerList = screen.getByRole("list", { name: "Các lô số dư buổi" });
    expect(screen.queryByText("Chờ bạn duyệt")).not.toBeInTheDocument();
    expect(screen.getByText("Đang chờ phê duyệt")).toBeInTheDocument();
    expect(screen.getByText("Chờ đối tác duyệt (Maker)")).toBeInTheDocument();
    expect(within(makerList).queryByRole("link", { name: /Phê duyệt/ })).not.toBeInTheDocument();
    expect(within(makerList).getByRole("link", { name: /^Xem đối soát/ })).toHaveAttribute(
      "href",
      "/dev/imports?view=balance-batch&state=reconcile&role=maker",
    );
    expect(within(makerList).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/dev/imports?view=balance-batch&state=approve-own&role=maker",
      "/dev/imports?view=balance-batch&state=approve&role=maker",
      "/dev/imports?view=balance-batch&state=reconcile&role=maker",
      "/dev/imports?view=balance-batch&state=post&role=maker",
      "/dev/imports?view=balance-batch&state=posted&role=maker",
    ]);
    expectNothingReal();
  });

  it("file: the first step without a batch list", () => {
    render(<BalanceImportPreviewBody role="owner" state="file" view="balances" />);
    expect(screen.queryByRole("list", { name: "Các lô số dư buổi" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ngày hiệu lực số dư")).toHaveValue(IMPORTS_PREVIEW_TODAY);
    expect(screen.getByLabelText("Chọn file Excel")).toBeInTheDocument();
  });

  it("review: opens on the fixture check; re-checking uses the stub; creating answers the stub inline and goes nowhere", async () => {
    render(<BalanceImportPreviewBody role="maker" state="review" view="balances" />);

    expect(screen.getByText("so-du-buoi-dau-ky-10-2026.xlsx · 8 dòng")).toBeInTheDocument();
    expect(screen.getByLabelText("Kết quả kiểm tra")).toHaveTextContent("Tổng dòng8Hợp lệ3Cần xem lại2Không hợp lệ2Không thay đổi1");

    fireEvent.click(screen.getByRole("button", { name: /Quay lại bước\s*Ánh xạ cột/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 8 dòng" }));
    expect(await screen.findByLabelText("Kết quả kiểm tra")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục: Tạo lô đối soát" }));
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Thử bản xem trước" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Tạo lô đối soát" }));

    expect(await screen.findByText(STUB)).toBeInTheDocument();
    expectNothingReal();
  });

  it("approve: the owner's click answers the stub inline; the maker reads the read-only sentence; the own batch reads the four-eyes sentence", async () => {
    render(<BalanceImportPreviewBody role="owner" state="approve" view="balance-batch" />);
    const approve = () => screen.getByRole("button", { name: "Phê duyệt batch" });
    expect(approve()).toBeEnabled();
    expect(screen.queryByText(/Nguyên tắc 4 mắt/)).not.toBeInTheDocument();
    fireEvent.click(approve());
    expect(await screen.findByText(STUB)).toBeInTheDocument();
    expectNothingReal();
    cleanup();

    render(<BalanceImportPreviewBody role="maker" state="approve" view="balance-batch" />);
    expect(approve()).toBeDisabled();
    expect(screen.getByText(/Tài khoản hiện tại chỉ xem thông tin read-only\. Bạn không có quyền phê duyệt/)).toBeInTheDocument();
    expect(screen.queryByText(/Nguyên tắc 4 mắt/)).not.toBeInTheDocument();
    cleanup();

    for (const role of ["owner", "maker"] as const) {
      render(<BalanceImportPreviewBody role={role} state="approve-own" view="balance-batch" />);
      expect(approve()).toBeDisabled();
      expect(screen.getByText(/Nguyên tắc 4 mắt \(Maker\/Checker\): Người tạo batch không được tự phê duyệt batch của mình/)).toBeInTheDocument();
      cleanup();
    }
    expectNothingReal();
  });

  it("reconcile: the maker's exclusion answers the stub inline; reconcile stays blocked by the review rows", async () => {
    render(<BalanceImportPreviewBody role="maker" state="reconcile" view="balance-batch" />);
    expect(screen.getByRole("button", { name: "Hoàn tất đối soát -> Gửi phê duyệt" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Loại khỏi lô dòng 4" }));
    expect(screen.getByLabelText("Lý do loại dòng 4")).toHaveValue("Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên.");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận loại" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("post: the owner can arm it and gets the stub; the maker cannot post", async () => {
    render(<BalanceImportPreviewBody role="owner" state="post" view="balance-batch" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Gõ GHI SO DU để xác nhận"), { target: { value: "GHI SO DU" } });
    fireEvent.click(screen.getByRole("button", { name: "Ghi số dư vào sổ buổi" }));
    expect(await screen.findByText(STUB)).toBeInTheDocument();
    expectNothingReal();
    cleanup();

    render(<BalanceImportPreviewBody role="maker" state="post" view="balance-batch" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Gõ GHI SO DU để xác nhận"), { target: { value: "GHI SO DU" } });
    expect(screen.getByRole("button", { name: "Ghi số dư vào sổ buổi" })).toBeDisabled();
  });

  it("posted: the ledger and the list links stay under /dev", () => {
    render(<BalanceImportPreviewBody role="owner" state="posted" view="balance-batch" />);
    expect(screen.getByRole("link", { name: "Xem sổ buổi" })).toHaveAttribute("href", "/dev/lists?view=session-ledger");
    expect(screen.getByRole("link", { name: /Danh sách lô/ })).toHaveAttribute("href", "/dev/imports?view=balances&state=list&role=owner");
  });

  it("keeps every link of every state and role under /dev and calls nothing real on render", () => {
    for (const role of roles) {
      for (const state of balanceStates) {
        render(<BalanceImportPreviewBody role={role} state={state} view="balances" />);
        expectLinksUnderDev();
        cleanup();
      }
      for (const state of batchStates) {
        render(<BalanceImportPreviewBody role={role} state={state} view="balance-batch" />);
        expectLinksUnderDev();
        cleanup();
      }
    }
    expectNothingReal();
  });

  it("fixtures agree with themselves on the fixed clock", async () => {
    for (const role of ["owner", "maker"] as const) {
      const list = getBalancePreviewBatches(role);
      expect(list.map((batch) => batch.created_at)).toEqual([...list.map((batch) => batch.created_at)].sort().reverse());
      for (const batch of list) expect(batch.created_at.slice(0, 10) <= IMPORTS_PREVIEW_TODAY).toBe(true);
      expect(list[0].created_by).toBe(IMPORTS_PREVIEW_USERS[role].id);
      expect(list.slice(1).every((batch) => batch.created_by !== IMPORTS_PREVIEW_USERS[role].id)).toBe(true);

      for (const state of batchStates) {
        const { batch, rows } = getBalancePreviewDetail(state, role);
        expect(batch.id).toBe(BALANCE_PREVIEW_BATCH_IDS[state]);
        expect(getBalancePreviewBatchHref(batch.id, role)).toBe(`/dev/imports?view=balance-batch&state=${state}&role=${role}`);
        const count = (status: string) => rows.filter((row) => row.validation_status === status).length;
        expect(batch.row_count).toBe(rows.length);
        expect(batch.review_count).toBe(count("review"));
        expect(batch.excluded_count).toBe(count("excluded"));
        expect(batch.no_change_count).toBe(count("no_change"));
        expect(batch.posted_count).toBe(count("posted"));
        expect(batch.valid_count).toBe(count("valid") + count("posted"));
        expect(batch.source_sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
      }
    }
    const { rows, summary } = BALANCE_PREVIEW_DRY_RUN;
    expect(summary.total).toBe(rows.length);
    expect(summary.valid + summary.review + summary.invalid + summary.no_change).toBe(summary.total);
  });
});
