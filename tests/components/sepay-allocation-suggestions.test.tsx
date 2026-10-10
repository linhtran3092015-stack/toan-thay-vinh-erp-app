import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SepayAllocationSuggestions } from "@/features/finance/components/sepay-allocation-suggestions";
import type { AllocationSuggestion } from "@/features/finance/allocation-suggestions-data";

const mocks = vi.hoisted(() => ({
  allocate: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/finance/manual-allocation-actions", () => ({
  allocateSepayTuitionAction: mocks.allocate,
}));

const suggestions: AllocationSuggestion[] = [
  {
    accountPurpose: "renewal",
    amountVnd: 1_400_000,
    candidateCount: 1,
    candidates: [
      {
        birthYear: 2013,
        candidateRank: 1,
        confidence: "high",
        currentGrade: 7,
        guardianName: "Phụ huynh Phú",
        guardianPhone: "0912345678",
        matchReasons: ["student_name", "birth_year"],
        pendingRequestId: null,
        studentCode: "TV-2026-93001",
        studentId: "f4000000-0000-4000-8000-000000000001",
        studentName: "Phạm Khánh Phú",
        suggestedSessions: 10,
        unitPriceVnd: 140_000,
      },
    ],
    transactionAt: "2026-09-20T03:00:00.000Z",
    transactionId: "f6000000-0000-4000-8000-000000000001",
    transferContent: "MB Pham Khanh Phu 2013 nop hoc phi",
  },
  {
    accountPurpose: "renewal",
    amountVnd: 2_800_000,
    candidateCount: 2,
    candidates: [
      {
        birthYear: 2014,
        candidateRank: 1,
        confidence: "medium",
        currentGrade: 6,
        guardianName: "Phụ huynh Bảo",
        guardianPhone: "0900000003",
        matchReasons: ["student_name"],
        pendingRequestId: null,
        studentCode: "TV-2026-93003",
        studentId: "f4000000-0000-4000-8000-000000000003",
        studentName: "Nguyễn Gia Bảo",
        suggestedSessions: null,
        unitPriceVnd: null,
      },
      {
        birthYear: 2016,
        candidateRank: 2,
        confidence: "medium",
        currentGrade: 4,
        guardianName: "Phụ huynh Bảo",
        guardianPhone: "0900000003",
        matchReasons: ["student_name"],
        pendingRequestId: null,
        studentCode: "TV-2026-93004",
        studentId: "f4000000-0000-4000-8000-000000000004",
        studentName: "Nguyễn Gia Bảo",
        suggestedSessions: null,
        unitPriceVnd: null,
      },
    ],
    transactionAt: "2026-09-22T03:00:00.000Z",
    transactionId: "f6000000-0000-4000-8000-000000000003",
    transferContent: "nguyen gia bao hoc phi",
  },
];

describe("SepayAllocationSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allocate.mockResolvedValue({ data: null, ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders suggestions with confidence and prefilled sessions", () => {
    render(<SepayAllocationSuggestions suggestions={suggestions} />);

    expect(screen.getByText("Gợi ý khớp giao dịch chưa phân bổ")).toBeInTheDocument();
    expect(screen.getByText("Tin cậy cao")).toBeInTheDocument();
    expect(screen.getByText("Cần kiểm tra")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn học sinh")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận 1 dòng tin cậy cao" })).toBeInTheDocument();
    expect((screen.getAllByPlaceholderText("Số buổi")[0] as HTMLInputElement).value).toBe("10");
  });

  it("confirms a row with the full amount, chosen student and edited sessions", async () => {
    render(<SepayAllocationSuggestions suggestions={suggestions} />);

    const sessionsInput = screen.getAllByPlaceholderText("Số buổi")[0];
    fireEvent.change(sessionsInput, { target: { value: "11" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Xác nhận$/ })[0]);

    await waitFor(() => expect(mocks.allocate).toHaveBeenCalledTimes(1));
    expect(mocks.allocate).toHaveBeenCalledWith(
      expect.objectContaining({
        allocations: [
          expect.objectContaining({
            amountVnd: 1_400_000,
            bonusSessions: 0,
            sessions: 11,
            studentId: "f4000000-0000-4000-8000-000000000001",
          }),
        ],
        transactionId: "f6000000-0000-4000-8000-000000000001",
      }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("blocks confirmation when sessions are missing and shows the server message on failure", async () => {
    mocks.allocate.mockResolvedValue({ message: "Học sinh đang có phiếu thu mở.", ok: false });
    render(<SepayAllocationSuggestions suggestions={suggestions} />);

    // Second row has no unit price, so sessions are empty.
    const rowButtons = screen.getAllByRole("button", { name: /^Xác nhận$/ });
    expect(rowButtons).toHaveLength(2);
    fireEvent.click(rowButtons[1]);
    const validation = await screen.findByRole("alert");
    expect(validation.textContent).toContain("Nhập số buổi cộng");
    expect(mocks.allocate).not.toHaveBeenCalled();

    fireEvent.change(screen.getAllByPlaceholderText("Số buổi")[1], { target: { value: "20" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Xác nhận$/ })[1]);
    expect(await screen.findByText("Học sinh đang có phiếu thu mở.")).toBeInTheDocument();
  });
});
