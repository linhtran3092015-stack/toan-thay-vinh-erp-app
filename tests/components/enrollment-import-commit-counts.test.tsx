import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EnrollmentImportPage } from "@/features/imports/enrollments/enrollment-import-page";

afterEach(cleanup);

describe("EnrollmentImportPage commit counts UI", () => {
  it("A. displays dynamic commit count 642 for new_count=642 and matching_count=0", () => {
    const initialBatch = {
      id: "760babca-62d9-4a77-9dd7-9fe8594b03a8",
      status: "ready_to_commit",
      row_count: 642,
      new_count: 642,
      matching_count: 0,
    };

    const initialDryRun = {
      academic_year_id: "ay-2026-2027",
      academic_year_code: "2026-2027",
      conflict_count: 0,
      invalid_count: 0,
      matching_count: 0,
      new_count: 642,
      row_count: 642,
      rows: [],
    };

    const { container } = render(
      <EnrollmentImportPage initialBatch={initialBatch} initialDryRun={initialDryRun} />
    );

    expect(container.textContent).toContain("Ghi danh mới: 642");
    expect(container.textContent).toContain("Dùng lại: 0");

    expect(screen.getByText("GHI DANH 642")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 642 HỌC VIÊN" })
    ).toBeInTheDocument();
  });

  it("B. displays dynamic commit count 620 for new_count=600 and matching_count=20", () => {
    const initialBatch = {
      id: "batch-620",
      status: "ready_to_commit",
      row_count: 620,
      new_count: 600,
      matching_count: 20,
    };

    const initialDryRun = {
      academic_year_id: "ay-2026-2027",
      academic_year_code: "2026-2027",
      conflict_count: 0,
      invalid_count: 0,
      matching_count: 20,
      new_count: 600,
      row_count: 620,
      rows: [],
    };

    const { container } = render(
      <EnrollmentImportPage initialBatch={initialBatch} initialDryRun={initialDryRun} />
    );

    expect(container.textContent).toContain("Ghi danh mới: 600");
    expect(container.textContent).toContain("Dùng lại: 20");

    expect(screen.getByText("GHI DANH 620")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 620 HỌC VIÊN" })
    ).toBeInTheDocument();
  });

  it("C. contains no literal 702 or pilot count 8 in generic UI", () => {
    const initialBatch = {
      id: "760babca-62d9-4a77-9dd7-9fe8594b03a8",
      status: "ready_to_commit",
      row_count: 642,
      new_count: 642,
      matching_count: 0,
    };

    const initialDryRun = {
      academic_year_id: "ay-2026-2027",
      academic_year_code: "2026-2027",
      conflict_count: 0,
      invalid_count: 0,
      matching_count: 0,
      new_count: 642,
      row_count: 642,
      rows: [],
    };

    render(<EnrollmentImportPage initialBatch={initialBatch} initialDryRun={initialDryRun} />);

    expect(screen.queryByText(/702/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pilot/i)).not.toBeInTheDocument();
  });
});
