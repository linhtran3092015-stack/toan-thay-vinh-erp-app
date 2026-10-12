import { createRef, useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClassListPage } from "@/features/classes/class-list-page";
import * as bulkActions from "@/features/students/bulk-status-actions";
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

// Generated by /ship test audit pass 2 (Claude Opus 5.5) — 2026-10-12
describe("Directory import entry points and bulk transition submit", () => {
  // Value: protects="Nhập từ file" (/imports/students) and "Nhập lớp từ file" (/imports/classes) render only with the imports permission props; fails_when=a link shows to staff without imports.* or disappears for those with it, or points at the wrong import route; why_new=canImportStudents/canImportClasses are new props and unasserted; seam=none; no_claim=does not prove the route pages map imports.students/imports.classes onto the props or that /imports authorizes
  it("shows the import links only when the user may import", () => {
    const withoutRight = render(<StudentListPage students={[student]} />);
    expect(screen.queryByRole("link", { name: "Nhập từ file" })).not.toBeInTheDocument();
    withoutRight.unmount();

    const withRight = render(<StudentListPage canImportStudents students={[student]} />);
    expect(screen.getByRole("link", { name: "Nhập từ file" })).toHaveAttribute("href", "/imports/students");
    withRight.unmount();

    const classesWithout = render(<ClassListPage canCreateClass={false} classes={[]} />);
    expect(screen.queryByRole("link", { name: "Nhập lớp từ file" })).not.toBeInTheDocument();
    classesWithout.unmount();

    render(<ClassListPage canCreateClass={false} canImportClasses classes={[]} />);
    expect(screen.getByRole("link", { name: "Nhập lớp từ file" })).toHaveAttribute("href", "/imports/classes");
  });

  // Value: protects=a bulk transition from the directory previews and executes against exactly the selected students under the filtered source status, then clears the selection and refreshes once; fails_when=selectedStudentIds is not passed (the batch hits every student in that status), the chip status is not the source, or success leaves a stale selection/no refresh; why_new=the dialog test renders it standalone and the page test stops at selection; seam=none; no_claim=does not prove the RPC count guard or RLS (actions mocked)
  it("submits the selected students only and clears the selection after a successful transition", async () => {
    navigation.refresh.mockClear();
    vi.mocked(bulkActions.previewBulkStudentStatusTransitionAction).mockResolvedValueOnce({ data: { count: 1, sourceStatus: "active" }, ok: true });
    vi.mocked(bulkActions.executeBulkStudentStatusTransitionAction).mockResolvedValueOnce({ data: { affectedCount: 1, sourceStatus: "active", targetStatus: "reserved" }, ok: true } as never);
    const other = { ...student, fullName: "Phạm Quốc Huy", id: "student-3", publicCode: "HV-003" };
    render(<StudentListPage canManageStatus students={[student, other]} />);

    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" })).getByRole("button", { name: /Đang học/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Nguyễn Thảo Vy" }));
    const bar = screen.getByRole("region", { name: "Đã chọn 1 học sinh" });
    fireEvent.click(within(bar).getByRole("button", { name: "Chuyển trạng thái…" }));

    fireEvent.click(screen.getByRole("button", { name: "Preview chuyển trạng thái" }));
    expect(bulkActions.previewBulkStudentStatusTransitionAction).toHaveBeenCalledWith(expect.objectContaining({ studentIds: ["student-1"] }));
    const confirm = await screen.findByRole("button", { name: "Xác nhận chuyển 1 học sinh" });
    fireEvent.change(screen.getByLabelText(/Ghi chú \/ Lý do chuyển/), { target: { value: "Nghỉ hè" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
    expect(bulkActions.executeBulkStudentStatusTransitionAction).toHaveBeenCalledWith(expect.objectContaining({ expectedCount: 1, reason: "Nghỉ hè", studentIds: ["student-1"] }));
    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
    // The page hands the active chip status to the dialog as its source; the selected students are all "active".
    // Last on purpose so every assertion above is verified even while this one fails.
    expect(vi.mocked(bulkActions.previewBulkStudentStatusTransitionAction).mock.calls[0]?.[0]).toEqual({ sourceStatus: "active", studentIds: ["student-1"] });
  });
});
