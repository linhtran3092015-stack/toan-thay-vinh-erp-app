import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getLedgerEntryLabel,
  SessionLedgerHistory,
} from "@/features/finance/components/session-ledger-history";
import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";

afterEach(cleanup);

const entry: CenterSessionLedgerEntryReadModel = {
  classSessionId: "session-1",
  createdAt: "2026-08-10T03:00:00.000Z",
  deltaSessions: 3,
  effectiveOn: "2026-08-10",
  entryType: "payment_credit",
  id: "ledger-1",
  note: "Ghi nhận học phí kỳ tháng 8.",
  referenceCode: "YC-001",
  studentFullName: "Nguyễn Minh An",
  studentId: "student-1",
  studentPublicCode: "HV-001",
  unitPriceVnd: 100_000,
};

describe("Session ledger audit presentation", () => {
  it("keeps the mounted ledger read-only without filters, pagination, actions, or balance summaries", () => {
    render(<SessionLedgerHistory entries={[entry]} />);

    expect(screen.getByText("Hiển thị 1 mục sổ cái mới nhất (tối đa 100).")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/phân trang|trang \d|số dư hiện tại|tổng số buổi|điều chỉnh|hoàn tác/i)).not.toBeInTheDocument();
  });

  it("maps every supported ledger event type textually", () => {
    expect(getLedgerEntryLabel("payment_credit")).toBe("Nạp học phí");
    expect(getLedgerEntryLabel("bonus_credit")).toBe("Thưởng buổi");
    expect(getLedgerEntryLabel("session_charge")).toBe("Trừ buổi học");
    expect(getLedgerEntryLabel("session_reversal")).toBe("Đảo trừ");
    expect(getLedgerEntryLabel("refund_debit")).toBe("Hoàn phí");
    expect(getLedgerEntryLabel("manual_adjustment")).toBe("Điều chỉnh thủ công");
    expect(getLedgerEntryLabel("transfer_in")).toBe("Chuyển buổi đến");
    expect(getLedgerEntryLabel("transfer_out")).toBe("Chuyển buổi đi");
    expect(getLedgerEntryLabel("annual_carryover")).toBe("Kết chuyển năm");
  });

  it("renders a session reversal as immutable history without exposing a reversal capability", () => {
    render(
      <SessionLedgerHistory
        entries={[
          {
            ...entry,
            deltaSessions: 1,
            entryType: "session_reversal",
            id: "ledger-reversal-1",
            note: "Hoàn lại buổi học theo nghiệp vụ đã ghi nhận.",
            referenceCode: "REV-001",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Đảo trừ")).toHaveLength(2);
    expect(screen.getAllByText("+1 buổi")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /hoàn tác|đảo trừ|reverse|undo|điều chỉnh|sửa|xóa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /hoàn tác|đảo trừ|reverse|undo|điều chỉnh|sửa|xóa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps signed integer sessions textual and separate from VND without treating a debit as an error", () => {
    render(
      <SessionLedgerHistory
        entries={[
          entry,
          { ...entry, deltaSessions: -1, entryType: "session_charge", id: "ledger-2" },
        ]}
      />,
    );

    expect(screen.getAllByText("+3 buổi")).toHaveLength(2);
    expect(screen.getAllByText("-1 buổi")).toHaveLength(2);
    expect(screen.getAllByText("100.000 ₫")).toHaveLength(4);
    expect(screen.queryByText(/0\.5 buổi/)).not.toBeInTheDocument();
    for (const debit of screen.getAllByText("-1 buổi")) {
      expect(debit).not.toHaveClass("text-danger");
    }
  });

  it("keeps supplied references and notes visible as ordinary selectable text", () => {
    render(<SessionLedgerHistory entries={[entry]} />);

    expect(screen.getAllByText("YC-001")).toHaveLength(2);
    const notes = screen.getAllByText(entry.note!);
    expect(notes).toHaveLength(2);
    for (const note of notes) {
      expect(note).not.toHaveAttribute("title");
      expect(note).not.toHaveClass("truncate");
    }
  });

  it("uses the zero-padding work area with the approved 1082px activation threshold", () => {
    const { container } = render(<SessionLedgerHistory entries={[entry]} />);
    const table = screen.getByRole("table", { name: "Danh sách mục sổ cái số buổi mới nhất" });
    const list = screen.getByRole("list", { name: "Danh sách mục sổ cái số buổi mới nhất" });
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(table.closest(".session-ledger-operational-work-area")).not.toBeNull();
    expect(list.closest(".session-ledger-operational-work-area")).not.toBeNull();
    expect(table).toHaveClass("min-w-[1080px]");
    expect(container.querySelector(".session-ledger-directory-table")).not.toBeNull();
    expect(container.querySelector(".session-ledger-directory-record-list")).not.toBeNull();
    expect(globals).toMatch(/\.session-ledger-operational-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1082px\)[\s\S]*\.session-ledger-directory-table/);
  });

  it("keeps the existing audit empty state without adding controls", () => {
    render(<SessionLedgerHistory entries={[]} />);

    expect(screen.getByText("Chưa có mục sổ cái")).toBeInTheDocument();
    expect(screen.getByText("Chưa có mục sổ cái số buổi nào được ghi nhận.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
