import { createRef, useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ClassFilters,
  ClassListPage,
} from "@/features/classes/class-list-page";
import { countActiveClassFilters, defaultClassFilters } from "@/features/classes/class-filters";
import type { ClassDirectoryItem } from "@/features/classes/read-models";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const classWithoutStudentCount: ClassDirectoryItem = {
  academicYear: { code: "2025-2026", endsOn: "2026-05-31", id: "year-1", isCurrent: true, name: "Năm học 2025-2026", startsOn: "2025-08-01", status: "active" },
  activeScheduleCount: 2,
  activeStudentCount: null,
  code: "7A",
  defaultLearningMode: "offline",
  grade: 7,
  id: "class-1",
  level: "A",
  name: "Toán 7A",
  notes: null,
  status: "active",
  weeklySessionCount: 2,
};

describe("Classes directory presentation", () => {
  it("announces active filters in the narrow drawer and clears them on reset", () => {
    function Harness() {
      const [filters, setFilters] = useState(defaultClassFilters);
      return <ClassFilters activeFilterCount={countActiveClassFilters(filters)} filters={filters} isOpen onClose={vi.fn()} onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} onReset={() => setFilters(defaultClassFilters)} returnFocusRef={createRef()} years={[]} />;
    }
    const view = render(<Harness />);
    expect(screen.getByText("Lọc danh sách lớp học hiện có")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("mobile-class-status"), { target: { value: "active" } });
    fireEvent.change(screen.getByTestId("mobile-class-grade"), { target: { value: "7" } });
    expect(screen.getByText("2 bộ lọc đang áp dụng")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mobile-class-reset-filters"));
    expect(screen.getByText("Lọc danh sách lớp học hiện có")).toBeInTheDocument();
    view.unmount();
  });

  it("labels, dismisses, and restores focus from the filter drawer", () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      const trigger = useRef<HTMLButtonElement>(null);
      return <><button onClick={() => setIsOpen(true)} ref={trigger} type="button">Mở bộ lọc</button><ClassFilters activeFilterCount={0} filters={defaultClassFilters} isOpen={isOpen} onClose={() => setIsOpen(false)} onFilterChange={vi.fn()} onReset={vi.fn()} returnFocusRef={trigger} years={[]} /></>;
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Mở bộ lọc" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Bộ lọc" }), { key: "Escape" });
    expect(trigger).toHaveFocus();
  });

  it("presents a withheld student count as permission state, never zero", () => {
    render(<ClassListPage canCreateClass={false} classes={[classWithoutStudentCount]} />);

    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Học viên: Không có quyền");
    expect(record).not.toHaveTextContent("Học viên: 0");
  });
});
