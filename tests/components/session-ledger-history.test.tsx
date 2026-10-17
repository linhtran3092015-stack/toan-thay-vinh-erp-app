import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  getLedgerEntryLabel,
  SessionLedgerHistory,
} from "@/features/finance/components/session-ledger-history";
import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";

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

  it("keeps a prototype-property event type visibly unsupported", () => {
    render(<SessionLedgerHistory entries={[{ ...entry, entryType: "constructor" }]} />);

    expect(getLedgerEntryLabel("constructor")).toBe("Loại phát sinh chưa hỗ trợ: constructor");
    expect(screen.getAllByText("Loại phát sinh chưa hỗ trợ: constructor")).toHaveLength(2);
    expect(screen.queryByText(/^function constructor/)).not.toBeInTheDocument();
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

  it("uses the zero-padding work area with the approved 1042px activation threshold", () => {
    const { container } = render(<SessionLedgerHistory entries={[entry]} />);
    const table = screen.getByRole("table", { name: "Danh sách mục sổ cái số buổi mới nhất" });
    const list = screen.getByRole("list", { name: "Danh sách mục sổ cái số buổi mới nhất" });
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(table.closest(".session-ledger-operational-work-area")).not.toBeNull();
    expect(list.closest(".session-ledger-operational-work-area")).not.toBeNull();
    expect(table).toHaveClass("min-w-[1040px]");
    expect(container.querySelector(".session-ledger-directory-table")).not.toBeNull();
    expect(container.querySelector(".session-ledger-directory-record-list")).not.toBeNull();
    expect(globals).toMatch(/\.session-ledger-operational-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1042px\)[\s\S]*\.session-ledger-directory-table/);
  });

  it("keeps the existing audit empty state without adding controls", () => {
    render(<SessionLedgerHistory entries={[]} />);

    expect(screen.getByText("Chưa có mục sổ cái")).toBeInTheDocument();
    expect(screen.getByText("Chưa có mục sổ cái số buổi nào được ghi nhận.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

// Step 14c restyle (design 16a "Sổ cái số buổi"): the read-only contract above is
// unchanged; these pin the Vietnam-time caption, badge tones, the permission-gated
// links and the single empty render.
describe("Session ledger restyle", () => {
  const LIST = "Danh sách mục sổ cái số buổi mới nhất";
  const FORBIDDEN_ACTION = /hoàn tác|đảo trừ|reverse|undo|điều chỉnh|sửa|xóa/i;
  const PAY_CODE = "PAY-261014-7C2E91A04B3D";
  const table = () => screen.getByRole("table", { name: LIST });
  const list = () => screen.getByRole("list", { name: LIST });

  it("keeps the pinned count sentence as its own element in the header context line", () => {
    render(<SessionLedgerHistory entries={[entry]} />);

    const sentence = screen.getByText("Hiển thị 1 mục sổ cái mới nhất (tối đa 100).");
    expect(sentence).toHaveAttribute("id", "session-ledger-result-context");
    expect(sentence.closest("header")).not.toBeNull();
    expect(screen.getByText("Mới ghi nhận trước.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hiển thị 1 mục sổ cái mới nhất (tối đa 100)." })).toHaveClass(
      "session-ledger-operational-work-area",
    );
  });

  it("shows when an entry was recorded in Vietnam time, never the UTC clock", () => {
    render(<SessionLedgerHistory entries={[{ ...entry, createdAt: "2026-08-09T18:30:00.000Z" }]} today="2026-10-16" />);

    const tableCaption = within(table()).getByText("ghi nhận 10/08 01:30");
    const cardTime = within(list()).getByText("10/08 01:30");
    for (const element of [tableCaption, cardTime]) {
      expect(element).toHaveAttribute("title", "01:30 10/08/2026");
    }
    expect(screen.queryByText(/18:30|09\/08/)).not.toBeInTheDocument();
  });

  it("tones each event badge by family and never treats an event as danger", () => {
    const types = [
      "payment_credit",
      "bonus_credit",
      "session_charge",
      "session_reversal",
      "refund_debit",
      "manual_adjustment",
      "transfer_in",
      "transfer_out",
      "annual_carryover",
      "constructor",
    ];
    // A Map, not an object literal: "constructor" must not resolve to Object.prototype.constructor.
    const tones = new Map([
      ["bonus_credit", "text-info"],
      ["manual_adjustment", "text-warning"],
      ["payment_credit", "text-success"],
      ["session_reversal", "text-info"],
    ]);
    render(
      <SessionLedgerHistory
        entries={types.map((entryType, index) => ({ ...entry, entryType, id: `ledger-type-${index}` }))}
      />,
    );

    for (const entryType of types) {
      const badges = screen.getAllByText(getLedgerEntryLabel(entryType));
      expect(badges).toHaveLength(2);
      for (const badge of badges) {
        expect(badge).toHaveClass(tones.get(entryType) ?? "text-neutral");
        expect(badge).not.toHaveClass("text-danger");
      }
    }
  });

  it("keeps the profile link by default and adds payment-request and session links only with their permissions", () => {
    const paymentEntry = { ...entry, referenceCode: PAY_CODE };
    const { unmount } = render(<SessionLedgerHistory entries={[paymentEntry]} />);

    expect(screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" })).toHaveLength(2);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getAllByText(PAY_CODE)).toHaveLength(2);
    unmount();

    render(<SessionLedgerHistory canViewPaymentRequests canViewSessions entries={[paymentEntry]} />);

    const paymentLinks = screen.getAllByRole("link", { name: `Xem yêu cầu thanh toán ${PAY_CODE}` });
    expect(paymentLinks).toHaveLength(2);
    for (const link of paymentLinks) {
      expect(link).toHaveAttribute("href", `/finance/payment-requests?search=${PAY_CODE}`);
      expect(link).toHaveTextContent(PAY_CODE);
    }
    const sessionLinks = screen.getAllByRole("link", { name: /^Mở buổi học/ });
    expect(sessionLinks).toHaveLength(2);
    for (const link of sessionLinks) {
      expect(link).toHaveAttribute("href", "/sessions/session-1");
      expect(link).toHaveTextContent("Mở buổi học");
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAccessibleName(FORBIDDEN_ACTION);
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the student without a profile link when students.view is missing", () => {
    render(<SessionLedgerHistory canViewStudents={false} entries={[entry]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Minh An")).toHaveLength(2);
    expect(screen.getAllByText("HV-001")).toHaveLength(2);
  });

  it("links only PAY- codes and shows a dash only when a row has neither a code nor a session link", () => {
    const allocationCode = "ALLOC-5b0e2c4a-91d7-4f3e-8a62-0c9d1e7b3f58";
    const entries = [
      { ...entry, classSessionId: null, id: "ledger-allocation", referenceCode: allocationCode },
      {
        ...entry,
        classSessionId: "session-9",
        deltaSessions: -1,
        entryType: "session_charge",
        id: "ledger-charge",
        note: "Tru 1 buoi cho buoi hoc (regular)",
        referenceCode: null,
        unitPriceVnd: 0,
      },
    ];
    const { rerender } = render(<SessionLedgerHistory canViewPaymentRequests entries={entries} />);

    expect(screen.getAllByText(allocationCode)).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /ALLOC-|yêu cầu thanh toán/ })).not.toBeInTheDocument();
    const chargeRow = () => within(table()).getAllByRole("row")[2];
    const chargeCard = () => within(list()).getAllByRole("listitem")[1];
    // Đơn giá and Tham chiếu in the row; the card drops its Đơn giá line for a zero price.
    expect(within(chargeRow()).getAllByText("—")).toHaveLength(2);
    expect(within(chargeCard()).getAllByText("—")).toHaveLength(1);
    expect(within(chargeCard()).queryByText("Đơn giá")).not.toBeInTheDocument();

    rerender(<SessionLedgerHistory canViewPaymentRequests canViewSessions entries={entries} />);

    expect(within(chargeRow()).getAllByText("—")).toHaveLength(1);
    expect(within(chargeRow()).getByRole("link", { name: /^Mở buổi học/ })).toHaveAttribute("href", "/sessions/session-9");
    expect(within(chargeCard()).queryByText("—")).not.toBeInTheDocument();
  });

  it("renders the empty state once in a frame visible at every width, without a record list", () => {
    const { container } = render(
      <SessionLedgerHistory canViewPaymentRequests canViewSessions entries={[]} today="2026-10-16" />,
    );

    expect(screen.getByText("Hiển thị 0 mục sổ cái mới nhất (tối đa 100).")).toBeInTheDocument();
    expect(screen.getByText("Chưa có mục sổ cái")).toBeInTheDocument();
    expect(screen.getByText("Chưa có mục sổ cái số buổi nào được ghi nhận.")).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(1);
    expect(table().closest(".session-ledger-operational-work-area")).not.toBeNull();
    expect(container.querySelector(".session-ledger-directory-table")).toBeNull();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
