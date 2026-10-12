import { createRef, useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import type { StudentDirectoryMetrics } from "@/features/students/student-directory-metrics";

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

const readyMetrics: StudentDirectoryMetrics = {
  attendanceRate: { byStudentId: { "student-1": 71 }, status: "ready" },
  balanceSessions: { byStudentId: { "student-1": -1 }, status: "ready" },
  outstandingVnd: { byStudentId: { "student-1": 2_400_000 }, status: "ready" },
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
    render(<StudentMobileCard directoryQuery="status=active" metrics={readyMetrics} student={student} />);

    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Nguyễn Thảo Vy");
    expect(within(record).getByText("Đang học")).toBeInTheDocument();
    const link = within(record).getByRole("link", { name: "Mở hồ sơ học viên Nguyễn Thảo Vy" });
    expect(link).toHaveAttribute("href", "/students/student-1?status=active");
    // The short link name must not hide the status and guardian from screen readers.
    expect(link).toHaveAccessibleDescription(/Đang học/);
    expect(link).toHaveAccessibleDescription(/Lê Minh/);
    expect(link).toHaveAccessibleDescription(/Chuyên cần 71%/);
    expect(link).toHaveAccessibleDescription(/Số dư −1/);
    expect(link).toHaveAccessibleDescription(/Nợ 2\.400\.000/);
  });

  it("explains blank metric columns instead of showing zero", () => {
    render(
      <StudentMobileCard
        directoryQuery=""
        metrics={{
          attendanceRate: { byStudentId: {}, status: "ready" },
          balanceSessions: { reason: "failed", status: "unavailable" },
          outstandingVnd: { reason: "forbidden", status: "unavailable" },
        }}
        student={student}
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleDescription(/Chưa có buổi điểm danh trong 30 ngày qua/);
    expect(link).toHaveAccessibleDescription(/Không tải được số dư buổi/);
    expect(link).toHaveAccessibleDescription(/Không có quyền xem công nợ/);
    expect(link).not.toHaveAccessibleDescription(/Không nợ|0 ₫/);
  });

  it("renders the three metric columns in the directory table", () => {
    render(<StudentListPage metrics={readyMetrics} students={[student]} />);

    const table = screen.getByRole("table", { name: "Danh sách học sinh" });
    for (const header of ["Chuyên cần", "Số dư buổi", "Công nợ"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const row = within(table).getAllByRole("row")[1];
    expect(row).toHaveTextContent("71%");
    expect(row).toHaveTextContent("−1");
    expect(row).toHaveTextContent(/2\.400\.000\s₫/);
  });

  it("marks every metric unavailable when the page gets no metrics", () => {
    render(<StudentListPage students={[student]} />);

    const row = within(screen.getByRole("table", { name: "Danh sách học sinh" })).getAllByRole("row")[1];
    expect(within(row).getByText("Không có quyền xem điểm danh")).toBeInTheDocument();
    expect(within(row).getByText("Không có quyền xem số dư buổi")).toBeInTheDocument();
    expect(within(row).getByText("Không có quyền xem công nợ")).toBeInTheDocument();
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

  // Value: protects=browser Back/Forward applies the URL's filter and drops the bulk selection; fails_when=the popstate handler stops calling setSelectedIds(new Set()), so a hidden row stays selected and the bulk bar acts on students no longer in view; why_new=selection clearing was only tested for in-page filter changes; seam=none; no_claim=does not prove Next fires popstate on its own router navigation
  it("clears bulk selection when browser history changes the filter", () => {
    render(<StudentListPage canManageStatus students={[student, reservedStudent]} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Nguyễn Thảo Vy" }));
    expect(screen.getByRole("region", { name: "Đã chọn 1 học sinh" })).toBeInTheDocument();

    act(() => {
      window.history.replaceState(null, "", "/students?status=reserved");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" });
    expect(within(chips).getByRole("button", { name: /Bảo lưu/ })).toHaveAttribute("aria-pressed", "true");

    // Going back to the unfiltered list must not resurrect the earlier selection.
    act(() => {
      window.history.replaceState(null, "", "/students");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
  });

  // Generated by /ship test audit pass 3 (Claude Opus 5.5) — 2026-10-13
  // Value: protects=directory URL writes (chip replace, page push) hand Next a null history state so its router stays in sync;
  // fails_when=the page forwards window.history.state (Next's __NA marker) again; why_new=only /classes had this guard,
  // and jsdom's null state hides the bug; seam=none; no_claim=does not run Next's patched history (state getter is stubbed)
  it("never forwards Next's internal history state when writing the directory URL", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      ...student,
      fullName: `Học sinh ${String(index + 1).padStart(2, "0")}`,
      id: `student-many-${index}`,
      publicCode: `HV-1${String(index).padStart(2, "0")}`,
    }));
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const stateGetter = vi.spyOn(window.history, "state", "get").mockReturnValue({ __NA: true });
    try {
      render(<StudentListPage students={many} />);

      const chips = screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" });
      fireEvent.click(within(chips).getByRole("button", { name: /Đang học/ }));
      fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang học sinh" })).getByRole("button", { name: "Sau" }));

      expect(replaceSpy).toHaveBeenCalled();
      expect(pushSpy).toHaveBeenCalled();
      for (const [data] of [...replaceSpy.mock.calls, ...pushSpy.mock.calls]) {
        expect(data).toBeNull();
      }
      expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    } finally {
      stateGetter.mockRestore();
      replaceSpy.mockRestore();
      pushSpy.mockRestore();
    }
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

  // Value: protects=a bulk transition from the directory previews and executes against exactly the selected students under the chip status as source, then clears the selection and refreshes once; fails_when=selectedStudentIds is not passed (the batch hits every student in that status), the chip status is not the source, or success leaves a stale selection/no refresh; why_new=the dialog test renders it standalone and the page test stops at selection; seam=none; no_claim=does not prove the RPC count guard or RLS (actions mocked)
  it("submits the selected students only and clears the selection after a successful transition", async () => {
    navigation.refresh.mockClear();
    vi.mocked(bulkActions.previewBulkStudentStatusTransitionAction).mockClear().mockResolvedValueOnce({ data: { count: 1, sourceStatus: "waiting_class" }, ok: true });
    vi.mocked(bulkActions.executeBulkStudentStatusTransitionAction).mockClear().mockResolvedValueOnce({ data: { affectedCount: 1, sourceStatus: "waiting_class", targetStatus: "interested" }, ok: true } as never);
    const waiting = { ...student, lifecycleStatus: "waiting_class" as const };
    const other = { ...waiting, fullName: "Phạm Quốc Huy", id: "student-3", publicCode: "HV-003" };
    render(<StudentListPage canManageStatus students={[waiting, other]} />);

    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" })).getByRole("button", { name: /Chờ chọn lớp/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Nguyễn Thảo Vy" }));
    const bar = screen.getByRole("region", { name: "Đã chọn 1 học sinh" });
    fireEvent.click(within(bar).getByRole("button", { name: "Chuyển trạng thái…" }));

    fireEvent.click(screen.getByRole("button", { name: "Preview chuyển trạng thái" }));
    expect(bulkActions.previewBulkStudentStatusTransitionAction).toHaveBeenCalledWith({ sourceStatus: "waiting_class", studentIds: ["student-1"] });
    const confirm = await screen.findByRole("button", { name: "Xác nhận chuyển 1 học sinh" });
    fireEvent.change(screen.getByLabelText(/Ghi chú \/ Lý do chuyển/), { target: { value: "Nghỉ hè" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
    expect(bulkActions.executeBulkStudentStatusTransitionAction).toHaveBeenCalledWith(expect.objectContaining({ expectedCount: 1, reason: "Nghỉ hè", sourceStatus: "waiting_class", studentIds: ["student-1"] }));
    expect(screen.queryByRole("region", { name: /Đã chọn/ })).not.toBeInTheDocument();
  });

  // Value: protects=the header checkbox selects exactly the current page, shows indeterminate for a partial page, and feeds the bulk bar; fails_when=select-all misses rows, keeps rows from other pages, or the mixed state is lost; why_new=only single-row checkboxes were driven; seam=none; no_claim=does not prove selections on other pages survive (single page here)
  it("selects every student on the page from the header checkbox and shows a mixed state after one is cleared", () => {
    const other = { ...student, fullName: "Phạm Quốc Huy", id: "student-3", publicCode: "HV-003" };
    render(<StudentListPage canManageStatus students={[student, other]} />);

    const all = screen.getByRole("checkbox", { name: "Chọn tất cả trên trang" }) as HTMLInputElement;
    fireEvent.click(all);
    expect(screen.getByRole("region", { name: "Đã chọn 2 học sinh" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Nguyễn Thảo Vy" }));
    expect(screen.getByRole("region", { name: "Đã chọn 1 học sinh" })).toBeInTheDocument();
    expect(all.indeterminate).toBe(true);

    fireEvent.click(all);
    expect(screen.getByRole("region", { name: "Đã chọn 2 học sinh" })).toBeInTheDocument();
    expect(all.indeterminate).toBe(false);
  });

  // Value: protects=the dialog never previews a status its source select cannot show; fails_when=an enrollment-bound chip (Đang học) seeds the source, so the select reads "Đang quan tâm" while the preview counts active students; why_new=QA finding 001 in ship review cycle 3; seam=none; no_claim=does not prove the RPC rejects active as a source
  it("falls back to a bulk-eligible source when the chip status cannot be bulk-transitioned", () => {
    vi.mocked(bulkActions.previewBulkStudentStatusTransitionAction).mockClear().mockResolvedValueOnce({ data: { count: 0, sourceStatus: "interested" }, ok: true });
    render(<StudentListPage canManageStatus students={[student]} />);

    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" })).getByRole("button", { name: /Đang học/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chuyển trạng thái hàng loạt" }));

    const source = screen.getByLabelText(/Trạng thái hiện tại \(Nguồn\)/) as HTMLSelectElement;
    expect(source.value).toBe("interested");
    expect(Array.from(source.options).map((option) => option.value)).not.toContain("active");
    fireEvent.click(screen.getByRole("button", { name: "Preview chuyển trạng thái" }));
    expect(bulkActions.previewBulkStudentStatusTransitionAction).toHaveBeenCalledWith(expect.objectContaining({ sourceStatus: source.value }));
  });
});
