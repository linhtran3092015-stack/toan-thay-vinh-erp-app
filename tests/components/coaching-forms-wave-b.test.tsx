import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoachingResponseList } from "@/features/coaching/components/coaching-response-list";
import { CoachingPublicLinkPanel } from "@/features/coaching/components/coaching-public-link-panel";
import { PublicCoachingForm } from "@/features/coaching/components/public-coaching-form";
import {
  issueCoachingPublicLinkAction,
  revokeCoachingPublicLinkAction,
} from "@/features/coaching/actions/coaching-form-actions";
import { submitPublicCoachingFormAction } from "@/features/coaching/actions/public-coaching-form-actions";

vi.mock("@/features/coaching/actions/public-coaching-form-actions", () => ({
  submitPublicCoachingFormAction: vi.fn(),
}));

vi.mock("@/features/coaching/actions/coaching-form-actions", () => ({
  issueCoachingPublicLinkAction: vi.fn(),
  revokeCoachingPublicLinkAction: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const responses = [
  { id: "00000000-0000-0000-0000-000000000001", coachingRecordId: "record-1", studentId: "student-1", studentName: "Học viên A", formId: "form-1", formName: "Phiếu 1", formVersionId: "version-1", versionNumber: 1, submittedAt: "2026-08-16T01:00:00Z" },
  { id: "00000000-0000-0000-0000-000000000002", coachingRecordId: "record-2", studentId: "student-2", studentName: "Học viên B", formId: "form-2", formName: "Phiếu 2", formVersionId: "version-2", versionNumber: 2, submittedAt: "2026-08-17T01:00:00Z" },
];

describe("Wave B coaching form presentation", () => {
  it("filters the staff response list without exposing answer data in the list", () => {
    render(<CoachingResponseList responses={responses} />);
    expect(screen.getAllByText("Học viên A")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Lọc biểu mẫu"), { target: { value: "Phiếu 2" } });
    expect(screen.queryAllByText("Học viên A")).toHaveLength(1);
    expect(screen.getAllByText("Học viên B")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Xem phản hồi" })).toHaveAttribute("href", "/coaching/responses/00000000-0000-0000-0000-000000000002");
  });

  it("renders all public question types and transitions to a non-repeatable success state", async () => {
    vi.mocked(submitPublicCoachingFormAction).mockResolvedValue({ status: "success", message: "Phiếu Coaching đã được gửi thành công." });
    render(<PublicCoachingForm token={"a".repeat(48)} title="Phiếu Coaching v1" instructions="Hướng dẫn an toàn" questions={[
      { id: "00000000-0000-0000-0000-000000000001", type: "short_text", title: "Ngắn", description: null, required: true, configuration: {} },
      { id: "00000000-0000-0000-0000-000000000002", type: "long_text", title: "Dài", description: null, required: false, configuration: {} },
      { id: "00000000-0000-0000-0000-000000000003", type: "single_choice", title: "Một", description: null, required: true, configuration: { options: ["A", "B"] } },
      { id: "00000000-0000-0000-0000-000000000004", type: "multiple_choice", title: "Nhiều", description: null, required: false, configuration: { options: ["C", "D"] } },
      { id: "00000000-0000-0000-0000-000000000005", type: "scale", title: "Điểm", description: null, required: true, configuration: { min: 1, max: 3 } },
      { id: "00000000-0000-0000-0000-000000000006", type: "number", title: "Số", description: null, required: false, configuration: {} },
    ]} />);
    expect(screen.getByText("Phiếu Coaching v1")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "C" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Có" } });
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi phiếu" }));
    await waitFor(() => expect(submitPublicCoachingFormAction).toHaveBeenCalledOnce());
    expect(screen.getByText("Phiếu Coaching đã được gửi thành công.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi phiếu" })).not.toBeInTheDocument();
  });

  it("shows link history and revokes an active link only with a reason", async () => {
    vi.mocked(revokeCoachingPublicLinkAction).mockResolvedValue({ status: "success", message: "Đã thu hồi liên kết." });
    render(<CoachingPublicLinkPanel coachingRecordId="00000000-0000-4000-8000-000000000001" forms={[{
      formId: "00000000-0000-4000-8000-000000000002",
      name: "Phiếu học kỳ",
      formStatus: "active",
      versionId: "00000000-0000-4000-8000-000000000003",
      versionNumber: 1,
      versionStatus: "published",
      title: "Phiếu học kỳ",
      publishedAt: "2026-08-16T00:00:00.000Z",
      responseCount: 0,
    }]} links={[
      { id: "00000000-0000-4000-8000-000000000004", formVersionId: "00000000-0000-4000-8000-000000000003", formName: "Phiếu học kỳ", versionNumber: 1, status: "active", expiresAt: "2026-08-30T00:00:00.000Z", issuedAt: "2026-08-16T00:00:00.000Z", revokedAt: null, revokeReason: null },
      { id: "00000000-0000-4000-8000-000000000005", formVersionId: "00000000-0000-4000-8000-000000000003", formName: "Phiếu học kỳ", versionNumber: 1, status: "revoked", expiresAt: "2026-08-30T00:00:00.000Z", issuedAt: "2026-08-15T00:00:00.000Z", revokedAt: "2026-08-16T00:00:00.000Z", revokeReason: "Thay liên kết mới" },
    ]} />);

    expect(screen.getByText("Lịch sử liên kết")).toBeInTheDocument();
    expect(screen.getByText(/Đang hoạt động/)).toBeInTheDocument();
    expect(screen.getByText(/Lý do thu hồi: Thay liên kết mới/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    expect(revokeCoachingPublicLinkAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Lý do thu hồi 00000000-0000-4000-8000-000000000004"), { target: { value: "Gửi nhầm" } });
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    await waitFor(() => expect(revokeCoachingPublicLinkAction).toHaveBeenCalledWith({
      coachingRecordId: "00000000-0000-4000-8000-000000000001",
      linkId: "00000000-0000-4000-8000-000000000004",
      reason: "Gửi nhầm",
    }));
  });

  it("requires an expiry before issuing a public link", () => {
    render(<CoachingPublicLinkPanel coachingRecordId="00000000-0000-4000-8000-000000000001" forms={[{
      formId: "00000000-0000-4000-8000-000000000002",
      name: "Phiếu học kỳ",
      formStatus: "active",
      versionId: "00000000-0000-4000-8000-000000000003",
      versionNumber: 1,
      versionStatus: "published",
      title: "Phiếu học kỳ",
      publishedAt: "2026-08-16T00:00:00.000Z",
      responseCount: 0,
    }]} />);
    fireEvent.change(screen.getByLabelText("Hết hạn lúc"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cần chọn thời hạn cho liên kết.");
    expect(issueCoachingPublicLinkAction).not.toHaveBeenCalled();
  });
});
