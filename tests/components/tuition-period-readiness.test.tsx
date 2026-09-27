import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";
vi.mock("@/features/tuition/actions", () => ({ createTuitionPeriodAction: vi.fn(), lockTuitionPeriodAction: vi.fn() }));
afterEach(cleanup);
const period = { id: "period", name: "Khóa mới", startsOn: "2026-08-22", endsOn: "2026-11-06", dueOn: null, status: "draft" as const };
const row = { acquisitionSourceId: "source", blockerCode: "MISSING_EFFECTIVE_TUITION_RATE", classId: "class", classSessionId: "session", enrollmentId: "enrollment", openingBalanceSessions: 0, sessionDate: "2026-08-22", sessionKind: "regular", studentId: "student", unitPriceVnd: null };

describe("tuition readiness", () => {
  it("explains missing rates, affected students and why requests have not been created", () => {
    render(<TuitionPeriodDirectory canLock canManage={false} periods={[period]} previewByPeriod={{ period: [row, { ...row, classSessionId: "second" }] }} systemBlockersByPeriod={{}} />);
    expect(screen.getByText(/1 học viên thiếu đơn giá/)).toBeInTheDocument();
    expect(screen.getByText(/Yêu cầu thanh toán chỉ được tạo sau khi khóa kỳ thành công/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Xem học viên cần bổ sung" })).toHaveAttribute("href", "/finance/tuition-periods/period");
    expect(screen.queryByText(/^0\s*₫$/)).not.toBeInTheDocument();
  });

  it("does not allow an empty period to be locked", () => {
    render(<TuitionPeriodDirectory canLock canManage={false} periods={[period]} previewByPeriod={{ period: [] }} systemBlockersByPeriod={{}} />);
    expect(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" })).toBeDisabled();
    expect(screen.getByText(/Chưa có buổi học đủ điều kiện/)).toBeInTheDocument();
  });
});
