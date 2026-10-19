// Value: protects=the /audit page (design 16a row "Nhật ký") is read-only and truthful: header with the exact filtered count and the rows shown (+ "Thu hẹp bộ lọc…" only when rows are cut), the existing GET form with its seven names (reset = a link, hidden params kept, an active value outside the option window still selected, an inverted range explained), seven columns in Vietnam time with seconds, "Hệ thống" only for a null actor, before/after JSON collapsed until "Xem" and then verbatim, cards with a closed <details>, one in-frame empty state;
// fails_when=a SummaryCard/eyebrow or a second primary comes back, a filter name or the GET method changes, the reset becomes a button, the selects keep a cleared filter after a soft "Xóa lọc", the JSON renders in the table or a closed card before it is asked for or is summarised, a card's action code wraps mid-word, an unreadable profile reads "Hệ thống", the empty state renders twice or as a 1040px header strip on phones, the skeleton's column count drifts from the table's, or the folder picks up outline-none, legacy tokens, raw colours, viewport breakpoints, a local Intl date formatter or a server-only import;
// why_new=step 14d rewrites AuditLogPage (no test rendered it before); seam=none (the page has no router or action; the toggle is local state); no_claim=the route's gate and param parsing (audit-route.test.tsx) or the loader (audit-load-limits.test.ts)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import AuditLoading from "@/app/(app)/audit/loading";
import { AuditLogPage } from "@/features/audit/audit-log-page";
import { EMPTY_AUDIT_FILTERS } from "@/features/audit/audit-log-models";
import { AUDIT_TABLE_COLUMN_COUNT } from "@/features/audit/components/audit-log-cells";
import { AuditRecordDataDisclosure } from "@/features/audit/components/audit-log-record-data";
import type { AuditFilters, AuditLogEntry, AuditLogReadModel } from "@/features/audit/read-models";

// Run as a UTC host (like the production server), so a time formatted without the
// Vietnam time zone shows the wrong hour here too; the runner's TZ is restored after.
const timeZone = vi.hoisted(() => {
  const original = process.env.TZ;
  process.env.TZ = "UTC";
  return { original };
});

afterAll(() => {
  if (timeZone.original === undefined) delete process.env.TZ;
  else process.env.TZ = timeZone.original;
});

afterEach(cleanup);

const TABLE = "Nhật ký hệ thống";
const owner = { displayName: "Thầy Vinh", email: "vinh.owner@example.com", id: "a1000000-0000-4000-8000-000000000001" };
const studentBefore = { full_name: "Phạm Thu Hà", id: "s-1", lifecycle_status: "active", public_code: "HS0142" };
const studentAfter = { ...studentBefore, lifecycle_status: "reserved" };

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    action: "student_updated",
    actor: owner,
    actorUserId: owner.id,
    entityId: "s-1",
    entityType: "student",
    id: "row-1",
    metadata: {},
    module: "students",
    newData: studentAfter,
    occurredAt: "2026-10-16T02:15:44.902+00:00",
    oldData: studentBefore,
    reason: null,
    requestId: null,
    ...overrides,
  };
}

const entries: AuditLogEntry[] = [
  entry({
    action: "ops_alert_raised",
    actor: null,
    actorUserId: null,
    entityId: "ops.sepay_webhook_failed:2026-10-16 11:30",
    entityType: "ops_alert",
    id: "row-ops",
    metadata: { code: "sepay_webhook_failed", recipients: 1 },
    module: "ops",
    newData: null,
    occurredAt: "2026-10-16T04:41:12.418+00:00",
    oldData: null,
    reason: "2 webhook SePay xử lý lỗi",
  }),
  entry({ id: "row-student" }),
  entry({
    action: "class_session_auto_locked",
    actor: { displayName: "Cô Lan", email: "lan.nguyen@example.com", id: "a-ta" },
    actorUserId: "a-ta",
    entityId: "c3000000-0000-4000-8000-000000000031",
    entityType: "class_session",
    id: "row-lock",
    metadata: { auto_lock_after_days: 3, source: "auto_lock_worker" },
    module: "sessions",
    newData: null,
    occurredAt: "2026-10-16T01:00:03.551+00:00",
    oldData: null,
    reason: "Tự động khóa sau 3 ngày",
  }),
  entry({
    action: "guardian_updated",
    actor: null,
    actorUserId: "a1000000-0000-4000-8000-000000000099",
    entityId: null,
    entityType: null,
    id: "row-unreadable",
    module: "rbac",
    occurredAt: "2026-10-15T03:00:00.000+00:00",
    requestId: "req-7f3a",
  }),
];

function model(overrides: Partial<AuditLogReadModel> = {}, filters: Partial<AuditFilters> = {}): AuditLogReadModel {
  return {
    entries,
    filters: { ...EMPTY_AUDIT_FILTERS, ...filters },
    options: {
      actions: ["class_session_auto_locked", "guardian_updated", "ops_alert_raised", "student_updated"],
      actors: [{ id: owner.id, label: "Thầy Vinh · vinh.owner@example.com" }],
      entityTypes: ["class_session", "ops_alert", "student"],
      modules: ["ops", "rbac", "sessions", "students"],
    },
    totalCount: entries.length,
    ...overrides,
  };
}

const table = () => screen.getByRole("table", { name: TABLE });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const form = (container: HTMLElement) => container.querySelector("form") as HTMLFormElement;

describe("AuditLogPage header", () => {
  it("states the exact count and the rows shown, read-only, with no eyebrow, summary cards or primary", () => {
    render(<AuditLogPage model={model()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Nhật ký hệ thống" })).toBeInTheDocument();
    expect(screen.getByText("4 bản ghi · hiển thị 4 mới nhất")).toBeInTheDocument();
    expect(screen.getByText("Chỉ đọc: nhật ký không sửa hoặc xóa được từ ứng dụng.")).toBeInTheDocument();
    expect(screen.queryByText(/Thu hẹp bộ lọc/)).not.toBeInTheDocument();
    expect(screen.queryByText("Quản trị hệ thống")).not.toBeInTheDocument();
    expect(screen.queryByText(/Kết quả phù hợp|Module trong trang|Người thao tác/)).not.toBeInTheDocument();
    expect(document.querySelector('[class~="bg-action-primary"]')).toBeNull();
  });

  it("says the count is filtered and asks to narrow when rows are cut", () => {
    render(<AuditLogPage model={model({ totalCount: 1240 }, { module: "rbac" })} />);

    expect(screen.getByText("1.240 bản ghi khớp bộ lọc · hiển thị 4 mới nhất")).toBeInTheDocument();
    expect(
      screen.getByText("Chỉ đọc: nhật ký không sửa hoặc xóa được từ ứng dụng. Thu hẹp bộ lọc để xem bản ghi cũ hơn."),
    ).toBeInTheDocument();
  });
});

describe("AuditLogPage filters", () => {
  it("keeps the GET form with the seven names, labels in order and uncontrolled values", () => {
    const { container } = render(
      <AuditLogPage model={model({}, { entityId: "HS0142", fromDate: "2026-10-01", module: "students" })} />,
    );
    const element = form(container);

    expect(element.getAttribute("method")).toBe("get");
    expect(element.getAttribute("action")).toBe("/audit");
    const bar = screen.getByRole("region", { name: "Bộ lọc nhật ký" });
    expect(
      [...bar.querySelectorAll("label")].map((label) => label.firstChild?.textContent),
    ).toEqual(["Từ ngày", "Đến ngày", "Module", "Hành động", "Người thực hiện", "Loại đối tượng", "Mã đối tượng"]);
    expect(
      [...element.querySelectorAll("input, select")].map((field) => (field as HTMLInputElement).name),
    ).toEqual(["fromDate", "toDate", "module", "action", "actorId", "entityType", "entityId"]);
    expect(screen.getByLabelText("Từ ngày")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Từ ngày")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Mã đối tượng")).toHaveValue("HS0142");
    expect(screen.getByLabelText("Mã đối tượng")).toHaveAttribute("placeholder", "UUID hoặc mã nghiệp vụ");
    expect(screen.getByLabelText("Module")).toHaveValue("students");
    expect(within(screen.getByLabelText("Module")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tất cả",
      "Buổi học",
      "Học viên",
      "Phân quyền",
      "Vận hành hệ thống",
    ]);
    expect(within(screen.getByLabelText("Hành động")).getByRole("option", { name: "Class session auto locked" })).toHaveValue(
      "class_session_auto_locked",
    );
    expect(within(screen.getByLabelText("Người thực hiện")).getByRole("option", { name: "Thầy Vinh · vinh.owner@example.com" })).toBeInTheDocument();
    expect(screen.getByText("Ngày theo giờ Việt Nam · tùy chọn lấy từ 1.000 bản ghi mới nhất.")).toBeInTheDocument();
  });

  it("submits with an unnamed secondary 'Áp dụng' and resets with a link only when something is filtered", () => {
    const { container, unmount } = render(<AuditLogPage model={model()} />);
    const submit = screen.getByRole("button", { name: "Áp dụng" });

    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).not.toHaveAttribute("name");
    expect(form(container).contains(submit)).toBe(true);
    expect(screen.queryByRole("link", { name: /Xóa lọc/ })).not.toBeInTheDocument();
    unmount();

    render(<AuditLogPage model={model({}, { action: "student_updated", fromDate: "2026-10-01" })} />);
    const reset = screen.getByRole("link", { name: "Xóa lọc (2)" });
    expect(reset).toHaveAttribute("href", "/audit");
    expect(screen.queryByRole("button", { name: /Xóa lọc/ })).not.toBeInTheDocument();
  });

  it("keeps preview params as hidden inputs and on the reset link", () => {
    const { container } = render(
      <AuditLogPage
        formAction="/dev/lists"
        hiddenParams={{ state: "capped", view: "audit" }}
        model={model({}, { module: "rbac" })}
      />,
    );

    expect(form(container).getAttribute("action")).toBe("/dev/lists");
    expect(
      [...form(container).querySelectorAll('input[type="hidden"]')].map((input) => [
        (input as HTMLInputElement).name,
        (input as HTMLInputElement).value,
      ]),
    ).toEqual([
      ["state", "capped"],
      ["view", "audit"],
    ]);
    expect(screen.getByRole("link", { name: "Xóa lọc (1)" })).toHaveAttribute("href", "/dev/lists?state=capped&view=audit");
  });

  it("keeps an active value outside the option window selected, labelled as such", () => {
    render(<AuditLogPage model={model({ entries: [], totalCount: 0 }, { actorId: "a-old", module: "payroll" })} />);

    expect(screen.getByLabelText("Module")).toHaveValue("payroll");
    expect(within(screen.getByLabelText("Module")).getByRole("option", { name: "Bảng lương (đang lọc)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Người thực hiện")).toHaveValue("a-old");
    expect(within(screen.getByLabelText("Người thực hiện")).getByRole("option", { name: "a-old (đang lọc)" })).toBeInTheDocument();
  });

  it("explains an inverted date range", () => {
    render(<AuditLogPage model={model({ entries: [], totalCount: 0 }, { fromDate: "2026-10-17", toDate: "2026-10-01" })} />);

    expect(screen.getByText("Từ ngày sau Đến ngày nên không có bản ghi nào khớp.")).toBeInTheDocument();
  });

  it("remounts the form when the applied filters change, so a soft 'Xóa lọc' clears every select", () => {
    // next/link keeps the page mounted across search-param changes and React never
    // re-applies a changed defaultValue: without the remount the old value stays selected.
    const { container, rerender } = render(
      <AuditLogPage model={model({}, { action: "student_updated", entityId: "HS0142", module: "rbac" })} />,
    );
    const field = (name: string) => container.querySelector(`[name="${name}"]`) as HTMLSelectElement;
    expect(field("module")).toHaveValue("rbac");
    expect(field("action")).toHaveValue("student_updated");

    rerender(<AuditLogPage model={model()} />);

    expect(field("module")).toHaveValue("");
    expect(field("action")).toHaveValue("");
    expect(field("entityId")).toHaveValue("");
    expect(screen.queryByRole("link", { name: /Xóa lọc/ })).not.toBeInTheDocument();
  });

  // Value: protects=two different applied filter sets never share the form's remount key, even when a hand-edited URL puts "|" inside a value;
  // fails_when=the key goes back to joining the values with a separator ("student|x" + "HS" and "student" + "x|HS" both read "student|x|HS"), so the second set keeps the first set's field values;
  // why_new=step 14d adversarial A6, fixed in the owner-approved fourth cycle; seam=rerender with the colliding filters; no_claim=which values production URLs carry
  it("remounts for filter sets whose values would collide under a joined key", () => {
    const { container, rerender } = render(<AuditLogPage model={model({}, { entityId: "HS", entityType: "student|x" })} />);
    const entityId = () => container.querySelector('[name="entityId"]') as HTMLInputElement;
    expect(entityId()).toHaveValue("HS");

    rerender(<AuditLogPage model={model({}, { entityId: "x|HS", entityType: "student" })} />);
    expect(entityId()).toHaveValue("x|HS");
  });
});

describe("AuditLogPage table", () => {
  it("shows the seven columns and one row per entry, in Vietnam time with seconds", () => {
    render(<AuditLogPage model={model()} />);

    expect(within(table()).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Thời điểm",
      "Người thực hiện",
      "Module",
      "Hành động",
      "Đối tượng",
      "Lý do",
      "Trước / Sau",
    ]);
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(AUDIT_TABLE_COLUMN_COUNT);
    expect(table().className).toContain("min-w-[1040px]");
    // Each entry has its row and a hidden detail row.
    expect(within(table()).getAllByRole("row", { hidden: true })).toHaveLength(1 + entries.length * 2);
    const ops = bodyRows()[0];
    expect(within(ops).getByText("16/10/2026")).toBeInTheDocument();
    expect(within(ops).getByText("11:41:12")).toBeInTheDocument();
    expect(within(ops).getByText("Vận hành hệ thống")).toHaveAttribute("title", "ops");
    expect(within(ops).getByText("Ops alert raised")).toBeInTheDocument();
    expect(within(ops).getByText("ops_alert_raised")).toBeInTheDocument();
    expect(within(ops).getByText("2 webhook SePay xử lý lỗi")).toBeInTheDocument();
  });

  it("calls only a null actor 'Hệ thống'; an unreadable profile stays a person with its uuid; auto-lock rows say so", () => {
    render(<AuditLogPage model={model()} />);
    const [ops, student, lock, unreadable] = bodyRows();

    expect(within(ops).getByText("Hệ thống")).toBeInTheDocument();
    expect(within(ops).getByText("ghi tự động từ database")).toBeInTheDocument();
    expect(screen.queryByText(/Migration|actor_user_id/)).not.toBeInTheDocument();
    expect(within(student).getByText("Thầy Vinh")).toBeInTheDocument();
    expect(within(student).getByText("vinh.owner@example.com")).toBeInTheDocument();
    expect(within(lock).getByText("Cô Lan")).toBeInTheDocument();
    expect(within(lock).getByText("khóa tự động")).toBeInTheDocument();
    expect(within(unreadable).getByText("Không đọc được hồ sơ")).toBeInTheDocument();
    expect(within(unreadable).getByText("a1000000-0000-4000-8000-000000000099")).toBeInTheDocument();
    expect(within(unreadable).queryByText("Hệ thống")).not.toBeInTheDocument();
    expect(within(unreadable).getByText("Không xác định")).toBeInTheDocument();
    expect(within(unreadable).getByText("Không có mã")).toBeInTheDocument();
    expect(within(student).getByText("—")).toBeInTheDocument();
  });

  it("keeps the before/after JSON out of the table until 'Xem', then prints it verbatim", () => {
    render(<AuditLogPage model={model()} />);
    const toggle = screen.getByRole("button", {
      name: "Xem dữ liệu trước / sau của Student updated lúc 09:15:44 16/10/2026",
    });
    const detail = document.getElementById(toggle.getAttribute("aria-controls") ?? "") as HTMLElement;

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(detail).not.toBeVisible();
    expect(detail.querySelector("pre")).toBeNull();
    expect(table().querySelector("pre")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Ẩn dữ liệu trước / sau của Student updated lúc 09:15:44 16/10/2026");
    expect(detail).toBeVisible();
    expect(detail.querySelector("td")).toHaveAttribute("colspan", "7");
    const panels = [...detail.querySelectorAll("pre")].map((pre) => pre.textContent);
    expect(panels).toEqual([JSON.stringify(studentBefore, null, 2), JSON.stringify(studentAfter, null, 2)]);
    expect(within(detail).getByText("Dữ liệu trước")).toBeInTheDocument();
    expect(within(detail).getByText("Dữ liệu sau")).toBeInTheDocument();
    // `metadata: {}` gets no panel, no request id → no "Request ID".
    expect(within(detail).queryByText("Metadata")).not.toBeInTheDocument();
    expect(within(detail).queryByText("Request ID")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(detail.querySelector("pre")).toBeNull();
  });

  it("says 'Không có dữ liệu' for a null side and shows non-empty metadata and the request id", () => {
    render(<AuditLogPage model={model()} />);
    const [opsDetail, unreadableDetail] = [/của Ops alert raised/, /của Guardian updated/].map((name) => {
      const toggle = screen.getByRole("button", { name });
      fireEvent.click(toggle);
      return document.getElementById(toggle.getAttribute("aria-controls") ?? "") as HTMLElement;
    });

    expect(within(opsDetail).getAllByText("Không có dữ liệu")).toHaveLength(2);
    expect(within(opsDetail).getByText("Metadata")).toBeInTheDocument();
    expect([...opsDetail.querySelectorAll("pre")].map((pre) => pre.textContent)).toEqual([
      JSON.stringify({ code: "sepay_webhook_failed", recipients: 1 }, null, 2),
    ]);
    expect(within(unreadableDetail).getByText("Request ID")).toBeInTheDocument();
    expect(within(unreadableDetail).getByText("req-7f3a")).toBeInTheDocument();
  });

  it("has no control besides the submit and the per-row toggles", () => {
    render(<AuditLogPage model={model()} />);

    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim().split(" ")[0])).toEqual([
      "Áp",
      "Xem",
      "Xem",
      "Xem",
      "Xem",
    ]);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("AuditLogPage cards", () => {
  it("lists the same entries as non-link cards with a closed <details> for the JSON", () => {
    render(<AuditLogPage model={model()} />);
    const list = screen.getByRole("list", { name: TABLE });
    const cards = within(list).getAllByRole("listitem");

    expect(cards).toHaveLength(entries.length);
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
    const details = cards[1].querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(cards[1]).getByText("Xem dữ liệu trước / sau", { exact: false })).toBeInTheDocument();
    expect(cards[1].querySelector("summary")?.textContent).toBe(
      "Xem dữ liệu trước / sau của Student updated lúc 09:15:44 16/10/2026",
    );
    expect(within(cards[0]).getByText("Hệ thống")).toBeInTheDocument();
  });

  it("keeps a card's raw action code on one truncated line with the full code in the title", () => {
    render(<AuditLogPage model={model()} />);
    const card = within(screen.getByRole("list", { name: TABLE })).getAllByRole("listitem")[0];
    const code = within(card).getByText("ops_alert_raised");

    expect(code).toHaveAttribute("title", "ops_alert_raised");
    expect(code.className.split(" ")).toEqual(expect.arrayContaining(["truncate", "font-mono"]));
    expect(code.className).not.toContain("break-all");
    expect(within(card).getByText("Ops alert raised").className).toContain("font-semibold");
  });

  it("renders no JSON in a closed card and the panels verbatim once its <details> opens", () => {
    render(<AuditLogPage model={model()} />);
    const list = screen.getByRole("list", { name: TABLE });

    // Nothing anywhere on the page until asked: no panel label, no pretty JSON.
    expect(screen.queryByText("Dữ liệu trước")).not.toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu sau")).not.toBeInTheDocument();
    expect(list.querySelector("pre")).toBeNull();
    expect(document.body.textContent).not.toContain('"lifecycle_status": "reserved"');

    const details = within(list).getAllByRole("listitem")[1].querySelector("details") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(within(details).getByText("Dữ liệu trước")).toBeInTheDocument();
    expect(within(details).getByText("Dữ liệu sau")).toBeInTheDocument();
    expect([...details.querySelectorAll("pre")].map((pre) => pre.textContent)).toEqual([
      JSON.stringify(studentBefore, null, 2),
      JSON.stringify(studentAfter, null, 2),
    ]);
    expect(list.querySelectorAll("pre")).toHaveLength(2);

    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(details.querySelector("pre")).toBeNull();
  });

  it("fills a card opened before hydration, whose toggle event React never sees", async () => {
    const ui = <AuditRecordDataDisclosure entry={entries[1]} />;
    const container = document.body.appendChild(document.createElement("div"));
    container.innerHTML = renderToString(ui);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.querySelector("pre")).toBeNull();

    // The user opens the server-rendered card; jsdom fires "toggle" on its next task,
    // while no React listener is attached yet.
    const toggled = new Promise((resolve) => details.addEventListener("toggle", resolve, { once: true }));
    details.open = true;
    await toggled;

    render(ui, { container, hydrate: true });

    expect(within(details).getByText("Dữ liệu trước")).toBeInTheDocument();
    expect(within(details).getByText("Dữ liệu sau")).toBeInTheDocument();
    expect([...details.querySelectorAll("pre")].map((pre) => pre.textContent)).toEqual([
      JSON.stringify(studentBefore, null, 2),
      JSON.stringify(studentAfter, null, 2),
    ]);
  });

  it("switches table and cards on the page's own container at 1042px", () => {
    const { container } = render(<AuditLogPage model={model()} />);

    expect(container.firstElementChild?.className).toContain("@container");
    expect(table().closest('[class~="@min-[1042px]:block"]')).not.toBeNull();
    expect(screen.getByRole("list", { name: TABLE }).className).toContain("@min-[1042px]:hidden");
  });
});

describe("AuditLogPage empty states", () => {
  it.each([
    [{}, "Chưa có nhật ký", "Các thao tác được ghi nhận sẽ xuất hiện tại đây.", "0 bản ghi"],
    [{ module: "rbac" }, "Không có nhật ký phù hợp", "Thay đổi hoặc xóa bộ lọc để xem các thao tác khác.", "0 bản ghi khớp bộ lọc"],
  ] as const)("renders the empty state once, inside the frame (%o)", (filters, title, description, count) => {
    render(<AuditLogPage model={model({ entries: [], totalCount: 0 }, filters)} />);

    expect(screen.getAllByText(title)).toHaveLength(1);
    expect(screen.getAllByText(description)).toHaveLength(1);
    expect(screen.getByText(count)).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(within(table()).getAllByRole("row")).toHaveLength(1);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(table().closest('[class~="hidden"]')).toBeNull();
    expect(screen.getByText(title).closest('[class~="hidden"]')).toBeNull();
  });

  it("drops the table floor and header row below the 1042px switch, so phones see a plain framed message", () => {
    render(<AuditLogPage model={model({ entries: [], totalCount: 0 })} />);
    const classes = (element: Element) => element.className.split(/\s+/);

    // No 1040px strip of cut-off headers on a phone: the floor and fixed layout only from 1042px.
    expect(classes(table())).not.toContain("min-w-[1040px]");
    expect(classes(table())).not.toContain("table-fixed");
    expect(classes(table())).toEqual(expect.arrayContaining(["@min-[1042px]:min-w-[1040px]", "@min-[1042px]:table-fixed"]));
    const [headerRow] = within(table()).getAllByRole("row");
    expect(classes(headerRow)).toEqual(expect.arrayContaining(["hidden", "@min-[1042px]:table-row"]));
    expect(within(headerRow).getAllByRole("columnheader")).toHaveLength(AUDIT_TABLE_COLUMN_COUNT);
    // The state slot loses its top rule where the header row is gone (the frame border is enough).
    expect(classes(table().parentElement as HTMLElement)).toContain("@max-[1042px]:[&>div]:border-t-0");
  });
});

describe("AuditLoading", () => {
  it("keeps the page geometry: header, 1 → 2 → 4-track filter bar, seven-column table or cards on the same container", () => {
    const { container } = render(<AuditLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải nhật ký hệ thống");
    expect(container.firstElementChild?.className).toContain("@container");
    expect(container.querySelector('[class*="@min-[880px]:grid-cols-4"]')).toBeInTheDocument();
    const tableSkeleton = container.querySelector('[class~="@min-[1042px]:block"]') as HTMLElement;
    expect(tableSkeleton.querySelector(`[style*="repeat(${AUDIT_TABLE_COLUMN_COUNT},"]`)).toBeInTheDocument();
    expect(container.querySelector('[class~="@min-[1042px]:hidden"]')).toBeInTheDocument();
  });
});

describe("audit sources", () => {
  const roots = [
    join(process.cwd(), "src/features/audit"),
    join(process.cwd(), "src/features/audit/components"),
  ];
  const files = roots.flatMap((root) =>
    readdirSync(root)
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => join(root, name)),
  );

  it("use the shared focus outline, never a ring or outline-none", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/outline-none|focus-visible:ring|focus-ring/);
    }
  });

  it("use no legacy alias tokens, raw colours or viewport breakpoints", () => {
    const legacy =
      /\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-primary-soft|bg-white|text-primary|bg-primary)\b|[\w-]+-primary\/\d+|#[0-9a-fA-F]{3,8}\b/;
    const viewport = /(^|[\s"'`])(max-)?(sm|md|lg|xl|2xl):/m;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(legacy);
      expect(source, file).not.toMatch(viewport);
    }
  });

  it("size the loading skeleton from the table's column count and the page's switch classes", () => {
    const skeleton = readFileSync(join(process.cwd(), "src/features/audit/components/audit-log-skeleton.tsx"), "utf8");

    expect(skeleton).toContain("columns={AUDIT_TABLE_COLUMN_COUNT}");
    expect(skeleton).not.toMatch(/columns=\{\d/);
    // The table/cards switch and filter tracks come from the constants the page uses.
    expect(skeleton).not.toMatch(/@min-\[1042px\]|grid-cols-[24]/);
  });

  it("build dates from @/lib/datetime, never a local Intl date formatter", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/Intl\.DateTimeFormat/);
    }
  });

  it("keep server-only in the loader alone, so the /dev/lists preview can render the page", () => {
    for (const file of files) {
      const importsServerOnly = /import "server-only"/.test(readFileSync(file, "utf8"));
      expect(importsServerOnly, file).toBe(file.endsWith(join("audit", "data.ts")));
    }
  });
});
