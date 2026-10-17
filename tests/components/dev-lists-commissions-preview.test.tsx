// Value: protects=the /dev/lists commissions body renders the real read-only /commissions page from Aug–Oct 2026 fixtures: the owner (commissions.manage) gets every sale, the Sale column and filter and two pages, the TA/accountant persona only the own sale's rows without Sale, "capped" names the cap and flags the oldest month (08/2026) but not a later one, "empty" keeps the frame with its in-frame state, and the fixtures keep the reader order, Vietnam bank dates and the MMA / Sandbox / unsupported group and status mix;
// fails_when=a role sees another sale's rows or the Sale column without manage, the capped state stops filling the limit (no notice) or flags a complete month, the empty state drops the frame or gains a button, or a fixture drifts out of server order / off its Vietnam date;
// why_new=step 14b adds the commissions view to /dev/lists; seam=none (the page has no server action, router or AppShell inside the body); no_claim=the /dev/lists wiring, shell and production 404 (dev-lists-preview.test.tsx) and the real route's permission gate (commissions-route.test.tsx)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { commissionEntries, commissionPreviewOwnSaleId, ownCommissionEntries } from "@/app/dev/lists/commission-fixtures";
import { CommissionsPreviewBody } from "@/app/dev/lists/commissions-preview";
import { getRecognizedMonth } from "@/features/commissions/commission-directory-models";
import { toVietnamDate } from "@/lib/datetime";

afterEach(cleanup);

const LIST_NAME = "Danh sách doanh thu đủ điều kiện hoa hồng";
const table = () => screen.getByRole("table", { name: LIST_NAME });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const monthSelect = () => screen.getByLabelText("Tháng ghi nhận") as HTMLSelectElement;

describe("commission preview fixtures", () => {
  it("are in server order on Vietnam bank dates across Aug–Oct 2026", () => {
    for (let index = 1; index < commissionEntries.length; index += 1) {
      const previous = commissionEntries[index - 1];
      const current = commissionEntries[index];
      expect(`${previous.recognizedOn} ${previous.recognizedAt}` >= `${current.recognizedOn} ${current.recognizedAt}`).toBe(true);
    }
    for (const entry of commissionEntries) {
      expect(toVietnamDate(entry.recognizedAt)).toBe(entry.recognizedOn);
    }
    expect(new Set(commissionEntries.map((entry) => getRecognizedMonth(entry.recognizedOn)))).toEqual(new Set(["2026-08", "2026-09", "2026-10"]));
    expect(new Set(commissionEntries.map((entry) => entry.id)).size).toBe(commissionEntries.length);
  });

  it("mix known and unsupported groups and statuses, several sales, and an own-scope subset", () => {
    const groups = new Set(commissionEntries.map((entry) => entry.leadSourceGroup));
    expect(groups).toEqual(new Set(["mma", "sandbox", "other"]));
    expect(commissionEntries.some((entry) => entry.status !== "provisional")).toBe(true);
    expect(new Set(commissionEntries.map((entry) => entry.saleOwnerId)).size).toBeGreaterThanOrEqual(3);
    expect(commissionEntries.length).toBeGreaterThan(20);
    expect(ownCommissionEntries.length).toBeGreaterThan(0);
    expect(ownCommissionEntries.length).toBeLessThanOrEqual(20);
    expect(ownCommissionEntries.every((entry) => entry.saleOwnerId === commissionPreviewOwnSaleId)).toBe(true);
  });
});

describe("CommissionsPreviewBody", () => {
  it("shows the owner every sale with the Sale column, filter and two pages", () => {
    render(<CommissionsPreviewBody role="owner" state="normal" />);

    expect(screen.getByRole("heading", { level: 1, name: "Doanh thu đủ điều kiện hoa hồng" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sale" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sale")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getAllByText(`1–20 trong ${commissionEntries.length} bản ghi`)).toHaveLength(2);
    expect(screen.getAllByText("Nguồn chưa hỗ trợ: other")).not.toHaveLength(0);
    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: approved")).not.toHaveLength(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["ta", "accountant"] as const)("shows the %s persona only the own sale's rows, without Sale", (role) => {
    render(<CommissionsPreviewBody role={role} state="normal" />);

    expect(screen.queryByRole("columnheader", { name: "Sale" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sale")).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(ownCommissionEntries.length);
    expect(screen.getByText(`${ownCommissionEntries.length} bản ghi · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.`)).toBeInTheDocument();
    // One page and nothing filtered: the read-only page holds no button at all.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the cap and flags only the oldest month when capped", () => {
    render(<CommissionsPreviewBody role="owner" state="capped" />);

    const total = commissionEntries.length;
    expect(
      screen.getByText(`${total} bản ghi · chỉ tải ${total} bản ghi mới nhất theo ngày tiền về · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.`),
    ).toBeInTheDocument();

    fireEvent.change(monthSelect(), { target: { value: "2026-08" } });
    expect(screen.getByRole("status")).toHaveTextContent(`Tháng 08/2026 có thể chưa đủ: chỉ tải ${total} bản ghi mới nhất.`);

    fireEvent.change(monthSelect(), { target: { value: "2026-09" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("flags the oldest month for the own-scope persona too", () => {
    render(<CommissionsPreviewBody role="ta" state="capped" />);

    fireEvent.change(monthSelect(), { target: { value: "2026-08" } });
    expect(screen.getByRole("status")).toHaveTextContent(`chỉ tải ${ownCommissionEntries.length} bản ghi mới nhất.`);
  });

  it.each(["owner", "ta", "accountant"] as const)("keeps the frame with the in-frame empty state for %s", (role) => {
    render(<CommissionsPreviewBody role={role} state="empty" />);

    expect(within(table()).getAllByRole("row")).toHaveLength(1);
    expect(screen.getAllByText("Chưa có doanh thu đủ điều kiện")).not.toHaveLength(0);
    expect(monthSelect()).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
