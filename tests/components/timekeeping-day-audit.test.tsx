import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/timekeeping/components/timekeeping-entry-dialog", () => ({
  TimekeepingEntryDialog: ({ operation }: { operation: "check-in" | "check-out" }) => (
    <button type="button">{operation === "check-in" ? "Check-in" : "Check-out"}</button>
  ),
}));

import {
  getTimekeepingEntryStatusPresentation,
  MyTimekeepingPanel,
} from "@/features/timekeeping/components/my-timekeeping-panel";
import { TimekeepingDayEntries } from "@/features/timekeeping/components/timekeeping-day-entries";
import type { TimekeepingDayEntry, TimekeepingMyEntry } from "@/features/timekeeping/types";

const baseEntry: TimekeepingDayEntry = {
  autoEndedAt: null,
  checkInAt: "2026-08-11T01:30:00.000Z",
  checkInMode: "offline",
  checkOutAt: "2026-08-11T10:30:00.000Z",
  checkOutMode: "online",
  hasCheckInGpsEvidence: true,
  hasCheckInWifiEvidence: false,
  hasCheckOutGpsEvidence: false,
  hasCheckOutWifiEvidence: true,
  id: "entry-1",
  scheduledEndTime: "18:00:00",
  scheduledStartTime: "09:00:00",
  staffDisplayName: "Nguyễn Minh An",
  staffEmployeeCode: "NS-001",
  staffId: "staff-1",
  status: "checked_out",
  workDate: "2026-08-11",
  workShiftCode: "HC",
  workShiftName: "Hành chính",
};

afterEach(cleanup);

describe("Timekeeping 1 day audit and personal panel", () => {
  it("uses only the supplied current-day evidence-presence read model with no filters, pagination, raw evidence, or adjustment action", () => {
    render(<TimekeepingDayEntries entries={[baseEntry]} />);

    expect(screen.getByRole("heading", { name: "Chấm công trong ngày" })).toBeInTheDocument();
    expect(screen.getByText("Các lượt chấm công ghi nhận trong ngày hôm nay theo giờ Việt Nam.")).toBeInTheDocument();
    expect(screen.getByText("Hiển thị 1 lượt chấm công trong ngày.")).toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Minh An")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã check-out")).not.toHaveLength(0);
    expect(screen.getAllByText(/GPS Có dữ liệu/)).not.toHaveLength(0);
    expect(screen.getAllByText(/Wi-Fi Không có dữ liệu/)).not.toHaveLength(0);
    expect(screen.getByRole("table", { name: "Danh sách lượt chấm công trong ngày" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Danh sách lượt chấm công trong ngày" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /điều chỉnh|tự động kết thúc|check-in|check-out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/latitude|longitude|ssid|bssid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/9 giờ|work unit|lương|đơn giá|payroll/i)).not.toBeInTheDocument();
  });

  it("keeps all server-owned entry states textual and does not treat auto-ended history as danger", () => {
    expect(getTimekeepingEntryStatusPresentation("open")).toEqual({ label: "Đang trong ca", tone: "info" });
    expect(getTimekeepingEntryStatusPresentation("checked_out")).toEqual({ label: "Đã check-out", tone: "success" });
    expect(getTimekeepingEntryStatusPresentation("auto_ended")).toEqual({ label: "Tự động kết thúc", tone: "neutral" });

    render(<TimekeepingDayEntries entries={[{ ...baseEntry, status: "auto_ended", autoEndedAt: "2026-08-11T16:30:00.000Z", checkOutMode: "auto_end" }]} />);

    const autoEndedStatus = screen.getAllByText("Tự động kết thúc")[0];
    expect(autoEndedStatus).not.toHaveClass("text-danger");
    expect(screen.queryByRole("button", { name: /đảo|điều chỉnh|kết thúc/i })).not.toBeInTheDocument();
  });

  it("keeps inbound and outbound evidence presence distinct without exposing raw evidence", () => {
    render(<MyTimekeepingPanel canCheck entries={[baseEntry]} />);

    const panel = screen.getByRole("heading", { name: "Chấm công của tôi" }).closest("section");
    if (!panel) throw new Error("Expected the personal timekeeping panel.");
    expect(within(panel).getByText("Dữ liệu GPS khi vào").nextElementSibling).toHaveTextContent("Có dữ liệu");
    expect(within(panel).getByText("Thông tin Wi-Fi khi vào").nextElementSibling).toHaveTextContent("Không có dữ liệu");
    expect(within(panel).getByText("Dữ liệu GPS khi ra").nextElementSibling).toHaveTextContent("Không có dữ liệu");
    expect(within(panel).getByText("Thông tin Wi-Fi khi ra").nextElementSibling).toHaveTextContent("Có dữ liệu");
    expect(within(panel).queryByText(/latitude|longitude|ssid|bssid|hợp lệ|đủ điều kiện/i)).not.toBeInTheDocument();
  });

  it("shows a single permitted personal action from the authoritative personal entry state", () => {
    const openEntry: TimekeepingMyEntry = { ...baseEntry, status: "open", checkOutAt: null, checkOutMode: null };
    const { rerender } = render(<MyTimekeepingPanel canCheck entries={[]} />);
    expect(screen.getByRole("button", { name: "Check-in" })).toBeInTheDocument();

    rerender(<MyTimekeepingPanel canCheck entries={[openEntry]} />);
    expect(screen.getByRole("button", { name: "Check-out" })).toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu GPS khi ra")).not.toBeInTheDocument();
    expect(screen.queryByText("Thông tin Wi-Fi khi ra")).not.toBeInTheDocument();
    expect(screen.queryByText(/giờ làm|9 giờ|lương|đơn giá/i)).not.toBeInTheDocument();

    rerender(<MyTimekeepingPanel canCheck={false} entries={[]} />);
    expect(screen.getByText("Bạn chưa có quyền chấm công.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check-in|check-out/i })).not.toBeInTheDocument();
  });

  it("keeps the Finance-proven 980px inner table / 982px work-area responsive contract", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    render(<TimekeepingDayEntries entries={[baseEntry]} />);

    expect(document.querySelector(".timekeeping-day-audit-work-area")).toBeInTheDocument();
    expect(screen.getByRole("table").parentElement).toHaveClass("timekeeping-day-audit-table");
    expect(screen.getByRole("table")).toHaveClass("min-w-[980px]");
    expect(screen.getByRole("list")).toHaveClass("timekeeping-day-audit-record-list");
    expect(css).toContain("@container (min-width: 982px)");
    expect(css).toMatch(/\.timekeeping-day-audit-work-area\s*\{\s*container-type:\s*inline-size;/);
    expect(css).toMatch(/\.timekeeping-day-audit-record-list\s*\{\s*display:\s*none;/);
  });
});
