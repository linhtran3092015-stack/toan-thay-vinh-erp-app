import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentTuitionProfileCard } from "@/features/students/detail/components/student-tuition-profile-card";
import { addStudentTuitionRateAction, correctStudentSourceAction } from "@/features/students/tuition-profile-actions";
import { TuitionBulkPrintControls } from "@/features/tuition/print-controls";

vi.mock("@/features/students/tuition-profile-actions", () => ({
  addStudentTuitionRateAction: vi.fn(),
  correctStudentSourceAction: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const profile = {
  currentRateVnd: 150_000,
  rateHistory: [
    { createdAt: "2026-08-01T00:00:00Z", effectiveFrom: "2026-08-01", reason: "Mức tháng 8", unitPriceVnd: 150_000 },
    { createdAt: "2026-07-01T00:00:00Z", effectiveFrom: "2026-07-01", reason: "Mức cũ", unitPriceVnd: 140_000 },
  ],
  sourceHistory: [{ assignedAt: "2026-08-01T00:00:00Z", reason: "Hiệu chỉnh từ CRM" }],
  sourceName: "Đến trực tiếp trung tâm",
  sources: [{ id: "source-direct", name: "Đến trực tiếp trung tâm" }],
};

describe("Wave A student and print workflows", () => {
  it("shows the current effective rate, rate/source history, and submits versioned corrections with reasons", async () => {
    vi.mocked(addStudentTuitionRateAction).mockResolvedValue({ message: "Đã thêm", ok: true });
    vi.mocked(correctStudentSourceAction).mockResolvedValue({ message: "Đã lưu", ok: true });
    render(<StudentTuitionProfileCard canCorrectSource canManageRates profile={profile} studentId="student-1" />);

    expect(screen.getAllByText("Đến trực tiếp trung tâm")).not.toHaveLength(0);
    expect(screen.getByText((content) => content.includes("Mức tháng 8"))).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Học phí VND/buổi"), { target: { value: "170000" } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="effectiveFrom"]')!, { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByPlaceholderText("Lý do"), { target: { value: "Điều chỉnh tháng 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm mức phí" }));
    await waitFor(() => expect(addStudentTuitionRateAction).toHaveBeenCalledWith("student-1", "2026-10-01", 170000, "Điều chỉnh tháng 10"));

    const sourceSelect = screen.getByRole("combobox");
    fireEvent.change(sourceSelect, { target: { value: "source-direct" } });
    expect(sourceSelect).toHaveValue("source-direct");
    fireEvent.change(screen.getByPlaceholderText("Lý do hiệu chỉnh"), { target: { value: "Chuẩn hóa nguồn" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu nguồn" }).closest("form")!);
    await waitFor(() => expect(correctStudentSourceAction).toHaveBeenCalledWith("student-1", "source-direct", "Chuẩn hóa nguồn"));
  });

  it("does not expose tuition/source mutations without their capability permissions", () => {
    render(<StudentTuitionProfileCard canCorrectSource={false} canManageRates={false} profile={profile} studentId="student-1" />);
    expect(screen.queryByRole("button", { name: "Thêm mức phí" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu nguồn" })).not.toBeInTheDocument();
  });

  it("opens a deterministic print route for selected notices or every locked snapshot in a grade", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TuitionBulkPrintControls notices={[
      { grade: 6, href: "/ignored", id: "00000000-0000-0000-0000-000000000001", name: "An" },
      { grade: 6, href: "/ignored", id: "00000000-0000-0000-0000-000000000002", name: "Bình" },
      { grade: 7, href: "/ignored", id: "00000000-0000-0000-0000-000000000003", name: "Chi" },
    ]} />);
    fireEvent.click(screen.getByLabelText(/An · Khối 6/));
    fireEvent.click(screen.getByRole("button", { name: "In đã chọn / cả khối" }));
    expect(String(open.mock.calls[0][0])).toContain("00000000-0000-0000-0000-000000000001");
    expect(String(open.mock.calls[0][0])).not.toContain("00000000-0000-0000-0000-000000000002");

    fireEvent.change(screen.getByLabelText("In theo khối"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "In đã chọn / cả khối" }));
    expect(String(open.mock.calls[1][0])).toContain("00000000-0000-0000-0000-000000000001");
    expect(String(open.mock.calls[1][0])).toContain("00000000-0000-0000-0000-000000000002");
    expect(String(open.mock.calls[1][0])).not.toContain("00000000-0000-0000-0000-000000000003");
  });

  it("counts payable and no-payment notices, grade options and the print scope", () => {
    render(<TuitionBulkPrintControls notices={[
      { grade: 6, href: "/ignored", id: "00000000-0000-0000-0000-000000000001", name: "An", payableAmountVnd: 1_200_000 },
      { grade: 6, href: "/ignored", id: "00000000-0000-0000-0000-000000000002", name: "Bình", payableAmountVnd: 0 },
      { grade: 7, href: "/ignored", id: "00000000-0000-0000-0000-000000000003", name: "Chi", payableAmountVnd: 900_000 },
      { grade: 0, href: "/ignored", id: "00000000-0000-0000-0000-000000000004", name: "Dũng", payableAmountVnd: 400_000 },
    ]} />);
    // Counts amounts due, not unpaid requests (payment status is not read here).
    expect(screen.getByText("4 phiếu · 3 có số tiền phải nộp · 1 không cần thanh toán")).toBeInTheDocument();
    const grade = screen.getByLabelText("In theo khối");
    expect(Array.from(grade.querySelectorAll("option")).map((option) => [option.value, option.textContent])).toEqual([
      ["", "Chọn khối để in"],
      ["6", "Khối 6 · 2 phiếu"],
      ["7", "Khối 7 · 1 phiếu"],
      ["0", "Chưa rõ khối · 1 phiếu"],
    ]);
    expect(screen.getByText(/^Chưa chọn: in toàn bộ 4 phiếu\. Mở tab in, mỗi phiếu một trang A5\.$/)).toBeInTheDocument();
    expect(screen.getByLabelText("Dũng · Chưa rõ khối")).not.toBeChecked();
    // 44px rows on touch, 40px from md.
    expect(screen.getByLabelText("Dũng · Chưa rõ khối").closest("label")).toHaveClass("min-h-11", "md:min-h-10");

    fireEvent.change(grade, { target: { value: "6" } });
    fireEvent.click(screen.getByLabelText(/Chi · Khối 7/));
    expect(screen.getByText(/^3 phiếu sẽ được in\. Mở tab in, mỗi phiếu một trang A5\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In đã chọn / cả khối" })).not.toHaveClass("bg-action-primary");
  });

  it("leaves the payable counts out when amounts are not known", () => {
    render(<TuitionBulkPrintControls notices={[{ grade: 6, href: "/ignored", id: "00000000-0000-0000-0000-000000000001", name: "An" }]} />);
    expect(screen.getByText(/^1 phiếu$/)).toBeInTheDocument();
    expect(screen.queryByText(/phải nộp|cần thanh toán/)).not.toBeInTheDocument();
  });
});
