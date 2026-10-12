import { createRef, useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentFilters } from "@/features/students/components/student-filters";
import { StudentListPage } from "@/features/students/student-list-page";
import { StudentMobileCard } from "@/features/students/components/student-mobile-card";
import {
  countActiveStudentFilters,
  defaultStudentFilters,
} from "@/features/students/student-filters";
import type { StudentDirectoryItem } from "@/features/students/read-models";

/** StudentListPage reads the query once and then owns filter state; only the initial params matter here. */
const navigation = vi.hoisted(() => ({
  refresh: vi.fn(),
  state: { params: new URLSearchParams() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: navigation.refresh, replace: vi.fn() }),
  useSearchParams: () => navigation.state.params,
}));
vi.mock("@/features/students/bulk-status-actions", () => ({
  executeBulkStudentStatusTransitionAction: vi.fn(),
  previewBulkStudentStatusTransitionAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  navigation.state.params = new URLSearchParams();
  window.history.replaceState(window.history.state, "", "/");
});

const student: StudentDirectoryItem = {
  activeEnrollment: null,
  birthYear: 2013,
  currentGrade: 7,
  fullName: "Nguyễn Thảo Vy",
  id: "student-1",
  learningLevel: "A",
  lifecycleStatus: "active",
  nickname: null,
  primaryGuardian: {
    email: null,
    fullName: "Lê Minh",
    id: "guardian-1",
    isPrimary: true,
    notes: null,
    phone: "0901 234 567",
    relationship: "Mẹ",
    zalo: null,
  },
  publicCode: "HV-001",
  registeredMode: "offline",
};

describe("Students directory presentation", () => {
  it("keeps the filter reset hidden until a filter is active", () => {
    const { rerender } = render(
      <StudentFilters
        activeFilterCount={0}
        classNames={[]}
        filters={defaultStudentFilters}
        isMobileOpen={false}
        onFilterChange={vi.fn()}
        onCloseMobile={vi.fn()}
        onReset={vi.fn()}
        returnFocusRef={createRef()}
      />,
    );

    expect(screen.queryByText("Xóa lọc")).not.toBeInTheDocument();

    rerender(
      <StudentFilters
        activeFilterCount={1}
        classNames={[]}
        filters={{ ...defaultStudentFilters, status: "active" }}
        isMobileOpen={false}
        onFilterChange={vi.fn()}
        onCloseMobile={vi.fn()}
        onReset={vi.fn()}
        returnFocusRef={createRef()}
      />,
    );

    expect(screen.getByText("Xóa lọc")).toBeInTheDocument();
  });

  it("presents the narrow record list as an accessible operational record", () => {
    render(<StudentMobileCard directoryQuery="status=active" student={student} />);

    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Nguyễn Thảo Vy");
    expect(within(record).getByText("Đang học")).toBeInTheDocument();
    expect(within(record).getByRole("link", { name: "Mở hồ sơ học viên Nguyễn Thảo Vy" })).toHaveAttribute(
      "href",
      "/students/student-1?status=active",
    );
  });

  it("labels the filter drawer and supports Escape dismissal", () => {
    const onCloseMobile = vi.fn();
    const view = render(
      <StudentFilters
        activeFilterCount={0}
        classNames={[]}
        filters={defaultStudentFilters}
        isMobileOpen
        onFilterChange={vi.fn()}
        onCloseMobile={onCloseMobile}
        onReset={vi.fn()}
        returnFocusRef={createRef()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Bộ lọc" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onCloseMobile).toHaveBeenCalledOnce();
    view.unmount();
  });

  it("restores focus to the filter trigger after closing the drawer", () => {
    function FilterDrawerHarness() {
      const [isOpen, setIsOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button onClick={() => setIsOpen(true)} ref={triggerRef} type="button">
            Mở bộ lọc
          </button>
          <StudentFilters
            activeFilterCount={0}
            classNames={[]}
            filters={defaultStudentFilters}
            isMobileOpen={isOpen}
            onFilterChange={vi.fn()}
            onCloseMobile={() => setIsOpen(false)}
            onReset={vi.fn()}
            returnFocusRef={triggerRef}
          />
        </>
      );
    }

    render(<FilterDrawerHarness />);

    const trigger = screen.getByRole("button", { name: "Mở bộ lọc" });
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Bộ lọc" }), {
      key: "Escape",
    });

    expect(trigger).toHaveFocus();
  });

  it("reports active filter counts and clears them when filters are reset", () => {
    function ActiveFilterHarness() {
      const [filters, setFilters] = useState(defaultStudentFilters);

      const updateFilter = (
        key: keyof typeof defaultStudentFilters,
        value: string,
      ) => {
        setFilters((current) => ({ ...current, [key]: value }));
      };

      return (
        <StudentFilters
          activeFilterCount={countActiveStudentFilters(filters)}
          classNames={[]}
          filters={filters}
          isMobileOpen
          onFilterChange={updateFilter}
          onCloseMobile={vi.fn()}
          onReset={() => setFilters(defaultStudentFilters)}
          returnFocusRef={createRef()}
        />
      );
    }

    render(<ActiveFilterHarness />);

    expect(screen.getByText("Lọc danh sách học viên hiện có")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("mobile-student-status"), {
      target: { value: "active" },
    });
    expect(screen.getByText("1 bộ lọc đang áp dụng")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("mobile-student-grade"), {
      target: { value: "7" },
    });
    expect(screen.getByText("2 bộ lọc đang áp dụng")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-student-reset-filters"));
    expect(screen.getByText("Lọc danh sách học viên hiện có")).toBeInTheDocument();
    expect(screen.queryByText(/bộ lọc đang áp dụng/)).not.toBeInTheDocument();
  });
});

// Value: protects=bulk status transition only targets students visible under the current filter; fails_when=selectedIds survives a status chip/filter/search/page change so "Chuyển trạng thái…" acts on hidden rows, or "Tất cả" stays pressed while the list is narrowed to a non-chip status; why_new=no test rendered StudentListPage, so selection lifecycle and chip pressed-state were unprotected; seam=none; no_claim=does not prove the bulk server action or URL history sync
describe("Students directory page selection and quick chips", () => {
  const reservedStudent: StudentDirectoryItem = {
    ...student,
    fullName: "Trần Gia Bảo",
    id: "student-2",
    lifecycleStatus: "reserved",
    primaryGuardian: null,
    publicCode: "HV-002",
  };

  it("clears bulk selection when the filter changes", () => {
    render(<StudentListPage canManageStatus students={[student, reservedStudent]} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Nguyễn Thảo Vy" }));
    expect(screen.getByRole("region", { name: "Đã chọn 1 học sinh" })).toBeInTheDocument();

    const chips = screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" });
    fireEvent.click(within(chips).getByRole("button", { name: /Bảo lưu/ }));

    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
  });

  it("leaves every quick chip unpressed for a status outside the chips", () => {
    navigation.state.params = new URLSearchParams("status=completed");
    render(<StudentListPage students={[student, { ...reservedStudent, lifecycleStatus: "completed" }]} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" });
    for (const chip of within(chips).getAllByRole("button")) {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
  });
});
