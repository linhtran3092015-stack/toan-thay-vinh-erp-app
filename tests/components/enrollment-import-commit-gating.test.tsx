// Value: protects="Import Ghi Danh Học Viên" commit step: the commit panel only appears once a staging batch is ready, a rejected batch offers no commit, and the commit action receives the staged batch id (never a fallback id); a successful commit shows how many students became "Đang học";
// fails_when=a hardcoded fallback batch id comes back, the commit panel shows before "Tạo Batch Staging", a rejected batch can be committed, or the activated count disappears from the success banner;
// why_new=enrollment-import-commit-counts.test.tsx only checks the counts in the confirmation phrase with a ready batch; on 2026-10-21 a commit without a staged batch sent a leftover id and showed STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_FOUND;
// seam=none (the real action module is mocked; initialBatch/initialDryRun props stand in for the dry-run and create-batch steps); no_claim=does not prove the RPC activates students (supabase/tests/enrollment-import-commit-activates-students.test.sql does)
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EnrollmentImportPage } from "@/features/imports/enrollments/enrollment-import-page";

const actions = vi.hoisted(() => ({
  commitStudentEnrollmentImportBatchAction: vi.fn(),
  createStudentEnrollmentImportBatchAction: vi.fn(),
  dryRunStudentEnrollmentImportAction: vi.fn(),
}));

vi.mock("@/features/imports/enrollments/actions", () => actions);

const dryRun = {
  academic_year_code: "2026-2027",
  academic_year_id: "ay-2026-2027",
  conflict_count: 0,
  invalid_count: 0,
  matching_count: 0,
  new_count: 10,
  row_count: 10,
  rows: [],
};

const readyBatch = {
  id: "a6733293-9acf-49d9-b550-5625b62f2f5a",
  matching_count: 0,
  new_count: 10,
  row_count: 10,
  status: "ready_to_commit",
};

const commitButtonName = "XÁC NHẬN COMMIT GHI DANH 10 HỌC VIÊN";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EnrollmentImportPage commit gating", () => {
  it("hides the commit step until a staging batch exists", () => {
    render(<EnrollmentImportPage initialDryRun={dryRun} />);

    expect(screen.queryByRole("button", { name: commitButtonName })).not.toBeInTheDocument();
    expect(
      screen.getByText("Bước 2 (commit ghi danh) mở ra sau khi tạo Batch Staging ở trên."),
    ).toBeInTheDocument();
  });

  it("offers no commit for a rejected batch", () => {
    render(
      <EnrollmentImportPage
        initialBatch={{ ...readyBatch, status: "rejected" }}
        initialDryRun={dryRun}
      />,
    );

    expect(screen.queryByRole("button", { name: commitButtonName })).not.toBeInTheDocument();
    expect(screen.getByText(/không commit được/)).toBeInTheDocument();
  });

  it("commits the staged batch id and reports activated students", async () => {
    actions.commitStudentEnrollmentImportBatchAction.mockResolvedValue({
      data: {
        activated_student_count: 10,
        batch_id: readyBatch.id,
        committed_at: "2026-10-21T09:35:26Z",
        committed_new_count: 10,
        reused_matching_count: 0,
        status: "committed",
      },
      success: true,
    });

    render(<EnrollmentImportPage initialBatch={readyBatch} initialDryRun={dryRun} />);

    const commitButton = screen.getByRole("button", { name: commitButtonName });
    expect(commitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Nhập chính xác: GHI DANH 10"), {
      target: { value: "GHI DANH 10" },
    });
    expect(commitButton).toBeEnabled();
    fireEvent.click(commitButton);

    await waitFor(() =>
      expect(actions.commitStudentEnrollmentImportBatchAction).toHaveBeenCalledWith(
        readyBatch.id,
        expect.stringContaining("Commit ghi danh học viên chính thức 2026-2027"),
      ),
    );
    expect(await screen.findByText("Học viên chuyển sang Đang học:")).toBeInTheDocument();
  });
});
