// Value: protects=/reports (design 16a "Báo cáo"): one header with truthful counts ("{visible} báo cáo theo quyền của bạn · {available} có sẵn") and the permission caption, a card per catalog item the account may view (others stay hidden), Badge "Có sẵn"/"Dự kiến", the scope note naming the real 1.000 cap, "Cần quyền: …" from the shared labels, a secondary "Xuất CSV" dialog trigger on the available card and a disabled "Xuất CSV" + "Chưa phát hành" on planned cards, no primary action, a single in-frame empty state, and clean design tokens in the feature sources;
// fails_when=a card shows without its module permission, the stale "300" copy returns, a planned card gets an enabled export or loses its reason, any primary button appears, the empty state renders twice or outside a frame, the sessions link loses text-action-link! or ignores the preview href, or a legacy token / outline-none / ring lands in src/features/reports;
// why_new=step 14d (R1–R7) rewrites the page; no test rendered it; seam=none (server-renderable page, the dialog is a client island rendered in place); no_claim=the dialog's submit contract (session-export-dialog.test.tsx) or the route gate (reports-route.test.tsx)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { REPORT_CATALOG } from "@/features/reports/catalog";
import { ReportsPage } from "@/features/reports/reports-page";
import type { PermissionCode } from "@/lib/permissions/types";

afterEach(cleanup);

const allModules: PermissionCode[] = ["reports.view", "sessions.view", "students.view", "crm.view", "staff.view"];
const cardTitles = () => screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
const card = (title: string) => screen.getByRole("region", { name: title });

describe("ReportsPage", () => {
  it("shows one card per catalog item the account may view, with truthful header counts and no eyebrow", () => {
    render(<ReportsPage permissions={allModules} />);

    expect(screen.getByRole("heading", { level: 1, name: "Báo cáo & Xuất dữ liệu" })).toBeInTheDocument();
    expect(screen.getByText("4 báo cáo theo quyền của bạn · 1 có sẵn")).toBeInTheDocument();
    expect(
      screen.getByText("Báo cáo chỉ hiện khi tài khoản có quyền xem module tương ứng; dữ liệu xuất vẫn theo quyền database."),
    ).toBeInTheDocument();
    expect(cardTitles()).toEqual(REPORT_CATALOG.map((report) => report.title));
    expect(screen.queryByText("Báo cáo", { exact: true })).not.toBeInTheDocument();
  });

  it("hides cards without their module permission (no planned export is advertised)", () => {
    render(<ReportsPage permissions={["reports.view", "sessions.view", "attendance.view", "results.view"]} />);

    expect(cardTitles()).toEqual(["Danh sách buổi học"]);
    expect(screen.getByText("1 báo cáo theo quyền của bạn · 1 có sẵn")).toBeInTheDocument();
    expect(screen.queryByText("Danh sách học viên")).not.toBeInTheDocument();
    expect(screen.queryByText("Dự kiến")).not.toBeInTheDocument();
  });

  it("gives the sessions card the available badge, scope from the shared cap, required permission and a secondary export trigger", () => {
    render(<ReportsPage permissions={allModules} />);
    const sessions = card("Danh sách buổi học");

    expect(within(sessions).getByText("Có sẵn")).toHaveClass("bg-success-bg");
    expect(within(sessions).getByText("Phạm vi:").closest("p")).toHaveTextContent(
      "Phạm vi: Xuất tối đa 1.000 buổi có ngày mới nhất. Có thể lọc theo khoảng ngày.",
    );
    expect(within(sessions).getByText("Cần quyền: xem buổi học")).toBeInTheDocument();
    expect(
      within(sessions).getByText("Cột điểm danh và kết quả chỉ có khi tài khoản có quyền xem điểm danh / kết quả."),
    ).toBeInTheDocument();
    const trigger = within(sessions).getByRole("button", { name: "Xuất CSV: Danh sách buổi học" });
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveClass("border-border-strong");
    const link = within(sessions).getByRole("link", { name: "Mở danh sách buổi học" });
    expect(link).toHaveAttribute("href", "/sessions");
    expect(link).toHaveClass("text-action-link!");
    expect(document.body).not.toHaveTextContent("300");
  });

  it("gives each planned card the Dự kiến badge, its permission and a disabled Xuất CSV with Chưa phát hành", () => {
    render(<ReportsPage permissions={allModules} />);

    for (const [title, permission] of [
      ["Danh sách học viên", "xem học sinh"],
      ["Lead tuyển sinh", "xem CRM"],
      ["Danh sách nhân sự", "xem nhân sự"],
    ]) {
      const planned = card(title);
      expect(within(planned).getByText("Dự kiến")).toHaveClass("bg-neutral-bg");
      expect(within(planned).getByText(`Cần quyền: ${permission}`)).toBeInTheDocument();
      const button = within(planned).getByRole("button", { name: `Xuất CSV: ${title}` });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription("Chưa phát hành");
      expect(
        within(planned).getByText("Bộ cột xuất dữ liệu đang chờ review bảo mật trước khi được kích hoạt."),
      ).toBeInTheDocument();
      expect(within(planned).queryByRole("link")).not.toBeInTheDocument();
    }
  });

  it("has no primary action anywhere on the page", () => {
    const { container } = render(<ReportsPage permissions={allModules} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(container.querySelector(".bg-action-primary")).toBeNull();
  });

  it("renders the empty state once, inside a frame, when no card is visible", () => {
    render(<ReportsPage permissions={["reports.view", "finance.view", "payroll.view"]} />);

    expect(screen.getByText("0 báo cáo theo quyền của bạn · 0 có sẵn")).toBeInTheDocument();
    const empty = screen.getByRole("region", { name: "Chưa có báo cáo phù hợp" });
    expect(empty).toHaveClass("rounded-lg", "border", "border-border-subtle");
    expect(screen.getAllByText("Chưa có báo cáo phù hợp")).toHaveLength(1);
    expect(
      within(empty).getByText("Tài khoản hiện tại chưa có quyền xem module nghiệp vụ nào được đưa vào trung tâm Báo cáo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("points the sessions link at a preview href when given one", () => {
    render(<ReportsPage permissions={allModules} sessionListHref="/dev/lists?view=sessions" />);
    expect(screen.getByRole("link", { name: "Mở danh sách buổi học" })).toHaveAttribute("href", "/dev/lists?view=sessions");
  });

  it("stays server-renderable: no client directive, and it renders to static markup", () => {
    const source = readFileSync(join(process.cwd(), "src/features/reports/reports-page.tsx"), "utf8");
    expect(source).not.toMatch(/^["']use client["']/m);
    const html = renderToStaticMarkup(<ReportsPage permissions={allModules} />);
    expect(html).toContain("Báo cáo &amp; Xuất dữ liệu");
    // The dialog is closed on the server: no form reaches the HTML.
    expect(html).not.toContain("<form");
  });
});

describe("reports sources", () => {
  const roots = [
    join(process.cwd(), "src/features/reports"),
    join(process.cwd(), "src/features/reports/components"),
    join(process.cwd(), "src/app/(app)/reports"),
  ];
  const sources = () =>
    roots.flatMap((root) =>
      readdirSync(root)
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => [name, readFileSync(join(root, name), "utf8")] as const),
    );

  it("uses the shared focus outline, never outline-none or a ring", () => {
    for (const [file, source] of sources()) {
      expect(source, file).not.toMatch(/outline-none|focus-visible:ring|focus:ring|focus-ring/);
    }
  });

  it("uses no legacy alias tokens, raw colours or viewport layout breakpoints in the page", () => {
    const legacy =
      /\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|bg-primary-soft|text-primary)\b|[\w-]+-primary\/\d+|#[0-9a-fA-F]{3,8}\b/;
    for (const [file, source] of sources()) {
      expect(source, file).not.toMatch(legacy);
    }
    // Layout switches on the card grid's container; `max-md:` only sizes 44px touch targets (14b/14c precedent).
    const page = readFileSync(join(process.cwd(), "src/features/reports/reports-page.tsx"), "utf8");
    expect(page).not.toMatch(/(?<![\w-])(sm|md|lg|xl|2xl):/);
    expect(page).toContain("@container");
    expect(page).toContain("@min-[720px]:grid-cols-2");
  });
});
