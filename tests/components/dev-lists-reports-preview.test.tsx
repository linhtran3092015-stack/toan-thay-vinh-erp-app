// Value: protects=the /dev/lists reports body renders the real ReportsPage per role with the controller's permission semantics (owner 4 cards with 1 available, TA only "Danh sách buổi học", accountant the in-frame empty; "capped" = normal, "empty" = no card), and stays inert: the export dialog validates then announces "Bản xem trước không xuất dữ liệu." instead of submitting to the production-backed /reports/export/sessions, and every link stays on /dev;
// fails_when=the body stops passing exportPreviewNotice or sessionListHref, a role sees a card its preview codes do not grant (or loses one they do), the empty state stops being reachable, or a click/submit could leave /dev;
// why_new=step 14d adds the reports view to /dev/lists (the body takes the shell's codes from preview-permissions.ts, the single source the review asked for); seam=a document-level submit listener records whether the dialog prevented the submit (then cancels it); the page has no server action or router, so nothing else needs a stub; no_claim=the /dev/lists wiring, shell and production 404 (dev-lists-preview.test.tsx) or the real route gate (reports-route.test.tsx)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getListsPreviewPermissions } from "@/app/dev/lists/preview-permissions";
import { REPORTS_EXPORT_PREVIEW_NOTICE, ReportsPreviewBody } from "@/app/dev/lists/reports-preview";

const roles = ["owner", "ta", "accountant"] as const;
const states = ["normal", "capped", "empty"] as const;

const EMPTY = "Chưa có báo cáo phù hợp";
const cardTitles = () => screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

let submits: boolean[] = [];
function recordSubmit(event: Event) {
  submits.push(event.defaultPrevented);
  event.preventDefault();
}

beforeEach(() => {
  submits = [];
  document.addEventListener("submit", recordSubmit);
});

afterEach(() => {
  document.removeEventListener("submit", recordSubmit);
  cleanup();
});

describe("/dev/lists reports preview", () => {
  it.each(roles.flatMap((role) => states.map((state) => [role, state] as const)))("renders %s / %s with links that stay on /dev", (role, state) => {
    const { container } = render(<ReportsPreviewBody permissions={getListsPreviewPermissions(role, "reports", state)} role={role} />);

    expect(screen.getByRole("heading", { level: 1, name: "Báo cáo & Xuất dữ liệu" })).toBeInTheDocument();
    for (const link of container.querySelectorAll("a[href]")) {
      expect(link.getAttribute("href")).toMatch(/^\/dev\//);
    }
    expect(getListsPreviewPermissions(role, "reports", state)).toEqual(expect.arrayContaining(["notifications.view", "reports.view"]));
  });

  it("shows the owner every card (1 available, 3 planned), the same when capped", () => {
    for (const state of ["normal", "capped"] as const) {
      render(<ReportsPreviewBody permissions={getListsPreviewPermissions("owner", "reports", state)} role="owner" />);
      expect(cardTitles()).toEqual(["Danh sách buổi học", "Danh sách học viên", "Lead tuyển sinh", "Danh sách nhân sự"]);
      expect(screen.getByText("4 báo cáo theo quyền của bạn · 1 có sẵn")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Mở danh sách buổi học" })).toHaveAttribute("href", "/dev/lists?view=sessions");
      cleanup();
    }
  });

  it("shows the TA only the sessions card, linking to the TA's sessions preview", () => {
    render(<ReportsPreviewBody permissions={getListsPreviewPermissions("ta", "reports", "normal")} role="ta" />);
    expect(cardTitles()).toEqual(["Danh sách buổi học"]);
    expect(screen.getByText("1 báo cáo theo quyền của bạn · 1 có sẵn")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở danh sách buổi học" })).toHaveAttribute("href", "/dev/lists?view=sessions&role=ta");
  });

  it.each([
    ["accountant", "normal"],
    ["accountant", "capped"],
    ["owner", "empty"],
    ["ta", "empty"],
  ] as const)("shows %s / %s the single in-frame empty state", (role, state) => {
    render(<ReportsPreviewBody permissions={getListsPreviewPermissions(role, "reports", state)} role={role} />);
    expect(screen.getAllByText(EMPTY)).toHaveLength(1);
    expect(screen.getByRole("region", { name: EMPTY })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("never submits the export: a valid range is prevented and the preview notice is announced", () => {
    render(<ReportsPreviewBody permissions={getListsPreviewPermissions("owner", "reports", "normal")} role="owner" />);
    fireEvent.click(screen.getByRole("button", { name: "Xuất CSV: Danh sách buổi học" }));
    const dialog = screen.getByRole("dialog", { name: "Xuất danh sách buổi học" });
    fireEvent.change(within(dialog).getByLabelText("Từ ngày"), { target: { value: "2026-10-01" } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày"), { target: { value: "2026-10-16" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));

    expect(submits).toEqual([true]);
    expect(within(dialog).getByRole("status")).toHaveTextContent(REPORTS_EXPORT_PREVIEW_NOTICE);
    expect(REPORTS_EXPORT_PREVIEW_NOTICE).toBe("Bản xem trước không xuất dữ liệu.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
