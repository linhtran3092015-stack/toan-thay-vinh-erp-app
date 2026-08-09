import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionFilters, SessionListPage } from "@/features/sessions/session-list-page";
import { countActiveSessionFilters, defaultSessionFilters } from "@/features/sessions/session-filters";
import type { SessionDirectoryItem } from "@/features/sessions/read-models";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
const session: SessionDirectoryItem = { attendanceCount: 2, classCode: "7A", classId: "class-1", className: "Toán 7A", componentCode: "MATH-01", endTime: "18:30:00", grade: 7, id: "session-1", learningMode: "offline", level: "A", lockedAt: "2026-08-11T00:00:00Z", resultCount: 1, roomName: "P3", sessionDate: "2026-08-10", sessionKind: "regular", startTime: "17:00:00", status: "completed" };

describe("Sessions directory presentation", () => {
  it("announces active filters and clears them", () => {
    function Harness() { const [filters, setFilters] = useState(defaultSessionFilters); return <SessionFilters activeFilterCount={countActiveSessionFilters(filters)} classOptions={[]} filters={filters} isOpen onClose={vi.fn()} onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} onReset={() => setFilters(defaultSessionFilters)} returnFocusRef={createRef()} />; }
    render(<Harness />);
    fireEvent.change(screen.getByTestId("mobile-session-status"), { target: { value: "scheduled" } });
    fireEvent.change(screen.getByTestId("mobile-session-kind"), { target: { value: "regular" } });
    expect(screen.getByText("2 bộ lọc đang áp dụng")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mobile-session-reset-filters"));
    expect(screen.getByText("Lọc danh sách buổi học hiện có")).toBeInTheDocument();
  });

  it("presents a compact textual lifecycle and separate locked state", () => {
    render(<SessionListPage canManageSessions={false} canViewAttendance canViewResults sessions={[session]} />);
    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Đã hoàn thành");
    expect(record).toHaveTextContent("Đã khóa");
    expect(screen.getAllByRole("link", { name: /Mở buổi học/i })).not.toHaveLength(0);
  });

  it("keeps a completed but unlocked session separate from lock readiness", () => {
    render(<SessionListPage canManageSessions={false} canViewAttendance={false} canViewResults={false} sessions={[{ ...session, lockedAt: null }]} />);
    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Đã hoàn thành");
    expect(record).toHaveTextContent("Chưa khóa");
    expect(record).not.toHaveTextContent("Đã khóa");
  });
});
