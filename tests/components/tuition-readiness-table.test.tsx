import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TuitionReadinessTable } from "@/features/tuition/tuition-readiness-table";

vi.mock("@/features/tuition/actions", () => ({
  setTuitionPeriodRatesAction: vi.fn().mockResolvedValue({ status: "success", message: "Đã lưu đơn giá thành công." }),
  setTuitionPeriodSourcesAction: vi.fn().mockResolvedValue({ status: "success", message: "Đã lưu nguồn thành công." }),
}));

vi.mock("@/features/tuition/tuition-template-browser", () => ({
  downloadTuitionRateExcel: vi.fn().mockResolvedValue(undefined),
  downloadTuitionSourceExcel: vi.fn().mockResolvedValue(undefined),
}));

afterEach(cleanup);

describe("TuitionReadinessTable", () => {
  const mockStudents = [
    {
      studentId: "s1",
      sessions: 10,
      missingRateFrom: "2026-08-22",
      issues: ["MISSING_EFFECTIVE_TUITION_RATE"],
    },
    {
      studentId: "s2",
      sessions: 8,
      missingRateFrom: null,
      issues: ["MISSING_ACQUISITION_SOURCE"],
    },
    {
      studentId: "s3",
      sessions: 12,
      missingRateFrom: null,
      issues: [],
    },
  ];

  const mockLabels = {
    s1: "Nguyễn Văn A (HV001)",
    s2: "Trần Thị B (HV002)",
    s3: "Lê Minh C (HV003)",
  };

  const mockStudentDetails = {
    s1: { id: "s1", fullName: "Nguyễn Văn A", publicCode: "HV001" },
    s2: { id: "s2", fullName: "Trần Thị B", publicCode: "HV002" },
    s3: { id: "s3", fullName: "Lê Minh C", publicCode: "HV003" },
  };

  const mockLeadSources = [
    { id: "ls1", code: "mma_fanpage", name: "MMA Fanpage" },
  ];

  it("renders students missing rate by default and allows toggling filters", () => {
    render(
      <TuitionReadinessTable
        canManageRates
        canManageSources
        labels={mockLabels}
        leadSources={mockLeadSources}
        periodId="period-123"
        studentDetails={mockStudentDetails}
        students={mockStudents}
      />
    );

    // Default filter is missing_rate (s1 has missing rate)
    expect(screen.getByText("Nguyễn Văn A (HV001)")).toBeInTheDocument();
    expect(screen.queryByText("Trần Thị B (HV002)")).not.toBeInTheDocument();

    // Click filter "Tất cả"
    fireEvent.click(screen.getByRole("button", { name: /Tất cả/ }));
    expect(screen.getByText("Nguyễn Văn A (HV001)")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị B (HV002)")).toBeInTheDocument();
    expect(screen.getByText("Lê Minh C (HV003)")).toBeInTheDocument();
  });

  it("provides Excel template download buttons", () => {
    render(
      <TuitionReadinessTable
        canManageRates
        labels={mockLabels}
        periodId="period-123"
        students={mockStudents}
      />
    );

    expect(screen.getByRole("button", { name: /File mẫu đơn giá/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất 1 học viên thiếu giá/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /File mẫu nguồn/ })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ })).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Đủ dữ liệu (1)" })).toBeInTheDocument();
  });

  it("supports select all missing rates and checkbox toggle", () => {
    render(
      <TuitionReadinessTable
        canManageRates
        labels={mockLabels}
        periodId="period-123"
        students={mockStudents}
      />
    );

    const selectAllBtn = screen.getByRole("button", { name: /Chọn tất cả 1 học viên thiếu giá/ });
    expect(selectAllBtn).toBeInTheDocument();

    fireEvent.click(selectAllBtn);
    expect(screen.getByRole("button", { name: /Lưu đơn giá cho 1 học viên/ })).toBeEnabled();

    // Clear selection
    fireEvent.click(screen.getByRole("button", { name: /Bỏ chọn/ }));
    expect(screen.getByRole("button", { name: /Lưu đơn giá cho 0 học viên/ })).toBeDisabled();
  });
});
